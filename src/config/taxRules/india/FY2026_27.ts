import { IndiaTaxRuleConfig } from '../../../types/taxTypes';
import { FY2025_26_RULES } from './FY2025_26';

export const FY2026_27_RULES: IndiaTaxRuleConfig = {
  ...FY2025_26_RULES,
  financialYear: 'FY2026-27',
  assessmentYear: 'AY 2027-28',
  effectiveFrom: '2026-04-01',
  ruleVersion: 'india-tax-year-2026-27-v1.0.0',
  lastVerifiedAt: '2026-08-27',
  officialSourceUrls: [
    'https://www.incometaxindia.gov.in/documents/d/guest/income_tax_act_2025_as_amended_by_fa_act_2026-pdf',
    'https://www.incometaxindia.gov.in/documents/d/guest/finance-act-2026-pdf-1',
    'https://www.incometaxindia.gov.in/w/section-19-206',
    'https://www.incometaxindia.gov.in/w/schedule_vda',
  ],
  notes: [
    'The Income-tax Act, 2025 applies from tax year 2026-27.',
    ...FY2025_26_RULES.notes,
  ],
};
