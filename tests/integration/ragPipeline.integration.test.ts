/**
 * Full RAG pipeline across the language boundary: start the Python sidecar, ingest documents,
 * retrieve through the TypeScript client, then check citations. Skipped when python3 is unavailable.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RagEngine, extractCitations } from '../../rag/rag_engine';

const hasPython = spawnSync('python3', ['-c', 'import numpy'], { stdio: 'ignore' }).status === 0;
const PORT = 18765 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
let proc: ChildProcess | undefined;

async function waitForHealth(ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('sidecar did not start');
}

async function ingest(text: string, source: string) {
  const res = await fetch(`${BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    body: JSON.stringify({ text, source }),
  });
  return { status: res.status, body: await res.json() };
}

describe.skipIf(!hasPython)('RAG pipeline: ingest → embed → retrieve → cite', () => {
  beforeAll(async () => {
    proc = spawn('python3', ['-m', 'rag.server', '--port', String(PORT)], {
      env: { ...process.env, RAG_ADMIN_TOKEN: 'test-token', RAG_EMBEDDER: 'hashing', DATABASE_URL: '', RAG_STORE_PATH: '' },
      stdio: 'ignore',
    });
    await waitForHealth();
  }, 20000);
  afterAll(() => {
    proc?.kill();
  });

  it('ingests, retrieves the right authority and resolves citations', async () => {
    expect(
      (
        await ingest(
          'Central Board of Direct Taxes notification dated 1 April 2026. Section 87A rebate: up to Rs 60,000 for taxable income up to Rs 12,00,000 under the new regime.',
          'cbdt.pdf',
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await ingest(
          'Securities and Exchange Board of India circular dated 12 March 2026. Total expense ratio of a direct plan is lower than the regular plan.',
          'sebi.pdf',
        )
      ).status,
    ).toBe(200);
    const again = await ingest(
      'Securities and Exchange Board of India circular dated 12 March 2026. Total expense ratio of a direct plan is lower than the regular plan.',
      'sebi.pdf',
    );
    expect(again.body.skipped).toBe(true);

    const engine = new RagEngine({ baseUrl: BASE, timeoutMs: 5000 });
    const r = await engine.retrieve('What is the 87A rebate under the new regime?', { topK: 2 });
    expect(r.ok).toBe(true);
    expect(r.passages[0].authority).toBe('CBDT');
    expect(r.passages[0].date).toBe('2026-04-01');
    expect(r.context).toContain('[1] CBDT');

    const filtered = await engine.retrieve('expense ratio', { authority: 'SEBI' });
    expect(filtered.passages.every((p) => p.authority === 'SEBI')).toBe(true);

    const cites = extractCitations('The rebate is up to Rs 60,000 [1].', r.passages);
    expect(cites.cited[0].source).toBe('cbdt.pdf');
    expect(await engine.health()).toBe(true);
  });

  it('rejects ingestion without the admin token', async () => {
    const res = await fetch(`${BASE}/ingest`, { method: 'POST', body: JSON.stringify({ text: 'x', source: 'x' }) });
    expect(res.status).toBe(401);
  });
});
