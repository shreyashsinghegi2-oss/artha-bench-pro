import { describe, expect, it } from 'vitest';
import type { NormalizedMarketQuote } from '../src/types';
import {
  FOREX_PAIRS,
  historyStats,
  isUnsafeTradingAdviceRequest,
  MARKET_SAFE_REDIRECT,
  marketDataState,
  US_MARKET_UNIVERSE,
} from '../src/services/marketPro';

function quote(freshness: NormalizedMarketQuote['freshness'], providerTimestamp: string | null = '2026-09-01T01:00:00Z'): NormalizedMarketQuote {
  return {
    symbol: 'TEST',
    name: 'Test Asset',
    assetType: 'equity',
    exchange: 'TEST',
    currency: 'USD',
    price: 100,
    open: 99,
    high: 101,
    low: 98,
    previousClose: 99,
    change: 1,
    changePercent: 1.01,
    volume: 1000,
    providerTimestamp,
    retrievedAt: '2026-09-01T01:00:05Z',
    freshness,
    providerName: 'Test Provider',
  };
}

describe('ArthaMind Pro market truthfulness', () => {
  it('maps missing and provider freshness to controlled labels', () => {
    expect(marketDataState(undefined)).toEqual({ state: 'unavailable', label: 'Unavailable' });
    expect(marketDataState(quote('end_of_day')).label).toBe('End-of-day reference');
    expect(marketDataState(quote('delayed')).label).toBe('Delayed quote');
    expect(marketDataState(quote('stale')).label).toBe('Stale data');
    expect(marketDataState(quote('demo')).label).toBe('Demo data');
    expect(marketDataState(quote('real_time')).label).toBe('Live verified feed');
    expect(marketDataState(quote('real_time', null)).label).toBe('Recently refreshed');
  });

  it('contains the requested FX research registry without quote fixtures', () => {
    expect(FOREX_PAIRS.map((item) => item.pair)).toEqual([
      'USD/INR','EUR/INR','GBP/INR','JPY/INR','EUR/USD','GBP/USD','USD/JPY','AUD/USD','USD/CAD','USD/CHF',
    ]);
    expect(FOREX_PAIRS.every((item) => !('price' in item))).toBe(true);
  });

  it('preserves the core US references and expands the registry', () => {
    const symbols = US_MARKET_UNIVERSE.map((item) => item.symbol);
    expect(symbols).toEqual(expect.arrayContaining(['SPY','AAPL','NVDA','MSFT']));
    expect(symbols.length).toBeGreaterThanOrEqual(10);
  });

  it('refuses direct trading instructions but permits educational chart questions', () => {
    expect(isUnsafeTradingAdviceRequest('Tell me exactly what to buy today')).toBe(true);
    expect(isUnsafeTradingAdviceRequest('Give me a sure-shot forex trade with target and stop loss')).toBe(true);
    expect(isUnsafeTradingAdviceRequest('Explain the visible USD/INR range and timestamp')).toBe(false);
    expect(MARKET_SAFE_REDIRECT).toContain('I cannot provide personalised trade instructions');
  });

  it('calculates visible-history statistics without forecasting', () => {
    const stats = historyStats([
      { date: '2026-08-01', price: 100 },
      { date: '2026-08-02', price: 105 },
      { date: '2026-08-03', price: 102 },
    ]);
    expect(stats?.high).toBe(105);
    expect(stats?.low).toBe(100);
    expect(stats?.observations).toBe(3);
    expect(stats?.returnPercent).toBeCloseTo(2);
  });
});
