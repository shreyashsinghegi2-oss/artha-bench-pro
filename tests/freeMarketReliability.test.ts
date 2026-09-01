import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchQuoteFromProvider } from '../server/providers/marketDataProvider';
import { fetchMarketQuote } from '../src/services/learningApi';
import { askReliableTutor } from '../src/services/reliableTutor';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.MARKET_DATA_PROVIDER;
  delete process.env.MARKET_DATA_API_KEY;
  delete process.env.TWELVE_DATA_API_KEY;
  delete process.env.YAHOO_FINANCE_BASE_URL;
});

function yahooReliancePayload(now: number) {
  return {
    chart: {
      result: [{
        meta: {
          currency: 'INR',
          symbol: 'RELIANCE.NS',
          exchangeName: 'NSI',
          fullExchangeName: 'NSE',
          instrumentType: 'EQUITY',
          regularMarketTime: now - 30,
          regularMarketPrice: 1392.7,
          regularMarketDayHigh: 1398.2,
          regularMarketDayLow: 1379.1,
          regularMarketVolume: 6810000,
          regularMarketOpen: 1384.4,
          previousClose: 1384.4,
          marketState: 'REGULAR',
          longName: 'Reliance Industries Limited',
          currentTradingPeriod: { regular: { start: now - 3600, end: now + 3600 } },
        },
        timestamp: [now - 60, now - 30],
        indicators: { quote: [{
          open: [1384.4, 1389.2],
          high: [1391.8, 1398.2],
          low: [1379.1, 1388.1],
          close: [1389.2, 1392.7],
          volume: [7420000, 6810000],
        }] },
      }],
      error: null,
    },
  };
}

describe('free India market routing', () => {
  it('forces an Indian NSE symbol through Yahoo even when Twelve Data is selected globally', async () => {
    process.env.MARKET_DATA_PROVIDER = 'twelvedata';
    process.env.MARKET_DATA_API_KEY = 'unused-for-india';
    process.env.YAHOO_FINANCE_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
    const now = Math.floor(Date.now() / 1000);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(yahooReliancePayload(now)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchQuoteFromProvider('RELIANCE.NS');

    expect(result.status).toBe('connected');
    expect(result.quote.currency).toBe('INR');
    expect(result.quote.price).toBe(1392.7);
    expect(result.quote.providerName).toContain('Yahoo Finance');
    const requested = String(fetchMock.mock.calls[0][0]);
    expect(requested).toContain('query1.finance.yahoo.com');
    expect(requested).not.toContain('twelvedata.com');
  });

  it('falls back from an unavailable Vercel market API to the Netlify Yahoo reference proxy', async () => {
    const now = Math.floor(Date.now() / 1000);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith('/api/markets/quote')) {
        return new Response(JSON.stringify({ error: 'backend unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith('/free-market/yahoo/RELIANCE.NS')) {
        return new Response(JSON.stringify(yahooReliancePayload(now)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMarketQuote('RELIANCE.NS');

    expect(result.status).toBe('connected');
    expect(result.quote.price).toBe(1392.7);
    expect(result.quote.currency).toBe('INR');
    expect(result.quote.freshness).toBe('delayed');
    expect(result.quote.providerName).toContain('experimental/reference');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/free-market/yahoo/RELIANCE.NS');
  });
});

describe('ArthaMind reliability fallback', () => {
  it('returns a grounded answer when the AI endpoint is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    const response = await askReliableTutor('Explain the visible range.', {
      visibleData: {
        symbol: 'RELIANCE.NS',
        quote: {
          price: 1392.7,
          currency: 'INR',
          providerName: 'Yahoo Finance · experimental/reference',
          freshness: 'delayed',
        },
      },
    });
    expect(response.fallbackMode).toBe(true);
    expect(response.providerStatus).toBe('grounded_fallback');
    expect(response.answer).toContain('ArthaMind grounded fallback mode');
    expect(response.answer).toContain('1392.7');
    expect(response.answer).toContain('delayed');
  });

  it('keeps personalised trading instructions behind the safety boundary', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    const response = await askReliableTutor('Tell me exactly what to buy and the target price.', {
      visibleData: { symbol: 'AAPL', price: 100 },
    });
    expect(response.answer).toContain('cannot provide personalised buy/sell instructions');
  });
});
