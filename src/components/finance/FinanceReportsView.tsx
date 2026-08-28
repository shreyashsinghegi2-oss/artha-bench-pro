import React, { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { Download, FileBarChart2, Filter, LockKeyhole, Send, Settings2 } from 'lucide-react';
import { Cell, ComposedChart, Bar, CartesianGrid, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppNavigationDestination } from '../../navigationTypes';
import { useAuth } from '../../auth/AuthContext';
import { askTutorAI } from '../../services/learningApi';
import { loadAiDataContext } from '../../services/aiDataContext';
import { loadIncomeSources, monthlyEquivalent } from '../../services/incomeStorage';
import {
  currentMonthKey,
  expensesInRange,
  formatINR,
  loadBudgets,
  loadExpenses,
  monthBounds,
  priorMonth,
  spendingByCategory,
} from '../../services/personalFinanceStorage';
import { loadEmiRecords } from '../../services/emiStorage';

type Props = { onNavigate: (destination: AppNavigationDestination) => void };
type PeriodMode = 'this-month' | 'last-month' | '3-months' | 'custom';
type TransactionType = 'all' | 'income' | 'expense';

const PIE_COLORS = ['#0F766E', '#2563EB', '#B7791F', '#9F4A54', '#64748B', '#7C3AED', '#15803D', '#C2410C'];

function monthsBetween(start: string, end: string): string[] {
  const result: string[] = [];
  const cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  const last = new Date(`${end.slice(0, 7)}-01T00:00:00Z`);
  while (cursor <= last && result.length < 36) {
    result.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

function rangeFor(mode: PeriodMode, customStart: string, customEnd: string) {
  const current = currentMonthKey();
  if (mode === 'this-month') return monthBounds(current);
  if (mode === 'last-month') return monthBounds(priorMonth(current));
  if (mode === '3-months') {
    const end = monthBounds(current).end;
    const [year, month] = current.split('-').map(Number);
    return { start: new Date(Date.UTC(year, month - 3, 1)).toISOString().slice(0, 10), end };
  }
  return { start: customStart || monthBounds(current).start, end: customEnd || monthBounds(current).end };
}

function previousEquivalentRange(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  const prevEnd = new Date(startDate.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86_400_000);
  return { start: prevStart.toISOString().slice(0, 10), end: prevEnd.toISOString().slice(0, 10) };
}

function incomeForMonth(month: string) {
  const { start, end } = monthBounds(month);
  return loadIncomeSources().reduce((sum, source) => {
    if (source.currency.toUpperCase() !== 'INR') return sum;
    if (source.frequency === 'One-time') return source.startDate >= start && source.startDate <= end ? sum.plus(source.amount) : sum;
    const active = source.startDate <= end && (!source.endDate || source.endDate >= start);
    return active ? sum.plus(monthlyEquivalent(source)) : sum;
  }, new Decimal(0)).toNumber();
}

function incomeForRange(start: string, end: string) {
  return monthsBetween(start, end).reduce((sum, month) => sum.plus(incomeForMonth(month)), new Decimal(0)).toNumber();
}

function downloadCsv(filename: string, rows: string[][]) {
  const escaped = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([escaped], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

export const FinanceReportsView: React.FC<Props> = ({ onNavigate }) => {
  const auth = useAuth();
  const [period, setPeriod] = useState<PeriodMode>('this-month');
  const current = monthBounds(currentMonthKey());
  const [customStart, setCustomStart] = useState(current.start);
  const [customEnd, setCustomEnd] = useState(current.end);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<TransactionType>('all');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  const range = useMemo(() => rangeFor(period, customStart, customEnd), [period, customStart, customEnd]);
  const previous = useMemo(() => previousEquivalentRange(range.start, range.end), [range]);
  const allExpenses = useMemo(loadExpenses, []);
  const budgets = useMemo(loadBudgets, []);
  const emis = useMemo(loadEmiRecords, []);
  const selectedExpenses = useMemo(() => expensesInRange(allExpenses, range.start, range.end), [allExpenses, range]);
  const previousExpenses = useMemo(() => expensesInRange(allExpenses, previous.start, previous.end), [allExpenses, previous]);
  const totalExpenses = selectedExpenses.reduce((sum, row) => sum.plus(row.amount), new Decimal(0)).toNumber();
  const previousExpenseTotal = previousExpenses.reduce((sum, row) => sum.plus(row.amount), new Decimal(0)).toNumber();
  const totalIncome = incomeForRange(range.start, range.end);
  const previousIncome = incomeForRange(previous.start, previous.end);
  const netRemaining = new Decimal(totalIncome).minus(totalExpenses).toNumber();

  const categoryData = useMemo(() => {
    const totals = spendingByCategory(selectedExpenses);
    const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, 7);
    const remainder = ranked.slice(7).reduce((sum, [, amount]) => sum.plus(amount), new Decimal(0)).toNumber();
    const rows = remainder > 0 ? [...top, ['Other', remainder] as [string, number]] : top;
    return rows.map(([name, value]) => ({ name, value, percent: totalExpenses > 0 ? value / totalExpenses * 100 : 0 }));
  }, [selectedExpenses, totalExpenses]);

  const trendData = useMemo(() => monthsBetween(range.start, range.end).map((month) => {
    const income = incomeForMonth(month);
    const expenses = allExpenses.filter((row) => row.date.startsWith(month)).reduce((sum, row) => sum.plus(row.amount), new Decimal(0)).toNumber();
    return { month, income, expenses, savings: new Decimal(income).minus(expenses).toNumber() };
  }), [allExpenses, range]);

  const relevantBudgets = useMemo(() => budgets.filter((budget) => monthsBetween(range.start, range.end).includes(budget.month)).flatMap((budget) => budget.categories.map((plan) => {
    const spent = allExpenses.filter((row) => row.date.startsWith(budget.month) && row.category === plan.category).reduce((sum, row) => sum.plus(row.amount), new Decimal(0)).toNumber();
    const remaining = new Decimal(plan.plannedAmount).minus(spent).toNumber();
    const usage = plan.plannedAmount > 0 ? spent / plan.plannedAmount * 100 : spent > 0 ? 999 : 0;
    return { month: budget.month, category: plan.category, planned: plan.plannedAmount, spent, remaining, usage, status: usage > 100 ? 'Over budget' : usage >= plan.warningThreshold ? 'Near limit' : 'On track' };
  })), [allExpenses, budgets, range]);
  const plannedTotal = relevantBudgets.reduce((sum, row) => sum.plus(row.planned), new Decimal(0)).toNumber();
  const budgetUsed = plannedTotal > 0 ? totalExpenses / plannedTotal * 100 : null;

  const emiPayments = useMemo(() => emis.flatMap((record) => record.payments.map((payment) => ({ ...payment, name: record.name }))).filter((payment) => payment.paidAt.slice(0, 10) >= range.start && payment.paidAt.slice(0, 10) <= range.end), [emis, range]);
  const emiPaid = emiPayments.reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0)).toNumber();
  const nextThirty = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const upcomingEmi = emis.filter((record) => record.status === 'active' && record.nextDueDate && record.nextDueDate >= new Date().toISOString().slice(0, 10) && record.nextDueDate <= nextThirty).reduce((sum, record) => sum.plus(record.emiAmount ?? 0), new Decimal(0)).toNumber();

  const transactions = useMemo(() => {
    const expenseRows = selectedExpenses.map((row) => ({ id: `e-${row.id}`, date: row.date, category: row.category, description: row.merchant || row.notes || 'Expense', amount: row.amount, type: 'expense' as const, paymentMethod: row.paymentMethod }));
    const incomeRows = loadIncomeSources().filter((source) => source.currency.toUpperCase() === 'INR' && source.frequency === 'One-time' && source.startDate >= range.start && source.startDate <= range.end).map((source) => ({ id: `i-${source.id}`, date: source.startDate, category: source.type, description: source.description || source.type, amount: source.amount, type: 'income' as const, paymentMethod: '' }));
    return [...expenseRows, ...incomeRows].filter((row) => categoryFilter === 'all' || row.category === categoryFilter).filter((row) => typeFilter === 'all' || row.type === typeFilter).sort((a, b) => b.date.localeCompare(a.date));
  }, [categoryFilter, range, selectedExpenses, typeFilter]);

  const summary = [
    { label: 'Total income', value: formatINR(totalIncome), comparison: previousIncome > 0 ? `${((totalIncome - previousIncome) / previousIncome * 100).toFixed(1)}% vs previous period` : 'Not enough history to compare' },
    { label: 'Total expenses', value: formatINR(totalExpenses), comparison: previousExpenseTotal > 0 ? `${((totalExpenses - previousExpenseTotal) / previousExpenseTotal * 100).toFixed(1)}% vs previous period` : 'Not enough history to compare' },
    { label: 'Net remaining / savings', value: formatINR(netRemaining), comparison: 'Income less recorded expenses' },
    { label: 'Budget used', value: budgetUsed == null ? 'No budget in period' : `${budgetUsed.toFixed(1)}%`, comparison: plannedTotal > 0 ? `${formatINR(totalExpenses)} of ${formatINR(plannedTotal)}` : 'Create a budget to compare' },
  ];

  const exportReport = () => downloadCsv(`artha-finance-report-${range.start}-${range.end}.csv`, [
    ['Artha Bench Pro — Spending & budget report'], ['Period', range.start, range.end], [],
    ['Summary', 'Value'], ...summary.map((row) => [row.label, row.value]), [],
    ['Date', 'Type', 'Category', 'Description', 'Amount INR', 'Payment method'],
    ...transactions.map((row) => [row.date, row.type, row.category, row.description, row.amount.toFixed(2), row.paymentMethod]),
  ]);

  const context = loadAiDataContext();
  const personalContextEnabled = Boolean(auth.user && auth.session && context.personalFinance);
  const ask = async (override?: string) => {
    const next = (override ?? question).trim();
    if (!next || asking) return;
    if (!personalContextEnabled) {
      setAnswer('Enable personal report context to ask questions about your data.');
      return;
    }
    const reportSnapshot = {
      period: range,
      totalIncome, totalExpenses, netRemaining,
      categories: categoryData.map((row) => ({ category: row.name, amount: Number(row.value.toFixed(2)), percent: Number(row.percent.toFixed(1)) })),
      budgets: context.budgetsAndGoals ? relevantBudgets.slice(0, 20) : [],
      emi: { paidDuringPeriod: emiPaid, upcomingNext30Days: upcomingEmi },
      transactionCount: selectedExpenses.length,
    };
    setAsking(true); setQuestion(''); setAnswer('');
    try {
      const response = await askTutorAI(`You are ArthaMind inside the personal-finance Reports workspace. Use ONLY the authorized report snapshot below. Start with "From your data:" for calculated facts. If you add general concepts, use a separate heading "General educational guidance:". Quote relevant amounts/categories/period. Never invent transactions or provide investment, lending, tax, legal, or guaranteed savings advice. If data is insufficient, say so.\nQuestion: ${next.slice(0, 350)}\nAuthorized report snapshot: ${JSON.stringify(reportSnapshot)}`.slice(0, 1950), [], { country: 'India', currency: 'INR', language: 'english', level: 'advanced', mode: 'explain', detail: 'detailed', useOfficialSources: false });
      setAnswer(response.answer);
    } catch {
      setAnswer('ArthaMind could not analyze this report right now. Your stored finance records were not changed.');
    } finally { setAsking(false); }
  };

  const suggested = ['What category increased the most this month?', 'Explain my budget-overrun categories.', 'Show my largest recurring expenses.', 'Help me create questions to review next month.'];

  return <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-7 sm:px-6">
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-interactive">Personal finance report</div><h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">Spending & budget report</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">Calculated from your recorded income, expenses, budgets and EMI records for the selected period. Educational/research use only — not financial advice.</p></div><button type="button" onClick={exportReport} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-canvas px-4 py-3 text-sm font-black text-ink hover:border-interactive/40"><Download className="h-4 w-4" /> Export report (CSV)</button></div></section>

    <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3"><span className="mr-2 text-[10px] font-black uppercase tracking-wider text-secondary">Period</span>{([['this-month','This month'],['last-month','Last month'],['3-months','Last 3 months'],['custom','Custom range']] as Array<[PeriodMode,string]>).map(([value,label]) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded-xl px-3 py-2 text-xs font-bold ${period === value ? 'bg-interactive-soft text-interactive' : 'text-secondary hover:bg-subtle hover:text-ink'}`}>{label}</button>)}{period === 'custom' && <div className="flex flex-wrap items-center gap-2 sm:ml-auto"><input aria-label="Report start date" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink" /><span className="text-xs text-secondary">to</span><input aria-label="Report end date" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink" /></div>}<span className="ml-auto text-[10px] font-semibold text-secondary">{range.start} → {range.end}</span></section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summary.map((row) => <div key={row.label} className="rounded-2xl border border-line bg-surface p-4 shadow-sm"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-secondary">{row.label}</p><p className="mt-2 text-xl font-black text-ink">{row.value}</p><p className="mt-1 text-[10px] text-secondary">{row.comparison}</p></div>)}</section>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]"><div className="space-y-6">
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><h2 className="text-lg font-black text-ink">Spending breakdown</h2><p className="mt-1 text-xs text-secondary">Expense categories from the selected period. Click a category to filter report details.</p>{categoryData.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-secondary">Add an expense to see your spending breakdown.</div> : <div className="mt-5 grid gap-5 md:grid-cols-[300px_1fr]"><div className="h-64" aria-label="Expense category donut chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2} onClick={(data) => data?.name && setCategoryFilter(String(data.name))}>{categoryData.map((row,index) => <Cell key={row.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatINR(Number(value))} /></PieChart></ResponsiveContainer></div><div className="space-y-2">{categoryData.map((row,index) => <button key={row.name} type="button" onClick={() => setCategoryFilter(row.name)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs ${categoryFilter === row.name ? 'border-interactive bg-interactive-soft' : 'border-line bg-canvas hover:border-interactive/30'}`}><span className="flex items-center gap-2 font-semibold text-ink"><span className="h-2.5 w-2.5 rounded-sm" style={{backgroundColor: PIE_COLORS[index % PIE_COLORS.length]}} />{row.name}</span><span className="font-mono text-secondary">{formatINR(row.value)} · {row.percent.toFixed(1)}%</span></button>)}</div></div>}</section>

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><h2 className="text-lg font-black text-ink">Income, expense & savings trend</h2><p className="mt-1 text-xs text-secondary">Monthly recorded/estimated INR income, recorded expenses and calculated net. This chart is descriptive, not predictive.</p><div className="mt-5 h-72"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trendData}><CartesianGrid strokeDasharray="3 3" stroke="var(--line,#E2E8F0)" /><XAxis dataKey="month" tick={{fontSize:10}} /><YAxis tick={{fontSize:10}} /><Tooltip formatter={(value) => formatINR(Number(value))} /><Legend /><Bar dataKey="income" name="Income" fill="#0F766E" radius={[4,4,0,0]} /><Bar dataKey="expenses" name="Expenses" fill="#B4535A" radius={[4,4,0,0]} /><Line type="monotone" dataKey="savings" name="Net" stroke="#2563EB" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-xs"><caption className="sr-only">Accessible monthly finance trend data</caption><thead className="text-left text-[9px] uppercase tracking-wider text-secondary"><tr><th className="py-2">Month</th><th className="py-2 text-right">Income</th><th className="py-2 text-right">Expenses</th><th className="py-2 text-right">Net</th></tr></thead><tbody className="divide-y divide-line">{trendData.map((row) => <tr key={row.month}><td className="py-2 font-semibold text-ink">{row.month}</td><td className="py-2 text-right font-mono">{formatINR(row.income)}</td><td className="py-2 text-right font-mono">{formatINR(row.expenses)}</td><td className="py-2 text-right font-mono">{formatINR(row.savings)}</td></tr>)}</tbody></table></div></section>

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><h2 className="text-lg font-black text-ink">Budget performance</h2>{relevantBudgets.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-line p-6 text-sm text-secondary">No budget rows exist in this period. Create a budget to compare planned and recorded spending.</p> : <div className="mt-4 space-y-3">{relevantBudgets.map((row,index) => <div key={`${row.month}-${row.category}-${index}`} className="rounded-2xl border border-line bg-canvas p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-bold text-ink">{row.category}</span><span className="ml-2 text-[9px] text-secondary">{row.month}</span></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.status === 'Over budget' ? 'bg-danger-soft text-danger' : row.status === 'Near limit' ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}`}>{row.status}</span></div><div className="mt-2 flex justify-between text-[10px] text-secondary"><span>{formatINR(row.spent)} spent / {formatINR(row.planned)} planned</span><span>{row.remaining >= 0 ? `${formatINR(row.remaining)} remaining` : `${formatINR(Math.abs(row.remaining))} over`}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-subtle"><div className={`h-full rounded-full ${row.usage > 100 ? 'bg-danger' : row.usage >= 80 ? 'bg-warning-fill' : 'bg-brand'}`} style={{width:`${Math.min(100,row.usage)}%`}} /></div></div>)}</div>}</section>

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-ink">Transaction/report detail</h2><p className="mt-1 text-xs text-secondary">Recorded expenses plus one-time INR income entries in the selected period.</p></div><div className="flex flex-wrap gap-2"><select aria-label="Transaction type filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TransactionType)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink"><option value="all">All types</option><option value="expense">Expenses</option><option value="income">Income</option></select><select aria-label="Transaction category filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink"><option value="all">All categories</option>{[...new Set([...categoryData.map((row)=>row.name), ...transactions.map((row)=>row.category)])].map((category)=><option key={category}>{category}</option>)}</select><button type="button" onClick={() => {setCategoryFilter('all');setTypeFilter('all');}} className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-xs font-bold text-secondary"><Filter className="h-3.5 w-3.5" /> Reset</button></div></div><div className="mt-4 overflow-x-auto rounded-2xl border border-line"><table className="w-full min-w-[780px] text-left text-xs"><thead className="bg-subtle text-[9px] uppercase tracking-wider text-secondary"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Description</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Payment</th><th className="px-3 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-line">{transactions.map((row) => <tr key={row.id}><td className="px-3 py-3">{row.date}</td><td className="px-3 py-3 font-semibold text-ink">{row.category}</td><td className="px-3 py-3 text-secondary">{row.description}</td><td className="px-3 py-3 capitalize">{row.type}</td><td className="px-3 py-3 text-secondary">{row.paymentMethod || '—'}</td><td className={`px-3 py-3 text-right font-mono font-bold ${row.type === 'income' ? 'text-success' : 'text-danger'}`}>{row.type === 'income' ? '+' : '−'}{formatINR(row.amount)}</td></tr>)}{transactions.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-secondary">No matching recorded transactions for this report filter.</td></tr>}</tbody></table></div></section>

      <section className="grid gap-4 md:grid-cols-2"><div className="rounded-3xl border border-line bg-surface p-5"><h2 className="text-base font-black text-ink">What changed</h2><div className="mt-3 space-y-2 text-xs leading-5 text-secondary"><p>Period: <strong className="text-ink">{range.start} to {range.end}</strong>.</p><p>Recorded expenses total <strong className="text-ink">{formatINR(totalExpenses)}</strong>{previousExpenseTotal > 0 ? `, ${Math.abs((totalExpenses-previousExpenseTotal)/previousExpenseTotal*100).toFixed(1)}% ${totalExpenses >= previousExpenseTotal ? 'higher' : 'lower'} than the previous equivalent period.` : '. Not enough prior expense history exists for comparison.'}</p><p>Recorded/estimated INR income for this period is <strong className="text-ink">{formatINR(totalIncome)}</strong>; recorded expenses used <strong className="text-ink">{totalIncome > 0 ? `${(totalExpenses/totalIncome*100).toFixed(1)}%` : 'an unavailable percentage because no INR income is recorded'}</strong>.</p></div></div><div className="rounded-3xl border border-line bg-surface p-5"><h2 className="text-base font-black text-ink">EMI commitments</h2><div className="mt-3 space-y-2 text-xs leading-5 text-secondary"><p>Total EMI marked paid during this report period: <strong className="text-ink">{formatINR(emiPaid)}</strong>.</p><p>EMIs as a percentage of recorded income: <strong className="text-ink">{totalIncome > 0 ? `${(emiPaid/totalIncome*100).toFixed(1)}%` : 'Not available — no INR income recorded'}</strong>.</p><p>Upcoming recorded EMI commitments in the next 30 days: <strong className="text-ink">{formatINR(upcomingEmi)}</strong>.</p></div></div></section>
    </div>

    <aside className="xl:sticky xl:top-32 xl:self-start"><section className="rounded-3xl border border-line bg-surface p-5 shadow-sm"><div className="flex items-center gap-2"><FileBarChart2 className="h-5 w-5 text-interactive" /><h2 className="text-base font-black text-ink">Ask ArthaMind about this report</h2></div><p className="mt-2 text-[10px] leading-5 text-secondary">Uses only the report period and personal categories you have enabled.</p>{!personalContextEnabled && <div className="mt-4 rounded-2xl border border-warning-fill/25 bg-warning-soft p-3 text-[10px] leading-5 text-secondary"><div className="flex items-center gap-2 font-black text-ink"><LockKeyhole className="h-4 w-4" /> Personal report context is off</div><p className="mt-1">Enable personal report context to ask questions about your data.</p></div>}<div className="mt-4 space-y-2">{suggested.map((item) => <button key={item} type="button" onClick={() => void ask(item)} className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-left text-[10px] font-semibold text-secondary hover:border-interactive/30 hover:text-ink">{item}</button>)}</div><textarea aria-label="Ask ArthaMind about this report" rows={4} maxLength={600} value={question} onChange={(e)=>setQuestion(e.target.value)} placeholder="Ask a factual question about this report…" className="mt-4 w-full resize-none rounded-xl border border-line-strong bg-canvas p-3 text-xs text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/20" /><button type="button" disabled={!question.trim() || asking} onClick={() => void ask()} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><Send className="h-4 w-4" />{asking ? 'Analyzing…' : 'Ask about report'}</button><button type="button" onClick={() => onNavigate('account')} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-xs font-bold text-ink"><Settings2 className="h-4 w-4" /> Manage AI context</button>{answer && <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-line bg-canvas p-4 text-xs leading-6 text-ink">{answer}</div>}<p className="mt-4 border-t border-line pt-3 text-[9px] leading-4 text-secondary">Educational data-understanding assistance only — not investment, lending, tax, legal, or financial advice.</p></section></aside>
    </div>
  </div>;
};
