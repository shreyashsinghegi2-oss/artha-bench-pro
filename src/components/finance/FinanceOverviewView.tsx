import React, { useMemo } from 'react';
import Decimal from 'decimal.js';
import { ArrowRight, CalendarClock, FileBarChart2, Plus, ReceiptText, Target, WalletCards } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { AppNavigationDestination } from '../../navigationTypes';
import { loadEmiRecords } from '../../services/emiStorage';
import { loadIncomeSources } from '../../services/incomeStorage';
import { currentMonthKey, expensesForMonth, formatINR, loadBudgets, loadExpenses, monthlyIncomeEstimate, totalExpenses } from '../../services/personalFinanceStorage';
import { PageFeedback } from '../common/PageFeedback';

type Props = { onNavigate: (destination: AppNavigationDestination) => void; onTrySample: () => void; onSignIn: () => void };

export const FinanceOverviewView: React.FC<Props> = ({ onNavigate, onTrySample, onSignIn }) => {
  const auth = useAuth();
  const snapshot = useMemo(() => {
    if (!auth.user) return null;
    const month = currentMonthKey();
    const expenses = expensesForMonth(loadExpenses(), month);
    const expenseTotal = totalExpenses(expenses);
    const income = monthlyIncomeEstimate(month);
    const budget = loadBudgets().find((item) => item.month === month) ?? null;
    const planned = budget?.categories.reduce((sum, item) => new Decimal(sum).plus(item.plannedAmount).toNumber(), 0) ?? 0;
    const activeEmis = loadEmiRecords().filter((record) => record.status === 'active');
    const monthlyEmi = activeEmis.reduce((sum, record) => new Decimal(sum).plus(record.emiAmount ?? 0).toNumber(), 0);
    const nextEmi = activeEmis.filter((record) => record.nextDueDate).sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))[0] ?? null;
    const recentExpenses = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((row) => ({ id: row.id, date: row.date, label: row.merchant || row.category, type: 'Expense', amount: -row.amount }));
    const oneTimeIncome = loadIncomeSources().filter((source) => source.currency.toUpperCase() === 'INR' && source.frequency === 'One-time' && source.startDate.startsWith(month)).map((row) => ({ id: row.id, date: row.startDate, label: row.description || row.type, type: 'Income', amount: row.amount }));
    return { month, income, expenseTotal, net: new Decimal(income).minus(expenseTotal).toNumber(), planned, budgetUsage: planned > 0 ? expenseTotal / planned * 100 : null, activeEmis, monthlyEmi, nextEmi, recent: [...recentExpenses, ...oneTimeIncome].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 6) };
  }, [auth.user]);

  if (!auth.user || !snapshot) return <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6"><section className="rounded-3xl border border-line bg-surface p-7 text-center shadow-sm"><WalletCards className="mx-auto h-9 w-9 text-brand" /><h1 className="mt-4 text-3xl font-black text-ink">Your Financial Workspace</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-secondary">Sign in to view your private finance snapshot, or explore the fictional sample workspace without entering personal data.</p><div className="mt-5 flex flex-wrap justify-center gap-2"><button type="button" onClick={onSignIn} className="rounded-xl bg-brand px-5 py-3 text-sm font-black text-white">Sign in</button><button type="button" onClick={onTrySample} className="rounded-xl border border-line px-5 py-3 text-sm font-black text-ink">Try sample workspace</button></div></section></div>;

  const firstName = (auth.profile?.full_name || auth.user.email || 'there').trim().split(/\s|@/)[0];
  const missingExpense = snapshot.recent.length === 0;
  const continueDestination: AppNavigationDestination = snapshot.income <= 0 ? 'income' : missingExpense ? 'expenses' : snapshot.planned <= 0 ? 'budgeting' : snapshot.activeEmis.length ? 'emi-manager' : 'finance-reports';
  const continueText = snapshot.income <= 0 ? 'Add income' : missingExpense ? 'Add an expense' : snapshot.planned <= 0 ? 'Create a budget' : snapshot.activeEmis.length ? 'Review EMI due dates' : 'View reports';

  return <div className="mx-auto max-w-[1300px] space-y-6 px-4 py-7 sm:px-6">
    <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.15em] text-brand">Your Financial Workspace</div><h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Welcome, {firstName}</h1><p className="mt-2 text-sm text-secondary">{snapshot.month} · only your recorded INR finance data is summarized here.</p></div><button type="button" onClick={onTrySample} className="rounded-xl border border-line bg-canvas px-4 py-2.5 text-xs font-black text-ink hover:border-brand/40">Try sample workspace</button></div></section>

    <section className="rounded-3xl border border-brand/20 bg-brand-soft/50 p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[9px] font-black uppercase tracking-wider text-brand-hover">Continue</div><h2 className="mt-1 text-lg font-black text-ink">{continueText}</h2><p className="mt-1 text-xs text-secondary">One focused next action based on what is currently recorded—not a financial recommendation.</p></div><button type="button" onClick={() => onNavigate(continueDestination)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-white">{continueText} <ArrowRight className="h-4 w-4" /></button></div></section>

    <section><h2 className="text-sm font-black text-ink">Financial snapshot</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Income', snapshot.income > 0 ? formatINR(snapshot.income) : 'Not recorded', 'Recorded / normalized INR income'],
      ['Expenses', formatINR(snapshot.expenseTotal), `${snapshot.recent.filter((row) => row.type === 'Expense').length} recent items shown`],
      ['Net remaining', snapshot.income > 0 || snapshot.expenseTotal > 0 ? formatINR(snapshot.net) : 'No data yet', 'Income less recorded expenses'],
      ['Budget status', snapshot.budgetUsage == null ? 'No budget' : `${snapshot.budgetUsage.toFixed(1)}% used`, snapshot.budgetUsage == null ? 'Create a monthly budget' : `${formatINR(snapshot.expenseTotal)} of ${formatINR(snapshot.planned)}`],
    ].map(([label,value,note]) => <div key={label} className="rounded-2xl border border-line bg-surface p-4 shadow-sm"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">{label}</div><div className="mt-2 text-xl font-black text-ink">{value}</div><div className="mt-1 text-[10px] leading-4 text-secondary">{note}</div></div>)}</div></section>

    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-sm font-black text-ink">Recent transactions</h2><button type="button" onClick={() => onNavigate('finance-reports')} className="text-[10px] font-black text-interactive">View reports →</button></div>{snapshot.recent.length ? <div className="mt-3 divide-y divide-line">{snapshot.recent.map((row) => <div key={`${row.type}-${row.id}`} className="flex items-center justify-between gap-3 py-3"><div><div className="text-xs font-bold text-ink">{row.label}</div><div className="mt-0.5 text-[9px] text-secondary">{row.date} · {row.type}</div></div><div className={`font-mono text-xs font-black ${row.amount >= 0 ? 'text-success' : 'text-danger'}`}>{row.amount >= 0 ? '+' : '−'}{formatINR(Math.abs(row.amount))}</div></div>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-line p-5 text-center text-xs text-secondary">No transactions recorded for this month. <button type="button" onClick={() => onNavigate('expenses')} className="font-black text-interactive">Add an expense</button>.</div>}</section>
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm"><h2 className="text-sm font-black text-ink">EMI commitments</h2><div className="mt-4 grid gap-3"><div className="rounded-xl bg-canvas p-3"><div className="text-[9px] uppercase text-secondary">Active EMIs</div><div className="mt-1 text-lg font-black text-ink">{snapshot.activeEmis.length}</div></div><div className="rounded-xl bg-canvas p-3"><div className="text-[9px] uppercase text-secondary">Monthly outflow</div><div className="mt-1 text-lg font-black text-ink">{formatINR(snapshot.monthlyEmi)}</div></div><div className="rounded-xl bg-canvas p-3"><div className="text-[9px] uppercase text-secondary">Next due</div><div className="mt-1 text-sm font-black text-ink">{snapshot.nextEmi ? `${snapshot.nextEmi.nextDueDate} · ${snapshot.nextEmi.name}` : 'No upcoming EMI recorded'}</div></div><button type="button" onClick={() => onNavigate('emi-manager')} className="rounded-xl border border-line px-3 py-2 text-xs font-black text-ink">Open EMI Manager</button></div></section>
    </div>

    <section className="rounded-3xl border border-line bg-surface p-5"><h2 className="text-sm font-black text-ink">Next steps</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{[
      ['Add income','income',WalletCards],['Add expense','expenses',ReceiptText],['Create budget','budgeting',Target],['View reports','finance-reports',FileBarChart2],['Add / review EMI','emi-manager',CalendarClock],
    ].map(([label,destination,Icon]) => <button key={label as string} type="button" onClick={() => onNavigate(destination as AppNavigationDestination)} className="flex items-center gap-2 rounded-xl border border-line bg-canvas p-3 text-left text-xs font-bold text-ink hover:border-brand/40">{React.createElement(Icon as React.ComponentType<{className?:string}>, { className:'h-4 w-4 text-brand' })}{label as string}<Plus className="ml-auto h-3 w-3 text-secondary" /></button>)}</div></section>
    <PageFeedback module="finance-overview" />
  </div>;
};
