import { EmiDetectionCandidate, EmiDocument } from './emiCentre';

export type ProviderConnectionState =
  | 'not_connected'
  | 'consent_required'
  | 'connected'
  | 'sync_in_progress'
  | 'needs_attention'
  | 'disconnected'
  | 'unavailable';

export type ProviderAttribution = {
  providerName: string;
  sourceUrl?: string;
  observedAt?: string;
  fetchedAt: string;
  state: 'live_verified' | 'recently_refreshed' | 'delayed' | 'end_of_day' | 'cached' | 'stale' | 'unavailable' | 'demo';
  delayNotice?: string;
};

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

// These are contracts only. No implementation in this file claims a provider is connected.
// Production adapters must use explicit credentials/consent and return honest unavailable states when not configured.
