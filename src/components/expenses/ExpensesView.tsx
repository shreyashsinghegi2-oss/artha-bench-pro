import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Filter,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { askTutorAI } from '../../services/learningApi';
import {
  createExpense,
  currentMonthKey,
  EXPENSE_CATEGORIES,
  ExpenseDraft,
  ExpenseRecord,
  expensesInRange,
  formatINR,
  loadExpenses,
  monthBounds,
  monthlyIncomeEstimate,
  PAYMENT_METHODS,
  priorMonth,
  saveExpenses,
  spendingByCategory,
  spendingByMerchant,
  totalExpenses,
} from '../../services/personalFinanceStorage';

type PeriodMode = 'this-month' | 'last-month' | '3-months' | 'custom';
type SortMode = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

const EMPTY_DRAFT: ExpenseDraft = {
  amount: 0,
  category: 'Food & Dining',
  date: new Date().toISOString().slice(0, 10),
  merchant: '',
  paymentMethod: 'UPI',
  notes: '',
  recurring: false,
};

function getRange(mode: PeriodMode, customStart: string, customEnd: string) {
  const currentMonth = currentMonthKey();
  if (mode === 'this-month') return monthBounds(currentMonth);
  if (mode === 'last-month') return monthBounds(priorMonth(currentMonth));
  if (mode === '3-months') {
    const end = monthBounds(currentMonth).end;
    const [year, month] = currentMonth.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 3, 1)).toISOString().slice(0, 10);
    return { start, end };
  }
  return {
    start: customStart || monthBounds(currentMonth).start,
    end: customEnd || monthBounds(currentMonth).end,
  };
}

function previousComparableMonth(start: string) {
  return priorMonth(start.slice(0, 7));
}

function daysInRange(start: string, end: string) {
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1);
}

function statusText(value: number) {
  if (value > 0) return 'higher';
  if (value < 0) return 'lower';
  return 'unchanged';
}

export const ExpensesView: React.FC = () => {
  const [records, setRecords] = useState<ExpenseRecord[]>(loadExpenses);
  const [period, setPeriod] = useState<PeriodMode>('this-month');
  const currentBounds = monthBounds(currentMonthKey());
  const [customStart, setCustomStart] = useState(currentBounds.start);
  const [customEnd, setCustomEnd] = useState(currentBounds.end);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft>(EMPTY_DRAFT);
  const [customCategory, setCustomCategory] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<SortMode>('date-desc');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const range = useMemo(() => getRange(period, customStart, customEnd), [customEnd, customStart, period]);
  const selectedRecords = useMemo(
    () => expensesInRange(records, range.start, range.end),
    [range.end, range.start, records],
  );
  const selectedTotal = totalExpenses(selectedRecords);
  const categoryTotals = useMemo(() => spendingByCategory(selectedRecords), [selectedRecords]);
  const categoryRanking = useMemo(
    () => Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]),
    [categoryTotals],
  );
  const topCategory = categoryRanking[0] ?? null;
  const merchantRanking = useMemo(() => spendingByMerchant(selectedRecords).slice(0, 5), [selectedRecords]);
  const recurringRecords = useMemo(() => selectedRecords.filter((record) => record.recurring), [selectedRecords]);

  const comparisonMonth = previousComparableMonth(range.start);
  const previousTotal = useMemo(
    () => totalExpenses(records.filter((record) => record.date.startsWith(comparisonMonth))),
    [comparisonMonth, records],
  );
  const monthChange = previousTotal > 0 ? ((selectedTotal - previousTotal) / previousTotal) * 100 : null;
  const income = monthlyIncomeEstimate(range.start.slice(0, 7));
  const remainingAfterExpenses = income > 0 ? income - selectedTotal : null;
  const dailyAverage = selectedTotal / daysInRange(range.start, range.end);

  const customCategories = useMemo(
    () => [...new Set(records.map((record) => record.category).filter((category) => !EXPENSE_CATEGORIES.includes(category as typeof EXPENSE_CATEGORIES[number])))],
    [records],
  );
  const allCategories = [...EXPENSE_CATEGORIES, ...customCategories];

  const tableRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return selectedRecords
      .filter((record) => !normalizedSearch || `${record.merchant} ${record.notes} ${record.category}`.toLowerCase().includes(normalizedSearch))
      .filter((record) => categoryFilter === 'all' || record.category === categoryFilter)
      .filter((record) => !dateFrom || record.date >= dateFrom)
      .filter((record) => !dateTo || record.date <= dateTo)
      .sort((a, b) => {
        if (sort === 'date-desc') return b.date.localeCompare(a.date);
        if (sort === 'date-asc') return a.date.localeCompare(b.date);
        if (sort === 'amount-desc') return b.amount - a.amount;
        return a.amount - b.amount;
      });
  }, [categoryFilter, dateFrom, dateTo, search, selectedRecords, sort]);

  const trendData = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const record of selectedRecords) grouped.set(record.date, (grouped.get(record.date) ?? 0) + record.amount);
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  }, [selectedRecords]);
  const trendMax = Math.max(1, ...trendData.map(([, amount]) => amount));
  const categoryMax = Math.max(1, ...categoryRanking.map(([, amount]) => amount));

  const commitRecords = (next: ExpenseRecord[]) => {
    setRecords(next);
    saveExpenses(next);
  };

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...EMPTY_DRAFT, date: new Date().toISOString().slice(0, 10) });
    setCustomCategory('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (record: ExpenseRecord) => {
    setEditing(record);
    const isStandard = EXPENSE_CATEGORIES.includes(record.category as typeof EXPENSE_CATEGORIES[number]);
    setDraft({
      amount: record.amount,
      category: isStandard ? record.category : 'Custom…',
      date: record.date,
      merchant: record.merchant,
      paymentMethod: record.paymentMethod,
      notes: record.notes,
      recurring: record.recurring,
    });
    setCustomCategory(isStandard ? '' : record.category);
    setFormError(null);
    setFormOpen(true);
  };

  const saveDraft = (event: React.FormEvent) => {
    event.preventDefault();
    const category = draft.category === 'Custom…' ? customCategory.trim() : draft.category;
    if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
      setFormError('Enter a valid expense amount greater than zero.');
      return;
    }
    if (!category) {
      setFormError('Choose a category or provide a custom category name.');
      return;
    }
    if (!draft.date || !draft.merchant.trim()) {
      setFormError('Date and merchant/payee are required.');
      return;
    }

    const saved = createExpense(
      { ...draft, category },
      editing?.id,
      editing?.createdAt,
    );
    const next = editing
      ? records.map((record) => record.id === editing.id ? saved : record)
      : [saved, ...records];
    commitRecords(next);
    setFormOpen(false);
    setEditing(null);
  };

  const deleteRecord = (record: ExpenseRecord) => {
    if (!window.confirm(`Delete expense “${record.merchant}” for ${formatINR(record.amount)}?`)) return;
    commitRecords(records.filter((item) => item.id !== record.id));
  };

  const askArthaMind = async (override?: string) => {
    const question = (override ?? aiQuestion).trim();
    if (!question || aiLoading) return;
    if (selectedRecords.length === 0) {
      setAiAnswer('There is not enough recorded expense data in the selected period to answer that question. Add expenses or choose a period with transactions first.');
      return;
    }

    const snapshot = {
      period: range,
      expenseCount: selectedRecords.length,
      totalExpenses: selectedTotal,
      previousMonthTotal: previousTotal,
      monthlyIncomeINR: income || null,
      remainingAfterExpenses: remainingAfterExpenses,
      categoryTotals: categoryRanking.slice(0, 8),
      recurring: recurringRecords.slice(0, 8).map((record) => ({ category: record.category, merchant: record.merchant, amount: record.amount, date: record.date })),
      topMerchants: merchantRanking,
    };
    const prompt = `You are ArthaMind Expense Intelligence inside Artha Bench Pro. Answer the user's expense question using ONLY the recorded snapshot below. Never invent transactions, balances, income, categories, merchants, savings, or trends. If evidence is insufficient, say exactly what is missing. Separate observed facts from educational suggestions. Do not provide financial, tax, legal, or investment advice. Be practical for an Indian INR-based user.\nQuestion: ${question.slice(0, 350)}\nRecorded snapshot: ${JSON.stringify(snapshot)}`.slice(0, 1950);

    setAiLoading(true);
    setAiQuestion('');
    try {
      const response = await askTutorAI(prompt, [], {
        country: 'India', currency: 'INR', language: 'english', level: 'advanced',
        mode: 'explain', detail: 'detailed', useOfficialSources: false,
      });
      setAiAnswer(response.answer);
    } catch {
      setAiAnswer('ArthaMind could not complete the analysis right now. Your expense data remains stored locally and unchanged.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-7 sm:px-6">
      <section className="rounded-3xl border border-brand/20 bg-surface p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-soft px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-brand-hover">ArthaMind · Personal Finance</span>
              <span className="rounded-full border border-line bg-canvas px-3 py-1 text-[10px] font-bold text-secondary">Private on this device</span>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">Expenses</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">Record, review, and understand personal or business spending with evidence-grounded AI assistance. Educational guidance only — not financial advice.</p>
          </div>
          <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-brand-hover">
            <Plus className="h-4 w-4" /> Add Expense
          </button>
        </div>
      </section>

      <section className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-3" aria-label="Expense period selector">
        {([
          ['this-month', 'This Month'], ['last-month', 'Last Month'], ['3-months', '3 Months'], ['custom', 'Custom Range'],
        ] as Array<[PeriodMode, string]>).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded-xl px-3 py-2 text-xs font-bold ${period === value ? 'bg-interactive-soft text-interactive' : 'text-secondary hover:bg-subtle hover:text-ink'}`}>{label}</button>
        ))}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <input aria-label="Custom expense start date" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink" />
            <span className="text-xs text-secondary">to</span>
            <input aria-label="Custom expense end date" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink" />
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Total expenses', value: formatINR(selectedTotal), note: `${selectedRecords.length} recorded transactions`, icon: ReceiptText },
          { label: 'Month-over-month', value: monthChange === null ? 'Not enough data' : `${monthChange >= 0 ? '+' : ''}${monthChange.toFixed(1)}%`, note: monthChange === null ? 'Add prior-month expenses to compare' : `${Math.abs(monthChange).toFixed(1)}% ${statusText(monthChange)} than prior month`, icon: monthChange !== null && monthChange > 0 ? ArrowUpRight : ArrowDownRight },
          { label: 'Largest category', value: topCategory?.[0] ?? 'No data', note: topCategory ? formatINR(topCategory[1]) : 'Add an expense to populate', icon: CircleDollarSign },
          { label: 'Daily average', value: formatINR(dailyAverage), note: `${daysInRange(range.start, range.end)} days in selected range`, icon: CalendarDays },
          { label: 'Income less expenses', value: remainingAfterExpenses === null ? 'Income not available' : formatINR(remainingAfterExpenses), note: income > 0 ? `${formatINR(income)} estimated INR income` : 'Add INR income in Income workspace', icon: WalletCards },
        ].map(({ label, value, note, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.14em] text-secondary">{label}</p><p className="mt-2 text-xl font-black text-ink">{value}</p><p className="mt-1 text-[10px] leading-4 text-secondary">{note}</p></div><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-subtle text-interactive"><Icon className="h-4 w-4" /></div></div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-12">
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm xl:col-span-7">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-black text-ink">Category spending</h2><p className="mt-1 text-xs text-secondary">Recorded spending by category for the selected period.</p></div><Filter className="h-5 w-5 text-interactive" /></div>
          {categoryRanking.length ? (
            <div className="mt-5 space-y-3">{categoryRanking.map(([category, amount]) => (
              <div key={category}><div className="flex items-center justify-between gap-3 text-xs"><span className="font-bold text-ink">{category}</span><span className="font-mono text-secondary">{formatINR(amount)}</span></div><div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-interactive" style={{ width: `${Math.max(4, amount / categoryMax * 100)}%` }} /></div></div>
            ))}</div>
          ) : <div className="py-16 text-center"><ReceiptText className="mx-auto h-8 w-8 text-secondary" /><p className="mt-3 text-sm font-bold text-ink">No spending in this period</p><p className="mt-1 text-xs text-secondary">Add your first expense or select a period containing transactions.</p></div>}
        </div>

        <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm xl:col-span-5">
          <h2 className="text-lg font-black text-ink">Spending trend</h2><p className="mt-1 text-xs text-secondary">Daily recorded expense totals; latest 14 active days shown.</p>
          {trendData.length ? (
            <div className="mt-6 flex h-56 items-end gap-2 border-b border-line px-1 pb-2">{trendData.map(([date, amount]) => (
              <div key={date} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`${date}: ${formatINR(amount)}`}><div className="w-full rounded-t-md bg-brand/70 transition group-hover:bg-brand" style={{ height: `${Math.max(6, amount / trendMax * 180)}px` }} /><span className="max-w-full truncate text-[8px] text-secondary">{date.slice(5)}</span></div>
            ))}</div>
          ) : <div className="flex h-56 items-center justify-center text-xs text-secondary">Trend data will appear after expenses are recorded.</div>}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-12">
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm xl:col-span-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-lg font-black text-ink">Transactions</h2><p className="mt-1 text-xs text-secondary">Search, filter, sort, edit, or remove locally stored expense records.</p></div><div className="flex flex-wrap gap-2">
            <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search merchant or notes" className="w-52 rounded-xl border border-line bg-canvas py-2 pl-9 pr-3 text-xs text-ink outline-none focus:border-interactive" /></label>
            <select aria-label="Expense category filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink"><option value="all">All categories</option>{allCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
            <select aria-label="Expense sort" value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink"><option value="date-desc">Newest first</option><option value="date-asc">Oldest first</option><option value="amount-desc">Highest amount</option><option value="amount-asc">Lowest amount</option></select>
          </div></div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-secondary"><span>Date filter:</span><input aria-label="Transaction filter from date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-ink" /><span>to</span><input aria-label="Transaction filter to date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-ink" />{(dateFrom || dateTo) && <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} className="font-bold text-interactive">Clear</button>}</div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-subtle text-[9px] uppercase tracking-wider text-secondary"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Merchant / Payee</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Method</th><th className="px-3 py-3">Recurring</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-line">{tableRecords.map((record) => (
              <tr key={record.id} className="bg-surface hover:bg-subtle/40"><td className="px-3 py-3 text-secondary">{record.date}</td><td className="px-3 py-3"><p className="font-bold text-ink">{record.merchant}</p>{record.notes && <p className="mt-0.5 max-w-52 truncate text-[9px] text-secondary">{record.notes}</p>}</td><td className="px-3 py-3 text-secondary">{record.category}</td><td className="px-3 py-3 text-secondary">{record.paymentMethod}</td><td className="px-3 py-3">{record.recurring ? <span className="rounded-full bg-warning-soft px-2 py-1 text-[9px] font-bold text-warning">Recurring</span> : <span className="text-secondary">—</span>}</td><td className="px-3 py-3 text-right font-mono font-bold text-ink">{formatINR(record.amount)}</td><td className="px-3 py-3"><div className="flex justify-end gap-1"><button type="button" aria-label={`Edit ${record.merchant}`} onClick={() => openEdit(record)} className="rounded-lg border border-line p-2 text-secondary hover:text-interactive"><Pencil className="h-3.5 w-3.5" /></button><button type="button" aria-label={`Delete ${record.merchant}`} onClick={() => deleteRecord(record)} className="rounded-lg border border-danger/20 p-2 text-danger hover:bg-danger-soft"><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>
            ))}{tableRecords.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-secondary">No transactions match the selected filters.</td></tr>}</tbody></table>
          </div>
        </div>

        <aside className="space-y-5 xl:col-span-4">
          <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm"><h2 className="font-black text-ink">Top merchants / payees</h2><p className="mt-1 text-xs text-secondary">Based only on merchant names recorded in this period.</p><div className="mt-4 space-y-2">{merchantRanking.map((item) => <div key={item.merchant} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3 py-2.5"><div className="min-w-0"><p className="truncate text-xs font-bold text-ink">{item.merchant}</p><p className="text-[9px] text-secondary">{item.count} transaction{item.count === 1 ? '' : 's'}</p></div><span className="font-mono text-xs text-secondary">{formatINR(item.amount)}</span></div>)}{merchantRanking.length === 0 && <p className="py-6 text-center text-xs text-secondary">No merchant data yet.</p>}</div></section>
          <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm"><h2 className="font-black text-ink">Recurring expenses</h2><p className="mt-1 text-xs text-secondary">Payments you marked as recurring and may want to review.</p><div className="mt-4 space-y-2">{recurringRecords.slice(0, 6).map((record) => <div key={record.id} className="rounded-xl border border-line bg-canvas px-3 py-2.5"><div className="flex justify-between gap-3"><span className="truncate text-xs font-bold text-ink">{record.merchant}</span><span className="font-mono text-xs text-secondary">{formatINR(record.amount)}</span></div><p className="mt-1 text-[9px] text-secondary">{record.category} · {record.paymentMethod}</p></div>)}{recurringRecords.length === 0 && <p className="py-6 text-center text-xs text-secondary">No recurring expenses recorded in this period.</p>}</div></section>
        </aside>
      </section>

      <section className="rounded-3xl border border-interactive/25 bg-surface shadow-sm">
        <div className="border-b border-line bg-interactive-soft/40 p-5 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-interactive/25 bg-surface text-interactive"><Sparkles className="h-5 w-5" /></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-ink">Ask ArthaMind · Expense Intelligence</h2><span className="rounded-full border border-success-fill/25 bg-success-soft px-2.5 py-1 text-[9px] font-bold text-success">Recorded-data grounded</span></div><p className="mt-1 text-xs leading-5 text-secondary">Answers use only your recorded expense, income-summary, category, merchant, and recurring-payment data. Educational guidance only.</p></div></div></div>
        <div className="grid gap-4 p-5 lg:grid-cols-[1fr_320px] sm:p-6"><div><div className="min-h-32 rounded-2xl border border-line bg-canvas p-4 text-sm leading-6 text-secondary whitespace-pre-wrap">{aiLoading ? <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin text-interactive" /> ArthaMind is reviewing your recorded expense snapshot…</span> : aiAnswer || 'Ask where you spent the most, compare months, identify rising categories, or review recurring payments. If the records do not support an answer, ArthaMind will say so.'}</div><div className="mt-3 flex gap-2"><input value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void askArthaMind(); }} placeholder="Ask a question about your recorded spending…" className="min-w-0 flex-1 rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-ink outline-none focus:border-interactive" /><button type="button" onClick={() => void askArthaMind()} disabled={!aiQuestion.trim() || aiLoading} className="inline-flex items-center gap-2 rounded-xl bg-interactive px-4 py-3 text-sm font-black text-white disabled:opacity-40"><Bot className="h-4 w-4" /> Ask</button></div></div><div className="space-y-2">{['Where did I spend the most this month?', 'Compare my expenses with last month.', 'Which category increased the most?', 'How can I reduce non-essential spending?', 'Show recurring payments I should review.'].map((question) => <button key={question} type="button" onClick={() => void askArthaMind(question)} className="w-full rounded-xl border border-line bg-canvas p-3 text-left text-xs font-semibold leading-5 text-secondary hover:border-interactive/30 hover:text-ink">{question}</button>)}</div></div>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="expense-form-title">
          <form onSubmit={saveDraft} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-surface p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><h2 id="expense-form-title" className="text-xl font-black text-ink">{editing ? 'Edit expense' : 'Add expense'}</h2><p className="mt-1 text-xs text-secondary">Stored locally in this browser. No bank connection is created.</p></div><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-line p-2 text-secondary hover:text-ink" aria-label="Close expense form"><X className="h-4 w-4" /></button></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold text-secondary">Amount (INR)<input autoFocus required min="0.01" step="0.01" type="number" value={draft.amount || ''} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })} className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-interactive" /></label>
              <label className="text-xs font-bold text-secondary">Date<input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-interactive" /></label>
              <label className="text-xs font-bold text-secondary">Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-interactive">{EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}<option>Custom…</option></select></label>
              {draft.category === 'Custom…' && <label className="text-xs font-bold text-secondary">Custom category<input required value={customCategory} maxLength={40} onChange={(event) => setCustomCategory(event.target.value)} placeholder="e.g. Professional tools" className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-interactive" /></label>}
              <label className="text-xs font-bold text-secondary">Merchant / Payee<input required value={draft.merchant} maxLength={80} onChange={(event) => setDraft({ ...draft, merchant: event.target.value })} placeholder="e.g. Metro, landlord, cafe" className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-interactive" /></label>
              <label className="text-xs font-bold text-secondary">Payment method<select value={draft.paymentMethod} onChange={(event) => setDraft({ ...draft, paymentMethod: event.target.value as ExpenseDraft['paymentMethod'] })} className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-interactive">{PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</select></label>
              <label className="sm:col-span-2 text-xs font-bold text-secondary">Notes<textarea value={draft.notes} maxLength={240} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={3} placeholder="Optional context for later analysis" className="mt-1.5 w-full resize-none rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-interactive" /></label>
              <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-line bg-canvas p-3 text-sm font-semibold text-ink"><input type="checkbox" checked={draft.recurring} onChange={(event) => setDraft({ ...draft, recurring: event.target.checked })} className="h-4 w-4 accent-brand" /><span>Recurring expense</span><span className="ml-auto text-[10px] font-normal text-secondary">Use for rent, subscriptions, EMI, insurance, etc.</span></label>
            </div>
            {formError && <div className="mt-4 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger">{formError}</div>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-secondary hover:text-ink">Cancel</button><button type="submit" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-white hover:bg-brand-hover">{editing ? 'Save changes' : 'Add expense'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
};
