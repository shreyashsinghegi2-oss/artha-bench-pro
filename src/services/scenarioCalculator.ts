import Decimal from 'decimal.js';
import type { CalculatorTab } from '../components/scenarios/ScenarioAssistantPanel';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface LocalScenarioResult extends Record<string, unknown> {
  engine: 'Decimal.js';
  verificationStatus: 'local';
  calculatedAt: string;
}

function finite(value: unknown, label: string) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a valid number.`);
  return number;
}

function nonNegative(value: unknown, label: string) {
  const number = finite(value, label);
  if (number < 0) throw new Error(`${label} cannot be negative.`);
  return number;
}

function positive(value: unknown, label: string) {
  const number = finite(value, label);
  if (number <= 0) throw new Error(`${label} must be greater than zero.`);
  return number;
}

function round(value: Decimal, decimals = 2) {
  return value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
}

export function calculateScenarioLocally(tab: CalculatorTab, inputs: Record<string, number>): LocalScenarioResult {
  const calculatedAt = new Date().toISOString();

  if (tab === 'compound') {
    const principal = nonNegative(inputs.principal, 'Principal');
    const annualRatePercent = nonNegative(inputs.annualRatePercent, 'Annual interest rate');
    const years = positive(inputs.years, 'Years');
    const monthlyContribution = nonNegative(inputs.monthlyContribution ?? 0, 'Monthly contribution');
    const compoundingFrequencyPerYear = positive(inputs.compoundingFrequencyPerYear ?? 12, 'Compounding frequency');
    if (!Number.isInteger(compoundingFrequencyPerYear) || compoundingFrequencyPerYear > 365) {
      throw new Error('Compounding frequency must be a whole number between 1 and 365.');
    }

    const P = new Decimal(principal);
    const r = new Decimal(annualRatePercent).div(100);
    const n = new Decimal(compoundingFrequencyPerYear);
    const PMT = new Decimal(monthlyContribution);
    let balance: Decimal;
    let totalContributions = P;

    if (PMT.isZero()) {
      const periods = n.times(years).toNumber();
      balance = P.times(new Decimal(1).plus(r.div(n)).pow(periods));
    } else {
      balance = P;
      const totalMonths = Math.round(new Decimal(years).times(12).toNumber());
      const effectiveMonthlyRate = new Decimal(1).plus(r.div(n)).pow(n.div(12).toNumber()).minus(1);
      for (let month = 0; month < totalMonths; month += 1) {
        balance = balance.plus(PMT).times(new Decimal(1).plus(effectiveMonthlyRate));
        totalContributions = totalContributions.plus(PMT);
      }
    }

    const finalBalance = round(balance);
    const contributed = round(totalContributions);
    return {
      principal,
      annualRatePercent,
      years,
      monthlyContribution,
      compoundingFrequencyPerYear,
      finalBalance,
      totalContributions: contributed,
      totalInterestEarned: round(new Decimal(finalBalance).minus(contributed)),
      engine: 'Decimal.js',
      verificationStatus: 'local',
      calculatedAt,
    };
  }

  if (tab === 'quick-ratio') {
    const cash = nonNegative(inputs.cash, 'Cash');
    const marketableSecurities = nonNegative(inputs.marketableSecurities, 'Marketable securities');
    const receivables = nonNegative(inputs.receivables, 'Receivables');
    const currentLiabilities = positive(inputs.currentLiabilities, 'Current liabilities');
    const quickRatio = round(new Decimal(cash).plus(marketableSecurities).plus(receivables).div(currentLiabilities));
    const assessment = quickRatio >= 1.5
      ? 'Strong Liquidity (>= 1.5)'
      : quickRatio >= 1
        ? 'Adequate Liquidity (1.0 - 1.49)'
        : 'Weak Liquidity (< 1.0)';
    return {
      cash,
      marketableSecurities,
      receivables,
      currentLiabilities,
      quickRatio,
      assessment,
      engine: 'Decimal.js',
      verificationStatus: 'local',
      calculatedAt,
    };
  }

  if (tab === 'cagr') {
    const initialValue = positive(inputs.initialValue, 'Initial value');
    const finalValue = positive(inputs.finalValue, 'Final value');
    const years = positive(inputs.years, 'Years');
    const cagrPercent = round(new Decimal(finalValue).div(initialValue).pow(new Decimal(1).div(years)).minus(1).times(100));
    return {
      initialValue,
      finalValue,
      years,
      cagrPercent,
      engine: 'Decimal.js',
      verificationStatus: 'local',
      calculatedAt,
    };
  }

  if (tab === 'break-even') {
    const fixedCosts = nonNegative(inputs.fixedCosts, 'Fixed costs');
    const pricePerUnit = positive(inputs.pricePerUnit, 'Price per unit');
    const variableCostPerUnit = nonNegative(inputs.variableCostPerUnit, 'Variable cost per unit');
    const contributionMargin = new Decimal(pricePerUnit).minus(variableCostPerUnit);
    if (contributionMargin.lte(0)) throw new Error('Price per unit must be greater than variable cost per unit.');
    const breakEvenUnits = new Decimal(fixedCosts).div(contributionMargin).ceil();
    return {
      fixedCosts,
      pricePerUnit,
      variableCostPerUnit,
      contributionMargin: round(contributionMargin),
      breakEvenUnits: breakEvenUnits.toNumber(),
      breakEvenRevenue: round(breakEvenUnits.times(pricePerUnit)),
      engine: 'Decimal.js',
      verificationStatus: 'local',
      calculatedAt,
    };
  }

  const monthlyGrossIncome = positive(inputs.monthlyGrossIncome, 'Monthly gross income');
  const monthlyDebtPayments = nonNegative(inputs.monthlyDebtPayments, 'Monthly debt payments');
  const dtiPercent = round(new Decimal(monthlyDebtPayments).div(monthlyGrossIncome).times(100));
  const healthCategory = dtiPercent <= 20
    ? 'Excellent'
    : dtiPercent <= 36
      ? 'Moderate'
      : dtiPercent <= 50
        ? 'High Risk'
        : 'Critical';
  return {
    monthlyGrossIncome,
    monthlyDebtPayments,
    dtiPercent,
    healthCategory,
    engine: 'Decimal.js',
    verificationStatus: 'local',
    calculatedAt,
  };
}
