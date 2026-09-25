/**
 * One shared picture of the user's money, built from every feature (setup, income, expenses, EMIs,
 * portfolio, planners), so any AI assistant can answer with the user's own numbers. It is attached
 * to AI requests only when the user switches "Use my data" on; the default is off.
 */
import { loadMoneyProfile } from './moneyProfile';
import { buildCompleteDashboard } from './completeDashboard';
import { loadEmiRecords } from './emiStorage';
import { loadIncomeSources } from './incomeStorage';
import { loadExpenses } from './personalFinanceStorage';
import { loadPortfolio, summarise } from './portfolio';

const KEY = 'arthamind-use-my-data-v1';
export const USE_MY_DATA_EVENT = 'arthamind:use-my-data';
export function useMyDataEnabled(): boolean { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } }
export function setUseMyData(on: boolean) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ } window.dispatchEvent(new CustomEvent(USE_MY_DATA_EVENT, { detail: on })); }

const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** A compact plain-text summary (no names of banks, no account numbers). Empty when nothing is saved. */
export function buildUserContext(): string {
  const lines: string[] = [];
  const profile = loadMoneyProfile();
  const income = loadIncomeSources();
  const expenses = loadExpenses();
  const loans = loadEmiRecords().filter((l) => l.status === 'active');
  if (profile) {
    try {
      const d = buildCompleteDashboard({ profile, loans, income, expenses });
      const r = d.report;
      lines.push(`Age ${profile.age}, ${profile.dependants} dependants, plans to retire at ${profile.retireAge ?? 60}.`);
      lines.push(`Income ${inr(d.annualIncome.value)} a year, take-home ${inr(d.monthlyTakeHome.value)} a month; tax this year ${inr(d.taxThisYear.value)} (${r.tax.better} regime better).`);
      lines.push(`Spending ${inr(d.monthlyExpenses.value)} a month, EMIs ${inr(d.monthlyEmi.value)}, surplus ${inr(d.monthlySurplus.value)} (savings rate ${pct(Math.max(0, r.cashflow.savingsRate))}).`);
      lines.push(`Cash ${inr(d.totalSavings.value)}, investments ${inr(d.totalInvestments.value)}, loans ${inr(d.totalDebt.value)}, net worth ${inr(d.netWorth.value)}.`);
      lines.push(`Emergency fund ${Number.isFinite(r.emergency.months) ? r.emergency.months.toFixed(1) : '—'} months; term cover gap ${inr(r.protection.termGap)}; health cover gap ${inr(r.protection.healthGap)}; health score ${r.health.score}/100.`);
      lines.push(`Retirement: needs ${inr(r.freedom.corpusNeeded)}, ${pct(d.freedomProgress)} reached, SIP needed ${inr(r.freedom.monthlySipNeeded)} a month.`);
    } catch { /* incomplete profile */ }
  }
  if (income.length) lines.push(`Income sources: ${income.slice(0, 6).map((s) => `${s.type} ${inr(s.amount)} ${String(s.frequency).toLowerCase()}`).join('; ')}.`);
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = expenses.filter((e) => e.date?.startsWith(month));
  if (thisMonth.length) {
    const byCat = new Map<string, number>();
    thisMonth.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount));
    lines.push(`Spent this month by category: ${[...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, v]) => `${c} ${inr(v)}`).join(', ')}.`);
  }
  if (loans.length) lines.push(`Loans: ${loans.slice(0, 5).map((l) => `${l.loanType} EMI ${inr(l.emiAmount ?? 0)}, ${inr(l.outstandingBalance ?? 0)} left${l.annualInterestRate != null ? ` at ${l.annualInterestRate}%` : ''}`).join('; ')}.`);
  const pfData = loadPortfolio();
  if (pfData.holdings.length) {
    const pf = summarise(pfData, profile?.age);
    lines.push(`Portfolio ${inr(pf.assets)}, gain ${inr(pf.gain)}${pf.xirr != null ? `, XIRR ${pct(pf.xirr)}` : ''}; mix ${pf.byClass.map((c) => `${c.cls} ${pct(c.share)}`).join(', ')}; top holdings ${pf.topHoldings.slice(0, 4).map((h) => h.name).join(', ')}.`);
  }
  for (const [key, label] of [['arthamind-plan-retirement-v1', 'Retirement plan inputs'], ['arthamind-plan-education-v1', 'Education plan inputs'], ['arthamind-plan-jobswitch-v1', 'Job switch inputs']] as const) {
    try { const raw = localStorage.getItem(key); if (raw) lines.push(`${label}: ${raw.slice(0, 300)}`); } catch { /* ignore */ }
  }
  return lines.join('\n').slice(0, 2400);
}
