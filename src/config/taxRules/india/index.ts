import { FinancialYear, IndiaTaxRuleConfig } from '../../../types/taxTypes';
import { FY2025_26_RULES } from './FY2025_26';
import { FY2026_27_RULES } from './FY2026_27';

export const INDIA_TAX_RULES: Record<FinancialYear, IndiaTaxRuleConfig> = {
  'FY2025-26': FY2025_26_RULES,
  'FY2026-27': FY2026_27_RULES,
};

export const getIndiaTaxRules = (financialYear: FinancialYear): IndiaTaxRuleConfig =>
  INDIA_TAX_RULES[financialYear];
