import { INDIA_MARKET_UNIVERSE } from '../src/data/indiaMarketUniverse';
import { TWELVE_DATA_STARTER_ASSET_IDS } from './data/indiaProviderMappings';
import { searchTwelveDataAssets, type TwelveDataSearchCandidate } from './providers/twelveDataProvider';

export type IndiaSymbolVerificationResult = {
  assetId: string;
  companyName: string;
  yahooReferenceSymbol: string;
  candidates: TwelveDataSearchCandidate[];
  checkedAt: string;
};

/**
 * Server-only development utility. It never returns or logs an API key.
 * Run only after TWELVE_DATA_API_KEY is configured server-side, inspect the
 * candidates, then manually commit the exact confirmed symbol/exchange into
 * server/data/indiaProviderMappings.ts and verify a quote before marking support.
 */
export async function discoverStarterTwelveDataMappings(
  assetIds: readonly string[] = TWELVE_DATA_STARTER_ASSET_IDS,
): Promise<IndiaSymbolVerificationResult[]> {
  const allowed = new Set(TWELVE_DATA_STARTER_ASSET_IDS);
  const selected = INDIA_MARKET_UNIVERSE.filter((asset) => assetIds.includes(asset.id) && allowed.has(asset.id as never));
  const results: IndiaSymbolVerificationResult[] = [];

  for (const asset of selected) {
    const candidates = await searchTwelveDataAssets(asset.officialName);
    results.push({
      assetId: asset.id,
      companyName: asset.officialName,
      yahooReferenceSymbol: asset.providerSymbol,
      candidates: candidates.filter((candidate) => {
        const country = candidate.country?.toLowerCase() || '';
        const exchange = candidate.exchange?.toLowerCase() || '';
        return country.includes('india') || exchange.includes('nse') || exchange.includes('bse');
      }),
      checkedAt: new Date().toISOString(),
    });
  }

  return results;
}
