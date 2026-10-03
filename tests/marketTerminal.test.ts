import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aggregateCandles, getTerminalCandles, getTerminalSnapshot, resetMarketTerminalCachesForTests } from '../server/marketTerminal';
import { formatChange, formatMarketPrice } from '../src/services/marketTerminalApi';

function yahooChart(symbol: string, closes: number[], stepSeconds = 3600) {
  const start = Date.UTC(2026, 8, 21, 3, 45) / 1000;
  const timestamp = closes.map((_, i) => start + i * stepSeconds);
  return {
    chart: {
      result: [{
        meta: { currency: 'INR', symbol, regularMarketTime: timestamp.at(-1), regularMarketPrice: closes.at(-1), chartPreviousClose: closes[0], previousClose: closes[0], exchangeDataDelayedBy: 0, currentTradingPeriod: { regular: { start: 0, end: 1 } } },
        timestamp,
        indicators: { quote: [{ open: closes.map((c) => c - 1), high: closes.map((c) => c + 2), low: closes.map((c) => c - 3), close: closes, volume: closes.map(() => 10) }] },
      }],
      error: null,
    },
  };
}

describe('market terminal data layer', () => {
  beforeEach(() => { resetMarketTerminalCachesForTests(); vi.stubEnv('MARKET_DATA_PROVIDER', 'yahoo'); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

  it('aggregates hourly bars into 4h candles with correct OHLCV', () => {
    const base = 4 * 3600 * 1000; // aligned to a 4h boundary
    const hourly = [0, 1, 2, 3, 4].map((i) => ({ time: base + i * 3600, open: 10 + i, high: 20 + i, low: 5 - i, close: 11 + i, volume: 1 }));
    const [first, second] = aggregateCandles(hourly, 4 * 3600);
    expect(first).toEqual({ time: base, open: 10, high: 23, low: 2, close: 14, volume: 4 });
    expect(second).toMatchObject({ open: 14, close: 15, volume: 1 });
  });

  it('maps NIFTY 50 to ^NSEI candles from the Yahoo provider and aggregates 4h', async () => {
    const fetchMock = vi.fn(async (url: string | URL) => new Response(JSON.stringify(yahooChart('^NSEI', Array.from({ length: 12 }, (_, i) => 23000 + i * 10)))));
    vi.stubGlobal('fetch', fetchMock);
    const result = await getTerminalCandles('nifty50', '4h');
    const requested = new URL(String(fetchMock.mock.calls[0][0]));
    expect(decodeURIComponent(requested.pathname)).toContain('^NSEI');
    expect(requested.searchParams.get('interval')).toBe('60m');
    expect(result.hasOhlc).toBe(true);
    expect(result.candles.length).toBeLessThan(12);
    expect(result.label).toBe('NIFTY 50');
    expect(result.stale).toBe(false);
  });

  it('serves the last good candles, flagged stale, when the provider fails after the cache expires', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-22T06:00:00Z'));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(yahooChart('INR=X', [95.5, 95.6, 95.7])))));
    await getTerminalCandles('usdinr', '15m');
    vi.setSystemTime(new Date('2026-09-22T06:05:00Z'));
    vi.stubGlobal('fetch', vi.fn(async () => new Response('rate limited', { status: 429 })));
    const again = await getTerminalCandles('usdinr', '15m');
    expect(again.stale).toBe(true);
    expect(again.candles.at(-1)?.close).toBe(95.7);
  });

  it('builds a four-card snapshot with sparklines and never invents prices when a feed fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const symbol = decodeURIComponent(new URL(String(url)).pathname.split('/').pop() || '');
      if (symbol === 'GC=F') return new Response('down', { status: 503 });
      return new Response(JSON.stringify(yahooChart(symbol, Array.from({ length: 20 }, (_, i) => 100 + i), 300)));
    }));
    const { items } = await getTerminalSnapshot();
    expect(items.map((item) => item.id)).toEqual(['nifty50', 'sensex', 'usdinr', 'gold']);
    expect(items[0]).toMatchObject({ status: 'ok', price: 119 });
    expect(items[0].sparkline.length).toBeGreaterThanOrEqual(8);
    expect(items[3]).toMatchObject({ status: 'unavailable', price: null });
  });

  it('formats prices and signed changes without relying on colour alone', () => {
    expect(formatMarketPrice(23329, 'INR', 2)).toBe('₹23,329.00');
    expect(formatMarketPrice(95.58, 'INR', 4)).toBe('₹95.5800');
    expect(formatChange(-17.4, -0.0745, 2)).toEqual({ text: '▼ −17.40 (−0.07%)', direction: 'down' });
    expect(formatChange(null, null, 2).text).toBe('Change unavailable');
  });
});
