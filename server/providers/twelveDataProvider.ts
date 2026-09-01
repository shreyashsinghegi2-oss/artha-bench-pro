import { z } from 'zod';
import type { MarketHistoryPoint, NormalizedMarketQuote } from '../../src/types';

const DEFAULT_BASE_URL = 'https://api.twelvedata.com';

export type TwelveDataFailureCategory =
  | 'missing_configuration'
  | 'authentication'
  | 'rate_limit'
  | 'timeout'
  | 'unsupported_symbol'
  | 'invalid_response'
  | 'provider_response_error'
  | 'network_error';

export class TwelveDataProviderError extends Error {
  constructor(public readonly category: TwelveDataFailureCategory, message: string) {
    super(message);
    this.name = 'TwelveDataProviderError';
  }
}

export type TwelveDataSearchCandidate = {
  symbol: string;
  instrumentName: string;
  exchange: string | null;
  country: string | null;
  currency: string | null;
  instrumentType: string | null;
};

const quoteSchema = z.object({
  symbol: z.string().optional(),
  name: z.string().optional(),
  exchange: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
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
  status: z.string().optional(),
  code: z.number().optional(),
  message: z.string().optional(),
}).passthrough();

const searchSchema = z.object({
  data: z.array(z.object({
    symbol: z.string(),
    instrument_name: z.string().optional().default(''),
    exchange: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    currency: z.string().nullable().optional(),
    instrument_type: z.string().nullable().optional(),
  }).passthrough()).optional().default([]),
  status: z.string().optional(),
  code: z.number().optional(),
  message: z.string().optional(),
}).passthrough();

const historySchema = z.object({
  values: z.array(z.object({
    datetime: z.string(),
    open: z.union([z.string(), z.number()]).nullable().optional(),
    high: z.union([z.string(), z.number()]).nullable().optional(),
    low: z.union([z.string(), z.number()]).nullable().optional(),
    close: z.union([z.string(), z.number()]),
    volume: z.union([z.string(), z.number()]).nullable().optional(),
  }).passthrough()).optional().default([]),
  status: z.string().optional(),
  code: z.number().optional(),
  message: z.string().optional(),
}).passthrough();

function toFinite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timeoutMs() {
  const parsed = Number(process.env.MARKET_DATA_REQUEST_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed >= 1_000 && parsed <= 30_000 ? parsed : 8_000;
}

function apiKey() {
  return process.env.TWELVE_DATA_API_KEY?.trim() || process.env.MARKET_DATA_API_KEY?.trim() || '';
}

function baseUrl() {
  const configured = process.env.TWELVE_DATA_BASE_URL?.trim() || process.env.MARKET_DATA_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const url = new URL(configured);
  if (url.protocol !== 'https:') throw new TwelveDataProviderError('missing_configuration', 'Twelve Data base URL must use HTTPS.');
  url.pathname = '';
  url.search = '';
  return url;
}

function providerUrl(endpoint: string) {
  const url = baseUrl();
  url.pathname = `/${endpoint.replace(/^\/+/, '')}`;
  return url;
}

function classifyError(httpStatus: number, raw: unknown): TwelveDataProviderError | null {
  const body = raw && typeof raw === 'object' ? raw as { status?: unknown; code?: unknown; message?: unknown } : {};
  const code = typeof body.code === 'number' ? body.code : httpStatus;
  const failed = httpStatus >= 400 || body.status === 'error';
  if (!failed) return null;
  if (code === 401 || code === 403) return new TwelveDataProviderError('authentication', 'Twelve Data authentication failed.');
  if (code === 429) return new TwelveDataProviderError('rate_limit', 'Twelve Data rate limit reached.');
  const message = typeof body.message === 'string' ? body.message.toLowerCase() : '';
  if (message.includes('symbol') && (message.includes('invalid') || message.includes('not found'))) {
    return new TwelveDataProviderError('unsupported_symbol', 'Twelve Data does not support the verified mapping.');
  }
  return new TwelveDataProviderError('provider_response_error', 'Twelve Data returned a provider error.');
}

async function requestJson(url: URL): Promise<unknown> {
  const key = apiKey();
  if (!key) throw new TwelveDataProviderError('missing_configuration', 'Twelve Data API key is not configured.');
  url.searchParams.set('apikey', key);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs()),
    });
    const raw = await response.json().catch(() => null);
    const error = classifyError(response.status, raw);
    if (error) throw error;
    return raw;
  } catch (error) {
    if (error instanceof TwelveDataProviderError) throw error;
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new TwelveDataProviderError('timeout', 'Twelve Data request timed out.');
    }
    throw new TwelveDataProviderError('network_error', 'Twelve Data could not be reached.');
  }
}

function validateProviderSymbol(symbol: string) {
  const value = symbol.trim();
  if (!value || value.length > 80 || /[\r\n]/.test(value)) {
    throw new TwelveDataProviderError('unsupported_symbol', 'Verified Twelve Data symbol is invalid.');
  }
  return value;
}

export function isTwelveDataConfigured() {
  return Boolean(apiKey());
}

export async function searchTwelveDataAssets(query: string): Promise<TwelveDataSearchCandidate[]> {
  const clean = query.trim();
  if (!clean || clean.length > 120) return [];
  const url = providerUrl('symbol_search');
  url.searchParams.set('symbol', clean);
  url.searchParams.set('outputsize', '30');
  const raw = await requestJson(url);
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) throw new TwelveDataProviderError('invalid_response', 'Twelve Data search response was invalid.');
  return parsed.data.data.map((item) => ({
    symbol: item.symbol,
    instrumentName: item.instrument_name,
    exchange: item.exchange ?? null,
    country: item.country ?? null,
    currency: item.currency ?? null,
    instrumentType: item.instrument_type ?? null,
  }));
}

export async function fetchTwelveDataVerifiedQuote(input: {
  providerSymbol: string;
  exchange?: string | null;
  assetType?: string;
  displaySymbol?: string;
}): Promise<NormalizedMarketQuote> {
  const providerSymbol = validateProviderSymbol(input.providerSymbol);
  const url = providerUrl('quote');
  url.searchParams.set('symbol', providerSymbol);
  if (input.exchange) url.searchParams.set('exchange', input.exchange);
  const raw = await requestJson(url);
  const parsed = quoteSchema.safeParse(raw);
  if (!parsed.success) throw new TwelveDataProviderError('invalid_response', 'Twelve Data quote response was invalid.');
  const data = parsed.data;
  const returnedSymbol = data.symbol?.trim();
  if (!returnedSymbol) throw new TwelveDataProviderError('invalid_response', 'Twelve Data did not return a symbol identity.');
  const price = toFinite(data.close) ?? toFinite(data.price);
  if (price === null || price < 0) throw new TwelveDataProviderError('invalid_response', 'Twelve Data returned no valid non-negative price.');
  const previousClose = toFinite(data.previous_close);
  const explicitChange = toFinite(data.change);
  const explicitPercent = toFinite(data.percent_change);
  const change = explicitChange ?? (previousClose === null ? null : price - previousClose);
  const changePercent = explicitPercent ?? (previousClose && change !== null ? (change / previousClose) * 100 : null);
  const currency = data.currency?.trim() || (input.exchange?.toUpperCase().includes('NSE') || input.exchange?.toUpperCase().includes('BSE') ? 'INR' : 'USD');
  if ((input.exchange?.toUpperCase().includes('NSE') || input.exchange?.toUpperCase().includes('BSE')) && currency !== 'INR') {
    throw new TwelveDataProviderError('invalid_response', 'Indian market quote returned an unexpected currency.');
  }
  return {
    symbol: input.displaySymbol || returnedSymbol,
    name: data.name || returnedSymbol,
    assetType: input.assetType || 'equity',
    exchange: data.exchange || input.exchange || null,
    currency,
    price,
    open: toFinite(data.open),
    high: toFinite(data.high),
    low: toFinite(data.low),
    previousClose,
    change,
    changePercent,
    volume: toFinite(data.volume),
    providerTimestamp: data.datetime || (data.timestamp == null ? null : String(data.timestamp)),
    retrievedAt: new Date().toISOString(),
    freshness: input.exchange?.toUpperCase().includes('NSE') || input.exchange?.toUpperCase().includes('BSE')
      ? 'end_of_day'
      : data.is_market_open ? 'delayed' : 'end_of_day',
    providerName: 'Twelve Data',
  };
}

function historyConfig(range: string) {
  const values: Record<string, { interval: string; outputsize: string }> = {
    '1d': { interval: '1day', outputsize: '2' },
    '1w': { interval: '1day', outputsize: '5' },
    '1m': { interval: '1day', outputsize: '30' },
    '3m': { interval: '1day', outputsize: '90' },
    '6m': { interval: '1day', outputsize: '180' },
    '1y': { interval: '1day', outputsize: '365' },
  };
  return values[range] || values['1m'];
}

export async function fetchTwelveDataVerifiedHistory(input: {
  providerSymbol: string;
  exchange?: string | null;
  range: string;
}): Promise<MarketHistoryPoint[]> {
  const providerSymbol = validateProviderSymbol(input.providerSymbol);
  const url = providerUrl('time_series');
  const options = historyConfig(input.range);
  url.searchParams.set('symbol', providerSymbol);
  if (input.exchange) url.searchParams.set('exchange', input.exchange);
  url.searchParams.set('interval', options.interval);
  url.searchParams.set('outputsize', options.outputsize);
  url.searchParams.set('order', 'ASC');
  const raw = await requestJson(url);
  const parsed = historySchema.safeParse(raw);
  if (!parsed.success) throw new TwelveDataProviderError('invalid_response', 'Twelve Data history response was invalid.');
  return parsed.data.values.flatMap((item): MarketHistoryPoint[] => {
    const close = toFinite(item.close);
    if (close === null || close < 0) return [];
    const open = toFinite(item.open);
    const high = toFinite(item.high);
    const low = toFinite(item.low);
    const volume = toFinite(item.volume);
    return [{
      date: item.datetime,
      price: close,
      ...(open === null ? {} : { open }),
      ...(high === null ? {} : { high }),
      ...(low === null ? {} : { low }),
      close,
      ...(volume === null ? {} : { volume }),
    }];
  });
}
