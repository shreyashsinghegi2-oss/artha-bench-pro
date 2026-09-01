import type { MarketHistoryPoint, NormalizedMarketQuote } from '../types';

type YahooChartMeta = {
  currency?: string;
  symbol?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  instrumentType?: string;
  regularMarketTime?: number;
  regularMarketPrice?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketOpen?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  marketState?: string;
  longName?: string;
  shortName?: string;
};

type YahooChartResult = {
  meta?: YahooChartMeta;
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
};

type YahooChartResponse = {
  chart?: {
    result?: YahooChartResult[] | null;
    error?: unknown;
  };
};

const PROVIDER_NAME = 'Yahoo Finance · experimental/reference (Netlify proxy)';

function toYahooSymbol(symbol: string) {
  const clean = symbol.trim().toUpperCase();
  const nse = clean.match(/^(.+):NSE$/);
  if (nse) return `${nse[1]}.NS`;
  const bse = clean.match(/^(.+):BSE$/);
  if (bse) return `${bse[1]}.BO`;
  return clean;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function latestFinite(values?: Array<number | null>) {
  if (!Array.isArray(values)) return null;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = finite(values[index]);
    if (value !== null) return value;
  }
  return null;
}

function isoFromSeconds(seconds?: number) {
  return typeof seconds === 'number' && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
}

function freshnessFor(meta: YahooChartMeta): NormalizedMarketQuote['freshness'] {
  const timestampMs = typeof meta.regularMarketTime === 'number' ? meta.regularMarketTime * 1000 : null;
  if (timestampMs && Date.now() - timestampMs > 72 * 60 * 60 * 1000) return 'stale';
  return meta.marketState?.toUpperCase() === 'REGULAR' ? 'delayed' : 'end_of_day';
}

async function requestChart(symbol: string, range: string, interval: string): Promise<YahooChartResult> {
  const yahooSymbol = toYahooSymbol(symbol);
  const params = new URLSearchParams({ range, interval, includePrePost: 'false', events: 'div,splits' });
  const response = await fetch(`/free-market/yahoo/${encodeURIComponent(yahooSymbol)}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Yahoo reference proxy returned HTTP ${response.status}.`);
  const raw = await response.json().catch(() => null) as YahooChartResponse | null;
  const result = raw?.chart?.result?.[0];
  if (!result || raw?.chart?.error) throw new Error('Yahoo reference proxy returned no usable chart result.');
  return result;
}

export async function fetchFreeYahooQuote(symbol: string, assetType = 'equity'): Promise<NormalizedMarketQuote> {
  const result = await requestChart(symbol, '1d', '1m');
  const meta = result.meta || {};
  const quoteSeries = result.indicators?.quote?.[0];
  const price = finite(meta.regularMarketPrice) ?? latestFinite(quoteSeries?.close);
  if (price === null || price < 0) throw new Error('Yahoo reference proxy returned no valid price.');
  const previousClose = finite(meta.previousClose) ?? finite(meta.chartPreviousClose);
  const change = previousClose === null ? null : price - previousClose;
  const changePercent = previousClose && change !== null ? (change / previousClose) * 100 : null;
  return {
    symbol: meta.symbol || toYahooSymbol(symbol),
    name: meta.longName || meta.shortName || meta.symbol || toYahooSymbol(symbol),
    assetType: meta.instrumentType?.toLowerCase() || assetType,
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    currency: meta.currency || (toYahooSymbol(symbol).endsWith('.NS') || toYahooSymbol(symbol).endsWith('.BO') ? 'INR' : 'USD'),
    price,
    open: finite(meta.regularMarketOpen) ?? latestFinite(quoteSeries?.open),
    high: finite(meta.regularMarketDayHigh) ?? latestFinite(quoteSeries?.high),
    low: finite(meta.regularMarketDayLow) ?? latestFinite(quoteSeries?.low),
    previousClose,
    change,
    changePercent,
    volume: finite(meta.regularMarketVolume) ?? latestFinite(quoteSeries?.volume),
    providerTimestamp: isoFromSeconds(meta.regularMarketTime) || isoFromSeconds(result.timestamp?.at(-1)),
    retrievedAt: new Date().toISOString(),
    freshness: freshnessFor(meta),
    providerName: PROVIDER_NAME,
  };
}

function historyWindow(range: string) {
  const windows: Record<string, { yahooRange: string; interval: string }> = {
    '1d': { yahooRange: '1d', interval: '5m' },
    '1w': { yahooRange: '5d', interval: '30m' },
    '1m': { yahooRange: '1mo', interval: '1d' },
    '3m': { yahooRange: '3mo', interval: '1d' },
    '6m': { yahooRange: '6mo', interval: '1d' },
    '1y': { yahooRange: '1y', interval: '1d' },
  };
  return windows[range] || windows['1m'];
}

export async function fetchFreeYahooHistory(symbol: string, range = '1m'): Promise<MarketHistoryPoint[]> {
  const config = historyWindow(range);
  const result = await requestChart(symbol, config.yahooRange, config.interval);
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const series = result.indicators?.quote?.[0];
  if (!series) return [];
  return timestamps.flatMap((timestamp, index): MarketHistoryPoint[] => {
    const close = finite(series.close?.[index]);
    if (close === null || close < 0) return [];
    const open = finite(series.open?.[index]);
    const high = finite(series.high?.[index]);
    const low = finite(series.low?.[index]);
    const volume = finite(series.volume?.[index]);
    return [{
      date: new Date(timestamp * 1000).toISOString(),
      price: close,
      ...(open === null ? {} : { open }),
      ...(high === null ? {} : { high }),
      ...(low === null ? {} : { low }),
      close,
      ...(volume === null ? {} : { volume }),
    }];
  });
}
