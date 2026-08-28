import { IncomeSource, loadIncomeSources, monthlyEquivalent } from './incomeStorage';

export const EXPENSE_STORAGE_KEY = 'artha_expenses_v1';
export const BUDGET_STORAGE_KEY = 'artha_budgets_v1';

export const EXPENSE_CATEGORIES = [
  'Housing/Rent',
  'Food & Dining',
  'Groceries',
  'Transport',
  'Bills & Utilities',
  'Education',
  'Health & Fitness',
  'Shopping',
  'Entertainment',
  'Travel',
  'EMI/Debt',
  'Investments',
  'Insurance',
  'Family',
  'Other',
] as const;

export const PAYMENT_METHODS = [
  'UPI',
  'Credit Card',
  'Debit Card',
  'Cash',
  'Bank Transfer',
  'Wallet',
  'Auto-debit',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number] | string;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface ExpenseRecord {
  id: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  merchant: string;
  paymentMethod: PaymentMethod;
  notes: string;
  recurring: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseDraft = Omit<ExpenseRecord, 'id' | 'createdAt' | 'updatedAt'>;

export interface BudgetCategoryPlan {
  id: string;
  category: ExpenseCategory;
  plannedAmount: number;
  warningThreshold: number;
}

export interface MonthlyBudget {
  id: string;
  name: string;
  month: string;
  notes: string;
  savingsTarget: number;
  categories: BudgetCategoryPlan[];
  createdAt: string;
  updatedAt: string;
}

interface ExpenseEnvelope {
  version: 1;
  records: ExpenseRecord[];
}

interface BudgetEnvelope {
  version: 1;
  budgets: MonthlyBudget[];
}

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage);

function safeParse<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export function loadExpenses(): ExpenseRecord[] {
  const envelope = safeParse<ExpenseEnvelope>(EXPENSE_STORAGE_KEY);
  if (envelope?.version !== 1 || !Array.isArray(envelope.records)) return [];
  return envelope.records.filter((record) =>
    typeof record.id === 'string' &&
    typeof record.amount === 'number' && Number.isFinite(record.amount) && record.amount > 0 &&
    typeof record.category === 'string' &&
    typeof record.date === 'string' &&
    typeof record.merchant === 'string' &&
    typeof record.paymentMethod === 'string' &&
    typeof record.notes === 'string' &&
    typeof record.recurring === 'boolean'
  );
}

export function saveExpenses(records: ExpenseRecord[]): void {
  if (!isBrowser()) return;
  const envelope: ExpenseEnvelope = { version: 1, records };
  window.localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(envelope));
}

export function createExpense(draft: ExpenseDraft, existingId?: string, originalCreatedAt?: string): ExpenseRecord {
  const now = new Date().toISOString();
  return {
    ...draft,
    amount: Math.abs(Number(draft.amount)),
    merchant: draft.merchant.trim(),
    notes: draft.notes.trim(),
    id: existingId ?? crypto.randomUUID(),
    createdAt: originalCreatedAt ?? now,
    updatedAt: now,
  };
}

export function loadBudgets(): MonthlyBudget[] {
  const envelope = safeParse<BudgetEnvelope>(BUDGET_STORAGE_KEY);
  if (envelope?.version !== 1 || !Array.isArray(envelope.budgets)) return [];
  return envelope.budgets.filter((budget) =>
    typeof budget.id === 'string' &&
    typeof budget.name === 'string' &&
    /^\d{4}-\d{2}$/.test(budget.month) &&
    Array.isArray(budget.categories)
  );
}

export function saveBudgets(budgets: MonthlyBudget[]): void {
  if (!isBrowser()) return;
  const envelope: BudgetEnvelope = { version: 1, budgets };
  window.localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(envelope));
}

export function createBudget(input: Omit<MonthlyBudget, 'id' | 'createdAt' | 'updatedAt'>, existing?: MonthlyBudget): MonthlyBudget {
  const now = new Date().toISOString();
  return {
    ...input,
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function defaultBudgetTemplate(): BudgetCategoryPlan[] {
  const template: Array<[ExpenseCategory, number]> = [
    ['Housing/Rent', 30],
    ['Food & Dining', 10],
    ['Groceries', 8],
    ['Transport', 8],
    ['Bills & Utilities', 7],
    ['Education', 5],
    ['Health & Fitness', 5],
    ['Shopping', 5],
    ['Entertainment', 4],
    ['Insurance', 5],
    ['Family', 5],
    ['Other', 8],
  ];
  return template.map(([category]) => ({
    id: crypto.randomUUID(),
    category,
    plannedAmount: 0,
    warningThreshold: 80,
  }));
}

export function monthBounds(month: string): { start: string; end: string } {
  const [year, monthIndex] = month.split('-').map(Number);
  const start = `${year}-${String(monthIndex).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(year, monthIndex, 0));
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

export function expensesInRange(records: ExpenseRecord[], start: string, end: string): ExpenseRecord[] {
  return records.filter((record) => record.date >= start && record.date <= end);
}

export function expensesForMonth(records: ExpenseRecord[], month: string): ExpenseRecord[] {
  return records.filter((record) => record.date.startsWith(`${month}-`) || record.date.startsWith(month));
}

export function totalExpenses(records: ExpenseRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function spendingByCategory(records: ExpenseRecord[]): Record<string, number> {
  return records.reduce<Record<string, number>>((totals, record) => {
    totals[record.category] = (totals[record.category] ?? 0) + record.amount;
    return totals;
  }, {});
}

export function spendingByMerchant(records: ExpenseRecord[]): Array<{ merchant: string; amount: number; count: number }> {
  const totals = new Map<string, { amount: number; count: number }>();
  for (const record of records) {
    const key = record.merchant.trim() || 'Unspecified';
    const current = totals.get(key) ?? { amount: 0, count: 0 };
    totals.set(key, { amount: current.amount + record.amount, count: current.count + 1 });
  }
  return [...totals.entries()]
    .map(([merchant, value]) => ({ merchant, ...value }))
    .sort((a, b) => b.amount - a.amount);
}

export function monthlyIncomeEstimate(month: string, sources: IncomeSource[] = loadIncomeSources()): number {
  const { start, end } = monthBounds(month);
  let total = 0;
  for (const source of sources) {
    if (source.currency.toUpperCase() !== 'INR') continue;
    if (source.frequency === 'One-time') {
      if (source.startDate >= start && source.startDate <= end) total += source.amount;
      continue;
    }
    const active = source.startDate <= end && (!source.endDate || source.endDate >= start);
    if (active) total += monthlyEquivalent(source);
  }
  return total;
}

export function priorMonth(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 2, 1));
  return date.toISOString().slice(0, 7);
}

export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}
