import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimitsForTests, v1Router, FREE_LIMIT_PER_MIN } from '../server/v1/router';
import { aiReliability, cfoBrief, numbersIn, runBenchmark, scoreAnswer } from '../server/v1/ai';
import { hashKey, newApiKey, verifyApiKey } from '../server/v1/auth';
import { CALCULATORS } from '../server/v1/calculators';
import { freshnessPenalty, marketReliability } from '../server/v1/envelope';
import { fiiDiiFlows, nseDateToIso, parseNseFlows, resetMarketCachesForTests, sectorRotation, NSE_SECTORS } from '../server/v1/market';
import { cronAuthorized, evaluate, signPayload, type WebhookRow } from '../server/v1/webhooks';
import { sipFutureValue } from '../src/services/calculators';
import type { NormalizedMarketQuote } from '../src/types';

let server: http.Server;
let base = '';

beforeAll(async () => {
  const app = express();
  app.use('/api/v1', v1Router);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});
afterAll(() => server.close());
beforeEach(() => resetRateLimitsForTests());
afterEach(() => {
  vi.unstubAllEnvs();
  resetMarketCachesForTests();
});

async function get(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}${path}`, { headers });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, body, headers: res.headers };
}

const calc = async (slug: string, query: string) => {
  const r = await get(`/calculators/${slug}?${query}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body;
};

describe('envelope and headers', () => {
  it('wraps results in { data, source, timestamp, reliability_score, is_deterministic } with open CORS and 60 s caching', async () => {
    const r = await get('/calculators/emi?principal=1000000&rate=8.5&months=240');
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(['data', 'is_deterministic', 'reliability_score', 'source', 'timestamp']);
    expect(r.body.is_deterministic).toBe(true);
    expect(r.body.reliability_score).toBe(100);
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
    expect(r.headers.get('cache-control')).toContain('s-maxage=60');
    expect(r.headers.get('x-ratelimit-limit')).toBe(String(FREE_LIMIT_PER_MIN));
  });

  it('answers CORS preflight', async () => {
    const res = await fetch(`${base}/calculators/emi`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-headers')).toMatch(/x-api-key/i);
  });

  it('lists every calculator with its parameters', async () => {
    const r = await get('/calculators');
    expect(r.body.data.map((c: { slug: string }) => c.slug)).toEqual(CALCULATORS.map((c) => c.slug));
    expect(r.body.data.length).toBeGreaterThanOrEqual(19);
  });
});

describe('calculators', () => {
  it('EMI: ₹10,00,000 at 8.5% for 240 months', async () => {
    const b = await calc('emi', 'principal=10,00,000&rate=8.5&months=240');
    expect(b.data.emi).toBe(8678.23);
    expect(b.data.total_payment).toBe(2082775.2);
    expect(b.data.total_interest).toBe(1082775.2);
  });

  it('compound interest: ₹1,00,000 at 7% for 10 years, yearly', async () => {
    const b = await calc('compound-interest', 'principal=100000&rate=7&years=10');
    expect(b.data.final_amount).toBe(196715.14);
    expect(b.data.interest).toBe(96715.14);
  });

  it('break-even and its impossible case', async () => {
    const b = await calc('break-even', 'fixed_cost=500000&price=250&variable_cost=150');
    expect(b.data.units).toBe(5000);
    expect(b.data.revenue).toBe(1250000);
    const bad = await get('/calculators/break-even?fixed_cost=1000&price=100&variable_cost=100');
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('not_calculable');
  });

  it('SIP matches the app’s SIP formula', async () => {
    const b = await calc('sip', 'amount=10000&rate=12&years=15');
    expect(b.data.future_value).toBeCloseTo(sipFutureValue(10000, 0.12, 180), 2);
    expect(b.data.invested).toBe(1800000);
  });

  it('PPF: default scheme rate lowers reliability to 90; a caller rate gives 100', async () => {
    const d = await calc('ppf', 'contribution=150000');
    expect(d.reliability_score).toBe(90);
    expect(d.data.invested).toBe(2250000);
    const e = await calc('ppf', 'contribution=150000&rate=7.1');
    expect(e.reliability_score).toBe(100);
    expect(e.data.maturity).toBe(d.data.maturity);
  });

  it('EPF: contribution split at the ₹15,000 wage ceiling (0% interest)', async () => {
    const b = await calc('epf', 'salary=15000&years=1&rate=0');
    expect(b.data.employee_contribution).toBe(21600);
    expect(b.data.eps_contribution).toBe(14994);
    expect(b.data.employer_contribution_epf).toBe(6606);
    expect(b.data.corpus).toBe(28206);
  });

  it('SSY: girl child only', async () => {
    const b = await calc('ssy', 'deposit=150000&gender=girl&rate=8.2');
    expect(b.data.invested).toBe(2250000);
    expect(b.data.maturity).toBeGreaterThan(b.data.invested);
    const boy = await get('/calculators/ssy?deposit=150000&gender=boy');
    expect(boy.status).toBe(422);
  });

  it('NPS until 60', async () => {
    const b = await calc('nps', 'contribution=5000&age=30&rate=10&annuity_rate=6');
    expect(b.data.years).toBe(30);
    expect(b.data.lumpsum + b.data.annuity_purchase).toBeCloseTo(b.data.corpus, 1);
    expect(b.data.monthly_pension).toBeCloseTo((b.data.annuity_purchase * 0.06) / 12, 1);
  });

  it('GST inclusive and exclusive', async () => {
    const inc = await calc('gst', 'price=1180&gst_rate=18&mode=inclusive');
    expect(inc.data).toMatchObject({ base_price: 1000, gst: 180, total: 1180, cgst: 90, sgst: 90, igst: 0 });
    const ex = await calc('gst', 'price=1000&gst_rate=18&supply=inter');
    expect(ex.data).toMatchObject({ gst: 180, igst: 180, cgst: 0 });
  });

  it('HRA: least of the three limits', async () => {
    const b = await calc('hra', 'basic=50000&rent=20000&city_type=metro&hra_received=25000');
    expect(b.data.exempt_monthly).toBe(15000);
    expect(b.data.taxable_hra_monthly).toBe(10000);
  });

  it('LTCG and STCG at the post-July-2024 rates', async () => {
    const l = await calc('ltcg', 'purchase=500000&sale=800000&holding_period=18');
    expect(l.data).toMatchObject({ type: 'long-term', taxable_gain: 175000, tax: 21875, total_tax: 22750 });
    const s = await calc('stcg', 'purchase=200000&sale=260000');
    expect(s.data).toMatchObject({ tax: 12000, total_tax: 12480 });
    const short = await calc('ltcg', 'purchase=100&sale=200&holding_period=6');
    expect(short.data.type).toBe('short-term');
  });

  it('80C saves tax only in the old regime', async () => {
    const b = await calc('80c', 'income=1200000&investments=150000');
    expect(b.data.eligible_deduction).toBe(150000);
    expect(b.data.tax_saved).toBeGreaterThan(0);
    expect(b.data.old_regime_tax_with).toBeLessThan(b.data.old_regime_tax_without);
  });

  it('rejects missing and invalid parameters with details', async () => {
    const r = await get('/calculators/emi?principal=abc&rate=200');
    expect(r.status).toBe(400);
    expect(r.body.error.details).toMatchObject({ principal: 'must be a number', rate: 'must be between 0 and 100', months: 'is required' });
  });

  it('404s unknown calculators and paths as JSON', async () => {
    expect((await get('/calculators/nope')).status).toBe(404);
    const r = await get('/nothing-here');
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('not_found');
  });
});

describe('tax engines (hand-computed from published slabs)', () => {
  it('India new regime: ₹12,75,000 salary is tax-free after the 87A rebate', async () => {
    const b = await calc('tax-india', 'income=1275000');
    expect(b.data.tax).toBe(0);
  });

  it('India new regime: ₹15,00,000 salary → ₹97,500 including cess', async () => {
    const b = await calc('tax-india', 'income=1500000');
    expect(b.data.taxable_income).toBe(1425000);
    expect(b.data.tax).toBe(97500);
    expect(b.data.marginal_rate).toBeCloseTo(0.156, 3);
    expect(b.data.slab_breakdown.at(-1)).toMatchObject({ rate: 0.15, taxable_amount: 225000 });
  });

  it('US single $100,000 → $13,170', async () => {
    const b = await calc('tax-us', 'income=100000&filing_status=single&state=ca');
    expect(b.data.taxable_income).toBe(83900);
    expect(b.data.tax).toBe(13170);
    expect(b.data.marginal_rate).toBe(0.22);
    expect(b.data.notes.join(' ')).toMatch(/State tax for CA is not included/);
  });

  it('UK £60,000 → £11,432; £110,000 shows the 60% allowance-taper marginal rate', async () => {
    const a = await calc('tax-uk', 'income=60000');
    expect(a.data.tax).toBe(11432);
    const b = await calc('tax-uk', 'income=110000');
    expect(b.data.tax).toBe(33432);
    expect(b.data.marginal_rate).toBe(0.6);
  });

  it('Philippines ₱1,000,000 → ₱152,500', async () => {
    expect((await calc('tax-philippines', 'income=1000000')).data.tax).toBe(152500);
  });

  it('Nigeria ₦5,000,000 → ₦690,000', async () => {
    expect((await calc('tax-nigeria', 'income=5000000')).data.tax).toBe(690000);
  });

  it('Kenya KSh 1,200,000 → KSh 268,600 after personal relief', async () => {
    const b = await calc('tax-kenya', 'income=1200000');
    expect(b.data.tax).toBe(268600);
    expect(b.data.credits_applied[0]).toMatchObject({ amount: 28800 });
  });

  it('refuses years without rules', async () => {
    const r = await get('/calculators/tax-uk?income=50000&year=2019');
    expect(r.status).toBe(400);
  });
});

describe('API keys and rate limits', () => {
  it('free tier: 100 a minute per IP, then 429 with Retry-After', async () => {
    for (let i = 0; i < FREE_LIMIT_PER_MIN; i += 1) await get('/calculators/gst?price=1&gst_rate=5');
    const r = await get('/calculators/gst?price=1&gst_rate=5');
    expect(r.status).toBe(429);
    expect(r.headers.get('retry-after')).toBeTruthy();
  });

  it('a valid key gets the 1000/minute tier; a wrong key is rejected', async () => {
    const { key, hash } = newApiKey();
    vi.stubEnv('API_V1_KEY_HASHES', `${'0'.repeat(64)},${hash}`);
    expect(verifyApiKey(key)).toBe(hash.slice(0, 12));
    const ok = await get('/calculators/gst?price=1&gst_rate=5', { 'x-api-key': key });
    expect(ok.headers.get('x-ratelimit-limit')).toBe('1000');
    const bad = await get('/calculators/gst?price=1&gst_rate=5', { 'x-api-key': 'ab_live_wrong' });
    expect(bad.status).toBe(401);
    expect(hashKey(key)).toBe(hash);
  });

  it('AI endpoints need a key; with one, the body is validated', async () => {
    const noKey = await fetch(`${base}/ai/cfo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(noKey.status).toBe(401);
    const { key, hash } = newApiKey();
    vi.stubEnv('API_V1_KEY_HASHES', hash);
    const bad = await fetch(`${base}/ai/benchmark`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ items: [] }),
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe('invalid_body');
  });
});

describe('docs', () => {
  it('serves an OpenAPI 3.1 spec covering every calculator, and Swagger UI', async () => {
    const spec = (await get('/openapi.json')).body;
    expect(spec.openapi).toBe('3.1.0');
    for (const c of CALCULATORS) expect(spec.paths[`/calculators/${c.slug}`]).toBeDefined();
    expect(spec.paths['/ai/cfo'].post.security).toEqual([{ ApiKeyAuth: [] }]);
    const html = await get('/docs');
    expect(String(html.body)).toContain('SwaggerUIBundle');
  });
});

describe('reliability scoring', () => {
  it('penalises stale market data', () => {
    const now = Date.parse('2026-09-30T10:00:00Z');
    expect(freshnessPenalty('2026-09-30T09:59:30Z', now)).toBe(0);
    expect(marketReliability('yahoo', '2026-09-30T09:50:00Z', now)).toBe(75);
    expect(marketReliability('exchange', null, now)).toBe(35);
  });

  it('scores AI answers from their evidence and never gives 100', () => {
    const base = { ok: true, answer: 'x', provider: 'Groq', model: 'm', fallbackUsed: false, latencyMs: 1, grounding: { invalidCitationsRemoved: [] } };
    const rich = aiReliability({
      ...base,
      structuredAnswer: {
        sources: [1, 2, 3, 4, 5].map((i) => ({ name: `s${i}`, dataDate: '', freshness: '', url: 'https://x' })),
        verifiedNumbers: [{ label: 'EMI', display: '1', certified: true, method: 'precision-engine' }],
      },
    });
    expect(rich).toBe(85);
    expect(aiReliability({ ...base, ok: false, structuredAnswer: { sources: [] } })).toBe(15);
  });
});

describe('AI helpers (gateway mocked)', () => {
  it('cfoBrief maps the gateway result into the envelope', async () => {
    const out = await cfoBrief({ query: 'Should I prepay my loan?' }, async () => ({
      ok: true,
      answer: 'Prepay first [1].',
      provider: 'Groq',
      model: 'llama',
      fallbackUsed: false,
      latencyMs: 12,
      structuredAnswer: { sources: [{ name: 'RBI', dataDate: '', freshness: 'official', url: 'https://rbi.org.in' }] },
    }));
    expect(out.is_deterministic).toBe(false);
    expect(out.data).toMatchObject({ brief: 'Prepay first [1].', model_used: 'Groq/llama' });
    expect(out.reliability_score).toBe(55);
  });

  it('benchmark scores numeric answers within tolerance', async () => {
    expect(numbersIn('EMI is ₹8,678.23 for 20 years')).toEqual([8678.23, 20]);
    expect(scoreAnswer('about ₹8,680', 8678.23, 1).correct).toBe(true);
    expect(scoreAnswer('about ₹9,500', 8678.23, 1).correct).toBe(false);
    const out = await runBenchmark(
      {
        model: 'artha',
        tolerance_pct: 1,
        items: [
          { question: 'EMI on 10 lakh at 8.5% for 20 years?', expected: 8678.23 },
          { question: 'What is 2+2?', expected: 4 },
        ],
      },
      async (r) => ({
        ok: true,
        answer: r.prompt.startsWith('EMI') ? '₹8,678.23' : 'Five',
        provider: 'Groq',
        model: 'm',
        fallbackUsed: false,
        latencyMs: 1,
        structuredAnswer: { sources: [] },
      }),
    );
    expect(out.data.accuracy_pct).toBe(50);
    expect(out.data.results[1].correct).toBe(false);
  });
});

describe('market data (sources mocked)', () => {
  it('parses NSE FII/DII rows and dates', () => {
    const d = parseNseFlows([
      { category: 'DII **', date: '29-Sep-2026', buyValue: '15,000.5', sellValue: '12,000', netValue: '3000.5' },
      { category: 'FII/FPI *', date: '29-Sep-2026', buyValue: '10000', sellValue: '14000', netValue: '-4000' },
    ]);
    expect(d.fii.net).toBe(-4000);
    expect(d.dii.buy).toBe(15000.5);
    expect(nseDateToIso('29-Sep-2026')).toBe('2026-09-29T15:30:00+05:30');
    expect(() => parseNseFlows({})).toThrow();
  });

  it('fetches FII/DII with the NSE cookie handshake, and fails honestly when blocked', async () => {
    const calls: string[] = [];
    const ok = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(String(url));
      if (String(url).endsWith('fiidiiTradeReact')) {
        expect((init?.headers as Record<string, string>).Cookie).toBe('nsit=abc; nseappid=xyz');
        return new Response(
          JSON.stringify([
            { category: 'FII/FPI', date: '29-Sep-2026', buyValue: 1, sellValue: 2, netValue: -1 },
            { category: 'DII', date: '29-Sep-2026', buyValue: 3, sellValue: 1, netValue: 2 },
          ]),
        );
      }
      return new Response('<html/>', { headers: { 'set-cookie': 'nsit=abc; Path=/; HttpOnly, nseappid=xyz; Path=/' } });
    }) as typeof fetch;
    const r = await fiiDiiFlows(ok);
    expect(r.data.dii.net).toBe(2);
    expect(r.source).toMatch(/NSE/);
    resetMarketCachesForTests();
    const blocked = (async () => new Response('denied', { status: 403 })) as typeof fetch;
    await expect(fiiDiiFlows(blocked)).rejects.toThrow(/HTTP 403/);
  });

  it('ranks sectors, names leaders and laggards, and refuses when most sectors are missing', async () => {
    const quote = (pctMove: number): NormalizedMarketQuote => ({
      symbol: 'X',
      name: 'X',
      assetType: 'index',
      exchange: 'NSE',
      currency: 'INR',
      price: 100,
      open: null,
      high: null,
      low: null,
      previousClose: null,
      change: null,
      changePercent: pctMove,
      volume: null,
      providerTimestamp: new Date().toISOString(),
      retrievedAt: new Date().toISOString(),
      freshness: 'delayed',
      providerName: 'Yahoo',
    });
    const moves = new Map(NSE_SECTORS.map((s, i) => [s.symbol, i - 4]));
    const r = await sectorRotation(async (sym) => quote(moves.get(sym) ?? 0));
    expect(r.data.leaders[0]?.name).toBe('NIFTY PSU BANK');
    expect(r.data.laggards[0]?.name).toBe('NIFTY BANK');
    await expect(
      sectorRotation(async () => {
        throw new Error('down');
      }),
    ).rejects.toThrow(/sector indices/);
  });
});

describe('webhooks', () => {
  const row = (over: Partial<WebhookRow>): WebhookRow => ({
    id: '00000000-0000-0000-0000-000000000001',
    key_id: 'k',
    url: 'https://example.com',
    symbol: 'nifty',
    condition: 'above',
    threshold: 25000,
    secret: 's',
    last_state: null,
    last_fired_at: null,
    last_status: null,
    active: true,
    created_at: '',
    ...over,
  });

  it('fires only when the condition becomes true (edge-triggered)', () => {
    const [first] = evaluate([row({})], { nifty: 25100 });
    expect(first).toMatchObject({ state: true, fire: true });
    const [again] = evaluate([row({ last_state: true })], { nifty: 25200 });
    expect(again?.fire).toBe(false);
    const [below] = evaluate([row({ condition: 'below', threshold: 25000 })], { nifty: 25100 });
    expect(below?.state).toBe(false);
    expect(evaluate([row({ symbol: 'btc' })], { nifty: 1 })).toEqual([]);
  });

  it('signs payloads and checks the cron secret', () => {
    expect(signPayload('whsec_x', '{"a":1}')).toMatch(/^sha256=[0-9a-f]{64}$/);
    vi.stubEnv('CRON_SECRET', 'topsecret');
    expect(cronAuthorized('Bearer topsecret')).toBe(true);
    expect(cronAuthorized('Bearer nope')).toBe(false);
    expect(cronAuthorized(undefined)).toBe(false);
  });

  it('run needs the cron secret; storage errors are honest 503s', async () => {
    expect((await get('/webhooks/run')).status).toBe(401);
    const { key, hash } = newApiKey();
    vi.stubEnv('API_V1_KEY_HASHES', hash);
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const r = await get('/webhooks', { 'x-api-key': key });
    expect(r.status).toBe(503);
    expect(r.body.error.message).toMatch(/not configured/);
  });
});
