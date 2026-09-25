import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { calculateCompoundInterest } from '../server/financeEngine';
import { calculateScenarioLocally } from '../src/services/scenarioCalculator';
import { FY2026_27_RULES } from '../src/config/taxRules/india/FY2026_27';
import {
  calculateCapitalGains,
  calculateIncomeFromHouseProperty,
  calculateSurcharge,
  monthsBetween,
} from '../src/services/indiaTaxEngine';
import { IncomeSource } from '../src/services/incomeStorage';
import { buildEmiSchedule, EmiRecord } from '../src/services/emiStorage';
import { calculateRepaymentScenario } from '../src/services/emiCentre';
import { currentMonthKey, totalExpenses } from '../src/services/personalFinanceStorage';
import { macroCardFromQuote, scoreRingOffset } from '../src/components/landing/ConnectedLandingPage';
import type { NormalizedMarketQuote } from '../src/types';

function income(overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: 'income-1', type: 'Investment Returns', amount: 0, currency: 'INR', frequency: 'One-time',
    description: 'Test', taxStatus: 'Pre-tax', startDate: '2026-04-01', tags: [],
    createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z', ...overrides,
  };
}

function emi(overrides: Partial<EmiRecord> = {}): EmiRecord {
  return {
    id: 'emi-1', name: 'Home loan', lender: 'Bank', loanType: 'Home loan', originalLoanAmount: 100_000,
    outstandingBalance: 100_000, annualInterestRate: 12, emiAmount: 10_000, startDate: '2025-01-31',
    nextDueDate: '2026-01-31', tenureMonths: 24, remainingInstallments: 12, paymentFrequency: 'monthly',
    notes: '', status: 'active', typeDetails: {}, payments: [], createdAt: '2025-01-01', updatedAt: '2025-01-01', ...overrides,
  } as EmiRecord;
}

describe('compound interest with contributions', () => {
  it('makes one deposit per whole month for fractional years and matches the browser calculator', () => {
    const server = calculateCompoundInterest(10_000, 0, 1.5, 1_000, 12);
    expect(server.totalContributions).toBe(28_000);
    expect(server.finalBalance).toBe(28_000);
    const local = calculateScenarioLocally('compound', { principal: 10_000, annualRatePercent: 8, years: 2.5, monthlyContribution: 500, compoundingFrequencyPerYear: 4 });
    const remote = calculateCompoundInterest(10_000, 8, 2.5, 500, 4);
    expect(local.finalBalance).toBe(remote.finalBalance);
    expect(local.totalContributions).toBe(remote.totalContributions);
  });

  it('rejects fractional compounding frequencies on the server as well as the browser', () => {
    expect(() => calculateCompoundInterest(1_000, 5, 1, 0, 2.5)).toThrow(/whole number/);
  });
});

describe('India tax holding period and set-off rules', () => {
  it('counts whole months only once the day of month is reached', () => {
    expect(monthsBetween('2024-01-15', '2025-01-10')).toBe(11);
    expect(monthsBetween('2024-01-15', '2025-01-15')).toBe(12);
    expect(monthsBetween('2024-01-31', '2024-02-29')).toBe(1);
  });

  it('treats listed equity as long-term only when held for more than 12 months', () => {
    const sale = (sellDate: string) => income({
      amount: 300_000,
      taxDetails: { investmentSubtype: 'listed-equity', quantity: 1, purchasePrice: 100_000, salePrice: 400_000, buyDate: '2024-01-15', sellDate },
    });
    const nearlyAYear = calculateCapitalGains([sale('2025-01-10')], FY2026_27_RULES);
    expect(nearlyAYear.specialRateTax.toFixed(0)).toBe('60000'); // 20% STCG
    const exactlyAYear = calculateCapitalGains([sale('2025-01-15')], FY2026_27_RULES);
    expect(exactlyAYear.specialRateTax.toFixed(0)).toBe('60000'); // not "more than" 12 months
    const longTerm = calculateCapitalGains([sale('2025-01-16')], FY2026_27_RULES);
    expect(longTerm.specialRateTax.toFixed(0)).toBe('21875'); // 12.5% × (3,00,000 − 1,25,000)
  });

  it('caps house-property loss set-off at ₹2,00,000 under the old regime', () => {
    const result = calculateIncomeFromHouseProperty([income({
      type: 'Rental', amount: 100_000, frequency: 'Annually',
      taxDetails: { propertyUse: 'let-out', homeLoanInterest: 500_000, coOwnedPercent: 100 },
    })], FY2026_27_RULES, 'old');
    expect(result.taxable.toFixed(0)).toBe('-200000');
    expect(result.warnings.join(' ')).toContain('2,00,000');
  });

  it('caps surcharge on listed-equity gains tax at 15%', () => {
    const surcharge = calculateSurcharge(new Decimal(30_000_000), new Decimal(1_000_000), 'old', FY2026_27_RULES, new Decimal(400_000));
    // 6,00,000 × 25% + 4,00,000 × 15%
    expect(surcharge.toFixed(0)).toBe('210000');
  });
});

describe('EMI schedule', () => {
  it('keeps month-end due dates from drifting to the 28th', () => {
    const rows = buildEmiSchedule(emi(), 3);
    expect(rows.map((row) => row.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('keeps a mid-month due day even when the loan started on a later day', () => {
    const rows = buildEmiSchedule(emi({ startDate: '2025-01-20', nextDueDate: '2026-01-05' }), 2);
    expect(rows.map((row) => row.dueDate)).toEqual(['2026-01-05', '2026-02-05']);
  });

  it('shows no instalment when none remain and never repays more than the balance', () => {
    expect(buildEmiSchedule(emi({ remainingInstallments: 0 }))).toEqual([]);
    const [last] = buildEmiSchedule(emi({ outstandingBalance: 5_000, remainingInstallments: 1 }), 1);
    expect(last.estimatedPrincipal).toBe(5_000);
    expect(last.amount).toBe(5_050); // 5,000 principal + 1% monthly interest
    expect(last.remainingBalance).toBe(0);
  });

  it('shows a zero EMI when a prepayment clears the loan', () => {
    const result = calculateRepaymentScenario(emi(), { prepaymentAmount: 150_000, processingFee: 0, emiIncrease: 0, strategy: 'reduce-emi' });
    expect(result?.revisedEmi).toBe(0);
    expect(result?.revisedInterest).toBe(0);
  });
});

describe('personal finance aggregation', () => {
  it('sums rupee amounts without floating-point drift', () => {
    const base = { merchant: 'x', category: 'Food', date: '2026-01-01' };
    expect(totalExpenses([{ ...base, amount: 0.1 }, { ...base, amount: 0.2 }] as never)).toBe(0.3);
  });

  it('uses the local calendar month', () => {
    expect(currentMonthKey(new Date(2026, 0, 1, 0, 30))).toBe('2026-01');
  });
});

describe('landing page figures', () => {
  it('does not show +0.00% when the provider has no change value', () => {
    const quote = { symbol: '^NSEI', price: 24_500.5, changePercent: null } as unknown as NormalizedMarketQuote;
    expect(macroCardFromQuote('NIFTY 50', quote).delta).toBe('Change unavailable');
    expect(macroCardFromQuote('NIFTY 50', { ...quote, changePercent: -0.456 } as NormalizedMarketQuote)).toMatchObject({ delta: '−0.46%', direction: 'down' });
    expect(macroCardFromQuote('Gold', undefined).delta).toBe('Connect data source');
  });

  it('fills the score ring in proportion to checks passed', () => {
    expect(scoreRingOffset(5, 6)).toBeCloseTo(1 / 6);
    expect(scoreRingOffset(6, 6)).toBe(0);
    expect(scoreRingOffset(0, 6)).toBe(1);
  });
});
