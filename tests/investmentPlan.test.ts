import { describe, expect, it } from 'vitest';
import { allocationFor, sectorsFor, type PlanInput } from '../server/investmentPlan';

const base: PlanInput = { age: 32, monthlySurplus: 20000, risk: 'moderate', horizonYears: 10, emergencyGap: 0, highCostDebt: false };

describe('investment plan split', () => {
  it('every split adds up to 100% in every band and risk level', () => {
    for (const horizonYears of [1, 4, 10]) {
      for (const risk of ['low', 'moderate', 'high'] as const) {
        const { rows } = allocationFor({ ...base, horizonYears, risk });
        expect(rows.reduce((s, r) => s + r.percent, 0)).toBe(100);
      }
    }
  });

  it('keeps money needed within three years out of shares', () => {
    const { band, rows } = allocationFor({ ...base, horizonYears: 2, risk: 'high' });
    expect(band).toBe('short');
    expect(rows.some((r) => r.key === 'index' || r.key === 'flexi')).toBe(false);
  });

  it('gives a long-term high-risk profile the most equity', () => {
    const equity = (risk: 'low' | 'moderate' | 'high') =>
      allocationFor({ ...base, horizonYears: 12, risk }).rows.filter((r) => r.key === 'index' || r.key === 'flexi').reduce((s, r) => s + r.percent, 0);
    expect(equity('low')).toBeLessThan(equity('moderate'));
    expect(equity('moderate')).toBeLessThan(equity('high'));
  });

  it('turns percentages into rounded monthly amounts from the surplus', () => {
    const { rows } = allocationFor({ ...base, horizonYears: 10, risk: 'moderate' });
    const index = rows.find((r) => r.key === 'index');
    expect(index?.monthly).toBe(9000);
    expect(rows.every((r) => r.monthly % 100 === 0)).toBe(true);
  });

  it('never allocates a negative surplus', () => {
    const { rows } = allocationFor({ ...base, monthlySurplus: -5000 });
    expect(rows.every((r) => r.monthly === 0)).toBe(true);
  });

  it('offers no sector picks for money needed soon', () => {
    expect(sectorsFor('short')[0].name).toMatch(/No single-sector/);
    expect(sectorsFor('long').length).toBeGreaterThan(1);
  });
});
