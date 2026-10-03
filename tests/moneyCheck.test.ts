import { describe, expect, it } from 'vitest';
import { buildMoneyCheck, pvGrowingAnnuityDue, SAMPLE_MONEY_CHECK, sipForTarget, sipFutureValue, validateMoneyCheck } from '../src/services/moneyCheck';

describe('Money Check maths', () => {
  it('values a growing annuity due', () => {
    // Level payments (g = 0): 100 a year for 3 years at 10%, paid at the start of each year.
    expect(pvGrowingAnnuityDue(100, 0.1, 0, 3)).toBeCloseTo(100 + 100 / 1.1 + 100 / 1.21, 6);
    // r = g collapses to first × n.
    expect(pvGrowingAnnuityDue(100, 0.06, 0.06, 20)).toBe(2000);
  });

  it('inverts SIP future value exactly', () => {
    const sip = sipForTarget(10_000_000, 0.1, 240);
    expect(sipFutureValue(sip, 0.1, 240)).toBeCloseTo(10_000_000, 2);
  });

  it('matches a known SIP value: ₹10,000 a month for 10 years at 12% a year', () => {
    // Monthly rate from an effective 12% a year, invested at the start of each month.
    const m = 1.12 ** (1 / 12) - 1;
    const expected = 10_000 * ((1 + m) ** 120 - 1) / m * (1 + m);
    expect(sipFutureValue(10_000, 0.12, 120)).toBeCloseTo(expected, 6);
    expect(sipFutureValue(10_000, 0.12, 120)).toBeGreaterThan(22_00_000);
  });

  it('rejects impossible inputs', () => {
    expect(validateMoneyCheck({ ...SAMPLE_MONEY_CHECK, age: 12 })).toMatch(/age/);
    expect(validateMoneyCheck({ ...SAMPLE_MONEY_CHECK, annualSalary: 0 })).toMatch(/salary/);
    expect(validateMoneyCheck({ ...SAMPLE_MONEY_CHECK, retireAge: 25 })).toMatch(/Retirement/);
  });
});

describe('Money Check report', () => {
  it('uses the tax engine: ₹12.75 lakh salary pays nil tax under the new regime', () => {
    const report = buildMoneyCheck({ age: 30, annualSalary: 1_275_000, monthlyExpenses: 40_000, monthlyEmi: 0, liquidSavings: 0, investments: 0, dependants: 0 });
    expect(report.tax.newRegimeTax).toBe(0);
    expect(report.tax.better).toBe('new');
    expect(report.tax.monthlyTakeHome).toBe(Math.round(1_275_000 / 12));
  });

  it('builds a consistent report for the sample profile', () => {
    const r = buildMoneyCheck(SAMPLE_MONEY_CHECK);
    const takeHome = r.tax.monthlyTakeHome;
    expect(r.cashflow.surplus).toBe(Math.round(takeHome - 55_000 - 18_000));
    expect(r.emergency.target).toBe(6 * 73_000);
    expect(r.emergency.gap).toBe(6 * 73_000 - 250_000);
    expect(r.netWorth).toBe(250_000 + 600_000 - 900_000);
    expect(r.runwayMonths).toBeCloseTo((250_000 + 600_000) / 73_000, 6);
    expect(r.freedom.yearsToRetire).toBe(31);
    expect(r.freedom.annualExpenseAtRetirement).toBe(Math.round(660_000 * 1.06 ** 31));
    // Health cover rule of thumb: two people → ₹10 lakh; has ₹5 lakh.
    expect(r.protection.healthGap).toBe(500_000);
    // Term cover = PV of household expenses to retirement + loans − assets.
    const expected = pvGrowingAnnuityDue(660_000, 0.07, 0.06, 31) + 900_000 - 250_000 - 600_000;
    expect(r.protection.termCoverNeeded).toBe(Math.round(expected));
    expect(r.actions.length).toBeGreaterThan(0);
  });

  it('finds a freedom age that actually funds the corpus', () => {
    const r = buildMoneyCheck(SAMPLE_MONEY_CHECK);
    expect(r.freedom.freedomAge).not.toBeNull();
    expect(r.freedom.freedomAge!).toBeGreaterThan(29);
  });

  it('needs no term cover without dependants or loans when assets cover the loan', () => {
    const r = buildMoneyCheck({ age: 25, annualSalary: 900_000, monthlyExpenses: 25_000, monthlyEmi: 0, liquidSavings: 100_000, investments: 0, dependants: 0 });
    expect(r.protection.termCoverNeeded).toBe(0);
  });
});
