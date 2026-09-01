import { INDIA_MARKET_UNIVERSE } from '../src/data/indiaMarketUniverse';
import type { MarketDataAttribution, MarketDataState } from '../src/services/providerContracts';
import type { MarketHistoryPoint, NormalizedMarketQuote } from '../src/types';
import { TWELVE_DATA_INDIA_MAPPINGS, type VerifiedIndiaProviderMapping } from './data/indiaProviderMappings';
import { dedupeMarketRequest, marketCacheConfig, readMarketCache, writeMarketCache } from './marketDataCache';
import { fetchYahooFinanceHistory, fetchYahooFinanceQuote } from './providers/yahooFinanceProvider';
import {
  fetchTwelveDataVerifiedHistory,
  fetchTwelveDataVerifiedQuote,
  isTwelveDataConfigured,
  TwelveDataProviderError,
} from './providers/twelveDataProvider';

type ActiveIndiaProvider = 'yahoo_experimental' | 'twelve_data' | 'hybrid' | 'unavailable';

type FailureCategory =
  | 'authentication'
  | 'missing_configuration'
  | 'unsupported_symbol'
  | 'timeout'
  | 'provider_response_error'
  | 'rate_limit'
  | 'network_error'
  | 'invalid_response';

export type IndiaMarketQuoteResult = {
  assetId: string;
  displayName: string;
  displaySymbol: string;
  providerSymbol: string | null;
  providerExchange: string | null;
  support: 'unknown' | 'supported' | 'unsupported';
  quote: NormalizedMarketQuote | null;
  attribution: MarketDataAttribution;
  reason?: string;
};

export type IndiaMarketHistoryResult = {
  assetId: string;
  points: MarketHistoryPoint[];
  attribution: MarketDataAttribution;
  reason?: string;
};

let lastSuccessfulQuoteFetch: string | null = null;
let lastFailureCategory: FailureCategory | null = null;
let rateLimitState: 'ok' | 'limited' = 'ok';

function activeProvider(): ActiveIndiaProvider {
  const provider = (process.env.MARKET_DATA_PROVIDER || 'hybrid').trim().toLowerCase();
  if (provider === 'twelve_data' || provider === 'twelvedata' || provider === 'twelve-data') return 'twelve_data';
  if (provider === 'yahoo' || provider === 'yahoo_finance' || provider === 'yahoo-finance') return 'yahoo_experimental';
  if (provider === 'hybrid') return 'hybrid';
  return 'unavailable';
}

function providerLabel(provider = activeProvider()) {
  if (provider === 'twelve_data') return 'Twelve Data';
  if (provider === 'yahoo_experimental') return 'Yahoo Finance · experimental/reference';
  if (provider === 'hybrid') return 'Hybrid · Yahoo experimental primary / verified Twelve Data fallback';
  return 'No supported India market provider';
}

function userReason(category: FailureCategory | null, support?: 'unknown' | 'supported' | 'unsupported') {
  if (support === 'unknown') return 'Provider coverage pending. This tracked company does not yet have a verified mapping for the active provider.';
  if (support === 'unsupported') return 'The active provider does not currently supply a verified quote for this tracked company.';
  switch (category) {
    case 'missing_configuration': return 'India market provider is not configured in this deployment. Add the server-side provider key to enable verified quotes.';
    case 'authentication': return 'India market provider authentication failed. The administrator needs to update the server-side configuration.';
    case 'rate_limit': return 'Quote refresh is temporarily limited by the data provider. Try again shortly.';
    case 'unsupported_symbol': return 'The active provider does not currently supply a verified quote for this tracked company.';
    case 'timeout':
    case 'network_error': return 'Market data could not be refreshed right now. Previously verified cached data may be shown with its time.';
    case 'invalid_response':
    case 'provider_response_error': return 'The market provider did not return a usable verified quote for this company.';
    default: return 'Current provider has not returned a verified quote for this symbol.';
  }
}

function stateFromQuote(quote: NormalizedMarketQuote): MarketDataState {
  if (quote.freshness === 'demo') return 'demo';
  if (quote.freshness === 'stale') return 'stale';
  if (quote.freshness === 'delayed') return 'delayed';
  if (quote.freshness === 'end_of_day') return 'end_of_day';
  if (quote.freshness === 'real_time' && quote.providerTimestamp) return 'live_verified';
  if (quote.freshness === 'real_time') return 'recently_refreshed';
  return 'unavailable';
}

function unavailableAttribution(reason: string): MarketDataAttribution {
  return {
    providerName: providerLabel(),
    retrievedAt: new Date().toISOString(),
    state: 'unavailable',
    reason,
  };
}

function mappingForTwelveData(assetId: string): VerifiedIndiaProviderMapping {
  return TWELVE_DATA_INDIA_MAPPINGS[assetId] || {
    providerSymbol: null,
    providerExchange: null,
    support: 'unknown',
    verifiedAt: null,
  };
}

function failureFromError(error: unknown): FailureCategory {
  if (error instanceof TwelveDataProviderError) return error.category;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('rate')) return 'rate_limit';
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('credential') || message.includes('auth')) return 'authentication';
  if (message.includes('symbol') || message.includes('unavailable')) return 'unsupported_symbol';
  return 'provider_response_error';
}

function cacheKey(provider: string, providerSymbol: string, exchange: string | null) {
  return `india:${provider}:${providerSymbol}:${exchange || ''}`;
}

async function retry<T>(loader: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      const category = failureFromError(error);
      if (category === 'authentication' || category === 'missing_configuration' || category === 'unsupported_symbol' || category === 'rate_limit') break;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw lastError;
}

async function loadYahooQuote(displaySymbol: string): Promise<NormalizedMarketQuote> {
  const result = await retry(() => fetchYahooFinanceQuote(displaySymbol, 'equity'));
  if (result.status !== 'connected' || result.quote.freshness === 'demo' || !Number.isFinite(result.quote.price) || result.quote.price < 0) {
    throw new Error(result.message || 'Yahoo Finance quote unavailable.');
  }
  return result.quote;
}

async function loadTwelveQuote(asset: (typeof INDIA_MARKET_UNIVERSE)[number], mapping: VerifiedIndiaProviderMapping): Promise<NormalizedMarketQuote> {
  if (!isTwelveDataConfigured()) throw new TwelveDataProviderError('missing_configuration', 'Twelve Data API key is not configured.');
  if (mapping.support !== 'supported' || !mapping.providerSymbol) throw new TwelveDataProviderError('unsupported_symbol', 'Twelve Data mapping is not verified.');
  return retry(() => fetchTwelveDataVerifiedQuote({
    providerSymbol: mapping.providerSymbol!,
    exchange: mapping.providerExchange,
    assetType: 'equity',
    displaySymbol: asset.providerSymbol,
  }));
}

async function fetchFreshQuote(asset: (typeof INDIA_MARKET_UNIVERSE)[number]): Promise<{ quote: NormalizedMarketQuote; providerSymbol: string; providerExchange: string | null; support: 'supported' }> {
  const provider = activeProvider();
  if (provider === 'twelve_data') {
    const mapping = mappingForTwelveData(asset.id);
    const quote = await loadTwelveQuote(asset, mapping);
    return { quote, providerSymbol: mapping.providerSymbol!, providerExchange: mapping.providerExchange, support: 'supported' };
  }
  if (provider === 'yahoo_experimental') {
    const quote = await loadYahooQuote(asset.providerSymbol);
    return { quote, providerSymbol: asset.providerSymbol, providerExchange: asset.exchange, support: 'supported' };
  }
  if (provider === 'hybrid') {
    try {
      const quote = await loadYahooQuote(asset.providerSymbol);
      return { quote, providerSymbol: asset.providerSymbol, providerExchange: asset.exchange, support: 'supported' };
    } catch (yahooError) {
      const mapping = mappingForTwelveData(asset.id);
      if (mapping.support !== 'supported' || !mapping.providerSymbol || !isTwelveDataConfigured()) throw yahooError;
      const quote = await loadTwelveQuote(asset, mapping);
      return { quote, providerSymbol: mapping.providerSymbol, providerExchange: mapping.providerExchange, support: 'supported' };
    }
  }
  throw new TwelveDataProviderError('missing_configuration', 'No supported India market provider is selected.');
}

async function getOneQuote(asset: (typeof INDIA_MARKET_UNIVERSE)[number]): Promise<IndiaMarketQuoteResult> {
  const provider = activeProvider();
  const twelveMapping = mappingForTwelveData(asset.id);
  if (provider === 'twelve_data' && (twelveMapping.support !== 'supported' || !twelveMapping.providerSymbol)) {
    const reason = userReason(null, twelveMapping.support);
    return {
      assetId: asset.id,
      displayName: asset.displayName,
      displaySymbol: asset.providerSymbol,
      providerSymbol: twelveMapping.providerSymbol,
      providerExchange: twelveMapping.providerExchange,
      support: twelveMapping.support,
      quote: null,
      attribution: unavailableAttribution(reason),
      reason,
    };
  }

  const intendedProviderSymbol = provider === 'twelve_data' ? twelveMapping.providerSymbol! : asset.providerSymbol;
  const intendedExchange = provider === 'twelve_data' ? twelveMapping.providerExchange : asset.exchange;
  const key = cacheKey(provider, intendedProviderSymbol, intendedExchange);
  const cached = readMarketCache<{ quote: NormalizedMarketQuote; providerSymbol: string; providerExchange: string | null }>(key);
  if (cached?.state === 'fresh') {
    return {
      assetId: asset.id,
      displayName: asset.displayName,
      displaySymbol: asset.providerSymbol,
      providerSymbol: cached.value.providerSymbol,
      providerExchange: cached.value.providerExchange,
      support: 'supported',
      quote: cached.value.quote,
      attribution: {
        providerName: cached.value.quote.providerName,
        exchange: cached.value.quote.exchange || undefined,
        quoteTimestamp: cached.value.quote.providerTimestamp || undefined,
        retrievedAt: cached.value.quote.retrievedAt,
        state: 'cached',
        staleAfter: new Date(Date.now() + marketCacheConfig().ttlMs).toISOString(),
      },
    };
  }

  try {
    const fresh = await dedupeMarketRequest(key, () => fetchFreshQuote(asset));
    writeMarketCache(key, { quote: fresh.quote, providerSymbol: fresh.providerSymbol, providerExchange: fresh.providerExchange });
    lastSuccessfulQuoteFetch = new Date().toISOString();
    lastFailureCategory = null;
    rateLimitState = 'ok';
    return {
      assetId: asset.id,
      displayName: asset.displayName,
      displaySymbol: asset.providerSymbol,
      providerSymbol: fresh.providerSymbol,
      providerExchange: fresh.providerExchange,
      support: 'supported',
      quote: fresh.quote,
      attribution: {
        providerName: fresh.quote.providerName,
        exchange: fresh.quote.exchange || undefined,
        quoteTimestamp: fresh.quote.providerTimestamp || undefined,
        retrievedAt: fresh.quote.retrievedAt,
        state: stateFromQuote(fresh.quote),
      },
    };
  } catch (error) {
    const category = failureFromError(error);
    lastFailureCategory = category;
    if (category === 'rate_limit') rateLimitState = 'limited';
    if (cached) {
      return {
        assetId: asset.id,
        displayName: asset.displayName,
        displaySymbol: asset.providerSymbol,
        providerSymbol: cached.value.providerSymbol,
        providerExchange: cached.value.providerExchange,
        support: 'supported',
        quote: cached.value.quote,
        attribution: {
          providerName: cached.value.quote.providerName,
          exchange: cached.value.quote.exchange || undefined,
          quoteTimestamp: cached.value.quote.providerTimestamp || undefined,
          retrievedAt: cached.value.quote.retrievedAt,
          state: 'stale',
          reason: userReason(category),
        },
        reason: userReason(category),
      };
    }
    const reason = userReason(category, category === 'unsupported_symbol' ? 'unsupported' : undefined);
    return {
      assetId: asset.id,
      displayName: asset.displayName,
      displaySymbol: asset.providerSymbol,
      providerSymbol: intendedProviderSymbol,
      providerExchange: intendedExchange,
      support: category === 'unsupported_symbol' ? 'unsupported' : 'supported',
      quote: null,
      attribution: unavailableAttribution(reason),
      reason,
    };
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return output;
}

export async function getIndiaMarketQuotes(assetIds: string[]): Promise<IndiaMarketQuoteResult[]> {
  const uniqueIds = [...new Set(assetIds.map((id) => id.trim()).filter(Boolean))].slice(0, 20);
  const requested = new Set(uniqueIds);
  const assets = INDIA_MARKET_UNIVERSE.filter((asset) => requested.has(asset.id));
  return mapWithConcurrency(assets, 4, getOneQuote);
}

export function searchIndiaMarketIdentities(query: string) {
  const needle = query.trim().toLowerCase();
  return INDIA_MARKET_UNIVERSE.filter((asset) => !needle || [
    asset.id,
    asset.officialName,
    asset.displayName,
    asset.providerSymbol,
    asset.exchange,
    asset.sector,
    asset.industry,
  ].some((value) => value.toLowerCase().includes(needle))).slice(0, 50).map((asset) => {
    const mapping = mappingForTwelveData(asset.id);
    return {
      id: asset.id,
      displayName: asset.displayName,
      officialName: asset.officialName,
      displaySymbol: asset.providerSymbol,
      exchange: asset.exchange,
      sector: asset.sector,
      industry: asset.industry,
      activeProvider: activeProvider(),
      providerSupport: activeProvider() === 'twelve_data' ? mapping.support : 'unknown',
    };
  });
}

export async function getIndiaMarketHistory(assetId: string, range: string): Promise<IndiaMarketHistoryResult> {
  const asset = INDIA_MARKET_UNIVERSE.find((item) => item.id === assetId);
  if (!asset) {
    const reason = 'Historical data is unavailable from the active provider for this range.';
    return { assetId, points: [], attribution: unavailableAttribution(reason), reason };
  }
  const provider = activeProvider();
  try {
    let points: MarketHistoryPoint[] = [];
    let providerName = providerLabel(provider);
    let sourceSymbol = asset.providerSymbol;
    if (provider === 'twelve_data') {
      const mapping = mappingForTwelveData(asset.id);
      if (mapping.support !== 'supported' || !mapping.providerSymbol) throw new TwelveDataProviderError('unsupported_symbol', 'Twelve Data mapping is not verified.');
      sourceSymbol = mapping.providerSymbol;
      providerName = 'Twelve Data';
      points = await fetchTwelveDataVerifiedHistory({ providerSymbol: mapping.providerSymbol, exchange: mapping.providerExchange, range });
    } else if (provider === 'yahoo_experimental' || provider === 'hybrid') {
      providerName = 'Yahoo Finance';
      points = await fetchYahooFinanceHistory(asset.providerSymbol, range);
      if (!points.length && provider === 'hybrid') {
        const mapping = mappingForTwelveData(asset.id);
        if (mapping.support === 'supported' && mapping.providerSymbol && isTwelveDataConfigured()) {
          sourceSymbol = mapping.providerSymbol;
          providerName = 'Twelve Data';
          points = await fetchTwelveDataVerifiedHistory({ providerSymbol: mapping.providerSymbol, exchange: mapping.providerExchange, range });
        }
      }
    }
    if (!points.length) {
      const reason = 'Historical data is unavailable from the active provider for this range.';
      return { assetId, points: [], attribution: { ...unavailableAttribution(reason), providerName }, reason };
    }
    return {
      assetId,
      points,
      attribution: {
        providerName,
        exchange: asset.exchange,
        retrievedAt: new Date().toISOString(),
        state: 'end_of_day',
        reason: `History loaded for verified source mapping ${sourceSymbol}.`,
      },
    };
  } catch (error) {
    const reason = userReason(failureFromError(error));
    return { assetId, points: [], attribution: unavailableAttribution(reason), reason };
  }
}

export function getIndiaMarketStatus() {
  const provider = activeProvider();
  const verifiedMappings = provider === 'twelve_data'
    ? INDIA_MARKET_UNIVERSE.filter((asset) => {
        const mapping = mappingForTwelveData(asset.id);
        return mapping.support === 'supported' && Boolean(mapping.providerSymbol) && Boolean(mapping.verifiedAt);
      }).length
    : 0;
  const unknownMappings = provider === 'twelve_data'
    ? INDIA_MARKET_UNIVERSE.length - verifiedMappings
    : INDIA_MARKET_UNIVERSE.length;
  const configured = provider === 'twelve_data' ? isTwelveDataConfigured() : provider !== 'unavailable';
  return {
    capability: 'India market quotes',
    provider: providerLabel(provider),
    providerId: provider,
    configured,
    apiKeyPresent: provider === 'twelve_data' ? isTwelveDataConfigured() : false,
    totalTrackedAssets: INDIA_MARKET_UNIVERSE.length,
    verifiedMappings,
    unknownMappings,
    lastSuccessfulQuoteFetch,
    lastFailureCategory,
    rateLimitState,
    cache: {
      ttlSeconds: Math.round(marketCacheConfig().ttlMs / 1_000),
      staleThresholdMinutes: Math.round(marketCacheConfig().staleMs / 60_000),
    },
    status: !configured ? 'No key configured' : provider === 'twelve_data' && verifiedMappings === 0 ? 'Partial coverage' : lastFailureCategory ? 'Partial coverage' : 'Connected',
  };
}
