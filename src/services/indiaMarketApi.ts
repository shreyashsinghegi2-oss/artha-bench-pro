import type { MarketDataAttribution } from './providerContracts';
import type { MarketHistoryPoint, NormalizedMarketQuote } from '../types';

export type IndiaMarketQuoteResult = {
  assetId: string;
  displayName: string;
  displaySymbol: string;
  providerSymbol: string | null;
  providerExchange: string | null;
  support: 'unknown' | 'supported' | 'unsupported';
  quote: NormalizedMarketQuote | null;
  attribution: MarketDataAttribution;
  reason?: string;
};

export type IndiaMarketStatus = {
  capability: string;
  provider: string;
  providerId: string;
  configured: boolean;
  apiKeyPresent: boolean;
  totalTrackedAssets: number;
  verifiedMappings: number;
  unknownMappings: number;
  lastSuccessfulQuoteFetch: string | null;
  lastFailureCategory: string | null;
  rateLimitState: 'ok' | 'limited';
  cache: { ttlSeconds: number; staleThresholdMinutes: number };
  status: 'Connected' | 'Partial coverage' | 'Unavailable' | 'No key configured';
  intradayLicensed: boolean;
  intradayConfigured: boolean;
  intradayProvider: string;
  checkedAt: string;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
  return body as T;
}

export async function fetchIndiaMarketQuotes(assetIds: string[]): Promise<IndiaMarketQuoteResult[]> {
  const bounded = [...new Set(assetIds.map((id) => id.trim()).filter(Boolean))].slice(0, 20);
  if (!bounded.length) return [];
  const response = await getJson<{ results: IndiaMarketQuoteResult[] }>(
    `/api/markets/india/quotes?assetIds=${encodeURIComponent(bounded.join(','))}`,
  );
  return Array.isArray(response.results) ? response.results : [];
}

export async function fetchIndiaMarketStatus(): Promise<IndiaMarketStatus> {
  return getJson<IndiaMarketStatus>('/api/markets/india/status');
}

export async function fetchIndiaMarketHistory(assetId: string, range = '1m'): Promise<{
  assetId: string;
  points: MarketHistoryPoint[];
  attribution: MarketDataAttribution;
  reason?: string;
}> {
  return getJson(`/api/markets/india/history?assetId=${encodeURIComponent(assetId)}&range=${encodeURIComponent(range)}`);
}

export async function searchIndiaMarketIdentities(query: string) {
  const response = await getJson<{ results: Array<{
    id: string;
    displayName: string;
    officialName: string;
    displaySymbol: string;
    exchange: string;
    sector: string;
    industry: string;
    activeProvider: string;
    providerSupport: 'unknown' | 'supported' | 'unsupported';
  }> }>(`/api/markets/india/search?q=${encodeURIComponent(query.slice(0, 120))}`);
  return response.results || [];
}
