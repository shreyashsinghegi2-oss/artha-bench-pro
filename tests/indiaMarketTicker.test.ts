import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getIndiaMarketTicker,
  resetIndiaMarketTickerCacheForTests,
} from '../server/indiaMarketTickerService';

function yahooResponse(symbol: string, price = 25000) {
  const now = Math.floor(Date.now() / 1000);
  return new Response(
    JSON.stringify({
      chart: {
        result: [{
          meta: {
            currency: 'INR',
            symbol,
            exchangeName: symbol.endsWith('.NS') ? 'NSI' : 'NSE',
            instrumentType: symbol.startsWith('^') ? 'INDEX' : 'EQUITY',
            regularMarketTime: now - 30,
            regularMarketPrice: price,
            regularMarketDayHigh: price + 25,
            regularMarketDayLow: price - 25,
            regularMarketVolume: 100000,
            previousClose: price - 100,
            exchangeDataDelayedBy: 15,
            currentTradingPeriod: {
              regular: { start: now - 3600, end: now + 3600 },
            },
          },
          timestamp: [now - 30],
          indicators: {
            quote: [{
              open: [price - 50],
              high: [price + 25],
              low: [price - 25],
              close: [price],
              volume: [100000],
            }],
          },
        }],
        error: null,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

afterEach(() => {
  resetIndiaMarketTickerCacheForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.YAHOO_FINANCE_BASE_URL;
});

describe('India market ticker service', () => {
  it('loads the requested Yahoo instruments and reuses the short server cache', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const symbol = decodeURIComponent(new URL(String(input)).pathname.split('/').pop() || '');
      return Promise.resolve(yahooResponse(symbol));
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await getIndiaMarketTicker();
    const second = await getIndiaMarketTicker();

    expect(first.status).toBe('available');
    expect(first.sourceLabel).toBe('Yahoo Finance · delayed / availability varies');
    expect(first.items.map((item) => item.yahooSymbol)).toEqual([
      '^NSEI',
      '^NSEBANK',
      '^BSESN',
      'RELIANCE.NS',
      'TCS.NS',
      'HDFCBANK.NS',
      'INFY.NS',
      'ICICIBANK.NS',
    ]);
    expect(first.items.every((item) => item.status === 'available')).toBe(true);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it('marks only a failed Yahoo symbol unavailable and does not expose demo prices', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/TCS.NS')) {
        return Promise.resolve(new Response('Too Many Requests', { status: 429 }));
      }
      const symbol = decodeURIComponent(url.pathname.split('/').pop() || '');
      return Promise.resolve(yahooResponse(symbol));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getIndiaMarketTicker();
    const tcs = result.items.find((item) => item.yahooSymbol === 'TCS.NS');

    expect(result.status).toBe('partial');
    expect(tcs).toMatchObject({
      label: 'TCS',
      status: 'unavailable',
      price: null,
      change: null,
      changePercent: null,
    });
    expect(result.items.filter((item) => item.status === 'available')).toHaveLength(7);
  });

  it('keeps the ticker response usable when Yahoo is entirely unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Unavailable', { status: 503 })),
    );

    const result = await getIndiaMarketTicker();

    expect(result.status).toBe('unavailable');
    expect(result.items).toHaveLength(8);
    expect(result.items.every((item) => item.price === null)).toBe(true);
  });
});
