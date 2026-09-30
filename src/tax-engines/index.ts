/** Registry of tax engines by country code. Rules for non-India countries live in ./config/*.json. */
import { indiaEngine } from './india';
import { progressiveEngine } from './progressive';
import type { TaxConfig, TaxEngine } from './types';
import us2026 from './config/us-2026.json';
import uk2026 from './config/uk-2026.json';
import ph2026 from './config/philippines-2026.json';
import ng2026 from './config/nigeria-2026.json';
import ke2026 from './config/kenya-2026.json';

export { TaxInputError } from './progressive';
export type { TaxEngine, TaxResult, TaxOptions, TaxConfig, SlabLine } from './types';

const ENGINES: Record<string, TaxEngine> = {
  IN: indiaEngine,
  US: progressiveEngine([us2026 as TaxConfig]),
  UK: progressiveEngine([uk2026 as TaxConfig]),
  PH: progressiveEngine([ph2026 as TaxConfig]),
  NG: progressiveEngine([ng2026 as TaxConfig]),
  KE: progressiveEngine([ke2026 as TaxConfig]),
};

export function getEngine(countryCode: string): TaxEngine | undefined {
  return ENGINES[countryCode.toUpperCase()];
}

export const availableCountries = (): string[] => Object.keys(ENGINES);
