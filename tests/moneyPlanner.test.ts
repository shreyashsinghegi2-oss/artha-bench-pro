import { describe, expect, it } from 'vitest';
import { planLumpSum, targetMix } from '../src/services/moneyPlanner';

const base = { monthlyExpenses: 40_000, monthlyEmi: 10_000, liquidSavings: 100_000 };

describe('money planner', () => {
  it('assigns every rupee exactly once', () => {
    const r = planLumpSum({ amount: 1_234_567, horizonYears: 7, risk: 'medium', ...base, taxRegime: 'old', section80CUsed: 50_000 });
    expect(r.allocated).toBe(1_234_567);
    expect(r.buckets.reduce((s, b) => s + b.amount, 0)).toBe(1_234_567);
    expect(Math.round(r.buckets.reduce((s, b) => s + b.share, 0))).toBe(100);
  });

  it('fills the emergency gap first (6 × (expenses + EMI) − cash)', () => {
    const r = planLumpSum({ amount: 500_000, horizonYears: 5, risk: 'medium', ...base });
    // 6 × 50,000 = 3,00,000 target; 1,00,000 already liquid → 2,00,000 gap.
    expect(r.buckets[0]).toMatchObject({ key: 'emergency', amount: 200_000 });
  });

  it('prepays loans at or above 9% before investing, and reports interest saved', () => {
    const r = planLumpSum({ amount: 400_000, horizonYears: 5, risk: 'high', liquidSavings: 1e9, monthlyExpenses: 10_000, costliestLoanRate: 14, costliestLoanOutstanding: 150_000 });
    expect(r.buckets[0]).toMatchObject({ key: 'debt-prepay', amount: 150_000 });
    expect(r.interestSavedPerYear).toBe(21_000); // 14% of 1.5 L
  });

  it('keeps cheap loans (below 9%) and invests instead', () => {
    const r = planLumpSum({ amount: 400_000, horizonYears: 8, risk: 'medium', costliestLoanRate: 8.4, costliestLoanOutstanding: 3_000_000 });
    expect(r.buckets.some((b) => b.key === 'debt-prepay')).toBe(false);
  });

  it('uses 80C room only under the old regime and counts the tax saved', () => {
    const old = planLumpSum({ amount: 300_000, horizonYears: 6, risk: 'medium', taxRegime: 'old', section80CUsed: 100_000 });
    const c = old.buckets.find((b) => b.key === 'tax-80c');
    expect(c?.amount).toBe(50_000);
    expect(c?.instrument).toMatch(/ELSS/);
    expect(old.taxSaved).toBe(15_600); // 31.2% of 50,000
    const newer = planLumpSum({ amount: 300_000, horizonYears: 6, risk: 'medium', taxRegime: 'new', section80CUsed: 0 });
    expect(newer.buckets.some((b) => b.key.startsWith('tax'))).toBe(false);
    expect(newer.notes.join(' ')).toMatch(/new regime/);
  });

  it('parks money needed within a year and never puts it in equity', () => {
    const r = planLumpSum({ amount: 200_000, horizonYears: 0.5, risk: 'high' });
    expect(r.buckets.map((b) => b.key)).toEqual(['liquid']);
  });

  it('shifts towards equity with a longer horizon and higher risk comfort', () => {
    expect(targetMix(2, 'low').equity).toBe(0);
    expect(targetMix(4, 'medium').equity).toBe(40);
    expect(targetMix(10, 'high')).toEqual({ equity: 75, debt: 15, gold: 10 });
  });

  it('projects value with compound growth at the stated assumptions', () => {
    const r = planLumpSum({ amount: 100_000, horizonYears: 10, risk: 'high' });
    // 75k equity @11%, 15k debt @7%, 10k gold @8% for 10 years.
    const expected = 75_000 * 1.11 ** 10 + 15_000 * 1.07 ** 10 + 10_000 * 1.08 ** 10;
    expect(r.projectedValue).toBe(Math.round(expected));
  });
});
