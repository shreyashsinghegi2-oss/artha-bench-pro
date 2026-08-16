/**
 * Market Data Service Router
 */

import { NormalizedMarketQuote } from '../src/types';
import { fetchQuoteFromProvider, fetchHistoryFromProvider } from './providers/marketDataProvider';
import { DEMO_MARKET_QUOTES } from '../src/data/marketFixtures';

export async function getMarketQuote(symbol: string, assetType = 'equity') {
  return fetchQuoteFromProvider(symbol, assetType);
}

export async function searchMarketQuotes(query: string, assetType = 'all') {
  const apiKey = process.env.MARKET_DATA_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    const q = query.toLowerCase();
    const results = DEMO_MARKET_QUOTES.filter(
      (item) =>
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
    );
    return { results };
  }

  // If live provider configured, attempt query or fallback
  try {
    const quoteRes = await fetchQuoteFromProvider(query, assetType);
    return { results: [quoteRes.quote] };
  } catch {
    return { results: DEMO_MARKET_QUOTES };
  }
}

export async function getMarketHistory(symbol: string, range = '1m') {
  const points = await fetchHistoryFromProvider(symbol, range);
  return { points };
}

export async function getMarketOverview(symbols: string[]) {
  const quotes = await Promise.all(
    symbols.map(async (s) => {
      try {
        const res = await getMarketQuote(s);
        return res.quote;
      } catch {
        const found = DEMO_MARKET_QUOTES.find((q) => q.symbol === s);
        return found || null;
      }
    })
  );
  return quotes.filter(Boolean);
}
