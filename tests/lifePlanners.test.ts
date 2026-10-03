import { describe, expect, it } from 'vitest';
import { corpusForIncome, planEducationGoal, planJobSwitch, planRetirement, RETIREMENT_DEFAULTS, salaryBreakup, sipNeededFor, steppedSipFutureValue, JOB_SWITCH_DEFAULTS } from '../src/services/lifePlanners';

describe('life planners', () => {
  it('SIP future value matches the closed form with no step-up', () => {
    const r = 1.12 ** (1 / 12) - 1, n = 120;
    const closed = 10_000 * (((1 + r) ** n - 1) / r) * (1 + r);
    expect(steppedSipFutureValue(10_000, 0.12, 10)).toBeCloseTo(closed, 4);
    expect(steppedSipFutureValue(10_000, 0.12, 10, 0.1)).toBeGreaterThan(closed);
  });
  it('sipNeededFor is the inverse of the future value', () => {
    const sip = sipNeededFor(1_00_00_000, 0.11, 15, 0.1);
    expect(steppedSipFutureValue(sip, 0.11, 15, 0.1)).toBeCloseTo(1_00_00_000, 0);
  });
  it('retirement corpus pays rising expenses exactly to zero', () => {
    const corpus = corpusForIncome(6_00_000, 25, 0.07, 0.06);
    let bal = corpus;
    for (let y = 0; y < 25; y += 1) bal = (bal - 6_00_000 * 1.06 ** y) * 1.07;
    expect(Math.abs(bal)).toBeLessThan(1);
    expect(corpusForIncome(1_00_000, 10, 0.06, 0.06)).toBe(10_00_000);
  });
  it('retirement plan: closing the gap with the extra SIP reaches the corpus', () => {
    const p = planRetirement(RETIREMENT_DEFAULTS);
    expect(p.yearsToRetire).toBe(30);
    const q = planRetirement({ ...RETIREMENT_DEFAULTS, monthlySip: p.totalSipNeeded });
    expect(q.gap).toBeLessThan(q.corpusNeeded * 0.001 + 5);
    expect(q.moneyLastsToAge === null || q.moneyLastsToAge >= RETIREMENT_DEFAULTS.lifeExpectancy - 1).toBe(true);
  });
  it('education goal: future cost, savings growth and SIP', () => {
    const g = planEducationGoal({ id: 'x', label: 'MS', costToday: 50_00_000, startAge: 18, inflation: 0.1, savedSoFar: 0 }, 8, 0.12);
    expect(g.years).toBe(10);
    expect(g.futureCost).toBe(Math.round(50_00_000 * 1.1 ** 10));
    expect(Math.abs(steppedSipFutureValue(g.monthlySip, 0.12, 10) / g.gap - 1)).toBeLessThan(1e-4);
    expect(g.sipIfDelayed3y!).toBeGreaterThan(g.monthlySip);
  });
  it('job switch: take-home rises with CTC and costs set break-even', () => {
    const a = salaryBreakup(12_00_000, 0.4, 0.1), b = salaryBreakup(16_00_000, 0.4, 0.1);
    expect(b.annualTakeHome).toBeGreaterThan(a.annualTakeHome);
    expect(a.employerPf).toBe(57_600);
    const p = planJobSwitch(JOB_SWITCH_DEFAULTS);
    expect(p.netMonthlyGain).toBeGreaterThan(0);
    expect(p.breakEvenMonths).toBe(Math.ceil(50_000 / p.netMonthlyGain));
    expect(planJobSwitch({ ...JOB_SWITCH_DEFAULTS, newCityMonthlyExpenses: 90_000 }).verdict).toBe('loss');
  });
});
