/**
 * Production market-data adapter.
 *
 * Policy:
 * - Yahoo Finance is the no-key primary source by default.
 * - Twelve Data can be used as a configured fallback when an API key exists.
 * - Provider failures return an unavailable/error state; they never manufacture prices.
 */

import { z } from 'zod';
import type { MarketHistoryPoint, NormalizedMarketQuote, ProviderDiagnostic } from '../../src/types';
import {
  fetchYahooFinanceHistory,
  fetchYahooFinanceQuote,
  isYahooFinanceProvider,
} from './yahooFinanceProvider';

const DEFAULT_TWELVE_DATA_QUOTE_URL = 'https://api.twelvedata.com/quote';

type ProviderStatus =
  | 'connected'
  | 'not_configured'
  | 'invalid_credentials'
  | 'invalid_response'
  | 'rate_limited'
  | 'error';

export interface MarketQuoteProviderResult {
  quote: NormalizedMarketQuote;
  status: ProviderStatus;
  message?: string;
}

type NamedMarketProvider = 'yahoo' | 'twelvedata';

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
  values: z.array(z.object({
    datetime: z.string(),
    open: z.union([z.string(), z.number()]).nullable().optional(),
    high: z.union([z.string(), z.number()]).nullable().optional(),
    low: z.union([z.string(), z.number()]).nullable().optional(),
    close: z.union([z.string(), z.number()]),
    volume: z.union([z.string(), z.number()]).nullable().optional(),
  }).passthrough()).optional().default([]),
}).passthrough();

const INDIA_EXCHANGE_ALIASES: Record<string, 'NSE' | 'BSE'> = {
  NSE: 'NSE', XNSE: 'NSE', NS: 'NSE',
  BSE: 'BSE', XBOM: 'BSE', BO: 'BSE',
};

export interface NormalizedTwelveDataSymbol {
  providerSymbol: string;
  baseSymbol: string;
  exchange: 'NSE' | 'BSE' | null;
}

function getConfiguration() {
  return {
    provider: (process.env.MARKET_DATA_PROVIDER || 'hybrid').trim().toLowerCase(),
    primaryProvider: (process.env.MARKET_DATA_PRIMARY_PROVIDER || 'yahoo').trim().toLowerCase(),
    fallbackProvider: (process.env.MARKET_DATA_FALLBACK_PROVIDER || 'twelvedata').trim().toLowerCase(),
    apiKey: process.env.MARKET_DATA_API_KEY?.trim() || '',
    baseUrl: process.env.MARKET_DATA_BASE_URL?.trim() || DEFAULT_TWELVE_DATA_QUOTE_URL,
  };
}

type MarketProviderConfiguration = ReturnType<typeof getConfiguration>;

function safeSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.:/_-]{0,24}$/.test(normalized)) throw new Error('Invalid market symbol.');
  return normalized;
}

export function normalizeTwelveDataSymbol(symbol: string): NormalizedTwelveDataSymbol {
  let normalized = symbol.trim().toUpperCase();
  let exchange: 'NSE' | 'BSE' | null = null;
  const yahooSuffix = normalized.match(/^(.+)\.(NS|BO)$/);
  if (yahooSuffix) {
    normalized = yahooSuffix[1];
    exchange = yahooSuffix[2] === 'NS' ? 'NSE' : 'BSE';
  } else {
    const qualified = normalized.match(/^([^:]+):([^:]+)$/);
    if (qualified) {
      const prefix = INDIA_EXCHANGE_ALIASES[qualified[1]];
      const suffix = INDIA_EXCHANGE_ALIASES[qualified[2]];
      if (prefix) { exchange = prefix; normalized = qualified[2]; }
      else if (suffix) { exchange = suffix; normalized = qualified[1]; }
    }
  }
  const baseSymbol = safeSymbol(normalized);
  return { providerSymbol: exchange ? `${baseSymbol}:${exchange}` : baseSymbol, baseSymbol, exchange };
}

function normalizeProviderName(provider: string): NamedMarketProvider | null {
  if (isYahooFinanceProvider(provider)) return 'yahoo';
  if (provider === 'twelvedata' || provider === 'twelve-data') return 'twelvedata';
  return null;
}

function providerLabel(provider: NamedMarketProvider) {
  return provider === 'yahoo' ? 'Yahoo Finance' : 'Twelve Data';
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildProviderUrl(baseUrl: string, endpoint: 'quote' | 'time_series') {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:') throw new Error('Market provider URL must use HTTPS.');
  const segments = url.pathname.split('/').filter(Boolean);
  if (!segments.length) segments.push(endpoint);
  else segments[segments.length - 1] = endpoint;
  url.pathname = `/${segments.join('/')}`;
  url.search = '';
  return url;
}

function classifyProviderError(data: unknown, httpStatus?: number): ProviderStatus | null {
  const body = data && typeof data === 'object' ? data as { status?: unknown; code?: unknown } : {};
  const code = typeof body.code === 'number' ? body.code : httpStatus;
  const isError = body.status === 'error' || (httpStatus !== undefined && httpStatus >= 400);
  if (!isError) return null;
  if (code === 401 || code === 403) return 'invalid_credentials';
  if (code === 429) return 'rate_limited';
  return 'error';
}

function isIndianExchange(exchange: string | null | undefined) {
  return Boolean(exchange && INDIA_EXCHANGE_ALIASES[exchange.trim().toUpperCase()]);
}

function twelveFreshness(exchange: string | null | undefined, isMarketOpen: boolean | undefined): NormalizedMarketQuote['freshness'] {
  if (isIndianExchange(exchange)) return 'end_of_day';
  return isMarketOpen ? 'delayed' : 'end_of_day';
}

async function fetchTwelveDataQuote(symbol: string, assetType: string, configuration: MarketProviderConfiguration): Promise<MarketQuoteProviderResult> {
  if (!configuration.apiKey) throw new Error('Twelve Data API key is not configured.');
  const normalized = normalizeTwelveDataSymbol(symbol);
  const url = buildProviderUrl(configuration.baseUrl, 'quote');
  url.searchParams.set('symbol', normalized.providerSymbol);
  url.searchParams.set('apikey', configuration.apiKey);

  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  const raw: unknown = await response.json().catch(() => null);
  const providerError = classifyProviderError(raw, response.status);
  if (providerError) throw new Error(`Twelve Data returned ${providerError}.`);

  const parsed = quoteResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Twelve Data returned an invalid quote response.');
  const data = parsed.data;
  const price = toNumber(data.close) ?? toNumber(data.price);
  if (price === null) throw new Error('Twelve Data returned no usable price.');
  const previousClose = toNumber(data.previous_close);
  const change = toNumber(data.change) ?? (previousClose === null ? 0 : price - previousClose);
  const changePercent = toNumber(data.percent_change) ?? (previousClose ? change / previousClose * 100 : 0);
  const responseExchange = data.exchange ? INDIA_EXCHANGE_ALIASES[data.exchange.toUpperCase()] || null : null;
  const indiaExchange = normalized.exchange || responseExchange;
  const responseBase = data.symbol ? normalizeTwelveDataSymbol(data.symbol).baseSymbol : normalized.baseSymbol;
  const quote: NormalizedMarketQuote = {
    symbol: indiaExchange ? `${responseBase}:${indiaExchange}` : data.symbol || normalized.baseSymbol,
    name: data.name || data.symbol || normalized.baseSymbol,
    assetType,
    exchange: indiaExchange || data.exchange || null,
    currency: data.currency || (indiaExchange ? 'INR' : 'USD'),
    price,
    open: toNumber(data.open),
    high: toNumber(data.high),
    low: toNumber(data.low),
    previousClose,
    change,
    changePercent,
    volume: toNumber(data.volume),
    providerTimestamp: data.datetime || (data.timestamp == null ? null : String(data.timestamp)),
    retrievedAt: new Date().toISOString(),
    freshness: twelveFreshness(indiaExchange || data.exchange, data.is_market_open),
    providerName: 'Twelve Data',
  };
  return { quote, status: 'connected', message: `Twelve Data ${quote.freshness.replaceAll('_', ' ')} quote loaded.` };
}

async function fetchRealQuote(provider: NamedMarketProvider, symbol: string, assetType: string, configuration: MarketProviderConfiguration): Promise<MarketQuoteProviderResult> {
  if (provider === 'twelvedata') return fetchTwelveDataQuote(symbol, assetType, configuration);
  const result = await fetchYahooFinanceQuote(symbol, assetType);
  if (result.status !== 'connected' || result.quote.freshness === 'demo' || !Number.isFinite(result.quote.price)) {
    throw new Error(result.message || 'Yahoo Finance quote is unavailable.');
  }
  return result;
}

export async function fetchQuoteFromProvider(symbol: string, assetType = 'equity'): Promise<MarketQuoteProviderResult> {
  const configuration = getConfiguration();
  const configured = normalizeProviderName(configuration.provider);
  const providers: NamedMarketProvider[] = configuration.provider === 'hybrid'
    ? [normalizeProviderName(configuration.primaryProvider) || 'yahoo', normalizeProviderName(configuration.fallbackProvider) || 'twelvedata']
    : configured
      ? [configured, ...(configured === 'yahoo' ? [] : ['yahoo' as const])]
      : ['yahoo'];

  const unique = [...new Set(providers)];
  const failures: string[] = [];
  for (const provider of unique) {
    if (provider === 'twelvedata' && !configuration.apiKey) {
      failures.push('Twelve Data not configured');
      continue;
    }
    try {
      const result = await fetchRealQuote(provider, symbol, assetType, configuration);
      return { ...result, message: `${providerLabel(provider)}: ${result.message || 'quote loaded'}` };
    } catch (error) {
      failures.push(`${providerLabel(provider)}: ${error instanceof Error ? error.message : 'unavailable'}`);
    }
  }
  throw new Error(`Market data unavailable for ${symbol}. ${failures.join('; ')}`);
}

function rangeConfiguration(range: string, indiaEndOfDay = false) {
  if (indiaEndOfDay) {
    const values: Record<string, { interval: string; outputsize: string }> = {
      '1d': { interval: '1day', outputsize: '2' }, '1w': { interval: '1day', outputsize: '5' },
      '1m': { interval: '1day', outputsize: '30' }, '3m': { interval: '1day', outputsize: '90' },
      '6m': { interval: '1day', outputsize: '180' }, '1y': { interval: '1day', outputsize: '365' },
    };
    return values[range] || values['1m'];
  }
  const values: Record<string, { interval: string; outputsize: string }> = {
    '1d': { interval: '5min', outputsize: '78' }, '1w': { interval: '1h', outputsize: '40' },
    '1m': { interval: '1day', outputsize: '30' }, '3m': { interval: '1day', outputsize: '90' },
    '6m': { interval: '1week', outputsize: '26' }, '1y': { interval: '1week', outputsize: '52' },
  };
  return values[range] || values['1m'];
}

async function fetchTwelveDataHistory(symbol: string, range: string, configuration: MarketProviderConfiguration): Promise<MarketHistoryPoint[]> {
  if (!configuration.apiKey) return [];
  try {
    const normalized = normalizeTwelveDataSymbol(symbol);
    const url = buildProviderUrl(configuration.baseUrl, 'time_series');
    const options = rangeConfiguration(range, normalized.exchange !== null);
    url.searchParams.set('symbol', normalized.providerSymbol);
    url.searchParams.set('interval', options.interval);
    url.searchParams.set('outputsize', options.outputsize);
    url.searchParams.set('order', 'ASC');
    url.searchParams.set('apikey', configuration.apiKey);
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const raw: unknown = await response.json().catch(() => null);
    if (classifyProviderError(raw, response.status)) return [];
    const parsed = timeSeriesResponseSchema.safeParse(raw);
    if (!parsed.success) return [];
    return parsed.data.values.flatMap((value): MarketHistoryPoint[] => {
      const close = toNumber(value.close);
      if (close === null) return [];
      const open = toNumber(value.open), high = toNumber(value.high), low = toNumber(value.low), volume = toNumber(value.volume);
      return [{ date: value.datetime, price: close, ...(open === null ? {} : { open }), ...(high === null ? {} : { high }), ...(low === null ? {} : { low }), close, ...(volume === null ? {} : { volume }) }];
    });
  } catch {
    return [];
  }
}

export async function fetchHistoryFromProvider(symbol: string, range = '1m'): Promise<MarketHistoryPoint[]> {
  const configuration = getConfiguration();
  const configured = normalizeProviderName(configuration.provider);
  const providers: NamedMarketProvider[] = configuration.provider === 'hybrid'
    ? [normalizeProviderName(configuration.primaryProvider) || 'yahoo', normalizeProviderName(configuration.fallbackProvider) || 'twelvedata']
    : configured
      ? [configured, ...(configured === 'yahoo' ? [] : ['yahoo' as const])]
      : ['yahoo'];
  for (const provider of [...new Set(providers)]) {
    const points = provider === 'yahoo'
      ? await fetchYahooFinanceHistory(symbol, range)
      : await fetchTwelveDataHistory(symbol, range, configuration);
    if (points.length) return points;
  }
  return [];
}

export async function checkMarketProviderDiagnostic(): Promise<ProviderDiagnostic> {
  const startedAt = Date.now();
  try {
    const result = await fetchQuoteFromProvider('INFY:NSE');
    return {
      id: 'market-data',
      name: result.quote.providerName,
      role: 'Market quotes and history with provider-derived freshness labels',
      status: 'connected',
      lastChecked: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      message: result.message,
    };
  } catch (error) {
    return {
      id: 'market-data',
      name: 'Market Data',
      role: 'Market quotes and history',
      status: 'error',
      lastChecked: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : 'Market data is unavailable.',
    };
  }
}
