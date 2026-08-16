/**
 * Federal Reserve Economic Data (FRED) server adapter.
 *
 * The credential is read only from the server-side FRED_API_KEY environment
 * variable. It is never returned to the browser or written into a request log.
 */

import { z } from 'zod';
import {
  ConnectionStatus,
  EconomicIndicator,
  EconomicObservation,
  ProviderDiagnostic,
} from '../../src/types';

const DEFAULT_FRED_OBSERVATIONS_URL =
  'https://api.stlouisfed.org/fred/series/observations';

const fredResponseSchema = z.object({
  observations: z
    .array(
      z
        .object({
          date: z.string(),
          value: z.union([z.string(), z.number()]),
        })
        .passthrough(),
    )
    .default([]),
}).passthrough();

type FredStatus = Extract<
  ConnectionStatus,
  | 'connected'
  | 'not_configured'
  | 'invalid_credentials'
  | 'invalid_response'
  | 'rate_limited'
  | 'error'
>;

interface FredSeriesResult {
  seriesId: string;
  observations: EconomicObservation[];
  status: FredStatus;
  message: string;
}

interface IndicatorDefinition {
  id: string;
  seriesId: string;
  label: string;
  unit: string;
  calculation?: 'latest' | 'year_over_year' | 'billions_to_trillions';
  decimals?: number;
}

const INDICATORS: IndicatorDefinition[] = [
  {
    id: 'inflation',
    seriesId: 'CPIAUCSL',
    label: 'US Inflation',
    unit: '% YoY',
    calculation: 'year_over_year',
    decimals: 2,
  },
  {
    id: 'gdp',
    seriesId: 'GDPC1',
    label: 'US Real GDP',
    unit: '$T',
    calculation: 'billions_to_trillions',
    decimals: 2,
  },
  {
    id: 'unemployment',
    seriesId: 'UNRATE',
    label: 'US Unemployment',
    unit: '%',
    decimals: 1,
  },
  {
    id: 'interest-rate',
    seriesId: 'FEDFUNDS',
    label: 'Federal Funds Rate',
    unit: '%',
    decimals: 2,
  },
  {
    id: 'treasury-10y',
    seriesId: 'DGS10',
    label: 'US 10-Year Treasury',
    unit: '%',
    decimals: 2,
  },
];

function getConfiguration() {
  return {
    apiKey: process.env.FRED_API_KEY?.trim() || '',
    baseUrl:
      process.env.FRED_API_BASE_URL?.trim() || DEFAULT_FRED_OBSERVATIONS_URL,
  };
}

function safeSeriesId(seriesId: string) {
  const normalized = seriesId.trim().toUpperCase();
  if (!/^[A-Z0-9._-]{1,64}$/.test(normalized)) {
    throw new Error('Invalid FRED series identifier.');
  }
  return normalized;
}

function createFredUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:') {
    throw new Error('FRED provider URL must use HTTPS.');
  }
  return url;
}

function classifyError(status: number, message: string): FredStatus {
  if (status === 429) return 'rate_limited';
  if (
    status === 401 ||
    status === 403 ||
    /api[_ ]?key|registered|credential/i.test(message)
  ) {
    return 'invalid_credentials';
  }
  return 'error';
}

export async function fetchFredSeries(
  seriesId: string,
  limit = 24,
): Promise<FredSeriesResult> {
  const normalizedSeriesId = safeSeriesId(seriesId);
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 240);
  const { apiKey, baseUrl } = getConfiguration();

  if (!apiKey) {
    return {
      seriesId: normalizedSeriesId,
      observations: [],
      status: 'not_configured',
      message: 'FRED API key is not configured.',
    };
  }

  try {
    const url = createFredUrl(baseUrl);
    url.searchParams.set('series_id', normalizedSeriesId);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('file_type', 'json');
    url.searchParams.set('sort_order', 'desc');
    url.searchParams.set('limit', String(safeLimit));

    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const rawData: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const rawMessage =
        rawData && typeof rawData === 'object' && 'error_message' in rawData
          ? String((rawData as { error_message?: unknown }).error_message || '')
          : '';
      const status = classifyError(response.status, rawMessage);
      return {
        seriesId: normalizedSeriesId,
        observations: [],
        status,
        message:
          status === 'invalid_credentials'
            ? 'FRED rejected the configured credential.'
            : status === 'rate_limited'
              ? 'FRED request limit reached. Please retry shortly.'
              : `FRED request failed with HTTP ${response.status}.`,
      };
    }

    const parsed = fredResponseSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        seriesId: normalizedSeriesId,
        observations: [],
        status: 'invalid_response',
        message: 'FRED returned an unexpected response.',
      };
    }

    const observations = parsed.data.observations
      .map((observation) => ({
        date: observation.date,
        value: Number(observation.value),
      }))
      .filter((observation) => Number.isFinite(observation.value))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (observations.length === 0) {
      return {
        seriesId: normalizedSeriesId,
        observations: [],
        status: 'invalid_response',
        message: 'FRED returned no usable observations for this series.',
      };
    }

    return {
      seriesId: normalizedSeriesId,
      observations,
      status: 'connected',
      message: 'Live FRED observations loaded.',
    };
  } catch {
    return {
      seriesId: normalizedSeriesId,
      observations: [],
      status: 'error',
      message: 'FRED is temporarily unreachable.',
    };
  }
}

function round(value: number, decimals = 2) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function toIndicator(
  definition: IndicatorDefinition,
  result: FredSeriesResult,
): EconomicIndicator {
  const latest = result.observations.at(-1);
  let value: number | null = latest?.value ?? null;

  if (value !== null && definition.calculation === 'billions_to_trillions') {
    value /= 1_000;
  }

  if (definition.calculation === 'year_over_year') {
    const previousYear = result.observations.at(-13);
    value =
      latest && previousYear && previousYear.value !== 0
        ? ((latest.value / previousYear.value) - 1) * 100
        : null;
  }

  return {
    id: definition.id,
    seriesId: definition.seriesId,
    label: definition.label,
    value: value === null ? null : round(value, definition.decimals),
    unit: definition.unit,
    date: latest?.date || null,
    status: value === null && result.status === 'connected' ? 'invalid_response' : result.status,
    sourceName: 'FRED',
    sourceUrl: `https://fred.stlouisfed.org/series/${definition.seriesId}`,
  };
}

export async function fetchFredOverview() {
  const results = await Promise.all(
    INDICATORS.map((indicator) =>
      fetchFredSeries(
        indicator.seriesId,
        indicator.calculation === 'year_over_year' ? 13 : 1,
      ),
    ),
  );
  const indicators = INDICATORS.map((indicator, index) =>
    toIndicator(indicator, results[index]),
  );
  const connectedCount = indicators.filter(
    (indicator) => indicator.status === 'connected',
  ).length;
  const status: FredStatus =
    connectedCount > 0 ? 'connected' : results[0]?.status || 'error';

  return {
    indicators,
    status,
    providerName: 'Federal Reserve Economic Data (FRED)',
    retrievedAt: new Date().toISOString(),
    message:
      connectedCount > 0
        ? `${connectedCount} live FRED economic indicators loaded.`
        : results[0]?.message || 'FRED data is unavailable.',
  };
}

export async function checkFredDiagnostic(): Promise<ProviderDiagnostic> {
  const startedAt = Date.now();
  const result = await fetchFredSeries('UNRATE', 1);
  return {
    id: 'economic-data',
    name: 'Federal Reserve Economic Data (FRED)',
    role: 'Inflation, GDP, unemployment, and interest-rate indicators',
    status: result.status,
    lastChecked: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    message: result.message,
  };
}
