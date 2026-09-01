/**
 * Compatibility entry point for the hardened generic market-data adapter.
 *
 * India company-directory quotes use server/indiaMarketService.ts so provider
 * mappings are verified by asset ID instead of inferred from Yahoo symbols.
 */
export * from './marketDataProviderV2';
