import { describe, expect, it } from 'vitest';
import { buildCompleteDashboard } from '../src/services/completeDashboard';
import type { MoneyProfile } from '../src/services/moneyProfile';
import type { EmiRecord } from '../src/services/emiStorage';

const profile: MoneyProfile = {
  age: 30, annualSalary: 1_800_000, monthlyExpenses: 50_000, monthlyEmi: 12_000, liquidSavings: 300_000, investments: 900_000,
  dependants: 1, loanOutstanding: 400_000, section80C: 150_000, section80D: 25_000, updatedAt: '2026-09-01T00:00:00Z', source: 'questions',
};
const loan = (over: Partial<EmiRecord>): EmiRecord => ({
  id: Math.random().toString(36), name: 'Car', lender: 'Bank', loanType: 'Vehicle loan', originalLoanAmount: 800_000, outstandingBalance: 500_000,
  annualInterestRate: 9.5, emiAmount: 17_000, startDate: '2025-01-05', nextDueDate: '2026-10-05', tenureMonths: 60, remainingInstallments: 40,
  paymentFrequency: 'monthly', notes: '', status: 'active', typeDetails: {}, payments: [], createdAt: '', updatedAt: '', ...over,
});

describe('complete dashboard', () => {
  it('uses the profile when nothing else is recorded', () => {
    const d = buildCompleteDashboard({ profile, now: new Date('2026-09-24') });
    expect(d.totalInvestments).toEqual({ value: 900_000, source: 'profile' });
    expect(d.totalSavings.value).toBe(300_000);
    expect(d.monthlyEmi).toEqual({ value: 12_000, source: 'profile' });
    expect(d.netWorth.value).toBe(300_000 + 900_000 - 400_000);
    expect(d.taxThisYear.value).toBe(Math.min(d.report.tax.oldRegimeTax, d.report.tax.newRegimeTax));
  });

  it('prefers recorded active loans over the setup estimate and ignores closed ones', () => {
    const d = buildCompleteDashboard({ profile, loans: [loan({}), loan({ emiAmount: 8_000, outstandingBalance: 200_000 }), loan({ status: 'closed', emiAmount: 99_999 })] });
    expect(d.monthlyEmi).toEqual({ value: 25_000, source: 'loans' });
    expect(d.totalDebt).toEqual({ value: 700_000, source: 'loans' });
    expect(d.loans).toHaveLength(2);
    expect(d.netWorth.value).toBe(300_000 + 900_000 - 700_000);
  });

  it('sums this month’s recorded spending and finds the top category', () => {
    const e = (amount: number, category: string, date: string) => ({ id: date + amount, amount, category, date, merchant: '', paymentMethod: 'UPI' as const, notes: '', recurring: false, createdAt: '', updatedAt: '' });
    const d = buildCompleteDashboard({ profile, now: new Date('2026-09-24'), expenses: [e(4000, 'Groceries', '2026-09-02'), e(6000, 'Rent', '2026-09-01'), e(3000, 'Groceries', '2026-09-20'), e(9000, 'Travel', '2026-08-30')] });
    expect(d.spendThisMonth).toBe(13_000);
    expect(d.topCategory).toEqual({ name: 'Groceries', amount: 7_000 });
  });

  it('bounds freedom progress between 0 and 1', () => {
    const d = buildCompleteDashboard({ profile });
    expect(d.freedomProgress).toBeGreaterThanOrEqual(0);
    expect(d.freedomProgress).toBeLessThanOrEqual(1);
  });
});
