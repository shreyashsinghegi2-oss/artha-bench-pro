/**
 * Artha Bench - Deterministic Financial Calculation Engine
 * Serves as the source of truth for numeric calculations.
 * Uses Decimal.js for arbitrary-precision decimal arithmetic.
 */

import { Decimal } from 'decimal.js';

// Configure Decimal.js precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface CompoundInterestResult {
  principal: number;
  annualRatePercent: number;
  years: number;
  compoundingFrequencyPerYear: number;
  monthlyContribution: number;
  finalBalance: number;
  totalContributions: number;
  totalInterestEarned: number;
}

export interface CAGRResult {
  initialValue: number;
  finalValue: number;
  years: number;
  cagrPercent: number;
}

export interface BreakEvenResult {
  fixedCosts: number;
  pricePerUnit: number;
  variableCostPerUnit: number;
  contributionMargin: number;
  breakEvenUnits: number;
  breakEvenRevenue: number;
}

export interface DTIResult {
  monthlyGrossIncome: number;
  monthlyDebtPayments: number;
  dtiPercent: number;
  healthCategory: 'Excellent' | 'Moderate' | 'High Risk' | 'Critical';
}

export interface QuickRatioResult {
  cash: number;
  marketableSecurities: number;
  receivables: number;
  currentLiabilities: number;
  quickRatio: number;
  assessment: string;
}

/**
 * Calculates Quick Ratio (Acid-Test Ratio).
 */
export function calculateQuickRatio(
  cash: number,
  marketableSecurities: number,
  receivables: number,
  currentLiabilities: number
): QuickRatioResult {
  if (currentLiabilities <= 0) {
    throw new Error('Current liabilities must be greater than zero.');
  }

  const dCash = new Decimal(cash);
  const dSecurities = new Decimal(marketableSecurities);
  const dReceivables = new Decimal(receivables);
  const dLiabilities = new Decimal(currentLiabilities);

  const quickAssets = dCash.plus(dSecurities).plus(dReceivables);
  const ratioDec = quickAssets.div(dLiabilities);
  const ratio = ratioDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

  let assessment = 'Weak Liquidity (< 1.0)';
  if (ratio >= 1.5) assessment = 'Strong Liquidity (>= 1.5)';
  else if (ratio >= 1.0) assessment = 'Adequate Liquidity (1.0 - 1.49)';

  return {
    cash,
    marketableSecurities,
    receivables,
    currentLiabilities,
    quickRatio: ratio,
    assessment,
  };
}

/**
 * Calculates Compound Interest using Decimal.js with correct compounding frequency.
 * Formula without contributions: A = P * (1 + r/n)^(n * t)
 * Formula with monthly contributions: compounds iteratively or per compounding frequency interval.
 */
export function calculateCompoundInterest(
  principal: number,
  annualRatePercent: number,
  years: number,
  monthlyContribution = 0,
  compoundingFrequencyPerYear = 12
): CompoundInterestResult {
  if (principal < 0 || annualRatePercent < 0 || years <= 0 || compoundingFrequencyPerYear <= 0) {
    throw new Error('Invalid input parameters for compound interest calculation.');
  }

  const P = new Decimal(principal);
  const r = new Decimal(annualRatePercent).div(100);
  const t = new Decimal(years);
  const n = new Decimal(compoundingFrequencyPerYear);
  const PMT = new Decimal(monthlyContribution);

  let finalBalanceDec: Decimal;
  let totalContributionsDec = P;

  if (PMT.isZero()) {
    // Pure Compound Interest Formula: A = P * (1 + r/n)^(n * t)
    const ratePerPeriod = r.div(n);
    const totalPeriods = n.times(t);
    const growthFactor = new Decimal(1).plus(ratePerPeriod).pow(totalPeriods.toNumber());
    finalBalanceDec = P.times(growthFactor);
  } else {
    // Compound interest with regular monthly contributions
    // Simulate step-by-step per month (12 steps per year)
    const totalMonths = t.times(12).toNumber();
    let balance = P;
    const ratePerMonth = r.div(12);

    for (let m = 1; m <= totalMonths; m++) {
      balance = balance.plus(PMT);
      totalContributionsDec = totalContributionsDec.plus(PMT);

      if (compoundingFrequencyPerYear === 12) {
        balance = balance.times(new Decimal(1).plus(ratePerMonth));
      } else {
        // Effective monthly compounding rate matching compounding frequency n
        const effectiveMonthlyRate = new Decimal(1).plus(r.div(n)).pow(n.div(12).toNumber()).minus(1);
        balance = balance.times(new Decimal(1).plus(effectiveMonthlyRate));
      }
    }
    finalBalanceDec = balance;
  }

  const finalBalance = finalBalanceDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  const totalContributions = totalContributionsDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  const totalInterestEarned = new Decimal(finalBalance).minus(totalContributions).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

  return {
    principal,
    annualRatePercent,
    years,
    compoundingFrequencyPerYear,
    monthlyContribution,
    finalBalance,
    totalContributions,
    totalInterestEarned,
  };
}

/**
 * Calculates Compound Annual Growth Rate (CAGR).
 * CAGR = (Final Value / Initial Value)^(1 / Years) - 1
 */
export function calculateCAGR(
  initialValue: number,
  finalValue: number,
  years: number
): CAGRResult {
  if (initialValue <= 0 || years <= 0) {
    throw new Error('Initial value and years must be greater than zero.');
  }

  const initDec = new Decimal(initialValue);
  const finalDec = new Decimal(finalValue);
  const yearsDec = new Decimal(years);

  const ratio = finalDec.div(initDec);
  const cagrDec = new Decimal(Math.pow(ratio.toNumber(), 1 / yearsDec.toNumber())).minus(1).times(100);
  const cagrPercent = cagrDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

  return {
    initialValue,
    finalValue,
    years,
    cagrPercent,
  };
}

/**
 * Calculates Break-Even Volume and Revenue.
 */
export function calculateBreakEven(
  fixedCosts: number,
  pricePerUnit: number,
  variableCostPerUnit: number
): BreakEvenResult {
  const fc = new Decimal(fixedCosts);
  const p = new Decimal(pricePerUnit);
  const vc = new Decimal(variableCostPerUnit);

  const cm = p.minus(vc);
  if (cm.lte(0)) {
    throw new Error('Price per unit must be greater than variable cost per unit.');
  }

  const unitsDec = fc.div(cm).ceil();
  const revenueDec = unitsDec.times(p);

  return {
    fixedCosts,
    pricePerUnit,
    variableCostPerUnit,
    contributionMargin: cm.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    breakEvenUnits: unitsDec.toNumber(),
    breakEvenRevenue: revenueDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
  };
}

/**
 * Calculates Debt-to-Income (DTI) ratio and risk tier.
 */
export function calculateDTI(
  monthlyGrossIncome: number,
  monthlyDebtPayments: number
): DTIResult {
  if (monthlyGrossIncome <= 0) {
    throw new Error('Monthly gross income must be greater than zero.');
  }

  const inc = new Decimal(monthlyGrossIncome);
  const debt = new Decimal(monthlyDebtPayments);

  const dtiDec = debt.div(inc).times(100);
  const dtiPercent = dtiDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

  let healthCategory: 'Excellent' | 'Moderate' | 'High Risk' | 'Critical';
  if (dtiPercent <= 20) healthCategory = 'Excellent';
  else if (dtiPercent <= 36) healthCategory = 'Moderate';
  else if (dtiPercent <= 50) healthCategory = 'High Risk';
  else healthCategory = 'Critical';

  return {
    monthlyGrossIncome,
    monthlyDebtPayments,
    dtiPercent,
    healthCategory,
  };
}

/**
 * Generates a deterministic report verification code.
 */
export function generateVerificationCode(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const code = Math.abs(hash).toString(36).toUpperCase().padStart(4, 'X').slice(-4);
  const year = new Date().getFullYear();
  return `ARTHA-${year}-${code}`;
}
