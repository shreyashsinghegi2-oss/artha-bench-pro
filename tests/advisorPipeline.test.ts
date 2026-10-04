import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdvisorRouter } from '../server/advisor/routes';
import { auditRecord, newShareId, type AuditStore } from '../server/advisor/audit';
import { computeFeatures } from '../src/advisor/features';
import { runPipeline, type AdvisorAnswer } from '../src/advisor/pipeline';
import type { Fetchers } from '../src/advisor/data-gathering';

function walk(n: number) {
  let s = 3;
  let p = 20000;
  return Array.from({ length: n }, (_, i) => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    p *= 1 + (s / 4294967296 - 0.49) * 0.02;
    return { date: new Date(Date.UTC(2016, 0, 1) + i * 86_400_000).toISOString().slice(0, 10), close: p };
  });
}
const history = computeFeatures(walk(1500));
const fetchers: Partial<Fetchers> = {
  rbi: async () => ({ data: { repo_rate_pct: 5.5, repo_rate_statement: 'MPC', recent: [] }, source: 'RBI', as_of: new Date().toISOString(), reliability: 95 }),
};

describe('runPipeline', () => {
  it('runs every layer in order and reports each', async () => {
    const seen: string[] = [];
    const a = await runPipeline('Should I invest ₹1 lakh in NIFTY index fund for 5 years?', {
      userId: 'u',
      fetchers,
      history: async () => history,
      onLayer: (e) => seen.push(`${e.layer}:${e.status}`),
    });
    expect(seen).toEqual(['parse:done', 'data:done', 'pattern:done', 'math:done', 'profile:skipped', 'explain:failed']);
    expect(a.pattern?.disclaimer).toMatch(/not a prediction/);
    expect(a.math.calculations[0]?.id).toBe('lump_sum');
    expect(a.explanation.mode).toBe('raw');
    expect(a.explanation.text).toContain('₹1,61,051');
  });

  it('skips the pattern layer for non-market questions and survives a failing history', async () => {
    const tax = await runPipeline('Tax on 12 lakh salary?', { userId: 'u', fetchers, history: async () => history });
    expect(tax.layers.find((l) => l.layer === 'pattern')?.status).toBe('skipped');
    const broken = await runPipeline('Is NIFTY cheap now?', {
      userId: 'u',
      fetchers,
      history: async () => {
        throw new Error('no data');
      },
    });
    expect(broken.layers.find((l) => l.layer === 'pattern')).toMatchObject({ status: 'failed', note: 'no data' });
    expect(broken.pattern).toBeNull();
  });

  it('uses the AI explanation when its numbers trace', async () => {
    const a = await runPipeline('EMI on home loan of 40 lakh for 20 years', {
      userId: 'u',
      fetchers,
      llm: async () => 'At the assumed 8.5%, your EMI is ₹34,712.93 a month.',
    });
    expect(a.explanation.mode).toBe('ai');
  });
});

describe('audit helpers', () => {
  it('share ids are url-safe and 16 chars', () => {
    expect(newShareId()).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });
});

describe('POST /api/advisor/ask, share, shared', () => {
  let server: http.Server;
  let base = '';
  const saved: AdvisorAnswer[] = [];
  const store: AuditStore = {
    save: async (_t, a) => {
      saved.push(a);
      return { id: '11111111-1111-4111-8111-111111111111', share_id: 'abcdefghijklmnop' };
    },
    share: async (_t, id) => (id === '11111111-1111-4111-8111-111111111111' ? 'abcdefghijklmnop' : null),
    getShared: async (sid) => (sid === 'abcdefghijklmnop' ? { question: 'q', created_at: 'now', answer: {} } : null),
  };
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      '/api/advisor',
      createAdvisorRouter({
        ai: () => undefined,
        llm: () => undefined,
        fetchers,
        history: async () => history,
        audit: store,
        resolveUser: async (req) => (req.header('authorization') === 'Bearer good' ? 'user-42' : null),
      }),
    );
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/advisor`;
  });
  afterAll(() => server.close());

  const ask = (body: unknown, auth?: string) =>
    fetch(`${base}/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
      body: JSON.stringify(body),
    });

  it('streams one line per layer then the answer; stores it for signed-in users without raw profile values', async () => {
    const res = await ask(
      { question: 'SIP of ₹5,000 per month for 10 years', profile: { age: 30, monthly_expenses: 40000, liquid_savings: 300000 } },
      'Bearer good',
    );
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    const lines = (await res.text())
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(lines.filter((l) => l.type === 'layer')).toHaveLength(6);
    const final = lines.at(-1);
    expect(final.type).toBe('answer');
    expect(final.audit.share_id).toBe('abcdefghijklmnop');
    expect(final.answer.profile.available).toBe(true);
    expect(auditRecord(saved[0]!).context.profile.data).toBeNull();
  });

  it('does not store anonymous answers and validates input', async () => {
    const before = saved.length;
    const lines = (await (await ask({ question: 'What is an FD?' })).text())
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(lines.at(-1).audit).toBeNull();
    expect(lines.at(-1).audit_note).toMatch(/Sign in/);
    expect(saved.length).toBe(before);
    expect((await ask({ question: 'x' })).status).toBe(400);
    expect((await ask({ question: 'valid question', profile: { age: 'thirty' } })).status).toBe(400);
    expect((await ask({ question: 'valid question', profile: { password: 'x' } })).status).toBe(400);
  });

  it('share requires sign-in and a valid id; shared lookups validate the id', async () => {
    const share = (body: unknown, auth?: string) =>
      fetch(`${base}/share`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
        body: JSON.stringify(body),
      });
    expect((await share({ id: '11111111-1111-4111-8111-111111111111' })).status).toBe(401);
    expect((await share({ id: 'nope' }, 'Bearer good')).status).toBe(400);
    expect(await (await share({ id: '11111111-1111-4111-8111-111111111111' }, 'Bearer good')).json()).toEqual({ share_id: 'abcdefghijklmnop' });
    expect((await fetch(`${base}/shared/abcdefghijklmnop`)).status).toBe(200);
    expect((await fetch(`${base}/shared/zzzzzzzzzzzzzzzz`)).status).toBe(404);
    expect((await fetch(`${base}/shared/bad!`)).status).toBe(400);
  });
});
