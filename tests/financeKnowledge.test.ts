import { describe, expect, it } from 'vitest';
import { FORMULAS as F, KNOWLEDGE, NEW_REGIME_SLABS, OLD_REGIME_SLABS } from '../src/data/financeKnowledge';
import { cagr, emi, lumpsumFutureValue } from '../src/services/calculators';
import { buildMoneyCheck } from '../src/services/moneyCheck';

const close = (a: number, b: number, tol = 0.01) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('formula book: textbook values', () => {
  it('interest and growth', () => {
    expect(F.simpleInterest(100_000, 0.08, 3)).toBe(24_000);
    close(F.compound(100_000, 0.08, 4, 5), 148_594.74);
    close(F.effectiveAnnualRate(0.12, 12), 0.126825, 1e-6);
    close(F.cagr(1, 2, 6), 0.122462, 1e-6);
    close(F.doublingYearsExact(0.08), 9.0065, 1e-4);
    close(F.realReturn(0.1, 0.06), 0.037736, 1e-6);
    close(F.futureCost(1_000_000, 0.06, 10), 1_790_847.70);
    close(F.presentValue(1_000_000, 0.08, 10), 463_193.49);
    close(F.annuityPv(10_000, 0.08, 10), 67_100.81);
  });

  it('SIP and EMI', () => {
    close(F.sipFutureValue(10_000, 0.12, 120), 2_323_390.76);
    close(F.sipForTarget(10_000_000, 0.12, 180), 19_818.62);
    close(F.emi(1_000_000, 0.09, 240), 8_997.26);
    // A SIP of the computed amount reaches the target exactly.
    close(F.sipFutureValue(F.sipForTarget(10_000_000, 0.12, 180), 0.12, 180), 10_000_000, 0.001);
  });

  it('valuation and risk', () => {
    close(F.npv(0.1, [-100_000, 40_000, 40_000, 40_000]), -525.92);
    close(F.irr([-100_000, 40_000, 40_000, 40_000]), 0.097010, 1e-5);
    // NPV at the IRR is zero.
    close(F.npv(F.irr([-100_000, 40_000, 40_000, 40_000]), [-100_000, 40_000, 40_000, 40_000]), 0, 0.001);
    close(F.bondPrice(1000, 0.08, 0.07, 3), 1026.24);
    expect(F.bondPrice(1000, 0.08, 0.08, 5)).toBeCloseTo(1000, 6); // coupon = yield → par
    close(F.gordon(10, 0.12, 0.05), 142.857, 0.001);
    close(F.capm(0.07, 1.2, 0.12), 0.13, 1e-9);
    close(F.sharpe(0.14, 0.07, 0.15), 0.46667, 1e-5);
    close(F.keynesMultiplier(0.8), 5, 1e-9);
  });

  it('Indian tax rules for FY 2025-26', () => {
    expect(F.slabTax(1_425_000, NEW_REGIME_SLABS)).toBe(93_750);
    expect(F.slabTax(1_200_000, NEW_REGIME_SLABS)).toBe(60_000); // exactly covered by the ₹60,000 87A rebate
    expect(F.slabTax(1_275_000, OLD_REGIME_SLABS)).toBe(195_000);
    expect(F.slabTax(500_000, OLD_REGIME_SLABS)).toBe(12_500); // exactly covered by the ₹12,500 old-regime rebate
    expect(F.hraExemption(240_000, 300_000, 600_000, true)).toBe(240_000);
    expect(F.hraExemption(240_000, 250_000, 600_000, false)).toBe(190_000);
  });
});

describe('formula book agrees with the app’s calculators and tax engine', () => {
  it('matches calculators.ts', () => {
    close(F.emi(2_500_000, 0.085, 240), emi(2_500_000, 0.085, 240), 0.01);
    close(F.cagr(50_000, 180_000, 9), cagr(50_000, 180_000, 9), 1e-9);
    close(F.compound(250_000, 0.1, 1, 7), lumpsumFutureValue(250_000, 0.1, 7), 0.01);
  });

  it('matches the tax engine for a ₹15 L salary in both regimes', () => {
    const r = buildMoneyCheck({ age: 30, annualSalary: 1_500_000, monthlyExpenses: 50_000, monthlyEmi: 0, liquidSavings: 0, investments: 0, dependants: 0, section80C: 150_000, section80D: 25_000 });
    close(r.tax.newRegimeTax, F.slabTax(1_500_000 - 75_000, NEW_REGIME_SLABS) * 1.04, 1);
    close(r.tax.oldRegimeTax, F.slabTax(1_500_000 - 50_000 - 150_000 - 25_000, OLD_REGIME_SLABS) * 1.04, 1);
  });
});

describe('formula book content', () => {
  it('has unique ids, keywords and a reference for every entry', () => {
    const ids = KNOWLEDGE.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const k of KNOWLEDGE) {
      expect(k.keywords.length, k.id).toBeGreaterThan(0);
      expect(k.reference.length, k.id).toBeGreaterThan(5);
      if (k.example) expect(Number.isFinite(k.example.value), k.id).toBe(true);
    }
  });
});
