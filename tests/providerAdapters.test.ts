import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchHistoryFromProvider,
  fetchQuoteFromProvider,
  normalizeTwelveDataSymbol,
} from '../server/providers/marketDataProvider';
import {
  fetchTwelveDataVerifiedHistory,
  fetchTwelveDataVerifiedQuote,
  searchTwelveDataAssets,
  TwelveDataProviderError,
} from '../server/providers/twelveDataProvider';
import { normalizeYahooFinanceSymbol } from '../server/providers/yahooFinanceProvider';

const envKeys = [
  'MARKET_DATA_PROVIDER',
  'MARKET_DATA_PRIMARY_PROVIDER',
  'MARKET_DATA_FALLBACK_PROVIDER',
  'MARKET_DATA_API_KEY',
  'MARKET_DATA_BASE_URL',
  'TWELVE_DATA_API_KEY',
  'TWELVE_DATA_BASE_URL',
  'MARKET_DATA_REQUEST_TIMEOUT_MS',
  'YAHOO_FINANCE_BASE_URL',
] as const;
const snapshot = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of envKeys) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('strict Twelve Data symbol handling', () => {
  it('accepts only neutral provider-specific identifiers in the generic adapter', () => {
    expect(normalizeTwelveDataSymbol('AAPL')).toEqual({ providerSymbol: 'AAPL', baseSymbol: 'AAPL', exchange: null });
    expect(() => normalizeTwelveDataSymbol('RELIANCE.NS')).toThrow(/provider-specific mapping/i);
    expect(() => normalizeTwelveDataSymbol('SBIN:NSE')).toThrow(/provider-specific mapping/i);
    expect(() => normalizeTwelveDataSymbol('EURUSD=X')).toThrow(/provider-specific mapping/i);
  });

  it('does not silently fall back to Yahoo when twelve_data is explicitly selected without a key', async () => {
    process.env.MARKET_DATA_PROVIDER = 'twelve_data';
    delete process.env.TWELVE_DATA_API_KEY;
    delete process.env.MARKET_DATA_API_KEY;
    await expect(fetchQuoteFromProvider('AAPL')).rejects.toThrow(/Twelve Data not configured/i);
  });

  it('rejects a Yahoo-style India symbol in strict Twelve Data mode before a provider request', async () => {
    process.env.MARKET_DATA_PROVIDER = 'twelve_data';
    process.env.TWELVE_DATA_API_KEY = 'server-test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchQuoteFromProvider('RELIANCE.NS')).rejects.toThrow(/provider-specific mapping/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Twelve Data server-only adapter', () => {
  it('returns missing change fields as null rather than zero', async () => {
    process.env.TWELVE_DATA_API_KEY = 'server-test-key';
    process.env.TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE', currency: 'INR', datetime: '2026-09-01 12:00:00', close: '1384.40', open: '1372.50', high: '1391.80', low: '1368.20', volume: '7420000', is_market_open: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const quote = await fetchTwelveDataVerifiedQuote({ providerSymbol: 'RELIANCE', exchange: 'NSE', displaySymbol: 'RELIANCE.NS' });
    expect(quote).toMatchObject({ symbol: 'RELIANCE.NS', currency: 'INR', price: 1384.4, change: null, changePercent: null, freshness: 'end_of_day', providerName: 'Twelve Data' });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/quote');
    expect(url.searchParams.get('symbol')).toBe('RELIANCE');
    expect(url.searchParams.get('exchange')).toBe('NSE');
  });

  it('classifies invalid credentials without returning raw provider text', async () => {
    process.env.TWELVE_DATA_API_KEY = 'server-test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'error', code: 401, message: 'raw secret-like provider message' }), { status: 401, headers: { 'Content-Type': 'application/json' } })));
    await expect(fetchTwelveDataVerifiedQuote({ providerSymbol: 'AAPL' })).rejects.toMatchObject({ category: 'authentication' });
  });

  it('classifies provider rate limiting', async () => {
    process.env.TWELVE_DATA_API_KEY = 'server-test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'error', code: 429, message: 'quota exceeded' }), { status: 429, headers: { 'Content-Type': 'application/json' } })));
    await expect(fetchTwelveDataVerifiedQuote({ providerSymbol: 'AAPL' })).rejects.toMatchObject({ category: 'rate_limit' });
  });

  it('requires the server-side key before search', async () => {
    delete process.env.TWELVE_DATA_API_KEY;
    delete process.env.MARKET_DATA_API_KEY;
    await expect(searchTwelveDataAssets('Reliance Industries')).rejects.toBeInstanceOf(TwelveDataProviderError);
  });

  it('normalizes only provider-returned history and never synthesizes missing OHLC', async () => {
    process.env.TWELVE_DATA_API_KEY = 'server-test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ values: [
      { datetime: '2026-08-31', open: '100', high: '106', low: '99', close: '104', volume: '1000' },
      { datetime: '2026-09-01', close: '105' },
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const points = await fetchTwelveDataVerifiedHistory({ providerSymbol: 'AAPL', range: '1m' });
    expect(points[0]).toMatchObject({ price: 104, open: 100, high: 106, low: 99, close: 104, volume: 1000 });
    expect(points[1]).toEqual({ date: '2026-09-01', price: 105, close: 105 });
  });
});

describe('Yahoo experimental/reference adapter compatibility', () => {
  it('keeps the existing explicit Yahoo India/FX aliases', () => {
    expect(normalizeYahooFinanceSymbol('RELIANCE:NSE')).toEqual({ providerSymbol: 'RELIANCE.NS', displaySymbol: 'RELIANCE:NSE', exchange: 'NSE' });
    expect(normalizeYahooFinanceSymbol('USD/INR').providerSymbol).toBe('INR=X');
  });

  it('loads Yahoo directly when Yahoo is explicitly selected', async () => {
    process.env.MARKET_DATA_PROVIDER = 'yahoo';
    const now = Math.floor(Date.now() / 1000);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ chart: { result: [{ meta: { currency: 'USD', symbol: 'AAPL', exchangeName: 'NMS', regularMarketTime: now - 20, regularMarketPrice: 230, regularMarketDayHigh: 232, regularMarketDayLow: 228, regularMarketVolume: 100, previousClose: 229, exchangeDataDelayedBy: 0, currentTradingPeriod: { regular: { start: now - 3600, end: now + 3600 } } }, timestamp: [now - 20], indicators: { quote: [{ open: [229], high: [232], low: [228], close: [230], volume: [100] }] } }], error: null } }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const result = await fetchQuoteFromProvider('AAPL');
    expect(result.status).toBe('connected');
    expect(result.quote).toMatchObject({ symbol: 'AAPL', price: 230, providerName: 'Yahoo Finance (Experimental)' });
  });

  it('keeps Yahoo history observations provider-derived', async () => {
    process.env.MARKET_DATA_PROVIDER = 'yahoo';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ chart: { result: [{ meta: { currency: 'USD', symbol: 'AAPL' }, timestamp: [1788134400], indicators: { quote: [{ open: [100], high: [105], low: [99], close: [104], volume: [500] }] } }], error: null } }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const points = await fetchHistoryFromProvider('AAPL', '1m');
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ price: 104, open: 100, high: 105, low: 99, close: 104, volume: 500 });
  });
});
