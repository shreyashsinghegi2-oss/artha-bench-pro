/**
 * World Bank Indicators API adapter for India.
 *
 * The public V2 Indicators API does not require an API key. Requests are made
 * server-side so the application can validate and normalize every response.
 */

import { z } from 'zod';
import {
  ConnectionStatus,
  EconomicIndicator,
  EconomicObservation,
  ProviderDiagnostic,
} from '../../src/types';

const DEFAULT_WORLD_BANK_BASE_URL =
  'https://api.worldbank.org/v2/country/IND/indicator';

const worldBankObservationSchema = z.object({
  indicator: z.object({ id: z.string(), value: z.string().nullable().optional() }).passthrough(),
  country: z.object({ id: z.string(), value: z.string() }).passthrough(),
  countryiso3code: z.string().optional(),
  date: z.string(),
  value: z.number().nullable(),
}).passthrough();

const worldBankResponseSchema = z.tuple([
  z.object({ page: z.number().optional(), pages: z.number().optional() }).passthrough(),
  z.array(worldBankObservationSchema),
]);

type WorldBankStatus = Extract<
  ConnectionStatus,
  'connected' | 'invalid_response' | 'rate_limited' | 'error'
>;

interface WorldBankSeriesResult {
  seriesId: string;
  observations: EconomicObservation[];
  status: WorldBankStatus;
  message: string;
}

interface IndiaIndicatorDefinition {
  id: string;
  seriesId: string;
  label: string;
  unit: string;
  transform?: 'usd_to_trillions';
  decimals?: number;
}

const INDIA_INDICATORS: IndiaIndicatorDefinition[] = [
  {
    id: 'india-gdp',
    seriesId: 'NY.GDP.MKTP.CD',
    label: 'India GDP',
    unit: 'US$T',
    transform: 'usd_to_trillions',
    decimals: 2,
  },
  {
    id: 'india-gdp-growth',
    seriesId: 'NY.GDP.MKTP.KD.ZG',
    label: 'India GDP Growth',
    unit: '%',
    decimals: 2,
  },
  {
    id: 'india-inflation',
    seriesId: 'FP.CPI.TOTL.ZG',
    label: 'India Inflation',
    unit: '% annual',
    decimals: 2,
  },
  {
    id: 'india-unemployment',
    seriesId: 'SL.UEM.TOTL.ZS',
    label: 'India Unemployment',
    unit: '%',
    decimals: 2,
  },
  {
    id: 'india-interest',
    seriesId: 'FR.INR.LEND',
    label: 'India Lending Rate',
    unit: '%',
    decimals: 2,
  },
];

function safeIndicatorId(indicatorId: string) {
  const normalized = indicatorId.trim().toUpperCase();
  if (!/^[A-Z0-9._-]{2,64}$/.test(normalized)) {
    throw new Error('Invalid World Bank indicator identifier.');
  }
  return normalized;
}

function getBaseUrl() {
  const baseUrl =
    process.env.WORLD_BANK_API_BASE_URL?.trim() || DEFAULT_WORLD_BANK_BASE_URL;
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error('World Bank provider URL must use HTTPS.');
  }
  return parsed.toString().replace(/\/$/, '');
}

export async function fetchWorldBankIndiaSeries(
  indicatorId: string,
  limit = 60,
): Promise<WorldBankSeriesResult> {
  const normalizedIndicatorId = safeIndicatorId(indicatorId);
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 240);

  try {
    const url = new URL(`${getBaseUrl()}/${normalizedIndicatorId}`);
    url.searchParams.set('format', 'json');
    url.searchParams.set('per_page', String(safeLimit));
    url.searchParams.set('date', `1960:${new Date().getUTCFullYear()}`);

    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) {
      return {
        seriesId: normalizedIndicatorId,
        observations: [],
        status: response.status === 429 ? 'rate_limited' : 'error',
        message:
          response.status === 429
            ? 'World Bank request limit reached. Please retry shortly.'
            : `World Bank request failed with HTTP ${response.status}.`,
      };
    }

    const parsed = worldBankResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        seriesId: normalizedIndicatorId,
        observations: [],
        status: 'invalid_response',
        message: 'World Bank returned an unexpected response.',
      };
    }

    const observations = parsed.data[1]
      .filter((observation) => observation.value !== null)
      .map((observation) => ({ date: observation.date, value: observation.value as number }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (observations.length === 0) {
      return {
        seriesId: normalizedIndicatorId,
        observations: [],
        status: 'invalid_response',
        message: 'World Bank returned no usable observations for this indicator.',
      };
    }

    return {
      seriesId: normalizedIndicatorId,
      observations,
      status: 'connected',
      message: 'Live World Bank India observations loaded.',
    };
  } catch {
    return {
      seriesId: normalizedIndicatorId,
      observations: [],
      status: 'error',
      message: 'World Bank data is temporarily unreachable.',
    };
  }
}

function round(value: number, decimals = 2) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function toIndicator(
  definition: IndiaIndicatorDefinition,
  result: WorldBankSeriesResult,
): EconomicIndicator {
  const latest = result.observations.at(-1);
  let value: number | null = latest?.value ?? null;
  if (value !== null && definition.transform === 'usd_to_trillions') {
    value /= 1_000_000_000_000;
  }

  return {
    id: definition.id,
    seriesId: definition.seriesId,
    label: definition.label,
    value: value === null ? null : round(value, definition.decimals),
    unit: definition.unit,
    date: latest?.date || null,
    status: value === null && result.status === 'connected' ? 'invalid_response' : result.status,
    sourceName: 'World Bank',
    sourceUrl: `https://data.worldbank.org/indicator/${definition.seriesId}?locations=IN`,
  };
}

export async function fetchWorldBankIndiaOverview() {
  const results = await Promise.all(
    INDIA_INDICATORS.map((indicator) =>
      fetchWorldBankIndiaSeries(indicator.seriesId, 20),
    ),
  );
  const indicators = INDIA_INDICATORS.map((indicator, index) =>
    toIndicator(indicator, results[index]),
  );
  const connectedCount = indicators.filter(
    (indicator) => indicator.status === 'connected',
  ).length;

  return {
    indicators,
    status: connectedCount > 0 ? 'connected' : results[0]?.status || 'error',
    providerName: 'World Bank Indicators API',
    country: 'India',
    countryCode: 'IND',
    retrievedAt: new Date().toISOString(),
    message:
      connectedCount > 0
        ? `${connectedCount} live India economic indicators loaded.`
        : results[0]?.message || 'India economic data is unavailable.',
  };
}

export async function checkWorldBankIndiaDiagnostic(): Promise<ProviderDiagnostic> {
  const startedAt = Date.now();
  const result = await fetchWorldBankIndiaSeries('NY.GDP.MKTP.KD.ZG', 10);
  return {
    id: 'india-economic-data',
    name: 'World Bank India Indicators',
    role: 'India GDP, inflation, unemployment, and interest-rate indicators',
    status: result.status,
    lastChecked: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    message: result.message,
  };
}
