import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectInstruments, extractQuestion, shouldSearchWeb, webSearch } from '../server/liveGrounding';

describe('live grounding', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('finds the instruments a question is about', () => {
    expect(detectInstruments('How did Nifty and gold do today?').map((i) => i.symbol)).toEqual(['^NSEI', 'GC=F']);
    expect(detectInstruments('Is Bank Nifty up?').map((i) => i.symbol)).toEqual(['^NSEBANK']);
    expect(detectInstruments('Why did Reliance Industries fall?').map((i) => i.symbol)).toContain('RELIANCE.NS');
    expect(detectInstruments('What is the dollar to rupee rate?').map((i) => i.symbol)).toContain('INR=X');
    expect(detectInstruments('Explain compounding')).toEqual([]);
  });

  it('searches the web for time-sensitive questions in auto mode, always when on, never when off', () => {
    expect(shouldSearchWeb('What is the current RBI repo rate?', 'auto')).toBe(true);
    expect(shouldSearchWeb('Latest news on SEBI F&O rules', 'auto')).toBe(true);
    expect(shouldSearchWeb('Explain what an index fund is', 'auto')).toBe(false);
    expect(shouldSearchWeb('Calculate my EMI for 10 lakh at 9%', 'auto')).toBe(false);
    expect(shouldSearchWeb('Explain what an index fund is', 'on')).toBe(true);
    expect(shouldSearchWeb('What is the current repo rate?', 'off')).toBe(false);
  });

  it('pulls the user question out of a composed prompt', () => {
    expect(extractQuestion('Context: {"a":1}\n\nUser question: what is the repo rate today?')).toBe('what is the repo rate today?');
    expect(extractQuestion('Snapshot {...}\n\nWhy did gold rise this week?')).toBe('Why did gold rise this week?');
  });

  it('uses a keyed provider when configured and falls back to keyless sources otherwise', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-key');
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('tavily')) return new Response(JSON.stringify({ results: [{ title: 'RBI policy', url: 'https://rbi.org.in', content: 'Repo rate unchanged' }] }), { status: 200 });
      throw new Error('unexpected');
    });
    vi.stubGlobal('fetch', fetchMock);
    const keyed = await webSearch('rbi repo rate');
    expect(keyed.provider).toBe('Tavily');
    expect(keyed.results[0]).toMatchObject({ url: 'https://rbi.org.in', snippet: 'Repo rate unchanged' });

    vi.stubEnv('TAVILY_API_KEY', '');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).includes('wikipedia')
      ? new Response(JSON.stringify({ query: { search: [{ title: 'Repo rate', snippet: 'The <b>repo rate</b> is…' }] } }), { status: 200 })
      : new Response(JSON.stringify({ AbstractText: '' }), { status: 200 })));
    const keyless = await webSearch('repo rate');
    expect(keyless.provider).toMatch(/Keyless/);
    expect(keyless.results[0]).toMatchObject({ title: 'Repo rate', snippet: 'The repo rate is…', source: 'Wikipedia' });
  });
});

describe('live context assembly', () => {
  it('combines quotes, news and web results with their sources and times', async () => {
    vi.resetModules();
    vi.doMock('../server/marketDataService', () => ({
      getMarketQuote: async (symbol: string) => ({ quote: { symbol, name: symbol, price: symbol === 'GC=F' ? 2386.4 : 24871.5, changePercent: 0.54, currency: symbol === 'GC=F' ? 'USD' : 'INR', freshness: 'delayed', providerName: 'Yahoo Finance', providerTimestamp: '2026-09-24T09:30:00Z', retrievedAt: '2026-09-24T09:31:00Z' } }),
    }));
    vi.doMock('../server/businessNewsService', () => ({
      getBusinessNews: async () => ({ items: [{ title: 'Gold rises as dollar eases', sourceName: 'Reuters', sourceUrl: 'https://example.com/n', publishedAt: '2026-09-24T08:00:00Z' }] }),
    }));
    vi.stubEnv('TAVILY_API_KEY', 'k');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ results: [{ title: 'Gold price today', url: 'https://example.com/g', content: 'Gold traded near $2,386' }] }), { status: 200 })));
    const { gatherLiveContext } = await import('../server/liveGrounding');
    const { text, sources } = await gatherLiveContext('Why did gold rise today?', 'auto');
    expect(text).toMatch(/LIVE CONTEXT retrieved/);
    expect(text).toContain('Gold futures (USD/oz) [GC=F]: 2,386.4 USD (+0.54%) · Yahoo Finance');
    expect(text).toContain('"Gold rises as dollar eases" · Reuters');
    expect(text).toContain('[1] Gold price today — https://example.com/g');
    expect(sources.map((s) => s.kind)).toEqual(['market', 'news', 'web']);
    vi.doUnmock('../server/marketDataService');
    vi.doUnmock('../server/businessNewsService');
  });

  it('refuses to state prices it could not retrieve', async () => {
    vi.resetModules();
    vi.doMock('../server/marketDataService', () => ({ getMarketQuote: async () => { throw new Error('down'); } }));
    vi.doMock('../server/businessNewsService', () => ({ getBusinessNews: async () => ({ items: [] }) }));
    const { gatherLiveContext } = await import('../server/liveGrounding');
    const { text } = await gatherLiveContext('Sensex level?', 'off');
    expect(text).toContain('could not be retrieved right now; say so rather than guessing a price');
    vi.doUnmock('../server/marketDataService');
    vi.doUnmock('../server/businessNewsService');
  });
});
