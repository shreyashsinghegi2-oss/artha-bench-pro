import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearProfileSeeds, syncProfileToWorkspace } from '../src/services/workspaceSync';
import { loadIncomeSources, saveIncomeSources } from '../src/services/incomeStorage';
import { loadExpenses, loadBudgets, saveExpenses } from '../src/services/personalFinanceStorage';
import { loadEmiRecords } from '../src/services/emiStorage';
import { loadTaxWorkspace } from '../src/services/taxWorkspaceStorage';
import type { MoneyProfile } from '../src/services/moneyProfile';

const profile: MoneyProfile = {
  age: 30, annualSalary: 1_200_000, monthlyExpenses: 40_000, monthlyEmi: 15_000, liquidSavings: 100_000, investments: 300_000,
  dependants: 1, loanOutstanding: 900_000, section80C: 150_000, updatedAt: '2026-10-01T00:00:00.000Z', source: 'questions',
};
const today = new Date(2026, 9, 18);

beforeEach(() => {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('window', { localStorage, dispatchEvent: () => true, addEventListener: () => undefined, removeEventListener: () => undefined });
});
afterEach(() => vi.unstubAllGlobals());

describe('profile → workspace sync', () => {
  it('fills income, expenses, EMIs, budget and tax from the profile', () => {
    syncProfileToWorkspace(profile, today);
    const salary = loadIncomeSources().find((s) => s.id === 'profile-salary');
    expect(salary?.amount).toBe(100_000);
    expect(salary?.taxStatus).toBe('Pre-tax');
    expect(loadExpenses().filter((e) => e.id.startsWith('profile-spend-')).map((e) => e.date)).toEqual(['2026-10-01', '2026-09-01', '2026-08-01']);
    const emi = loadEmiRecords().find((r) => r.id === 'profile-emi');
    expect(emi?.emiAmount).toBe(15_000);
    expect(emi?.outstandingBalance).toBe(900_000);
    const budget = loadBudgets().find((b) => b.month === '2026-10');
    expect(budget?.categories[0].plannedAmount).toBe(40_000);
    expect(budget!.savingsTarget).toBeGreaterThan(0);
    expect(loadTaxWorkspace().deductions.find((d) => d.type === '80c')?.amount).toBe(150_000);
  });

  it('follows profile changes without duplicating records', () => {
    syncProfileToWorkspace(profile, today);
    syncProfileToWorkspace({ ...profile, annualSalary: 1_800_000, monthlyExpenses: 50_000 }, today);
    expect(loadIncomeSources().filter((s) => s.type === 'Salary')).toHaveLength(1);
    expect(loadIncomeSources()[0].amount).toBe(150_000);
    expect(loadExpenses()).toHaveLength(3);
    expect(loadExpenses()[0].amount).toBe(50_000);
  });

  it('steps aside once the user adds their own records', () => {
    syncProfileToWorkspace(profile, today);
    const own = { ...loadIncomeSources()[0], id: 'mine', tags: [], description: 'My salary' };
    saveIncomeSources([...loadIncomeSources(), own]);
    saveExpenses([...loadExpenses(), { ...loadExpenses()[0], id: 'exp-1', merchant: 'Rent' }]);
    syncProfileToWorkspace(profile, today);
    expect(loadIncomeSources().map((s) => s.id)).toEqual(['mine']);
    expect(loadExpenses().map((e) => e.id)).toEqual(['exp-1']);
  });

  it('removes everything it added when the profile is cleared', () => {
    syncProfileToWorkspace(profile, today);
    clearProfileSeeds();
    expect(loadIncomeSources()).toHaveLength(0);
    expect(loadExpenses()).toHaveLength(0);
    expect(loadEmiRecords()).toHaveLength(0);
    expect(loadBudgets()).toHaveLength(0);
    expect(loadTaxWorkspace().deductions).toHaveLength(0);
  });
});
