/**
 * Finnhub company-intelligence adapter.
 *
 * The API credential is read only on the server from FINNHUB_API_KEY. The
 * browser receives normalized company data and never receives the token.
 */

import { z } from 'zod';
import {
  CompanyIntelligence,
  ConnectionStatus,
  ProviderDiagnostic,
} from '../../src/types';

const DEFAULT_FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

type FinnhubStatus = Extract<
  ConnectionStatus,
  | 'connected'
  | 'not_configured'
  | 'invalid_credentials'
  | 'invalid_response'
  | 'rate_limited'
  | 'error'
>;

const profileSchema = z
  .object({
    country: z.string().optional(),
    currency: z.string().optional(),
    exchange: z.string().optional(),
    finnhubIndustry: z.string().optional(),
    ipo: z.string().optional(),
    logo: z.string().optional(),
    marketCapitalization: z.number().nullable().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    shareOutstanding: z.number().nullable().optional(),
    ticker: z.string().optional(),
    weburl: z.string().optional(),
  })
  .passthrough();

const metricsSchema = z
  .object({
    metric: z.record(z.string(), z.unknown()).optional().default({}),
  })
  .passthrough();

const earningsSchema = z.array(
  z
    .object({
      actual: z.number().nullable().optional(),
      estimate: z.number().nullable().optional(),
      period: z.string().optional(),
      quarter: z.number().nullable().optional(),
      surprise: z.number().nullable().optional(),
      surprisePercent: z.number().nullable().optional(),
      symbol: z.string().optional(),
      year: z.number().nullable().optional(),
    })
    .passthrough(),
);

const recommendationSchema = z.array(
  z
    .object({
      buy: z.number().optional(),
      hold: z.number().optional(),
      period: z.string().optional(),
      sell: z.number().optional(),
      strongBuy: z.number().optional(),
      strongSell: z.number().optional(),
      symbol: z.string().optional(),
    })
    .passthrough(),
);

interface ProviderResult<T> {
  status: FinnhubStatus;
  data: T | null;
  message: string;
}

function safeSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.:_-]{0,19}$/.test(normalized)) {
    throw new Error('Invalid Finnhub stock symbol.');
  }
  return normalized;
}

function getConfiguration() {
  const baseUrl = process.env.FINNHUB_API_BASE_URL?.trim() || DEFAULT_FINNHUB_BASE_URL;
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error('Finnhub provider URL must use HTTPS.');
  }

  return {
    apiKey: process.env.FINNHUB_API_KEY?.trim() || '',
    baseUrl: parsed.toString().replace(/\/$/, ''),
  };
}

function classifyError(response: Response, body: unknown): FinnhubStatus | null {
  const message =
    body && typeof body === 'object' && 'error' in body
      ? String((body as { error?: unknown }).error || '')
      : '';
  const normalized = message.toLowerCase();

  if (response.status === 401 || response.status === 403 || /token|api key|access denied/.test(normalized)) {
    return 'invalid_credentials';
  }
  if (response.status === 429 || /limit|too many/.test(normalized)) {
    return 'rate_limited';
  }
  if (!response.ok || message) return 'error';
  return null;
}

async function requestFinnhub<T>(
  endpoint: string,
  schema: z.ZodType<T>,
  params: Record<string, string>,
): Promise<ProviderResult<T>> {
  const { apiKey, baseUrl } = getConfiguration();
  if (!apiKey) {
    return {
      status: 'not_configured',
      data: null,
      message: 'Add FINNHUB_API_KEY in Vercel to activate company intelligence.',
    };
  }

  try {
    const url = new URL(`${baseUrl}/${endpoint.replace(/^\//, '')}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    url.searchParams.set('token', apiKey);

    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const body: unknown = await response.json().catch(() => null);
    const providerError = classifyError(response, body);
    if (providerError) {
      return {
        status: providerError,
        data: null,
        message:
          providerError === 'invalid_credentials'
            ? 'Finnhub rejected the configured credential.'
            : providerError === 'rate_limited'
              ? 'Finnhub request limit reached. Please retry shortly.'
              : `Finnhub request failed with HTTP ${response.status}.`,
      };
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return {
        status: 'invalid_response',
        data: null,
        message: 'Finnhub returned an unexpected response.',
      };
    }

    return { status: 'connected', data: parsed.data, message: 'Finnhub data loaded.' };
  } catch {
    return {
      status: 'error',
      data: null,
      message: 'Finnhub is temporarily unreachable.',
    };
  }
}

function metricNumber(metrics: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

export async function fetchFinnhubCompanyIntelligence(
  symbol: string,
): Promise<CompanyIntelligence> {
  const normalizedSymbol = safeSymbol(symbol);
  const { apiKey } = getConfiguration();
  if (!apiKey) {
    return {
      symbol: normalizedSymbol,
      status: 'not_configured',
      providerName: 'Finnhub',
      retrievedAt: new Date().toISOString(),
      message: 'Add FINNHUB_API_KEY in Vercel to activate company intelligence.',
      profile: null,
      metrics: null,
      earnings: [],
      recommendations: [],
    };
  }

  const [profileResult, metricsResult, earningsResult, recommendationResult] =
    await Promise.all([
      requestFinnhub('stock/profile2', profileSchema, { symbol: normalizedSymbol }),
      requestFinnhub('stock/metric', metricsSchema, {
        symbol: normalizedSymbol,
        metric: 'all',
      }),
      requestFinnhub('stock/earnings', earningsSchema, {
        symbol: normalizedSymbol,
        limit: '4',
      }),
      requestFinnhub('stock/recommendation', recommendationSchema, {
        symbol: normalizedSymbol,
      }),
    ]);

  const results = [profileResult, metricsResult, earningsResult, recommendationResult];
  const connectedCount = results.filter((result) => result.status === 'connected').length;
  const blockingStatus = results.find(
    (result) => result.status === 'invalid_credentials' || result.status === 'rate_limited',
  );
  const profile = profileResult.data;
  const rawMetrics = metricsResult.data?.metric || {};

  const normalizedProfile =
    profile && (profile.name || profile.ticker)
      ? {
          name: profile.name || normalizedSymbol,
          ticker: profile.ticker || normalizedSymbol,
          exchange: profile.exchange || null,
          currency: profile.currency || null,
          country: profile.country || null,
          industry: profile.finnhubIndustry || null,
          ipoDate: profile.ipo || null,
          logoUrl: profile.logo || null,
          webUrl: profile.weburl || null,
          marketCapitalization: profile.marketCapitalization ?? null,
          sharesOutstanding: profile.shareOutstanding ?? null,
        }
      : null;

  const hasMetrics = Object.keys(rawMetrics).length > 0;
  const normalizedMetrics = hasMetrics
    ? {
        peRatio: metricNumber(rawMetrics, 'peBasicExclExtraTTM', 'peTTM', 'peAnnual'),
        priceToBook: metricNumber(rawMetrics, 'pbAnnual', 'pbQuarterly'),
        priceToSales: metricNumber(rawMetrics, 'psTTM', 'psAnnual'),
        returnOnEquity: metricNumber(rawMetrics, 'roeTTM', 'roeAnnual'),
        currentRatio: metricNumber(rawMetrics, 'currentRatioAnnual', 'currentRatioQuarterly'),
        beta: metricNumber(rawMetrics, 'beta'),
        week52High: metricNumber(rawMetrics, '52WeekHigh'),
        week52Low: metricNumber(rawMetrics, '52WeekLow'),
        dividendYield: metricNumber(
          rawMetrics,
          'dividendYieldIndicatedAnnual',
          'dividendYield5Y',
        ),
        epsGrowth3Y: metricNumber(rawMetrics, 'epsGrowth3Y'),
        revenueGrowth3Y: metricNumber(rawMetrics, 'revenueGrowth3Y'),
      }
    : null;

  return {
    symbol: normalizedSymbol,
    status:
      blockingStatus?.status ||
      (connectedCount > 0 ? 'connected' : results[0]?.status || 'error'),
    providerName: 'Finnhub',
    retrievedAt: new Date().toISOString(),
    message:
      connectedCount > 0
        ? `${connectedCount} of 4 Finnhub company datasets loaded.`
        : blockingStatus?.message || results[0]?.message || 'Finnhub data is unavailable.',
    profile: normalizedProfile,
    metrics: normalizedMetrics,
    earnings: (earningsResult.data || []).slice(0, 4).map((item) => ({
      period: item.period || null,
      actual: item.actual ?? null,
      estimate: item.estimate ?? null,
      surprise: item.surprise ?? null,
      surprisePercent: item.surprisePercent ?? null,
    })),
    recommendations: (recommendationResult.data || []).slice(0, 6).map((item) => ({
      period: item.period || null,
      strongBuy: item.strongBuy || 0,
      buy: item.buy || 0,
      hold: item.hold || 0,
      sell: item.sell || 0,
      strongSell: item.strongSell || 0,
    })),
  };
}

export async function checkFinnhubDiagnostic(): Promise<ProviderDiagnostic> {
  const startedAt = Date.now();
  const result = await requestFinnhub('stock/profile2', profileSchema, { symbol: 'AAPL' });
  return {
    id: 'company-intelligence',
    name: 'Finnhub Company Intelligence',
    role: 'Company profiles, fundamentals, earnings, and analyst trends',
    status: result.status,
    lastChecked: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    message: result.message,
  };
}
