export interface TaxMarketQuote {
  symbol: string;
  price: number;
  currency: string;
  timestamp: string;
  provider: string;
  freshness: 'live' | 'delayed' | 'end-of-day' | 'stale' | 'unavailable';
}

export interface MarketDataProvider {
  getQuote(symbol: string): Promise<TaxMarketQuote>;
  getHistoricalPrice(symbol: string, date: string): Promise<TaxMarketQuote>;
  getFxRate(base: string, quote: string): Promise<TaxMarketQuote>;
  getMutualFundNav(fundId: string): Promise<TaxMarketQuote>;
}

interface MarketQuoteResponse {
  quote?: {
    symbol?: string;
    price?: number;
    currency?: string;
    providerTimestamp?: string;
    retrievedAt?: string;
    providerName?: string;
    freshness?: string;
  };
}

function normalizeFreshness(value?: string): TaxMarketQuote['freshness'] {
  const normalized = value?.toLowerCase();
  if (normalized === 'live') return 'live';
  if (normalized === 'delayed') return 'delayed';
  if (normalized === 'end-of-day' || normalized === 'eod') return 'end-of-day';
  if (normalized === 'stale' || normalized === 'cached') return 'stale';
  return 'unavailable';
}

async function requestQuote(symbol: string, assetType = 'equity'): Promise<TaxMarketQuote> {
  const response = await fetch(`/api/markets/quote?symbol=${encodeURIComponent(symbol)}&assetType=${encodeURIComponent(assetType)}`);
  if (!response.ok) throw new Error('Market data unavailable');
  const body = await response.json() as MarketQuoteResponse;
  const quote = body.quote;
  const freshness = normalizeFreshness(quote?.freshness);
  if (!quote || typeof quote.price !== 'number' || !Number.isFinite(quote.price) || quote.price <= 0 || freshness === 'unavailable') {
    throw new Error('No verified provider quote is available');
  }
  return {
    symbol: quote.symbol ?? symbol,
    price: quote.price,
    currency: quote.currency ?? 'INR',
    timestamp: quote.providerTimestamp ?? quote.retrievedAt ?? new Date().toISOString(),
    provider: quote.providerName ?? 'Configured market provider',
    freshness,
  };
}

export const arthaMarketDataProvider: MarketDataProvider = {
  getQuote: (symbol) => requestQuote(symbol),
  async getHistoricalPrice(symbol, date) {
    const response = await fetch(`/api/markets/history?symbol=${encodeURIComponent(symbol)}&range=1y`);
    if (!response.ok) throw new Error('Historical price unavailable');
    const body = await response.json() as { points?: Array<{ date?: string; price?: number; close?: number }> };
    const target = body.points?.find((point) => point.date?.slice(0, 10) === date);
    const price = target?.price ?? target?.close;
    if (typeof price !== 'number' || !Number.isFinite(price)) throw new Error('Historical price unavailable for selected date');
    return { symbol, price, currency: 'INR', timestamp: date, provider: 'Configured historical market provider', freshness: 'end-of-day' };
  },
  getFxRate: (base, quote) => requestQuote(`${base}${quote}=X`, 'currency'),
  getMutualFundNav: (fundId) => requestQuote(fundId, 'mutual-fund'),
};
