import { describe, it, expect } from 'vitest';
import {
  calculateCompoundInterest,
  calculateCAGR,
  calculateQuickRatio,
  calculateBreakEven,
  calculateDTI,
} from '../server/financeEngine';

describe('Financial Calculation Engine (Decimal.js)', () => {
  describe('calculateCompoundInterest', () => {
    it('calculates compound interest correctly for annual compounding (n = 1)', () => {
      const res = calculateCompoundInterest(10000, 7, 5, 0, 1);
      // P * (1 + 0.07/1)^5 = 10000 * 1.4025517 = 14025.52
      expect(res.finalBalance).toBe(14025.52);
      expect(res.totalInterestEarned).toBe(4025.52);
    });

    it('calculates compound interest correctly for quarterly compounding (n = 4)', () => {
      const res = calculateCompoundInterest(10000, 7, 5, 0, 4);
      // P * (1 + 0.07/4)^20 = 10000 * 1.414778 = 14147.78
      expect(res.finalBalance).toBe(14147.78);
      expect(res.totalInterestEarned).toBe(4147.78);
    });

    it('calculates compound interest correctly for monthly compounding (n = 12)', () => {
      const res = calculateCompoundInterest(10000, 7, 5, 0, 12);
      // P * (1 + 0.07/12)^60 = 10000 * 1.417625 = 14176.25
      expect(res.finalBalance).toBe(14176.25);
      expect(res.totalInterestEarned).toBe(4176.25);
    });

    it('calculates compound interest correctly for daily compounding (n = 365)', () => {
      const res = calculateCompoundInterest(10000, 7, 5, 0, 365);
      // P * (1 + 0.07/365)^1825 = 10000 * 1.419020 = 14190.20
      expect(res.finalBalance).toBe(14190.20);
      expect(res.totalInterestEarned).toBe(4190.20);
    });

    it('ensures compounding frequency outputs differ as n increases', () => {
      const annual = calculateCompoundInterest(10000, 7, 5, 0, 1).finalBalance;
      const quarterly = calculateCompoundInterest(10000, 7, 5, 0, 4).finalBalance;
      const monthly = calculateCompoundInterest(10000, 7, 5, 0, 12).finalBalance;
      const daily = calculateCompoundInterest(10000, 7, 5, 0, 365).finalBalance;

      expect(quarterly).toBeGreaterThan(annual);
      expect(monthly).toBeGreaterThan(quarterly);
      expect(daily).toBeGreaterThan(monthly);
    });
  });

  describe('calculateCAGR', () => {
    it('calculates CAGR accurately', () => {
      const res = calculateCAGR(100000, 250000, 5);
      // (250000 / 100000)^(1/5) - 1 = 20.11%
      expect(res.cagrPercent).toBe(20.11);
    });

    it('throws on invalid inputs', () => {
      expect(() => calculateCAGR(0, 100, 5)).toThrow();
    });
  });

  describe('calculateQuickRatio', () => {
    it('calculates Quick Ratio accurately', () => {
      const res = calculateQuickRatio(50000, 10000, 20000, 40000);
      expect(res.quickRatio).toBe(2.0);
      expect(res.assessment).toBe('Strong Liquidity (>= 1.5)');
    });

    it('throws if current liabilities <= 0', () => {
      expect(() => calculateQuickRatio(10, 0, 0, 0)).toThrow();
    });
  });

  describe('calculateBreakEven', () => {
    it('calculates Break-Even volume and revenue accurately', () => {
      const res = calculateBreakEven(120000, 50, 20);
      expect(res.contributionMargin).toBe(30);
      expect(res.breakEvenUnits).toBe(4000);
      expect(res.breakEvenRevenue).toBe(200000);
    });

    it('throws if price <= variable cost', () => {
      expect(() => calculateBreakEven(1000, 20, 30)).toThrow();
    });
  });

  describe('calculateDTI', () => {
    it('calculates DTI percentage and risk tier accurately', () => {
      const res = calculateDTI(80000, 28000);
      expect(res.dtiPercent).toBe(35);
      expect(res.healthCategory).toBe('Moderate');
    });

    it('throws if gross income <= 0', () => {
      expect(() => calculateDTI(0, 500)).toThrow();
    });
  });
});
