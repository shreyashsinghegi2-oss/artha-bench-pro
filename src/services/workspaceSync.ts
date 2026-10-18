/**
 * Keeps the workspace connected to the money profile (guided setup, document scan or Money Check), so
 * nobody has to type the same numbers into Income, Expenses, Budget, EMIs and Tax again.
 *
 * Records created here are tagged "from-profile". They follow the profile whenever it changes, and they
 * step aside as soon as the user adds their own records of that kind (so nothing is counted twice):
 * - Income: a gross monthly Salary source (Pre-tax, so the tax engine and health score read it).
 * - Expenses: one monthly "spending estimate" for each of the last 3 months, until the user logs expenses.
 * - EMIs: one "Existing EMIs" record with the monthly total, until the user adds their own loans.
 * - Budget: this month's budget (spending plan and savings target), until the user creates one.
 * - Tax: 80C, 80D and NPS deductions from the profile, unless the user entered their own of that type.
 */
import type { MoneyProfile } from './moneyProfile';
import { loadIncomeSources, saveIncomeSources, type IncomeSource } from './incomeStorage';
import { loadExpenses, saveExpenses, loadBudgets, saveBudgets, type ExpenseRecord, type MonthlyBudget } from './personalFinanceStorage';
import { loadEmiRecords, saveEmiRecords, EMI_RECORDS_CHANGED_EVENT, type EmiRecord } from './emiStorage';
import { loadTaxWorkspace, saveTaxWorkspace } from './taxWorkspaceStorage';
import type { TaxDeductionEntry } from '../types/taxTypes';
import { buildMoneyCheck } from './moneyCheck';

export const PROFILE_TAG = 'from-profile';
export const WORKSPACE_SYNC_EVENT = 'arthamind:workspace-synced';
const NOTE = 'Filled in from your money profile. Add your own records any time and this one steps aside.';

const isSeed = (tags: string[] | undefined) => Array.isArray(tags) && tags.includes(PROFILE_TAG);
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthStart = (d: Date) => `${monthKey(d)}-01`;
const shiftMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

export interface SyncResult { income: boolean; expenses: boolean; emi: boolean; budget: boolean; tax: boolean }

/** Brings the profile's numbers into every workspace module. Safe to call repeatedly. */
export function syncProfileToWorkspace(profile: MoneyProfile, today = new Date()): SyncResult {
  const now = today.toISOString();
  const result: SyncResult = { income: false, expenses: false, emi: false, budget: false, tax: false };

  // Income: gross salary as a monthly Pre-tax source, unless the user keeps their own salary records.
  const incomes = loadIncomeSources();
  const ownSalary = incomes.some((s) => s.type === 'Salary' && !isSeed(s.tags));
  const incomeRest = incomes.filter((s) => s.id !== 'profile-salary');
  if (!ownSalary && profile.annualSalary > 0) {
    const prior = incomes.find((s) => s.id === 'profile-salary');
    const salary: IncomeSource = {
      id: 'profile-salary', type: 'Salary', amount: Math.round(profile.annualSalary / 12), currency: 'INR', frequency: 'Monthly',
      description: 'Salary (from your money profile)', taxStatus: 'Pre-tax', startDate: monthStart(shiftMonths(today, -11)),
      tags: [PROFILE_TAG], createdAt: prior?.createdAt ?? now, updatedAt: now,
    };
    saveIncomeSources([...incomeRest, salary]);
    result.income = true;
  } else if (incomeRest.length !== incomes.length) {
    saveIncomeSources(incomeRest);
  }

  // Expenses: a monthly estimate for the last 3 months, only while the user has not logged any expenses.
  const expenses = loadExpenses();
  const ownExpenses = expenses.some((e) => !e.id.startsWith('profile-spend-'));
  const expenseRest = expenses.filter((e) => !e.id.startsWith('profile-spend-'));
  if (!ownExpenses && profile.monthlyExpenses > 0) {
    const seeds: ExpenseRecord[] = [0, -1, -2].map((n) => {
      const m = shiftMonths(today, n);
      return {
        id: `profile-spend-${monthKey(m)}`, amount: Math.round(profile.monthlyExpenses), category: 'Other', date: monthStart(m),
        merchant: 'Monthly spending (estimate)', paymentMethod: 'Other', notes: NOTE, recurring: true, createdAt: now, updatedAt: now,
      };
    });
    saveExpenses([...expenseRest, ...seeds]);
    result.expenses = true;
  } else if (expenseRest.length !== expenses.length) {
    saveExpenses(expenseRest);
  }

  // EMIs: one combined record with the monthly total, until the user adds their own loans.
  const emis = loadEmiRecords();
  const ownEmis = emis.some((r) => r.id !== 'profile-emi');
  const emiRest = emis.filter((r) => r.id !== 'profile-emi');
  if (!ownEmis && profile.monthlyEmi > 0) {
    const prior = emis.find((r) => r.id === 'profile-emi');
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 5);
    const record: EmiRecord = {
      id: 'profile-emi', name: 'Existing EMIs (from your money profile)', lender: '', loanType: 'Other',
      originalLoanAmount: null, outstandingBalance: profile.loanOutstanding && profile.loanOutstanding > 0 ? Math.round(profile.loanOutstanding) : null,
      annualInterestRate: null, emiAmount: Math.round(profile.monthlyEmi), startDate: monthStart(shiftMonths(today, -12)),
      nextDueDate: next.toISOString().slice(0, 10), tenureMonths: null, remainingInstallments: null, paymentFrequency: 'monthly',
      notes: NOTE, status: 'active', typeDetails: {}, payments: prior?.payments ?? [], createdAt: prior?.createdAt ?? now, updatedAt: now,
    };
    saveEmiRecords([...emiRest, record]);
    result.emi = true;
  } else if (emiRest.length !== emis.length) {
    saveEmiRecords(emiRest);
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EMI_RECORDS_CHANGED_EVENT));

  // Budget: this month's plan from the profile, until the user creates their own budget for the month.
  const month = monthKey(today);
  const budgets = loadBudgets();
  const ownBudget = budgets.some((b) => b.month === month && b.id !== `profile-budget-${month}`);
  const budgetRest = budgets.filter((b) => !b.id.startsWith('profile-budget-'));
  if (!ownBudget && profile.monthlyExpenses > 0) {
    const takeHome = buildMoneyCheck(profile).tax.monthlyTakeHome;
    const budget: MonthlyBudget = {
      id: `profile-budget-${month}`, name: 'Monthly plan (from your money profile)', month, notes: NOTE,
      savingsTarget: Math.max(0, Math.round(takeHome - profile.monthlyExpenses - profile.monthlyEmi)),
      categories: [{ id: 'profile-budget-spend', category: 'Other', plannedAmount: Math.round(profile.monthlyExpenses), warningThreshold: 80 }],
      createdAt: now, updatedAt: now,
    };
    saveBudgets([...budgetRest, budget]);
    result.budget = true;
  } else if (budgetRest.length !== budgets.length && ownBudget) {
    saveBudgets(budgetRest);
  }

  // Tax: deductions the profile knows about, unless the user entered their own of that type.
  const tax = loadTaxWorkspace();
  const wanted: Array<[TaxDeductionEntry['type'], number | undefined]> = [['80c', profile.section80C], ['health-insurance', profile.section80D], ['nps', profile.npsExtra]];
  const deductions = tax.deductions.filter((d) => !d.id.startsWith('profile-'));
  for (const [type, amount] of wanted) {
    if (!amount || amount <= 0 || deductions.some((d) => d.type === type)) continue;
    deductions.push({ id: `profile-${type}`, type, amount: Math.round(amount), description: 'From your money profile', status: 'added', createdAt: now });
  }
  const ageCategory = profile.age >= 80 ? '80-plus' : profile.age >= 60 ? '60-79' : 'below-60';
  saveTaxWorkspace({ ...tax, deductions, profile: { ...tax.profile, ageCategory, updatedAt: now } });
  result.tax = true;

  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(WORKSPACE_SYNC_EVENT, { detail: result }));
  return result;
}

/** Removes everything this module added (used when the profile is cleared). */
export function clearProfileSeeds(): void {
  saveIncomeSources(loadIncomeSources().filter((s) => s.id !== 'profile-salary'));
  saveExpenses(loadExpenses().filter((e) => !e.id.startsWith('profile-spend-')));
  saveEmiRecords(loadEmiRecords().filter((r) => r.id !== 'profile-emi'));
  saveBudgets(loadBudgets().filter((b) => !b.id.startsWith('profile-budget-')));
  const tax = loadTaxWorkspace();
  saveTaxWorkspace({ ...tax, deductions: tax.deductions.filter((d) => !d.id.startsWith('profile-')) });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EMI_RECORDS_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent(WORKSPACE_SYNC_EVENT, { detail: null }));
  }
}
