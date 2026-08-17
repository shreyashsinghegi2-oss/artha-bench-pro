/**
 * Experimental Yahoo Finance chart adapter.
 *
 * Yahoo does not publish this as a supported redistribution API. Keep all
 * requests server-side, cache/poll conservatively, and preserve the feed
 * freshness derived from the returned timestamp and delay metadata.
 */

import { z } from 'zod';
import { MarketHistoryPoint, NormalizedMarketQuote } from '../../src/types';
import { DEMO_MARKET_HISTORY, DEMO_MARKET_QUOTES } from '../../src/data/marketFixtures';
import type { MarketQuoteProviderResult } from './marketDataProvider';

const DEFAULT_YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

const yahooChartResponseSchema = z.object({
  chart: z.object({
    result: z.array(z.object({
      meta: z.object({
        currency: z.string().optional(),
        symbol: z.string().optional(),
        exchangeName: z.string().optional(),
        fullExchangeName: z.string().optional(),
        instrumentType: z.string().optional(),
        regularMarketTime: z.number().nullable().optional(),
        regularMarketPrice: z.number().nullable().optional(),
        regularMarketDayHigh: z.number().nullable().optional(),
        regularMarketDayLow: z.number().nullable().optional(),
        regularMarketVolume: z.number().nullable().optional(),
        chartPreviousClose: z.number().nullable().optional(),
        previousClose: z.number().nullable().optional(),
        exchangeDataDelayedBy: z.number().nullable().optional(),
        longName: z.string().optional(),
        shortName: z.string().optional(),
        currentTradingPeriod: z.object({
          regular: z.object({
            start: z.number().optional(),
            end: z.number().optional(),
          }).passthrough().optional(),
        }).passthrough().optional(),
      }).passthrough(),
      timestamp: z.array(z.number()).optional().default([]),
      indicators: z.object({
        quote: z.array(z.object({
          open: z.array(z.number().nullable()).optional().default([]),
          high: z.array(z.number().nullable()).optional().default([]),
          low: z.array(z.number().nullable()).optional().default([]),
          close: z.array(z.number().nullable()).optional().default([]),
          volume: z.array(z.number().nullable()).optional().default([]),
        }).passthrough()).optional().default([]),
      }).passthrough(),
    }).passthrough()).nullable().optional(),
    error: z.unknown().nullable().optional(),
  }).passthrough(),
}).passthrough();

const YAHOO_SYMBOL_ALIASES: Record<string, NormalizedYahooSymbol> = {
  'NIFTY:NSE': { providerSymbol: '^NSEI', displaySymbol: 'NIFTY:NSE', exchange: 'NSE' },
  'NSE:NIFTY': { providerSymbol: '^NSEI', displaySymbol: 'NIFTY:NSE', exchange: 'NSE' },
  '^NSEI': { providerSymbol: '^NSEI', displaySymbol: 'NIFTY:NSE', exchange: 'NSE' },
  'BANKNIFTY:NSE': { providerSymbol: '^NSEBANK', displaySymbol: 'BANKNIFTY:NSE', exchange: 'NSE' },
  'NSE:BANKNIFTY': { providerSymbol: '^NSEBANK', displaySymbol: 'BANKNIFTY:NSE', exchange: 'NSE' },
  '^NSEBANK': { providerSymbol: '^NSEBANK', displaySymbol: 'BANKNIFTY:NSE', exchange: 'NSE' },
  'SENSEX:BSE': { providerSymbol: '^BSESN', displaySymbol: 'SENSEX:BSE', exchange: 'BSE' },
  'BSE:SENSEX': { providerSymbol: '^BSESN', displaySymbol: 'SENSEX:BSE', exchange: 'BSE' },
  '^BSESN': { providerSymbol: '^BSESN', displaySymbol: 'SENSEX:BSE', exchange: 'BSE' },
  'USD/INR': { providerSymbol: 'INR=X', displaySymbol: 'USD/INR', exchange: 'FX' },
  'INR=X': { providerSymbol: 'INR=X', displaySymbol: 'USD/INR', exchange: 'FX' },
  GOLD: { providerSymbol: 'GC=F', displaySymbol: 'GC=F', exchange: 'COMEX' },
  'GC=F': { providerSymbol: 'GC=F', displaySymbol: 'GC=F', exchange: 'COMEX' },
};

export interface NormalizedYahooSymbol {
  providerSymbol: string;
  displaySymbol: string;
  exchange: string | null;
}

export function isYahooFinanceProvider(provider: string) {
  return provider === 'yahoo' || provider === 'yahoo-finance' || provider === 'yahoofinance';
}

function safeYahooSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9^][A-Z0-9.^=_-]{0,39}$/.test(normalized)) {
    throw new Error('Invalid Yahoo Finance symbol.');
  }
  return normalized;
}

export function normalizeYahooFinanceSymbol(symbol: string): NormalizedYahooSymbol {
  const normalized = symbol.trim().toUpperCase();
  const alias = YAHOO_SYMBOL_ALIASES[normalized];
  if (alias) return { ...alias };

  const yahooIndiaSuffix = normalized.match(/^(.+)\.(NS|BO)$/);
  if (yahooIndiaSuffix) {
    const baseSymbol = safeYahooSymbol(yahooIndiaSuffix[1]);
    const exchange = yahooIndiaSuffix[2] === 'NS' ? 'NSE' : 'BSE';
    return {
      providerSymbol: `${baseSymbol}.${yahooIndiaSuffix[2]}`,
      displaySymbol: `${baseSymbol}:${exchange}`,
      exchange,
    };
  }

  const exchangeQualified = normalized.match(/^([^:]+):(NSE|BSE)$/);
  const exchangePrefixed = normalized.match(/^(NSE|BSE):([^:]+)$/);
  if (exchangeQualified || exchangePrefixed) {
    const exchange = (exchangeQualified?.[2] || exchangePrefixed?.[1]) as 'NSE' | 'BSE';
    const baseSymbol = safeYahooSymbol(exchangeQualified?.[1] || exchangePrefixed?.[2] || '');
    return {
      providerSymbol: `${baseSymbol}.${exchange === 'NSE' ? 'NS' : 'BO'}`,
      displaySymbol: `${baseSymbol}:${exchange}`,
      exchange,
    };
  }

  const providerSymbol = safeYahooSymbol(normalized);
  return { providerSymbol, displaySymbol: providerSymbol, exchange: null };
}

function buildChartUrl(symbol: string, range: string, interval: string) {
  const baseUrl = process.env.YAHOO_FINANCE_BASE_URL?.trim() || DEFAULT_YAHOO_CHART_URL;
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:') throw new Error('Yahoo Finance provider URL must use HTTPS.');
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeURIComponent(symbol)}`;
  url.search = '';
  url.searchParams.set('range', range);
  url.searchParams.set('interval', interval);
  url.searchParams.set('includePrePost', 'false');
  url.searchParams.set('events', 'div,splits');
  return url;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function firstFinite(values: Array<number | null>) {
  for (const value of values) {
    const numberValue = toFiniteNumber(value);
    if (numberValue !== null) return numberValue;
  }
  return null;
}

function valueAt(values: Array<number | null>, index: number) {
  return toFiniteNumber(values[index]);
}

function fallbackQuote(
  symbol: NormalizedYahooSymbol,
  assetType: string,
): NormalizedMarketQuote {
  const fixture = DEMO_MARKET_QUOTES.find((quote) => quote.symbol === symbol.displaySymbol);
  if (fixture) return { ...fixture, retrievedAt: new Date().toISOString() };

  const isIndia = symbol.exchange === 'NSE' || symbol.exchange === 'BSE';
  return {
    symbol: symbol.displaySymbol,
    name: `${symbol.displaySymbol} (Demo)`,
    assetType,
    exchange: symbol.exchange,
    currency: isIndia ? 'INR' : 'USD',
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

function resolveFreshness(
  meta: z.infer<typeof yahooChartResponseSchema>['chart']['result'] extends Array<infer T> | null | undefined
    ? T extends { meta: infer M } ? M : never
    : never,
  providerTimestampSeconds: number | null,
): NormalizedMarketQuote['freshness'] {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const regular = meta.currentTradingPeriod?.regular;
  const isRegularSession = Boolean(
    regular?.start && regular?.end && nowSeconds >= regular.start && nowSeconds <= regular.end,
  );

  if (!isRegularSession) return 'end_of_day';
  if (!providerTimestampSeconds) return 'stale';

  const ageSeconds = Math.max(0, nowSeconds - providerTimestampSeconds);
  const delayMinutes = meta.exchangeDataDelayedBy;
  const expectedDelaySeconds = typeof delayMinutes === 'number' ? delayMinutes * 60 : 900;
  if (ageSeconds > expectedDelaySeconds + 300) return 'stale';
  if (delayMinutes === 0 && ageSeconds <= 180) return 'real_time';
  return 'delayed';
}

function providerErrorStatus(httpStatus: number): MarketQuoteProviderResult['status'] {
  if (httpStatus === 429) return 'rate_limited';
  if (httpStatus === 401 || httpStatus === 403) return 'invalid_credentials';
  return 'error';
}

export async function fetchYahooFinanceQuote(
  symbol: string,
  assetType = 'equity',
): Promise<MarketQuoteProviderResult> {
  const normalizedSymbol = normalizeYahooFinanceSymbol(symbol);
  const fallback = fallbackQuote(normalizedSymbol, assetType);

  try {
    const url = buildChartUrl(normalizedSymbol.providerSymbol, '1d', '1m');
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      const status = providerErrorStatus(response.status);
      return {
        quote: fallback,
        status,
        message: status === 'rate_limited'
          ? 'Yahoo Finance rate limit reached. Displaying a labelled demo quote.'
          : `Yahoo Finance request failed with HTTP ${response.status}.`,
      };
    }

    const rawData: unknown = await response.json().catch(() => null);
    const parsed = yahooChartResponseSchema.safeParse(rawData);
    const result = parsed.success ? parsed.data.chart.result?.[0] : null;
    const series = result?.indicators.quote[0];
    if (!result || !series) {
      return {
        quote: fallback,
        status: 'invalid_response',
        message: 'Yahoo Finance returned an unexpected chart response.',
      };
    }

    let latestIndex = -1;
    for (let index = result.timestamp.length - 1; index >= 0; index -= 1) {
      if (valueAt(series.close, index) !== null) {
        latestIndex = index;
        break;
      }
    }

    const latestClose = latestIndex >= 0 ? valueAt(series.close, latestIndex) : null;
    const price = toFiniteNumber(result.meta.regularMarketPrice) ?? latestClose;
    if (price === null) {
      return {
        quote: fallback,
        status: 'invalid_response',
        message: 'Yahoo Finance did not return a usable market price.',
      };
    }

    const providerTimestampSeconds =
      (latestIndex >= 0 ? result.timestamp[latestIndex] : null) ??
      toFiniteNumber(result.meta.regularMarketTime);
    const previousClose =
      toFiniteNumber(result.meta.previousClose) ??
      toFiniteNumber(result.meta.chartPreviousClose);
    const change = previousClose === null ? null : price - previousClose;
    const changePercent = previousClose && change !== null
      ? (change / previousClose) * 100
      : null;
    const freshness = resolveFreshness(result.meta, providerTimestampSeconds);

    return {
      quote: {
        symbol: normalizedSymbol.displaySymbol,
        name:
          result.meta.longName ||
          result.meta.shortName ||
          result.meta.symbol ||
          normalizedSymbol.displaySymbol,
        assetType: result.meta.instrumentType?.toLowerCase() || assetType,
        exchange:
          normalizedSymbol.exchange ||
          result.meta.fullExchangeName ||
          result.meta.exchangeName ||
          null,
        currency: result.meta.currency || (normalizedSymbol.exchange === 'NSE' || normalizedSymbol.exchange === 'BSE' ? 'INR' : 'USD'),
        price,
        open: firstFinite(series.open),
        high: toFiniteNumber(result.meta.regularMarketDayHigh) ?? (latestIndex >= 0 ? valueAt(series.high, latestIndex) : null),
        low: toFiniteNumber(result.meta.regularMarketDayLow) ?? (latestIndex >= 0 ? valueAt(series.low, latestIndex) : null),
        previousClose,
        change: change ?? 0,
        changePercent: changePercent ?? 0,
        volume: toFiniteNumber(result.meta.regularMarketVolume) ?? (latestIndex >= 0 ? valueAt(series.volume, latestIndex) : null),
        providerTimestamp: providerTimestampSeconds
          ? new Date(providerTimestampSeconds * 1000).toISOString()
          : null,
        retrievedAt: new Date().toISOString(),
        freshness,
        providerName: 'Yahoo Finance (Experimental)',
      },
      status: 'connected',
      message: `Yahoo Finance quote loaded with ${freshness.replaceAll('_', ' ')} freshness.`,
    };
  } catch {
    return {
      quote: fallback,
      status: 'error',
      message: 'Yahoo Finance is temporarily unreachable. Displaying a labelled demo quote.',
    };
  }
}

function historyFallback(symbol: NormalizedYahooSymbol): MarketHistoryPoint[] {
  return DEMO_MARKET_HISTORY[symbol.displaySymbol] || [];
}

function historyConfiguration(range: string) {
  const configurations: Record<string, { range: string; interval: string }> = {
    '1d': { range: '1d', interval: '5m' },
    '1w': { range: '5d', interval: '15m' },
    '1m': { range: '1mo', interval: '1d' },
    '3m': { range: '3mo', interval: '1d' },
    '6m': { range: '6mo', interval: '1d' },
    '1y': { range: '1y', interval: '1d' },
  };
  return configurations[range] || configurations['1m'];
}

export async function fetchYahooFinanceHistory(
  symbol: string,
  range = '1m',
): Promise<MarketHistoryPoint[]> {
  const normalizedSymbol = normalizeYahooFinanceSymbol(symbol);
  const fallback = historyFallback(normalizedSymbol);

  try {
    const configuration = historyConfiguration(range);
    const url = buildChartUrl(
      normalizedSymbol.providerSymbol,
      configuration.range,
      configuration.interval,
    );
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return fallback;

    const rawData: unknown = await response.json().catch(() => null);
    const parsed = yahooChartResponseSchema.safeParse(rawData);
    const result = parsed.success ? parsed.data.chart.result?.[0] : null;
    const series = result?.indicators.quote[0];
    if (!result || !series) return fallback;

    const points = result.timestamp.flatMap((timestamp, index): MarketHistoryPoint[] => {
      const close = valueAt(series.close, index);
      if (close === null) return [];
      const open = valueAt(series.open, index);
      const high = valueAt(series.high, index);
      const low = valueAt(series.low, index);
      const volume = valueAt(series.volume, index);
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

    return points.length > 0 ? points : fallback;
  } catch {
    return fallback;
  }
}
