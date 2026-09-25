/**
 * Complete dashboard: one summary of everything the user has told the app, from the money profile
 * (guided setup or scan) and from records they keep in the workspace (loans, income, expenses).
 * Where both exist, recorded detail wins (for example the sum of active loans over a single estimate),
 * and every figure carries the source it came from.
 */
import { buildMoneyCheck, type MoneyCheckReport } from './moneyCheck';
import type { MoneyProfile } from './moneyProfile';
import type { EmiRecord } from './emiStorage';
import type { IncomeSource } from './incomeStorage';
import type { ExpenseRecord } from './personalFinanceStorage';

export type FigureSource = 'profile' | 'loans' | 'income' | 'expenses' | 'calculated';
export interface Figure { value: number; source: FigureSource }

export interface DashboardLoan { name: string; type: string; emi: number; outstanding: number; rate: number | null; nextDue: string | null }

export interface CompleteDashboard {
  report: MoneyCheckReport;
  netWorth: Figure;
  totalInvestments: Figure;
  totalSavings: Figure;
  totalDebt: Figure;
  annualIncome: Figure;
  monthlyTakeHome: Figure;
  taxThisYear: Figure;
  effectiveTaxRate: number;
  monthlyEmi: Figure;
  monthlyExpenses: Figure;
  monthlySurplus: Figure;
  loans: DashboardLoan[];
  spendThisMonth: number | null;
  topCategory: { name: string; amount: number } | null;
  freedomProgress: number;
}

const r0 = (v: number) => Math.round(v);

function monthlyFromSource(s: Pick<IncomeSource, 'amount' | 'frequency'>): number {
  switch (s.frequency) {
    case 'Monthly': return s.amount;
    case 'Quarterly': return s.amount / 3;
    case 'Annually': return s.amount / 12;
    default: return 0; // one-time income is not a recurring monthly amount
  }
}

export function buildCompleteDashboard(input: {
  profile: MoneyProfile;
  loans?: EmiRecord[];
  income?: IncomeSource[];
  expenses?: ExpenseRecord[];
  now?: Date;
}): CompleteDashboard {
  const { profile } = input;
  const now = input.now ?? new Date();
  const active = (input.loans ?? []).filter((l) => l.status === 'active');
  const loans: DashboardLoan[] = active.map((l) => ({
    name: l.name || l.loanType, type: l.loanType, emi: l.emiAmount ?? 0, outstanding: l.outstandingBalance ?? 0,
    rate: l.annualInterestRate, nextDue: l.nextDueDate || null,
  }));
  const recordedEmi = loans.reduce((s, l) => s + l.emi, 0);
  const recordedDebt = loans.reduce((s, l) => s + l.outstanding, 0);

  // Recorded loans override the single estimates from setup when they exist.
  const monthlyEmi: Figure = recordedEmi > 0 ? { value: r0(recordedEmi), source: 'loans' } : { value: r0(profile.monthlyEmi), source: 'profile' };
  const totalDebt: Figure = recordedDebt > 0 ? { value: r0(recordedDebt), source: 'loans' } : { value: r0(profile.loanOutstanding ?? 0), source: 'profile' };

  const inrIncome = (input.income ?? []).filter((s) => s.currency === 'INR' && (!s.endDate || new Date(s.endDate) >= now));
  const recordedAnnual = inrIncome.reduce((s, src) => s + monthlyFromSource(src) * 12, 0);
  const annualIncome: Figure = recordedAnnual > profile.annualSalary ? { value: r0(recordedAnnual), source: 'income' } : { value: r0(profile.annualSalary), source: 'profile' };

  const report = buildMoneyCheck({ ...profile, monthlyEmi: monthlyEmi.value, loanOutstanding: totalDebt.value });
  const taxThisYear = Math.min(report.tax.oldRegimeTax, report.tax.newRegimeTax);

  const monthKey = now.toISOString().slice(0, 7);
  const monthExpenses = (input.expenses ?? []).filter((e) => (e.date ?? '').startsWith(monthKey));
  const spendThisMonth = monthExpenses.length ? r0(monthExpenses.reduce((s, e) => s + (e.amount || 0), 0)) : null;
  const byCat = new Map<string, number>();
  for (const e of monthExpenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + (e.amount || 0));
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    report,
    netWorth: { value: report.netWorth, source: 'calculated' },
    totalInvestments: { value: r0(profile.investments), source: 'profile' },
    totalSavings: { value: r0(profile.liquidSavings), source: 'profile' },
    totalDebt,
    annualIncome,
    monthlyTakeHome: { value: report.tax.monthlyTakeHome, source: 'calculated' },
    taxThisYear: { value: taxThisYear, source: 'calculated' },
    effectiveTaxRate: annualIncome.value > 0 ? taxThisYear / annualIncome.value : 0,
    monthlyEmi,
    monthlyExpenses: { value: r0(profile.monthlyExpenses), source: 'profile' },
    monthlySurplus: { value: report.cashflow.surplus, source: 'calculated' },
    loans,
    spendThisMonth,
    topCategory: top ? { name: top[0], amount: r0(top[1]) } : null,
    freedomProgress: report.freedom.corpusNeeded > 0 ? Math.min(1, report.freedom.projectedFromInvestments / report.freedom.corpusNeeded) : 0,
  };
}
