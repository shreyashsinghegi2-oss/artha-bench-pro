import { describe, expect, it } from 'vitest';
import { gatherContext, searchQuery, sourceSummary, type Fetchers } from '../src/advisor/data-gathering';
import { computeFeatures, MIN_HISTORY } from '../src/advisor/features';
import { parseDeterministic } from '../src/advisor/query-parser';
import type { MarketSnapshot } from '../src/advisor/context';
import type { ParsedQuery } from '../src/advisor/types';

const NOW = Date.parse('2026-09-30T06:00:00Z');
const fresh = '2026-09-30T05:50:00Z';
const old = '2026-09-29T10:00:00Z';

const snapshot: MarketSnapshot = {
  nifty: { symbol: '^NSEI', name: 'NIFTY 50', price: 25000, change_percent: 0.5, currency: 'INR', as_of: fresh },
  sp500: null,
  btc: null,
  usdinr: null,
  gold: null,
};

function fetchers(overrides: Partial<Fetchers> = {}): Partial<Fetchers> {
  return {
    market: async () => ({ data: snapshot, source: 'Yahoo', as_of: fresh, reliability: 85 }),
    rbi: async () => ({ data: { repo_rate_pct: 5.5, repo_rate_statement: 'Policy', recent: [] }, source: 'RBI', as_of: fresh, reliability: 95 }),
    news: async () => ({ data: [{ title: 'n', source: 's', url: 'u', published_at: fresh }], source: 'News', as_of: fresh, reliability: 70 }),
    web: async () => ({ data: [1, 2, 3].map((i) => ({ title: `w${i}`, url: `u${i}`, snippet: '' })), source: 'Web', as_of: null, reliability: 60 }),
    ...overrides,
  };
}

const parse = (q: string): ParsedQuery => {
  const r = parseDeterministic(q, new Date(NOW));
  return {
    intent: r.intent,
    entities: r.entities,
    amounts: r.amounts,
    time_horizon: r.time_horizon,
    is_time_sensitive: r.is_time_sensitive,
    is_novel: true,
    user_id: 'u',
  };
};

describe('Layer B: gatherContext', () => {
  it('collects available sources and marks missing ones unavailable without failing', async () => {
    const b = await gatherContext({
      question: 'Should I start a SIP of ₹10,000?',
      parsed: parse('Should I start a SIP of ₹10,000?'),
      fetchers: fetchers(),
      now: () => NOW,
    });
    expect(b.market.status).toBe('ok');
    expect(b.market.reliability).toBe(85);
    expect(b.fii_dii.status).toBe('unavailable');
    expect(b.fii_dii.note).toMatch(/not configured/);
    expect(b.profile.status).toBe('skipped');
  });

  it('turns a thrown error or timeout into unavailable', async () => {
    const b = await gatherContext({
      question: 'x',
      parsed: parse('How is NIFTY doing?'),
      fetchers: fetchers({
        market: async () => {
          throw new Error('boom');
        },
        rbi: () => new Promise(() => undefined),
      }),
      timeoutMs: { rbi: 20 },
      now: () => NOW,
    });
    expect(b.market).toMatchObject({ status: 'unavailable', note: 'boom' });
    expect(b.rbi.status).toBe('unavailable');
    expect(b.rbi.note).toMatch(/timed out/);
  });

  it('adds a stale warning when data is older than an hour, and then runs web search (max 2)', async () => {
    const q = 'What is the NIFTY level?';
    const parsed = { ...parse(q), is_novel: false };
    const b = await gatherContext({
      question: q,
      parsed,
      fetchers: fetchers({ market: async () => ({ data: snapshot, source: 'Yahoo', as_of: old, reliability: 60 }) }),
      now: () => NOW,
    });
    expect(b.market.stale_warning).toBe(`Data from ${old}`);
    expect(b.web.status).toBe('ok');
    expect(b.web.data).toHaveLength(2);
  });

  it('skips web search when the answer is cached and data is fresh; skips news when not time-sensitive', async () => {
    const q = 'How does compounding work?';
    const b = await gatherContext({ question: q, parsed: { ...parse(q), is_novel: false, is_time_sensitive: false }, fetchers: fetchers(), now: () => NOW });
    expect(b.web.status).toBe('skipped');
    expect(b.news.status).toBe('skipped');
  });

  it('uses the profile only when it has content, and summarises every source', async () => {
    const b = await gatherContext({ question: 'q', parsed: parse('q'), profile: { age: 30, goals: [] }, fetchers: fetchers(), now: () => NOW });
    expect(b.profile.status).toBe('ok');
    expect(sourceSummary(b).map((s) => s.key)).toEqual(['market', 'market_state', 'rbi', 'fii_dii', 'sectors', 'profile', 'news', 'web']);
  });

  it('adds India to search queries without an Indian context', () => {
    expect(searchQuery('best index fund', parse('best index fund'))).toBe('best index fund India');
    expect(searchQuery('RBI repo rate', parse('RBI repo rate'))).toBe('RBI repo rate');
  });
});

describe('features', () => {
  it('needs 201 closes and computes returns, moving-average distance and RSI', () => {
    const series = Array.from({ length: 260 }, (_, i) => ({ date: `d${i}`, close: 100 * 1.001 ** i }));
    expect(computeFeatures(series.slice(0, MIN_HISTORY - 1))).toHaveLength(0);
    const f = computeFeatures(series);
    expect(f).toHaveLength(60);
    const last = f.at(-1)!;
    expect(last.return_5d).toBeCloseTo(1.001 ** 5 - 1, 10);
    expect(last.rsi_14).toBe(100);
    expect(last.volatility_20d).toBeCloseTo(0, 10);
    expect(last.dist_ma50).toBeGreaterThan(0);
    expect(last.dist_ma200).toBeGreaterThan(last.dist_ma50);
  });
});
