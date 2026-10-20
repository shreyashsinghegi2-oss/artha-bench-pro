import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { clearWebSearchCache, cacheKey, normalizeResults, publicQuery, searchWeb, WebSearchUnavailable, isFinanceTopic } from '../server/services/searxngSearch';
import { createRateLimiter } from '../server/rateLimiter';
import { validateCitations } from '../server/fetch/citations';
import { WebStatusLine } from '../src/components/ai/StructuredFinancialAnswer';

const ROWS = [
  { title: 'Monetary Policy Statement, October 2026', url: 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?id=1', content: 'The repo rate was kept unchanged at 5.50 per cent.', publishedDate: '2026-10-08T00:00:00Z' },
  { title: 'Repo rate latest monetary policy', url: 'https://economictimes.indiatimes.com/news/repo-rate', content: 'Repo rate news and RBI policy review.', publishedDate: '2026-10-08T00:00:00Z' },
  { title: 'Repo rate latest monetary policy', url: 'https://www.example-blog.net/repo', content: 'Duplicate title, should be dropped.', publishedDate: '2026-10-07T00:00:00Z' },
  { title: 'Win a free repo course', url: 'https://www.pinterest.com/pin/123', content: 'Blocked social page about repo.', publishedDate: '2026-10-01T00:00:00Z' },
  { title: '', url: 'https://www.sebi.gov.in/x', content: 'No title, dropped.', publishedDate: '2026-10-01T00:00:00Z' },
  { title: 'Unrelated cooking tips', url: 'https://www.food.com/tips', content: 'Nothing about money.', publishedDate: '2026-10-01T00:00:00Z' },
  { title: 'SEBI circular on mutual funds', url: 'https://www.sebi.gov.in/circular', content: 'New mutual fund rules.', publishedDate: '2026-09-30T00:00:00Z' },
];

function mockFetch(impl: () => Promise<Response> | Response) {
  const fn = vi.fn(async () => impl());
  vi.stubGlobal('fetch', fn);
  return fn;
}
const okJson = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  process.env.SEARXNG_BASE_URL = 'https://search.example.test';
  clearWebSearchCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.SEARXNG_BASE_URL;
});

describe('SearXNG results', () => {
  it('normalises a valid response into ranked, numbered sources', async () => {
    mockFetch(() => okJson({ results: ROWS }));
    const r = await searchWeb('RBI repo rate latest');
    expect(r.search_provider).toBe('SearXNG');
    expect(r.cached).toBe(false);
    expect(r.results.map((x) => x.id)).toEqual([1, 2, 3].slice(0, r.results.length));
    expect(r.results[0]).toMatchObject({ domain: 'rbi.org.in', source_type: 'regulator', publisher: 'RBI', date: '2026-10-08' });
    expect(r.results.length).toBeLessThanOrEqual(5);
    expect(r.results.some((x) => x.domain.includes('pinterest'))).toBe(false);
    expect(r.results.filter((x) => x.title === 'Repo rate latest monetary policy')).toHaveLength(1);
    expect(r.results.some((x) => x.title === '')).toBe(false);
    expect(new Date(r.expires_at).getTime()).toBeGreaterThan(new Date(r.fetched_at).getTime());
  });

  it('returns no sources for an empty response', async () => {
    mockFetch(() => okJson({ results: [] }));
    const r = await searchWeb('RBI repo rate latest');
    expect(r.results).toEqual([]);
  });

  it('keeps only results that match the question', () => {
    expect(normalizeResults('RBI repo rate', [ROWS[5]])).toEqual([]);
  });

  it('builds a stable cache key from the normalised query', () => {
    expect(cacheKey('RBI  Repo rate?')).toBe(cacheKey('rbi repo rate'));
    expect(cacheKey('rbi repo rate')).toBe(`websearch:${createHash('sha256').update('rbi repo rate').digest('hex').slice(0, 32)}`);
  });
});

describe('timeouts and fallback', () => {
  it('a timeout raises WebSearchUnavailable when nothing is cached', async () => {
    mockFetch(() => { throw Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }); });
    await expect(searchWeb('RBI repo rate latest')).rejects.toBeInstanceOf(WebSearchUnavailable);
  });

  it('falls back to a cached answer when SearXNG fails later', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-20T09:00:00Z') });
    mockFetch(() => okJson({ results: ROWS }));
    await searchWeb('RBI repo rate latest');
    vi.setSystemTime(new Date('2026-10-20T09:30:00Z'));
    mockFetch(() => { throw new Error('network down'); });
    const r = await searchWeb('RBI repo rate latest');
    expect(r.cached).toBe(true);
    expect(r.results.length).toBeGreaterThan(0);
  });

  it('is not configured without SEARXNG_BASE_URL', async () => {
    delete process.env.SEARXNG_BASE_URL;
    await expect(searchWeb('RBI repo rate latest')).rejects.toBeInstanceOf(WebSearchUnavailable);
  });
});

describe('cache', () => {
  it('reuses an identical query within 15 minutes without calling SearXNG', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-20T09:00:00Z') });
    const fn = mockFetch(() => okJson({ results: ROWS }));
    await searchWeb('RBI repo rate latest');
    vi.setSystemTime(new Date('2026-10-20T09:10:00Z'));
    const again = await searchWeb('rbi repo rate latest');
    expect(again.cached).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('searches again after 15 minutes', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-20T09:00:00Z') });
    const fn = mockFetch(() => okJson({ results: ROWS }));
    await searchWeb('RBI repo rate latest');
    vi.setSystemTime(new Date('2026-10-20T09:16:00Z'));
    await searchWeb('RBI repo rate latest');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('privacy of the search query', () => {
  it('never sends amounts, first-person words or personal finance details', () => {
    const q = publicQuery('My salary is ₹85,000 a month and my EMI is 40000, I have 12 lakh in loans. Is the RBI repo rate rising?');
    expect(q).not.toBeNull();
    expect(q!).not.toMatch(/85|40000|12 lakh|salary|\bmy\b|\bi\b|EMI/i);
    expect(q!).toMatch(/RBI repo rate/);
  });

  it('removes personal numbers but keeps years', () => {
    expect(publicQuery('Rs 4,50,000 loan, 9 lakh income, 2026 policy')).toMatch(/2026/);
    expect(publicQuery('Rs 4,50,000 loan, 9 lakh income, 2026 policy')).not.toMatch(/4,50|9 lakh/);
  });

  it('sends nothing when no public topic is left', () => {
    expect(publicQuery('my ₹5,00,000 salary')).toBeNull();
  });

  it('searches only financial questions', () => {
    expect(isFinanceTopic('RBI repo rate latest')).toBe(true);
    expect(isFinanceTopic('best pizza near me')).toBe(false);
  });
});

describe('rate limit', () => {
  it('blocks the eleventh search in a minute for the same user', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 10, message: 'You’ve reached the short-term web-search limit. Please try again shortly.', keyFor: () => 'user:test-rl-1' });
    let last = 0;
    let body: unknown = null;
    for (let i = 0; i < 11; i++) {
      const res = {
        headers: {} as Record<string, string>,
        setHeader(k: string, v: string) { this.headers[k] = v; },
        status(code: number) { last = code; return this; },
        json(b: unknown) { body = b; return this; },
      };
      const req = { headers: {}, socket: { remoteAddress: '10.0.0.1' } };
      limiter(req as never, res as never, () => { last = 200; });
    }
    expect(last).toBe(429);
    expect(body).toMatchObject({ error: 'You’ve reached the short-term web-search limit. Please try again shortly.' });
  });
});

describe('citations and the answer', () => {
  it('removes citations that point at no real source', () => {
    const answer = {
      title: 'T', directAnswer: 'The repo rate is 5.50% [1]. A made-up figure [9].', steps: [], formula: { expression: '', variables: [] },
      example: { title: '', inputs: '', calculation: [], result: '' }, interpretation: [], risks: [], keyTakeaways: [], sources: [],
    } as unknown as Parameters<typeof validateCitations>[0];
    const { answer: out } = validateCitations(answer, [{ n: 1, kind: 'web', title: 'RBI', url: 'https://rbi.org.in', publisher: 'RBI', fetchedAt: '', freshness: 'live', sourceId: 'web' } as never]);
    expect(out.directAnswer).toContain('[1]');
    expect(out.directAnswer).not.toContain('[9]');
  });
});

describe('frontend status', () => {
  it('shows the cached timestamp in IST when cached data is used', () => {
    const html = renderToStaticMarkup(React.createElement(WebStatusLine, { status: { state: 'cached', provider: 'SearXNG', fetchedAt: '2026-10-20T09:00:00Z' } }));
    expect(html).toContain('Cached web data');
    expect(html).toContain('IST');
  });

  it('shows live status and the calm unavailable notice', () => {
    expect(renderToStaticMarkup(React.createElement(WebStatusLine, { status: { state: 'live', provider: 'SearXNG' } }))).toContain('Live web data');
    expect(renderToStaticMarkup(React.createElement(WebStatusLine, { status: { state: 'unavailable', provider: 'none' } }))).toContain('Live web data unavailable');
  });
});
