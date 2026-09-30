import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { detectLanguage, extractAmounts, extractHorizon, fingerprint, mergeAi, parseDeterministic, parseQuery } from '../src/advisor/query-parser';
import type { AiExtractor } from '../src/advisor/types';
import { createGroqExtractor, PARSER_SYSTEM_PROMPT } from '../server/advisor/groq-extractor';
import { createAdvisorRouter } from '../server/advisor/routes';

const NOW = new Date('2026-09-30T06:00:00Z');
const rules = (q: string) => parseDeterministic(q, NOW);

describe('deterministic parse: real questions', () => {
  it('SIP or FD with a lump sum and horizon', () => {
    const r = rules('Should I invest ₹5 lakh in SIP or FD for 10 years?');
    expect(r.intent).toBe('COMPARE');
    expect(r.entities).toEqual(expect.arrayContaining(['SIP', 'FD']));
    expect(r.amounts).toMatchObject([{ value: 500000, currency: 'INR', type: 'lump_sum' }]);
    expect(r.time_horizon).toBe('10y');
    expect(r.is_time_sensitive).toBe(false);
  });

  it('EMI calculation with Indian formats', () => {
    const r = rules('What is the EMI on a 50L home loan at 8.5% for 20 years?');
    expect(r.intent).toBe('CALCULATE');
    expect(r.entities).toEqual(expect.arrayContaining(['EMI', 'HOME_LOAN']));
    expect(r.amounts.map((a) => a.value)).toEqual([5000000]);
    expect(r.time_horizon).toBe('20y');
  });

  it('monthly SIP amount and a target corpus', () => {
    const r = rules('How much SIP per month do I need to build a corpus of 1.2 crore by 2036?');
    expect(r.intent).toBe('PLAN');
    expect(r.amounts).toMatchObject([{ value: 12000000, type: 'target' }]);
    expect(r.time_horizon).toBe('10y');
  });

  it('SIP of 15k per month', () => {
    const r = rules('If I do a SIP of 15k per month for 7 years at 12%, what will I get?');
    expect(r.amounts).toMatchObject([{ value: 15000, type: 'monthly' }]);
    expect(r.intent).toBe('CALCULATE');
    expect(r.time_horizon).toBe('7y');
  });

  it('salary is income, rent is an expense; percentages and ages are not amounts', () => {
    const r = rules('I am 30, my salary is ₹1,20,000 per month and rent is 25000. I save 20% — how should I plan retirement at 60?');
    expect(r.amounts).toMatchObject([
      { value: 120000, type: 'income' },
      { value: 25000, type: 'expense' },
    ]);
    expect(r.time_horizon).toBe('30y');
    expect(r.intent).toBe('PLAN');
  });

  it('CTC in LPA', () => {
    const r = rules('Tax on 18 LPA in new regime?');
    expect(r.entities).toEqual(expect.arrayContaining(['INCOME_TAX']));
    expect(r.amounts).toEqual([]);
    const s = rules('My CTC is 18,00,000. How much income tax in the new regime?');
    expect(s.amounts).toMatchObject([{ value: 1800000, type: 'income' }]);
    expect(s.intent).toBe('CALCULATE');
  });

  it('section numbers, years and small counts are not money', () => {
    const r = rules('Explain section 80C and 80D limits for FY 2026 and my top 3 options');
    expect(r.amounts).toEqual([]);
    expect(r.entities).toEqual(expect.arrayContaining(['80C', '80D']));
    expect(r.intent).toBe('EXPLAIN');
  });

  it('USD amounts', () => {
    expect(extractAmounts('I have $25,000 to invest in the S&P 500')).toMatchObject([{ value: 25000, currency: 'USD', type: 'lump_sum' }]);
  });

  it('time-sensitive market questions', () => {
    const r = rules('Why did NIFTY fall today?');
    expect(r.is_time_sensitive).toBe(true);
    expect(r.entities).toContain('NIFTY');
    expect(r.intent).toBe('EXPLAIN');
    expect(rules('Is now a good time to buy gold?').is_time_sensitive).toBe(true);
    expect(rules('I have 5 lakh now, what is an FD?').is_time_sensitive).toBe(false);
  });

  it('alerts', () => {
    const r = rules('Alert me when NIFTY crosses 25000');
    expect(r.intent).toBe('ALERT');
    expect(r.entities).toContain('NIFTY');
  });

  it('BANKNIFTY is not NIFTY; PPF is not EPF', () => {
    expect(rules('bank nifty outlook').entities).toEqual(['BANKNIFTY']);
    expect(rules('public provident fund returns').entities).toEqual(['PPF']);
  });

  it('Hinglish', () => {
    const r = rules('5 lakh ka SIP karu ya FD mein daalu? 10 saal ke liye');
    expect(r.language).toBe('hinglish');
    expect(r.intent).toBe('COMPARE');
    expect(r.amounts.map((a) => a.value)).toEqual([500000]);
    expect(r.time_horizon).toBe('10y');
  });

  it('Hindi', () => {
    const r = rules('मुझे 10 लाख का होम लोन चाहिए, EMI कितना होगा 15 साल के लिए?');
    expect(r.language).toBe('hi');
    expect(r.amounts.map((a) => a.value)).toEqual([1000000]);
    expect(r.entities).toEqual(expect.arrayContaining(['HOME_LOAN', 'EMI']));
    expect(r.time_horizon).toBe('15y');
    expect(r.intent).toBe('CALCULATE');
  });

  it('horizons in months and from a target year', () => {
    expect(extractHorizon('park money for 6 months', NOW)).toBe('6m');
    expect(extractHorizon('save for 24 months', NOW)).toBe('2y');
    expect(extractHorizon('buy a house by 2030', NOW)).toBe('4y');
    expect(extractHorizon('what is a mutual fund', NOW)).toBeNull();
  });

  it('language detection', () => {
    expect(detectLanguage('What is CAGR?')).toBe('en');
  });
});

describe('AI merge: the AI can label, never invent', () => {
  const q = 'Should I invest ₹5 lakh in SIP or FD for 10 years?';

  it('uses the AI intent and vocabulary entities, drops unknown entities', () => {
    const m = mergeAi(rules(q), { intent: 'compare', entities: ['SIP', 'fd', 'Unicorn Fund', 'mutual fund'] }, q);
    expect(m.intent).toBe('COMPARE');
    expect(m.entities).toEqual(expect.arrayContaining(['SIP', 'FD', 'MUTUAL_FUND']));
    expect(m.corrections.join(' ')).toMatch(/Unicorn Fund/);
  });

  it('drops an AI amount that is not in the question', () => {
    const m = mergeAi(
      rules(q),
      {
        amounts: [
          { value: 500000, type: 'lump_sum' },
          { value: 900000, type: 'target' },
        ],
      },
      q,
    );
    expect(m.amounts.map((a) => a.value)).toEqual([500000]);
    expect(m.corrections.join(' ')).toMatch(/900000/);
  });

  it('may relabel only a guessed amount type', () => {
    const guessed = 'I have 3,00,000. Where should it go?';
    const m = mergeAi(rules(guessed), { amounts: [{ value: 300000, type: 'lump_sum' }] }, guessed);
    expect(m.amounts[0]?.type).toBe('lump_sum');
    const explicit = 'SIP of 10000 per month';
    const n = mergeAi(rules(explicit), { amounts: [{ value: 10000, type: 'lump_sum' }] }, explicit);
    expect(n.amounts[0]?.type).toBe('monthly');
  });

  it('accepts an AI horizon only if its number is in the question', () => {
    const text = 'retirement plan, I have 20 working years left';
    const r = { ...rules(text), time_horizon: null };
    expect(mergeAi(r, { time_horizon: '20y' }, text).time_horizon).toBe('20y');
    const invented = mergeAi(r, { time_horizon: '25y' }, text);
    expect(invented.time_horizon).toBeNull();
    expect(invented.corrections.join(' ')).toMatch(/25y/);
  });

  it('rejects an unknown intent', () => {
    const m = mergeAi(rules(q), { intent: 'BUY_NOW' }, q);
    expect(m.intent).toBe('COMPARE');
    expect(m.corrections[0]).toMatch(/BUY_NOW/);
  });
});

describe('parseQuery', () => {
  it('falls back to rules when the AI throws, times out or returns junk', async () => {
    const q = 'EMI on 10 lakh at 9% for 5 years';
    const throwing: AiExtractor = async () => {
      throw new Error('boom');
    };
    const slow: AiExtractor = () => new Promise((r) => setTimeout(() => r({ intent: 'EXPLAIN' }), 500));
    const junk = (async () => 'not an object') as unknown as AiExtractor;
    for (const [ai, err] of [
      [throwing, /boom/],
      [slow, /timed out/],
      [junk, /no structure/],
    ] as const) {
      const r = await parseQuery(q, { ai, aiTimeoutMs: 50, now: NOW });
      expect(r.meta.method).toBe('rules');
      expect(r.meta.ai_error).toMatch(err);
      expect(r.parsed.intent).toBe('CALCULATE');
      expect(r.parsed.amounts[0]?.value).toBe(1000000);
    }
  });

  it('merges a good AI result and keeps the audit trail', async () => {
    const ai: AiExtractor = async () => ({
      intent: 'CALCULATE',
      entities: ['EMI', 'PERSONAL_LOAN'],
      amounts: [{ value: 1000000, type: 'lump_sum' }],
      is_time_sensitive: false,
    });
    const r = await parseQuery('EMI on 10 lakh personal loan at 12% for 5 years', { ai, userId: 'u-1', now: NOW });
    expect(r.meta.method).toBe('ai+rules');
    expect(r.meta.rules_intent).toBe('CALCULATE');
    expect(r.parsed).toMatchObject({ intent: 'CALCULATE', user_id: 'u-1', time_horizon: '5y' });
    expect(r.parsed.amounts[0]).toEqual({ value: 1000000, currency: 'INR', type: expect.any(String), raw: '10 lakh' });
  });

  it('is_novel comes from the cache lookup by fingerprint', async () => {
    const seen = new Set<string>();
    const first = await parseQuery('What is CAGR?', { hasCachedAnswer: (fp) => seen.has(fp) });
    expect(first.parsed.is_novel).toBe(true);
    seen.add(first.meta.fingerprint);
    const again = await parseQuery('  what is   CAGR? ', { hasCachedAnswer: (fp) => seen.has(fp) });
    expect(again.parsed.is_novel).toBe(false);
    const broken = await parseQuery('What is CAGR?', { hasCachedAnswer: () => Promise.reject(new Error('cache down')) });
    expect(broken.parsed.is_novel).toBe(true);
  });

  it('fingerprint changes when the numbers change', () => {
    expect(fingerprint('emi on x', [{ value: 1, currency: 'INR', type: 'lump_sum', raw: '1' }], null)).not.toBe(
      fingerprint('emi on x', [{ value: 2, currency: 'INR', type: 'lump_sum', raw: '2' }], null),
    );
  });

  it('strips control characters and caps length', async () => {
    const r = await parseQuery(`What is\u0000 an FD?${'x'.repeat(5000)}`);
    expect(r.parsed.entities).toContain('FD');
  });
});

describe('Groq extractor', () => {
  it('is disabled without a key', () => {
    expect(createGroqExtractor({ apiKey: '' })).toBeUndefined();
  });

  it('sends a structure-only JSON-mode request and parses the reply', async () => {
    let sent: { model?: string; response_format?: { type: string }; temperature?: number; messages?: Array<{ content: string }> } = {};
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"intent":"EXPLAIN","entities":["NIFTY"]}' } }] }));
    }) as typeof fetch;
    const ai = createGroqExtractor({ apiKey: 'k', fetchImpl });
    expect(ai).toBeDefined();
    const out = await ai?.('Why did NIFTY fall today?');
    expect(out).toEqual({ intent: 'EXPLAIN', entities: ['NIFTY'] });
    expect(sent.response_format).toEqual({ type: 'json_object' });
    expect(sent.temperature).toBe(0);
    expect(sent.model).toBe('llama-3.1-8b-instant');
    expect(PARSER_SYSTEM_PROMPT).toMatch(/NEVER answer/);
  });

  it('throws on HTTP errors so the parser falls back', async () => {
    const ai = createGroqExtractor({ apiKey: 'k', fetchImpl: (async () => new Response('{}', { status: 429 })) as typeof fetch });
    await expect(ai?.('x')).rejects.toThrow(/429/);
  });
});

describe('POST /api/advisor/parse', () => {
  let server: http.Server;
  let base = '';
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      '/api/advisor',
      createAdvisorRouter({ ai: () => undefined, resolveUser: async (req) => (req.header('authorization') === 'Bearer good' ? 'user-42' : null) }),
    );
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/advisor`;
  });
  afterAll(() => server.close());

  const post = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}/parse`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

  it('parses with rules when Groq is not configured; user_id from the verified token only', async () => {
    const res = await post({ question: 'SIP or FD for 5 lakh?', user_id: 'spoofed' }, { authorization: 'Bearer good' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.parsed.user_id).toBe('user-42');
    expect(body.meta.method).toBe('rules');
    expect(body.parsed.intent).toBe('COMPARE');
    const anon = await (await post({ question: 'What is an FD?' })).json();
    expect(anon.parsed.user_id).toBe('anonymous');
  });

  it('rejects empty questions', async () => {
    expect((await post({ question: ' ' })).status).toBe(400);
    expect((await post({})).status).toBe(400);
  });
});
