import { describe, expect, it } from 'vitest';
import {
  calculateBreakEven,
  calculateCAGR,
  calculateCompoundInterest,
  calculateDTI,
  calculateQuickRatio,
} from '../server/financeEngine';
import { calculateScenarioLocally } from '../src/services/scenarioCalculator';

describe('Scenario Studio browser/server Decimal.js parity', () => {
  it('matches compound interest', () => {
    const inputs = {
      principal: 10000,
      annualRatePercent: 7,
      years: 5,
      monthlyContribution: 200,
      compoundingFrequencyPerYear: 12,
    };
    const local = calculateScenarioLocally('compound', inputs);
    const server = calculateCompoundInterest(inputs.principal, inputs.annualRatePercent, inputs.years, inputs.monthlyContribution, inputs.compoundingFrequencyPerYear);
    expect(local.finalBalance).toBe(server.finalBalance);
    expect(local.totalContributions).toBe(server.totalContributions);
    expect(local.totalInterestEarned).toBe(server.totalInterestEarned);
  });

  it('matches quick ratio', () => {
    const inputs = { cash: 50000, marketableSecurities: 20000, receivables: 15000, currentLiabilities: 40000 };
    const local = calculateScenarioLocally('quick-ratio', inputs);
    const server = calculateQuickRatio(inputs.cash, inputs.marketableSecurities, inputs.receivables, inputs.currentLiabilities);
    expect(local.quickRatio).toBe(server.quickRatio);
    expect(local.assessment).toBe(server.assessment);
  });

  it('matches CAGR', () => {
    const inputs = { initialValue: 50000, finalValue: 100000, years: 5 };
    const local = calculateScenarioLocally('cagr', inputs);
    const server = calculateCAGR(inputs.initialValue, inputs.finalValue, inputs.years);
    expect(local.cagrPercent).toBe(server.cagrPercent);
  });

  it('matches break-even', () => {
    const inputs = { fixedCosts: 120000, pricePerUnit: 100, variableCostPerUnit: 60 };
    const local = calculateScenarioLocally('break-even', inputs);
    const server = calculateBreakEven(inputs.fixedCosts, inputs.pricePerUnit, inputs.variableCostPerUnit);
    expect(local.contributionMargin).toBe(server.contributionMargin);
    expect(local.breakEvenUnits).toBe(server.breakEvenUnits);
    expect(local.breakEvenRevenue).toBe(server.breakEvenRevenue);
  });

  it('matches DTI', () => {
    const inputs = { monthlyGrossIncome: 8000, monthlyDebtPayments: 2400 };
    const local = calculateScenarioLocally('dti', inputs);
    const server = calculateDTI(inputs.monthlyGrossIncome, inputs.monthlyDebtPayments);
    expect(local.dtiPercent).toBe(server.dtiPercent);
    expect(local.healthCategory).toBe(server.healthCategory);
  });

  it('rejects invalid break-even assumptions', () => {
    expect(() => calculateScenarioLocally('break-even', { fixedCosts: 1000, pricePerUnit: 50, variableCostPerUnit: 50 })).toThrow(/greater than variable cost/i);
  });
});
