export type ProviderSupportState = 'unknown' | 'supported' | 'unsupported';

export type VerifiedIndiaProviderMapping = {
  providerSymbol: string | null;
  providerExchange: string | null;
  support: ProviderSupportState;
  verifiedAt: string | null;
  note?: string;
};

/**
 * Twelve Data mappings must only be added after symbol_search + quote verification
 * against the configured Twelve Data account/entitlement. Never infer these from
 * Yahoo Finance `.NS`/`.BO` symbols.
 */
export const TWELVE_DATA_INDIA_MAPPINGS: Record<string, VerifiedIndiaProviderMapping> = {
  'reliance': {
    providerSymbol: null,
    providerExchange: null,
    support: 'unknown',
    verifiedAt: null,
    note: 'Starter verification asset: Reliance Industries. Mapping intentionally blank until provider verification succeeds.',
  },
  'tcs': {
    providerSymbol: null,
    providerExchange: null,
    support: 'unknown',
    verifiedAt: null,
    note: 'Starter verification asset: Tata Consultancy Services. Mapping intentionally blank until provider verification succeeds.',
  },
  'hdfc-bank': {
    providerSymbol: null,
    providerExchange: null,
    support: 'unknown',
    verifiedAt: null,
    note: 'Starter verification asset: HDFC Bank. Mapping intentionally blank until provider verification succeeds.',
  },
  'infosys': {
    providerSymbol: null,
    providerExchange: null,
    support: 'unknown',
    verifiedAt: null,
    note: 'Starter verification asset: Infosys. Mapping intentionally blank until provider verification succeeds.',
  },
  'icici-bank': {
    providerSymbol: null,
    providerExchange: null,
    support: 'unknown',
    verifiedAt: null,
    note: 'Starter verification asset: ICICI Bank. Mapping intentionally blank until provider verification succeeds.',
  },
};

export const TWELVE_DATA_STARTER_ASSET_IDS = [
  'reliance',
  'tcs',
  'hdfc-bank',
  'infosys',
  'icici-bank',
] as const;
