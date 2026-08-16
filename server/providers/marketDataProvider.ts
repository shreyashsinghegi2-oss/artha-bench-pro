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

function buildFallbackQuote(symbol: string, assetType: string): NormalizedMarketQuote {
  const uppercaseSymbol = symbol.toUpperCase();
  const fixture = DEMO_MARKET_QUOTES.find((quote) => quote.symbol === uppercaseSymbol);
  if (fixture) return { ...fixture, retrievedAt: new Date().toISOString() };

  return {
    symbol: uppercaseSymbol,
    name: `${uppercaseSymbol} (Demo)`,
    assetType,
    exchange: null,
    currency: 'USD',
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
  const normalizedSymbol = safeSymbol(symbol);
  const fallbackQuote = buildFallbackQuote(normalizedSymbol, assetType);
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
    url.searchParams.set('symbol', normalizedSymbol);
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

    const quote: NormalizedMarketQuote = {
      symbol: data.symbol || normalizedSymbol,
      name: data.name || data.symbol || normalizedSymbol,
      assetType,
      exchange: data.exchange || null,
      currency: data.currency || 'USD',
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
      // The free plan can include delayed exchange data, so do not overstate freshness.
      freshness: data.is_market_open ? 'delayed' : 'end_of_day',
      providerName: 'Twelve Data',
    };

    return {
      quote,
      status: 'connected',
      message: 'Live Twelve Data quote loaded.',
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

function rangeConfiguration(range: string) {
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
  const normalizedSymbol = safeSymbol(symbol);
  const fallback = historyFallback(normalizedSymbol);
  const { provider, apiKey, baseUrl } = getConfiguration();
  if (!apiKey || (provider !== 'twelvedata' && provider !== 'twelve-data')) return fallback;

  try {
    const url = buildProviderUrl(baseUrl, 'time_series');
    const configuration = rangeConfiguration(range);
    url.searchParams.set('symbol', normalizedSymbol);
    url.searchParams.set('interval', configuration.interval);
    url.searchParams.set('outputsize', configuration.outputsize);
    url.searchParams.set('order', 'ASC');
    url.searchParams.set('apikey', apiKey);

    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const rawData: unknown = await response.json().catch(() => null);
    if (classifyProviderError(rawData, response.status)) return fallback;

    const parsed = timeSeriesResponseSchema.safeParse(rawData);
    if (!parsed.success || parsed.data.values.length === 0) return fallback;

    const points = parsed.data.values
      .map((value) => ({
        date: value.datetime,
        price: toNumber(value.close),
        volume: toNumber(value.volume),
      }))
      .filter((value): value is { date: string; price: number; volume: number | null } =>
        value.price !== null,
      )
      .map((value) => ({
        date: value.date,
        price: value.price,
        ...(value.volume === null ? {} : { volume: value.volume }),
      }));

    return points.length > 0 ? points : fallback;
  } catch {
    return fallback;
  }
}

export async function checkMarketProviderDiagnostic(): Promise<ProviderDiagnostic> {
  const startedAt = Date.now();
  const result = await fetchQuoteFromProvider('AAPL');
  return {
    id: 'market-data',
    name: 'Twelve Data',
    role: 'Stock, ETF, forex, and crypto market data',
    status: result.status,
    lastChecked: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    message: result.message,
  };
}
