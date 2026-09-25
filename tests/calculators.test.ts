import { describe, expect, it } from 'vitest';
import { annualDepositFutureValue, cagr, emi, fdMaturity, hraExemption, npsAtSixty, nscMaturity, ppfMaturity, rdMaturity, ssyMaturity } from '../src/services/calculators';

describe('planning calculators', () => {
  it('FD: ₹1 lakh at 7% for a year, compounded quarterly', () => {
    expect(fdMaturity(100_000, 0.07, 1)).toBeCloseTo(100_000 * 1.0175 ** 4, 2);
    expect(fdMaturity(100_000, 0.07, 1)).toBeCloseTo(107_185.9, 1);
  });

  it('RD: sums each instalment compounded quarterly to maturity', () => {
    const value = rdMaturity(5_000, 0.07, 12);
    let expected = 0;
    for (let k = 1; k <= 12; k += 1) expected += 5_000 * 1.0175 ** (4 * k / 12);
    expect(value).toBeCloseTo(expected, 2);
    expect(value).toBeGreaterThan(60_000);
    expect(value).toBeLessThan(63_000);
  });

  it('PPF: ₹1.5 lakh a year for 15 years at 7.1% is about ₹40.68 lakh', () => {
    const r = ppfMaturity(150_000, 0.071);
    expect(Math.round(r.maturity / 1000)).toBe(4068);
    expect(r.invested).toBe(2_250_000);
    // Deposits above the ₹1.5 lakh cap are not counted.
    expect(ppfMaturity(200_000, 0.071).invested).toBe(2_250_000);
  });

  it('SSY: 15 years of deposits, then 6 more years of growth', () => {
    const r = ssyMaturity(150_000, 0.082);
    expect(r.maturity).toBeCloseTo(annualDepositFutureValue(150_000, 0.082, 15) * 1.082 ** 6, 0);
    expect(r.invested).toBe(2_250_000);
  });

  it('NSC grows yearly for five years', () => {
    expect(nscMaturity(100_000, 0.077)).toBeCloseTo(100_000 * 1.077 ** 5, 2);
  });

  it('EMI: ₹10 lakh at 9% for 10 years is ₹12,667.58', () => {
    expect(emi(1_000_000, 0.09, 120)).toBeCloseTo(12_667.58, 1);
    expect(emi(120_000, 0, 12)).toBe(10_000);
  });

  it('CAGR: doubling in 5 years is about 14.87%', () => {
    expect(cagr(100_000, 200_000, 5)).toBeCloseTo(0.1487, 4);
    expect(cagr(0, 100, 5)).toBeNaN();
  });

  it('HRA exemption takes the least of the three limits', () => {
    const metro = hraExemption(50_000, 20_000, 25_000, true);
    expect(metro.exempt).toBe(20_000);
    const lowRent = hraExemption(50_000, 20_000, 12_000, false);
    // Rent − 10% of basic = 7,000 is the smallest limit.
    expect(lowRent.exempt).toBe(7_000);
    expect(lowRent.taxable).toBe(13_000);
  });

  it('NPS buys an annuity with at least 40% of the corpus', () => {
    const r = npsAtSixty(5_000, 30, 0.1, 0.2);
    expect(r.lumpsum).toBeCloseTo(r.corpus * 0.6, 0);
    expect(r.monthlyPension).toBeCloseTo((r.corpus * 0.4 * 0.06) / 12, 0);
    expect(r.invested).toBe(5_000 * 360);
  });
});
