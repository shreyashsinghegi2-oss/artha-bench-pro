/**
 * Federal Reserve Economic Data (FRED) server adapter.
 *
 * Uses the authenticated FRED API when FRED_API_KEY is configured. When it is
 * not, it reads the same official series through FRED's public CSV endpoint.
 * Economic observations are release-based data, not tick-by-tick market data.
 */

import { z } from 'zod';
import type { ConnectionStatus, EconomicIndicator, EconomicObservation, ProviderDiagnostic } from '../../src/types';

const DEFAULT_FRED_OBSERVATIONS_URL = 'https://api.stlouisfed.org/fred/series/observations';
const DEFAULT_FRED_CSV_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv';

const fredResponseSchema = z.object({
  observations: z.array(z.object({ date: z.string(), value: z.union([z.string(), z.number()]) }).passthrough()).default([]),
}).passthrough();

type FredStatus = Extract<ConnectionStatus, 'connected' | 'not_configured' | 'invalid_credentials' | 'invalid_response' | 'rate_limited' | 'error'>;

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
  { id: 'inflation', seriesId: 'CPIAUCSL', label: 'US Inflation', unit: '% YoY', calculation: 'year_over_year', decimals: 2 },
  { id: 'gdp', seriesId: 'GDPC1', label: 'US Real GDP', unit: '$T', calculation: 'billions_to_trillions', decimals: 2 },
  { id: 'unemployment', seriesId: 'UNRATE', label: 'US Unemployment', unit: '%', decimals: 1 },
  { id: 'interest-rate', seriesId: 'FEDFUNDS', label: 'Federal Funds Rate', unit: '%', decimals: 2 },
  { id: 'treasury-10y', seriesId: 'DGS10', label: 'US 10-Year Treasury', unit: '%', decimals: 2 },
];

function getConfiguration() {
  return {
    apiKey: process.env.FRED_API_KEY?.trim() || '',
    baseUrl: process.env.FRED_API_BASE_URL?.trim() || DEFAULT_FRED_OBSERVATIONS_URL,
    csvUrl: process.env.FRED_CSV_BASE_URL?.trim() || DEFAULT_FRED_CSV_URL,
  };
}

function safeSeriesId(seriesId: string) {
  const normalized = seriesId.trim().toUpperCase();
  if (!/^[A-Z0-9._-]{1,64}$/.test(normalized)) throw new Error('Invalid FRED series identifier.');
  return normalized;
}

function classifyError(status: number, message: string): FredStatus {
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403 || /api[_ ]?key|registered|credential/i.test(message)) return 'invalid_credentials';
  return 'error';
}

async function fetchFredApi(seriesId: string, limit: number, apiKey: string, baseUrl: string): Promise<FredSeriesResult> {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:') throw new Error('FRED provider URL must use HTTPS.');
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('sort_order', 'desc');
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  const raw: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const rawMessage = raw && typeof raw === 'object' && 'error_message' in raw ? String((raw as { error_message?: unknown }).error_message || '') : '';
    const status = classifyError(response.status, rawMessage);
    return { seriesId, observations: [], status, message: status === 'invalid_credentials' ? 'FRED rejected the configured credential.' : status === 'rate_limited' ? 'FRED request limit reached.' : `FRED request failed with HTTP ${response.status}.` };
  }
  const parsed = fredResponseSchema.safeParse(raw);
  if (!parsed.success) return { seriesId, observations: [], status: 'invalid_response', message: 'FRED returned an unexpected response.' };
  const observations = parsed.data.observations.map((row) => ({ date: row.date, value: Number(row.value) })).filter((row) => Number.isFinite(row.value)).sort((a, b) => a.date.localeCompare(b.date));
  return observations.length
    ? { seriesId, observations, status: 'connected', message: 'Latest official FRED observations loaded through the FRED API.' }
    : { seriesId, observations: [], status: 'invalid_response', message: 'FRED returned no usable observations.' };
}

function parseFredCsv(text: string, seriesId: string, limit: number): EconomicObservation[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const rows = lines.slice(1).flatMap((line): EconomicObservation[] => {
    const comma = line.indexOf(',');
    if (comma < 0) return [];
    const date = line.slice(0, comma).trim();
    const value = Number(line.slice(comma + 1).trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value)) return [];
    return [{ date, value }];
  });
  return rows.slice(-limit);
}

async function fetchFredCsv(seriesId: string, limit: number, csvUrl: string): Promise<FredSeriesResult> {
  try {
    const url = new URL(csvUrl);
    if (url.protocol !== 'https:') throw new Error('FRED CSV URL must use HTTPS.');
    url.searchParams.set('id', seriesId);
    const response = await fetch(url, { headers: { Accept: 'text/csv,text/plain' }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return { seriesId, observations: [], status: response.status === 429 ? 'rate_limited' : 'error', message: `FRED public CSV request failed with HTTP ${response.status}.` };
    const observations = parseFredCsv(await response.text(), seriesId, limit);
    return observations.length
      ? { seriesId, observations, status: 'connected', message: 'Latest official FRED observations loaded through the public FRED CSV endpoint.' }
      : { seriesId, observations: [], status: 'invalid_response', message: 'FRED public CSV returned no usable observations.' };
  } catch {
    return { seriesId, observations: [], status: 'error', message: 'FRED public data is temporarily unreachable.' };
  }
}

export async function fetchFredSeries(seriesId: string, limit = 24): Promise<FredSeriesResult> {
  const normalized = safeSeriesId(seriesId);
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 240);
  const { apiKey, baseUrl, csvUrl } = getConfiguration();
  if (apiKey) {
    try {
      const result = await fetchFredApi(normalized, safeLimit, apiKey, baseUrl);
      if (result.status === 'connected') return result;
    } catch {
      // Fall through to the official public CSV endpoint.
    }
  }
  return fetchFredCsv(normalized, safeLimit, csvUrl);
}

function round(value: number, decimals = 2) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function toIndicator(definition: IndicatorDefinition, result: FredSeriesResult): EconomicIndicator {
  const latest = result.observations.at(-1);
  let value: number | null = latest?.value ?? null;
  if (value !== null && definition.calculation === 'billions_to_trillions') value /= 1_000;
  if (definition.calculation === 'year_over_year') {
    const target = latest ? new Date(`${latest.date}T00:00:00Z`) : null;
    if (target) target.setUTCFullYear(target.getUTCFullYear() - 1);
    const targetDate = target?.toISOString().slice(0, 10);
    const previous = result.observations.find((row) => row.date === targetDate);
    value = latest && previous && previous.value !== 0 ? (latest.value / previous.value - 1) * 100 : null;
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
  const results = await Promise.all(INDICATORS.map((indicator) => fetchFredSeries(indicator.seriesId, indicator.calculation === 'year_over_year' ? 18 : 1)));
  const indicators = INDICATORS.map((indicator, index) => toIndicator(indicator, results[index]));
  const connectedCount = indicators.filter((indicator) => indicator.status === 'connected').length;
  const status: FredStatus = connectedCount > 0 ? 'connected' : results[0]?.status || 'error';
  return {
    indicators,
    status,
    providerName: 'Federal Reserve Economic Data (FRED)',
    retrievedAt: new Date().toISOString(),
    message: connectedCount > 0 ? `${connectedCount} latest official FRED indicators loaded.` : results[0]?.message || 'FRED data is unavailable.',
  };
}

export async function checkFredDiagnostic(): Promise<ProviderDiagnostic> {
  const startedAt = Date.now();
  const result = await fetchFredSeries('UNRATE', 1);
  return {
    id: 'economic-data',
    name: 'Federal Reserve Economic Data (FRED)',
    role: 'Latest official inflation, GDP, unemployment and interest-rate observations',
    status: result.status,
    lastChecked: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    message: result.message,
  };
}
