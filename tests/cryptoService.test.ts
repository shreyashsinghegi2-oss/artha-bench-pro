import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCryptoAssistantFallback,
  getCryptoKlines,
  getCryptoMarkets,
  resetCryptoCachesForTests,
} from '../server/cryptoService';
import { normalizeKlineMessage, normalizeTickerMessage } from '../src/components/crypto/useCryptoMarketData';
import { CRYPTO_SYMBOLS, CryptoAssistantContext } from '../src/components/crypto/cryptoTypes';

const originalGroqApiKey = process.env.GROQ_API_KEY;

function ticker(symbol: string, index: number) {
  return {
    symbol,
    lastPrice: String(100 + index),
    priceChange: '2.5',
    priceChangePercent: '2.50',
    highPrice: String(105 + index),
    lowPrice: String(95 + index),
    volume: '1000',
    quoteVolume: '100000',
    bidPrice: String(99 + index),
    askPrice: String(101 + index),
    closeTime: 1_777_000_000_000,
  };
}

afterEach(() => {
  resetCryptoCachesForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalGroqApiKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqApiKey;
});

describe('Binance crypto market service', () => {
  it('normalizes all tracked REST quotes without inventing prices', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(CRYPTO_SYMBOLS.map(ticker)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getCryptoMarkets();

    expect(result.sourceLabel).toBe('Binance Public Market Data');
    expect(result.markets.map((quote) => quote.symbol)).toEqual(CRYPTO_SYMBOLS);
    expect(result.markets[0]).toMatchObject({ price: 100, change: 2.5, changePercent: 2.5 });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v3/ticker/24hr?symbols=');
  });

  it('tries the next official REST endpoint when the first one is unavailable', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(CRYPTO_SYMBOLS.map(ticker)), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getCryptoMarkets();

    expect(result.markets).toHaveLength(7);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('data-api.binance.vision');
    expect(String(fetchMock.mock.calls[1][0])).toContain('api.binance.com');
  });

  it('normalizes Binance kline arrays and preserves trade counts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify([[1_777_000_000_000, '100', '110', '90', '105', '250', 1_777_000_059_999, '25000', 423]]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));

    const result = await getCryptoKlines('BTCUSDT', '1m');

    expect(result).toMatchObject({ symbol: 'BTCUSDT', interval: '1m', sourceLabel: 'Binance Public Market Data' });
    expect(result.candles[0]).toMatchObject({ open: 100, high: 110, low: 90, close: 105, trades: 423 });
  });
});

describe('crypto stream validation and assistant safety', () => {
  it('accepts valid tracked stream messages and rejects malformed or untracked data', () => {
    const quote = normalizeTickerMessage({ s: 'BTCUSDT', c: '100', p: '2', P: '2', h: '105', l: '95', v: '1000', q: '100000', b: '99', a: '101', E: 1_777_000_000_000 });
    expect(quote).toMatchObject({ symbol: 'BTCUSDT', price: 100 });
    expect(normalizeTickerMessage({ s: 'UNKNOWNUSDT', c: '100' })).toBeNull();
    expect(normalizeTickerMessage({ s: 'BTCUSDT', c: 'not-a-number' })).toBeNull();

    const candle = normalizeKlineMessage({ k: { t: 1, T: 2, o: '100', h: '110', l: '90', c: '105', v: '10', q: '1000', n: 42 } });
    expect(candle).toMatchObject({ open: 100, close: 105, trades: 42 });
    expect(normalizeKlineMessage({ k: { t: 1, o: 'bad' } })).toBeNull();
  });

  it('returns grounded conditional scenarios and refuses direct trading orders', () => {
    const context: CryptoAssistantContext = {
      symbol: 'BTCUSDT',
      interval: '1m',
      candleStatus: 'Closed',
      timeUtc: '2026-08-27 01:00:00',
      timeIst: '2026-08-27 06:30:00',
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      absoluteChange: 5,
      percentChange: 5,
      baseVolume: 250,
      quoteVolume: 25_000,
      tradeCount: 423,
      provider: 'Binance Public Market Data',
      streamStatus: 'live',
      lastUpdatedAt: '2026-08-27T01:00:00.000Z',
    };

    const answer = buildCryptoAssistantFallback('Should I buy this?', context);

    expect(answer).toContain('## Selected Data');
    expect(answer).toContain('## Purchase Decision Framework');
    expect(answer).toContain('## Scenario Analysis');
    expect(answer).toContain('does not issue a buy, sell, hold');
    expect(answer).toContain('Binance Public Market Data');
  });
});
