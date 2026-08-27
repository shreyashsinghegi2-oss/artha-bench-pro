import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { FY2026_27_RULES } from '../src/config/taxRules/india/FY2026_27';
import {
  calculateIncomeFromHouseProperty,
  calculateIndiaTaxEstimate,
  calculateSlabTax,
  calculateSurcharge,
  compareTaxRegimes,
} from '../src/services/indiaTaxEngine';
import { IncomeSource } from '../src/services/incomeStorage';
import { createDefaultTaxProfile } from '../src/services/taxWorkspaceStorage';

function source(overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: 'income-1', type: 'Salary', amount: 100_000, currency: 'INR', frequency: 'Monthly',
    description: 'Test income', taxStatus: 'Pre-tax', startDate: '2026-04-01', tags: [],
    createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z', ...overrides,
  };
}

describe('India tax engine', () => {
  it('applies the verified FY 2026-27 new-regime slabs deterministically', () => {
    expect(calculateSlabTax(new Decimal(2_325_000), FY2026_27_RULES.slabs.new).toFixed(0)).toBe('281250');
  });

  it('applies the resident rebate after the configured salary standard deduction', () => {
    const profile = { ...createDefaultTaxProfile(), taxRegime: 'new' as const };
    const result = calculateIndiaTaxEstimate([source({ amount: 106_250 })], profile, [], []);
    expect(result.taxableIncome).toBe('1200000');
    expect(result.rebate).toBe('60000');
    expect(result.totalTaxLiability).toBe('0');
  });

  it('adds four-percent cess and subtracts confirmed tax credits', () => {
    const profile = { ...createDefaultTaxProfile(), taxRegime: 'new' as const };
    const result = calculateIndiaTaxEstimate([source({ amount: 200_000 })], profile, [], [{
      id: 'tds-1', type: 'tds', source: 'Employer', amount: 100_000, status: 'matched', confidence: 'high', confirmed: true, createdAt: '2026-06-01',
    }]);
    expect(result.slabTax).toBe('281250');
    expect(result.cess).toBe('11250');
    expect(result.totalTaxLiability).toBe('292500');
    expect(result.remainingTaxPayable).toBe('192500');
  });

  it('keeps VDA gains at the configured special rate and out of rebate', () => {
    const profile = { ...createDefaultTaxProfile(), taxRegime: 'new' as const };
    const result = calculateIndiaTaxEstimate([source({
      type: 'Investment Returns', amount: 100_000, frequency: 'One-time',
      taxDetails: { investmentSubtype: 'vda', quantity: 1, purchasePrice: 100_000, salePrice: 200_000 },
    })], profile, [], []);
    expect(result.specialRateTax).toBe('30000');
    expect(result.totalTaxLiability).toBe('31200');
  });

  it('calculates let-out house property after municipal taxes, statutory deduction and interest', () => {
    const result = calculateIncomeFromHouseProperty([source({
      type: 'Rental', amount: 600_000, frequency: 'Annually',
      taxDetails: { propertyUse: 'let-out', municipalTaxes: 60_000, homeLoanInterest: 100_000, coOwnedPercent: 100 },
    })], FY2026_27_RULES);
    expect(result.taxable.toFixed(0)).toBe('278000');
  });

  it('does not set off a house-property loss against other income in the new regime', () => {
    const result = calculateIncomeFromHouseProperty([source({
      type: 'Rental', amount: 100_000, frequency: 'Annually',
      taxDetails: { propertyUse: 'let-out', homeLoanInterest: 200_000, coOwnedPercent: 100 },
    })], FY2026_27_RULES, 'new');
    expect(result.taxable.toFixed(0)).toBe('0');
    expect(result.warnings.join(' ')).toContain('not set off');
  });

  it('keeps explicitly tax-free income out of taxable income without double-counting it', () => {
    const profile = { ...createDefaultTaxProfile(), taxRegime: 'new' as const };
    const result = calculateIndiaTaxEstimate([source({ taxStatus: 'Tax-free' })], profile, [], []);
    expect(result.grossIncome).toBe('1200000');
    expect(result.exemptions).toBe('1200000');
    expect(result.taxableIncome).toBe('0');
  });

  it('excludes VDA losses from taxable special-rate income', () => {
    const profile = { ...createDefaultTaxProfile(), taxRegime: 'new' as const };
    const result = calculateIndiaTaxEstimate([source({
      type: 'Investment Returns', amount: 100_000, frequency: 'One-time',
      taxDetails: { investmentSubtype: 'vda', quantity: 1, purchasePrice: 200_000, salePrice: 100_000 },
    })], profile, [], []);
    expect(result.taxableIncome).toBe('0');
    expect(result.specialRateTax).toBe('0');
    expect(result.warnings.join(' ')).toContain('Capital loss');
  });

  it('compares regimes without presenting the result as filing advice', () => {
    const comparison = compareTaxRegimes([source({ amount: 125_000 })], createDefaultTaxProfile(), [{
      id: '80c', type: '80c', amount: 150_000, description: '80C', status: 'verified', createdAt: '2026-04-01',
    }], []);
    expect(comparison.lowerEstimatedRegime).toBe('new');
    expect(Number(comparison.estimatedDifference)).toBeGreaterThan(0);
  });

  it('applies the configured surcharge threshold without floating-point math', () => {
    const surcharge = calculateSurcharge(new Decimal(6_000_000), new Decimal(1_000_000), 'new', FY2026_27_RULES);
    expect(surcharge.toFixed(0)).toBe('100000');
  });
});
