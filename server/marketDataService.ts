/**
 * Market Data Service Router
 * Production policy: return provider data or an honest empty/unavailable state.
 * Never substitute demo prices in user-facing production paths.
 */

import { NormalizedMarketQuote } from '../src/types';
import { fetchQuoteFromProvider, fetchHistoryFromProvider } from './providers/marketDataProvider';

function isUsableQuote(quote: NormalizedMarketQuote | null | undefined) {
  return Boolean(
    quote &&
    quote.freshness !== 'demo' &&
    Number.isFinite(quote.price),
  );
}

export async function getMarketQuote(symbol: string, assetType = 'equity') {
  const result = await fetchQuoteFromProvider(symbol, assetType);
  if (result.status !== 'connected' || !isUsableQuote(result.quote)) {
    throw new Error(result.message || `Real market data is unavailable for ${symbol}.`);
  }
  return result;
}

export async function searchMarketQuotes(query: string, assetType = 'all') {
  try {
    const quoteRes = await getMarketQuote(query, assetType);
    return { results: isUsableQuote(quoteRes.quote) ? [quoteRes.quote] : [] };
  } catch {
    return { results: [] };
  }
}

export async function getMarketHistory(symbol: string, range = '1m') {
  const points = await fetchHistoryFromProvider(symbol, range);
  return { points: Array.isArray(points) ? points : [] };
}

export async function getMarketOverview(symbols: string[]) {
  const settled = await Promise.allSettled(symbols.map((symbol) => getMarketQuote(symbol)));
  return settled.flatMap((result) =>
    result.status === 'fulfilled' && isUsableQuote(result.value.quote)
      ? [result.value.quote]
      : [],
  );
}
