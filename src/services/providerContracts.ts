import type { MarketHistoryPoint, NormalizedMarketQuote } from '../types';
import { EmiDetectionCandidate, EmiDocument } from './emiCentre';

export type ProviderConnectionState =
  | 'not_connected'
  | 'consent_required'
  | 'connected'
  | 'sync_in_progress'
  | 'needs_attention'
  | 'disconnected'
  | 'unavailable';

export type MarketDataState =
  | 'live_verified'
  | 'recently_refreshed'
  | 'delayed'
  | 'end_of_day'
  | 'cached'
  | 'stale'
  | 'unavailable'
  | 'demo';

export interface MarketDataAttribution {
  providerName: string;
  sourceUrl?: string;
  exchange?: string;
  quoteTimestamp?: string;
  retrievedAt: string;
  state: MarketDataState;
  delayNotice?: string;
  staleAfter?: string;
}

// Compatibility alias for finance/EMI provider contracts that already use this name.
export type ProviderAttribution = MarketDataAttribution;

export type MarketProviderQuote = {
  quote: NormalizedMarketQuote;
  attribution: MarketDataAttribution;
};

export type MarketAssetSearchResult = {
  id: string;
  symbol: string;
  providerSymbol?: string;
  displayName: string;
  market: 'india' | 'us' | 'forex';
  exchange?: string;
  currency?: string;
  sector?: string;
  supported: boolean;
};

export interface MarketQuoteProvider {
  readonly id: string;
  readonly displayName: string;
  getQuote(symbol: string): Promise<MarketProviderQuote>;
  getBatchQuotes?(symbols: string[]): Promise<MarketProviderQuote[]>;
  searchAssets?(query: string, market: 'india' | 'us' | 'forex'): Promise<MarketAssetSearchResult[]>;
}

export interface MarketHistoryProvider {
  readonly id: string;
  getHistory(input: {
    symbol: string;
    interval: string;
    from?: string;
    to?: string;
    market: 'india' | 'us' | 'forex';
  }): Promise<{ points: MarketHistoryPoint[]; attribution: MarketDataAttribution }>;
}

export type FxQuote = {
  pair: string;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  spread: number | null;
  dailyChangePercent: number | null;
  attribution: MarketDataAttribution;
};

export type FxHistoryRequest = {
  pair: string;
  interval: string;
  from?: string;
  to?: string;
};

export type FxPairSearchResult = {
  pair: string;
  baseCurrency: string;
  quoteCurrency: string;
  supported: boolean;
};

export interface ForexDataProvider {
  readonly id: string;
  getFxQuote(pair: string): Promise<FxQuote>;
  getFxHistory(input: FxHistoryRequest): Promise<{ points: MarketHistoryPoint[]; attribution: MarketDataAttribution }>;
  searchPairs(query: string): Promise<FxPairSearchResult[]>;
}

export type MarketAlertInput = {
  symbol: string;
  condition: 'price_threshold' | 'movement' | 'period_high_low' | 'data_quality' | 'watchlist_update' | 'fx_reference';
  threshold?: number | null;
  direction?: 'above' | 'below' | 'absolute' | null;
};

export type MarketAlertProviderRecord = MarketAlertInput & {
  id: string;
  createdAt: string;
  status: 'active' | 'paused' | 'unavailable';
};

export interface MarketAlertProvider {
  readonly id: string;
  createAlert(input: MarketAlertInput): Promise<MarketAlertProviderRecord>;
  evaluateAlerts(): Promise<void>;
}

export type ConsentGrant = {
  id: string;
  providerName: string;
  scopes: string[];
  grantedAt: string;
  expiresAt?: string;
  state: 'pending' | 'active' | 'revoked' | 'expired' | 'denied';
};

export interface AccountAggregationProvider {
  readonly id: string;
  readonly displayName: string;
  connectionState(): Promise<ProviderConnectionState>;
  requestConsent(scopes: string[]): Promise<ConsentGrant>;
  revokeConsent(consentId: string): Promise<void>;
  detectCommitments(consentId: string): Promise<{ candidates: EmiDetectionCandidate[]; attribution: ProviderAttribution }>;
}

export interface StatementImportProvider {
  readonly id: string;
  supports(file: File): boolean;
  stage(file: File, sourceType: EmiDocument['sourceType']): Promise<{ document: EmiDocument; candidates: EmiDetectionCandidate[] }>;
}

export interface LoanDocumentExtractionProvider {
  readonly id: string;
  supports(file: File): boolean;
  extract(file: File): Promise<{ status: 'review_required' | 'unavailable' | 'failed'; fields: Record<string, unknown>; uncertainFields: string[]; attribution: ProviderAttribution }>;
}

export interface RbiPolicyRateProvider {
  getReference(): Promise<{ policyRate: number | null; publishedAt: string | null; attribution: ProviderAttribution }>;
}

export interface LenderRateProvider {
  searchReferences(query: { lender?: string; productCategory?: string }): Promise<Array<{ lender: string; productCategory: string; rateMin: number | null; rateMax: number | null; rateType?: string; attribution: ProviderAttribution }>>;
}

export interface FxRateProvider {
  getReference(baseCurrency: string, quoteCurrency: string): Promise<{ rate: number | null; marketStatus?: string; attribution: ProviderAttribution }>;
}

export interface NotificationProvider {
  permission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'>;
  requestPermission(): Promise<'granted' | 'denied' | 'unsupported'>;
  scheduleReference(input: { entityId: string; dueDate: string; offsetsDays: number[] }): Promise<{ state: 'scheduled' | 'unavailable'; referenceId?: string }>;
}

export interface IndiaMarketDirectoryProvider {
  searchIdentity(query: string): Promise<Array<{ id: string; symbol: string; displayName: string; exchange?: string; sector?: string; supported: boolean }>>;
}

export interface MarketAssetLogoProvider {
  resolve(symbol: string): Promise<{ url?: string; source?: string; status: 'verified' | 'fallback' | 'unavailable' }>;
}

// Contracts only: no implementation here claims a bank, exchange, market-data,
// notification, FX, lender, billing or logo provider is connected.
