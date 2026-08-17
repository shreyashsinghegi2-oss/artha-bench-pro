/**
 * Twelve Data server adapter.
 *
 * Credentials are read only from server-side environment variables:
 * MARKET_DATA_PROVIDER, MARKET_DATA_API_KEY, MARKET_DATA_BASE_URL.
 */

import { z } from 'zod';
import { MarketHistoryPoint, NormalizedMarketQuote, ProviderDiagnostic } from '../../src/types';
import { DEMO_MARKET_HISTORY, DEMO_MARKET_QUOTES } from '../../src/data/marketFixtures';

const DEFAULT_TWELVE_DATA_QUOTE_URL = 'https://api.twelvedata.com/quote';

const quoteResponseSchema = z.object({
  symbol: z.string().optional(),
  name: z.string().optional(),
  exchange: z.string().nullable().optional(),
  currency: z.string().optional(),
  datetime: z.string().nullable().optional(),
  timestamp: z.union([z.string(), z.number()]).nullable().optional(),
  open: z.union([z.string(), z.number()]).nullable().optional(),
  high: z.union([z.string(), z.number()]).nullable().optional(),
  low: z.union([z.string(), z.number()]).nullable().optional(),
  close: z.union([z.string(), z.number()]).nullable().optional(),
  price: z.union([z.string(), z.number()]).nullable().optional(),
  previous_close: z.union([z.string(), z.number()]).nullable().optional(),
  change: z.union([z.string(), z.number()]).nullable().optional(),
  percent_change: z.union([z.string(), z.number()]).nullable().optional(),
  volume: z.union([z.string(), z.number()]).nullable().optional(),
  is_market_open: z.boolean().optional(),
}).passthrough();

const timeSeriesResponseSchema = z.object({
  status: z.string().optional(),
  values: z.array(
    z.object({
      datetime: z.string(),
      open: z.union([z.string(), z.number()]).nullable().optional(),
      high: z.union([z.string(), z.number()]).nullable().optional(),
      low: z.union([z.string(), z.number()]).nullable().optional(),
      close: z.union([z.string(), z.number()]),
      volume: z.union([z.string(), z.number()]).nullable().optional(),
    }).passthrough(),
  ).optional().default([]),
}).passthrough();

export interface MarketQuoteProviderResult {
  quote: NormalizedMarketQuote;
  status:
    | 'connected'
    | 'not_configured'
    | 'invalid_credentials'
    | 'invalid_response'
    | 'rate_limited'
    | 'error';
  message?: string;
}

function getConfiguration() {
  return {
    provider: (process.env.MARKET_DATA_PROVIDER || 'twelvedata').trim().toLowerCase(),
    apiKey: process.env.MARKET_DATA_API_KEY?.trim() || '',
    baseUrl: process.env.MARKET_DATA_BASE_URL?.trim() || DEFAULT_TWELVE_DATA_QUOTE_URL,
  };
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

const INDIA_EXCHANGE_ALIASES: Record<string, 'NSE' | 'BSE'> = {
  NSE: 'NSE',
  XNSE: 'NSE',
  NS: 'NSE',
  BSE: 'BSE',
  XBOM: 'BSE',
  BO: 'BSE',
};

export interface NormalizedTwelveDataSymbol {
  providerSymbol: string;
  baseSymbol: string;
  exchange: 'NSE' | 'BSE' | null;
}

/**
 * Twelve Data accepts exchange-qualified symbols as SYMBOL:EXCHANGE.
 * Also accept common Yahoo- and TradingView-style inputs at our boundary so
 * callers never need provider-specific conversion logic.
 */
export function normalizeTwelveDataSymbol(symbol: string): NormalizedTwelveDataSymbol {
  let normalized = symbol.trim().toUpperCase();
  let exchange: 'NSE' | 'BSE' | null = null;

  const yahooSuffix = normalized.match(/^(.+)\.(NS|BO)$/);
  if (yahooSuffix) {
    normalized = yahooSuffix[1];
    exchange = INDIA_EXCHANGE_ALIASES[yahooSuffix[2]];
  } else {
    const qualified = normalized.match(/^([^:]+):([^:]+)$/);
    if (qualified) {
      const prefixExchange = INDIA_EXCHANGE_ALIASES[qualified[1]];
      const suffixExchange = INDIA_EXCHANGE_ALIASES[qualified[2]];
      if (prefixExchange) {
        normalized = qualified[2];
        exchange = prefixExchange;
      } else if (suffixExchange) {
        normalized = qualified[1];
        exchange = suffixExchange;
      }
    }
  }

  const baseSymbol = safeSymbol(normalized);
  return {
    providerSymbol: exchange ? `${baseSymbol}:${exchange}` : baseSymbol,
    baseSymbol,
    exchange,
  };
}

function isIndianExchange(exchange: string | null | undefined) {
  if (!exchange) return false;
  return Boolean(INDIA_EXCHANGE_ALIASES[exchange.trim().toUpperCase()]);
}

function resolveQuoteFreshness(
  exchange: string | null | undefined,
  isMarketOpen: boolean | undefined,
): NormalizedMarketQuote['freshness'] {
  // Twelve Data currently classifies its India stock coverage as EOD. Keep
  // this conservative even if an exchange session happens to be open.
  if (isIndianExchange(exchange)) return 'end_of_day';
  return isMarketOpen ? 'delayed' : 'end_of_day';
}

function buildFallbackQuote(symbol: string, assetType: string): NormalizedMarketQuote {
  const uppercaseSymbol = symbol.toUpperCase();
  const fixture = DEMO_MARKET_QUOTES.find((quote) => quote.symbol === uppercaseSymbol);
  if (fixture) return { ...fixture, retrievedAt: new Date().toISOString() };

  const exchange = uppercaseSymbol.endsWith(':NSE')
    ? 'NSE'
    : uppercaseSymbol.endsWith(':BSE')
      ? 'BSE'
      : null;
  const baseSymbol = exchange ? uppercaseSymbol.slice(0, -(exchange.length + 1)) : uppercaseSymbol;

  return {
    symbol: uppercaseSymbol,
    name: `${baseSymbol} (Demo)`,
    assetType,
    exchange,
    currency: exchange ? 'INR' : 'USD',
    price: 100,
    open: 100,
    high: 100,
    low: 100,
    previousClose: 100,
    change: 0,
    changePercent: 0,
    volume: 0,
    providerTimestamp: null,
    retrievedAt: new Date().toISOString(),
    freshness: 'demo',
    providerName: 'Demo Market Fixtures',
  };
}

function buildProviderUrl(baseUrl: string, endpoint: 'quote' | 'time_series') {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:') {
    throw new Error('Market provider URL must use HTTPS.');
  }
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0) segments.push(endpoint);
  else segments[segments.length - 1] = endpoint;
  url.pathname = `/${segments.join('/')}`;
  url.search = '';
  return url;
}

function classifyProviderError(data: unknown, httpStatus?: number) {
  const body =
    data && typeof data === 'object'
      ? (data as { status?: unknown; code?: unknown; message?: unknown })
      : {};
  const code = typeof body.code === 'number' ? body.code : httpStatus;
  const isError = body.status === 'error' || (httpStatus !== undefined && httpStatus >= 400);

  if (!isError) return null;
  if (code === 401 || code === 403) return 'invalid_credentials' as const;
  if (code === 429) return 'rate_limited' as const;
  return 'error' as const;
}

function safeSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.:/_-]{0,24}$/.test(normalized)) {
    throw new Error('Invalid market symbol.');
  }
  return normalized;
}

export async function fetchQuoteFromProvider(
  symbol: string,
  assetType = 'equity',
): Promise<MarketQuoteProviderResult> {
  const normalizedSymbol = normalizeTwelveDataSymbol(symbol);
  const fallbackQuote = buildFallbackQuote(normalizedSymbol.providerSymbol, assetType);
  const { provider, apiKey, baseUrl } = getConfiguration();

  if (!apiKey) {
    return {
      quote: fallbackQuote,
      status: 'not_configured',
      message: 'Twelve Data API key is not configured. Displaying a labelled demo quote.',
    };
  }

  if (provider !== 'twelvedata' && provider !== 'twelve-data') {
    return {
      quote: fallbackQuote,
      status: 'error',
      message: 'Unsupported market-data provider configuration.',
    };
  }

  try {
    const url = buildProviderUrl(baseUrl, 'quote');
    url.searchParams.set('symbol', normalizedSymbol.providerSymbol);
    url.searchParams.set('apikey', apiKey);

    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const rawData: unknown = await response.json().catch(() => null);
    const providerError = classifyProviderError(rawData, response.status);
    if (providerError) {
      return {
        quote: fallbackQuote,
        status: providerError,
        message:
          providerError === 'invalid_credentials'
            ? 'Twelve Data rejected the configured credential.'
            : providerError === 'rate_limited'
              ? 'Twelve Data rate limit reached. Displaying a labelled demo quote.'
              : `Twelve Data request failed with HTTP ${response.status}.`,
      };
    }

    const parsed = quoteResponseSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        quote: fallbackQuote,
        status: 'invalid_response',
        message: 'Twelve Data returned an unexpected quote response.',
      };
    }

    const data = parsed.data;
    const price = toNumber(data.close) ?? toNumber(data.price);
    if (price === null) {
      return {
        quote: fallbackQuote,
        status: 'invalid_response',
        message: 'Twelve Data did not return a usable market price.',
      };
    }

    const previousClose = toNumber(data.previous_close);
    const change = toNumber(data.change) ?? (previousClose === null ? null : price - previousClose);
    const changePercent =
      toNumber(data.percent_change) ??
      (previousClose && change !== null ? (change / previousClose) * 100 : null);

    const responseIndiaExchange = data.exchange
      ? INDIA_EXCHANGE_ALIASES[data.exchange.trim().toUpperCase()] || null
      : null;
    const indiaExchange = normalizedSymbol.exchange || responseIndiaExchange;
    const responseBaseSymbol = data.symbol
      ? normalizeTwelveDataSymbol(data.symbol).baseSymbol
      : normalizedSymbol.baseSymbol;

    const quote: NormalizedMarketQuote = {
      symbol: indiaExchange
        ? `${responseBaseSymbol}:${indiaExchange}`
        : data.symbol || normalizedSymbol.baseSymbol,
      name: data.name || data.symbol || normalizedSymbol.baseSymbol,
      assetType,
      exchange: indiaExchange || data.exchange || null,
      currency: data.currency || (indiaExchange ? 'INR' : 'USD'),
      price,
      open: toNumber(data.open),
      high: toNumber(data.high),
      low: toNumber(data.low),
      previousClose,
      change: change ?? 0,
      changePercent: changePercent ?? 0,
      volume: toNumber(data.volume),
      providerTimestamp:
        data.datetime ||
        (data.timestamp !== null && data.timestamp !== undefined ? String(data.timestamp) : null),
      retrievedAt: new Date().toISOString(),
      freshness: resolveQuoteFreshness(
        indiaExchange || data.exchange,
        data.is_market_open,
      ),
      providerName: 'Twelve Data',
    };

    return {
      quote,
      status: 'connected',
      message: indiaExchange
        ? 'Twelve Data India end-of-day quote loaded.'
        : 'Twelve Data quote loaded with conservative freshness labelling.',
    };
  } catch {
    return {
      quote: fallbackQuote,
      status: 'error',
      message: 'Twelve Data is temporarily unreachable. Displaying a labelled demo quote.',
    };
  }
}

function historyFallback(symbol: string): MarketHistoryPoint[] {
  const normalizedSymbol = symbol.toUpperCase();
  if (DEMO_MARKET_HISTORY[normalizedSymbol]) {
    return DEMO_MARKET_HISTORY[normalizedSymbol];
  }

  const points: MarketHistoryPoint[] = [];
  const now = new Date();
  for (let daysAgo = 30; daysAgo >= 0; daysAgo -= 5) {
    const date = new Date(now.getTime() - daysAgo * 86_400_000);
    points.push({
      date: date.toISOString().split('T')[0],
      price: 100,
    });
  }
  return points;
}

function rangeConfiguration(range: string, indiaEndOfDay = false) {
  if (indiaEndOfDay) {
    const indiaConfigurations: Record<string, { interval: string; outputsize: string }> = {
      '1d': { interval: '1day', outputsize: '2' },
      '1w': { interval: '1day', outputsize: '5' },
      '1m': { interval: '1day', outputsize: '30' },
      '3m': { interval: '1day', outputsize: '90' },
      '6m': { interval: '1day', outputsize: '180' },
      '1y': { interval: '1day', outputsize: '365' },
    };
    return indiaConfigurations[range] || indiaConfigurations['1m'];
  }

  const configurations: Record<string, { interval: string; outputsize: string }> = {
    '1d': { interval: '5min', outputsize: '78' },
    '1w': { interval: '1h', outputsize: '40' },
    '1m': { interval: '1day', outputsize: '30' },
    '3m': { interval: '1day', outputsize: '90' },
    '6m': { interval: '1week', outputsize: '26' },
    '1y': { interval: '1week', outputsize: '52' },
  };
  return configurations[range] || configurations['1m'];
}

export async function fetchHistoryFromProvider(
  symbol: string,
  range = '1m',
): Promise<MarketHistoryPoint[]> {
  const normalizedSymbol = normalizeTwelveDataSymbol(symbol);
  const fallback = historyFallback(normalizedSymbol.providerSymbol);
  const { provider, apiKey, baseUrl } = getConfiguration();
  if (!apiKey || (provider !== 'twelvedata' && provider !== 'twelve-data')) return fallback;

  try {
    const url = buildProviderUrl(baseUrl, 'time_series');
    const configuration = rangeConfiguration(range, normalizedSymbol.exchange !== null);
    url.searchParams.set('symbol', normalizedSymbol.providerSymbol);
    url.searchParams.set('interval', configuration.interval);
    url.searchParams.set('outputsize', configuration.outputsize);
    url.searchParams.set('order', 'ASC');
    url.searchParams.set('apikey', apiKey);

    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const rawData: unknown = await response.json().catch(() => null);
    if (classifyProviderError(rawData, response.status)) return fallback;

    const parsed = timeSeriesResponseSchema.safeParse(rawData);
    if (!parsed.success || parsed.data.values.length === 0) return fallback;

    const points = parsed.data.values.flatMap((value): MarketHistoryPoint[] => {
      const close = toNumber(value.close);
      if (close === null) return [];
      const open = toNumber(value.open);
      const high = toNumber(value.high);
      const low = toNumber(value.low);
      const volume = toNumber(value.volume);
      return [{
        date: value.datetime,
        price: close,
        ...(open === null ? {} : { open }),
        ...(high === null ? {} : { high }),
        ...(low === null ? {} : { low }),
        close,
        ...(volume === null ? {} : { volume }),
      }];
    });

    return points.length > 0 ? points : fallback;
  } catch {
    return fallback;
  }
}

export async function checkMarketProviderDiagnostic(): Promise<ProviderDiagnostic> {
  const startedAt = Date.now();
  const result = await fetchQuoteFromProvider('INFY:NSE');
  return {
    id: 'market-data',
    name: 'Twelve Data India',
    role: 'Global market data with conservatively labelled India EOD coverage',
    status: result.status,
    lastChecked: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    message: result.message,
  };
}
