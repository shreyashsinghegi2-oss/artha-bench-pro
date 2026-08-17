import type {
  IndiaMarketTickerItem,
  IndiaMarketTickerResponse,
} from '../src/types';
import { fetchYahooFinanceQuote } from './providers/yahooFinanceProvider';

const TICKER_CACHE_MS = 45_000;
const MAX_CONCURRENT_REQUESTS = 2;
const SOURCE_LABEL = 'Yahoo Finance · delayed / availability varies';

const INDIA_MARKET_INSTRUMENTS = [
  { id: 'nifty-50', label: 'NIFTY 50', yahooSymbol: '^NSEI', assetType: 'index' },
  { id: 'bank-nifty', label: 'BANK NIFTY', yahooSymbol: '^NSEBANK', assetType: 'index' },
  { id: 'sensex', label: 'SENSEX', yahooSymbol: '^BSESN', assetType: 'index' },
  { id: 'reliance', label: 'RELIANCE', yahooSymbol: 'RELIANCE.NS', assetType: 'equity' },
  { id: 'tcs', label: 'TCS', yahooSymbol: 'TCS.NS', assetType: 'equity' },
  { id: 'hdfcbank', label: 'HDFCBANK', yahooSymbol: 'HDFCBANK.NS', assetType: 'equity' },
  { id: 'infy', label: 'INFY', yahooSymbol: 'INFY.NS', assetType: 'equity' },
  { id: 'icicibank', label: 'ICICIBANK', yahooSymbol: 'ICICIBANK.NS', assetType: 'equity' },
] as const;

let cache: { expiresAt: number; payload: IndiaMarketTickerResponse } | undefined;
let inFlightRequest: Promise<IndiaMarketTickerResponse> | undefined;

function unavailableItem(
  instrument: (typeof INDIA_MARKET_INSTRUMENTS)[number],
): IndiaMarketTickerItem {
  return {
    id: instrument.id,
    label: instrument.label,
    yahooSymbol: instrument.yahooSymbol,
    status: 'unavailable',
    price: null,
    change: null,
    changePercent: null,
    currency: null,
    freshness: null,
    providerTimestamp: null,
  };
}

async function fetchTickerItem(
  instrument: (typeof INDIA_MARKET_INSTRUMENTS)[number],
): Promise<IndiaMarketTickerItem> {
  try {
    const result = await fetchYahooFinanceQuote(
      instrument.yahooSymbol,
      instrument.assetType,
    );
    const { quote } = result;
    const isUsable =
      result.status === 'connected' &&
      quote.freshness !== 'demo' &&
      quote.freshness !== 'stale' &&
      Number.isFinite(quote.price);

    if (!isUsable) return unavailableItem(instrument);

    return {
      id: instrument.id,
      label: instrument.label,
      yahooSymbol: instrument.yahooSymbol,
      status: 'available',
      price: quote.price,
      change: Number.isFinite(quote.change) ? quote.change : null,
      changePercent: Number.isFinite(quote.changePercent)
        ? quote.changePercent
        : null,
      currency: quote.currency || null,
      freshness: quote.freshness,
      providerTimestamp: quote.providerTimestamp,
    };
  } catch {
    return unavailableItem(instrument);
  }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(values[currentIndex]);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

async function loadIndiaMarketTicker(): Promise<IndiaMarketTickerResponse> {
  const items = await mapWithConcurrency(
    INDIA_MARKET_INSTRUMENTS,
    MAX_CONCURRENT_REQUESTS,
    fetchTickerItem,
  );
  const availableCount = items.filter((item) => item.status === 'available').length;
  const status = availableCount === items.length
    ? 'available'
    : availableCount > 0
      ? 'partial'
      : 'unavailable';

  return {
    status,
    sourceLabel: SOURCE_LABEL,
    retrievedAt: new Date().toISOString(),
    items,
  };
}

export async function getIndiaMarketTicker(): Promise<IndiaMarketTickerResponse> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.payload;
  if (inFlightRequest) return inFlightRequest;

  inFlightRequest = loadIndiaMarketTicker()
    .then((payload) => {
      cache = { expiresAt: Date.now() + TICKER_CACHE_MS, payload };
      return payload;
    })
    .finally(() => {
      inFlightRequest = undefined;
    });

  return inFlightRequest;
}

export function resetIndiaMarketTickerCacheForTests() {
  cache = undefined;
  inFlightRequest = undefined;
}
