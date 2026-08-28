import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CreditCard,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { askTutorAI } from '../../services/learningApi';
import {
  BudgetCategoryPlan,
  createBudget,
  currentMonthKey,
  ExpenseCategory,
  expensesForMonth,
  EXPENSE_CATEGORIES,
  formatINR,
  loadBudgets,
  loadExpenses,
  monthlyIncomeEstimate,
  MonthlyBudget,
  saveBudgets,
  spendingByCategory,
  totalExpenses,
} from '../../services/personalFinanceStorage';

type BudgetDraft = Omit<MonthlyBudget, 'id' | 'createdAt' | 'updatedAt'>;

const statusForUsage = (usage: number, threshold: number) => {
  if (usage > 100) return { label: 'Over Budget', className: 'border-danger/20 bg-danger-soft text-danger' };
  if (usage >= threshold) return { label: 'Near Limit', className: 'border-warning-fill/20 bg-warning-soft text-warning' };
  return { label: 'On Track', className: 'border-success-fill/20 bg-success-soft text-success' };
};

function recommendedCategories(income: number): BudgetCategoryPlan[] {
  const weights: Array<[ExpenseCategory, number]> = [
    ['Housing/Rent', .28], ['Food & Dining', .08], ['Groceries', .08], ['Transport', .08],
    ['Bills & Utilities', .07], ['Education', .05], ['Health & Fitness', .04], ['Shopping', .04],
    ['Entertainment', .03], ['Insurance', .05], ['Family', .05], ['Other', .05],
  ];
  return weights.map(([category, weight]) => ({
    id: crypto.randomUUID(),
    category,
    plannedAmount: income > 0 ? Math.round(income * weight) : 0,
    warningThreshold: 80,
  }));
}

export const BudgetingView: React.FC = () => {
  const [budgets, setBudgets] = useState<MonthlyBudget[]>(loadBudgets);
  const [expenseRevision, setExpenseRevision] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MonthlyBudget | null>(null);
  const [draft, setDraft] = useState<BudgetDraft>({
    name: 'Monthly Budget', month: currentMonthKey(), notes: '', savingsTarget: 0, categories: recommendedCategories(0),
  });
  const [newCategory, setNewCategory] = useState<ExpenseCategory>('Food & Dining');
  const [newPlannedAmount, setNewPlannedAmount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const expenses = useMemo(() => loadExpenses(), [expenseRevision]);
  const monthExpenses = useMemo(() => expensesForMonth(expenses, selectedMonth), [expenses, selectedMonth]);
  const actualByCategory = useMemo(() => spendingByCategory(monthExpenses), [monthExpenses]);
  const actualSpending = totalExpenses(monthExpenses);
  const monthlyIncome = monthlyIncomeEstimate(selectedMonth);
  const activeBudget = useMemo(() => budgets.find((budget) => budget.month === selectedMonth) ?? null, [budgets, selectedMonth]);
  const plannedTotal = activeBudget?.categories.reduce((sum, row) => sum + row.plannedAmount, 0) ?? 0;
  const savingsTarget = activeBudget?.savingsTarget ?? 0;
  const remainingBudget = plannedTotal - actualSpending;
  const utilization = plannedTotal > 0 ? actualSpending / plannedTotal * 100 : 0;
  const totalCommitment = plannedTotal + savingsTarget;
  const exceedsIncome = monthlyIncome > 0 && totalCommitment > monthlyIncome;
  const overallStatus = statusForUsage(utilization, 80);

  const categoryRows = useMemo(() => activeBudget?.categories.map((plan) => {
    const spent = actualByCategory[plan.category] ?? 0;
    const remaining = plan.plannedAmount - spent;
    const usage = plan.plannedAmount > 0 ? spent / plan.plannedAmount * 100 : spent > 0 ? 999 : 0;
    return { ...plan, spent, remaining, usage, status: statusForUsage(usage, plan.warningThreshold) };
  }) ?? [], [activeBudget, actualByCategory]);

  const commitBudgets = (next: MonthlyBudget[]) => { setBudgets(next); saveBudgets(next); };

  const openCreate = () => {
    const income = monthlyIncomeEstimate(selectedMonth);
    setEditing(null);
    setDraft({
      name: `${new Date(`${selectedMonth}-01T00:00:00`).toLocaleString('en-IN', { month: 'long', year: 'numeric' })} Budget`,
      month: selectedMonth,
      notes: '',
      savingsTarget: income > 0 ? Math.round(income * .15) : 0,
      categories: recommendedCategories(income),
    });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (budget: MonthlyBudget) => {
    setEditing(budget);
    setDraft({ name: budget.name, month: budget.month, notes: budget.notes, savingsTarget: budget.savingsTarget, categories: budget.categories.map((row) => ({ ...row })) });
    setFormError(null);
    setFormOpen(true);
  };

  const addDraftCategory = () => {
    const existing = draft.categories.find((row) => row.category === newCategory);
    const categories = existing
      ? draft.categories.map((row) => row.category === newCategory ? { ...row, plannedAmount: newPlannedAmount } : row)
      : [...draft.categories, { id: crypto.randomUUID(), category: newCategory, plannedAmount: newPlannedAmount, warningThreshold: 80 }];
    setDraft({ ...draft, categories });
    setNewPlannedAmount(0);
  };

  const saveBudget = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !/^\d{4}-\d{2}$/.test(draft.month)) return setFormError('Budget name and month are required.');
    if (draft.savingsTarget < 0 || draft.categories.some((row) => row.plannedAmount < 0 || row.warningThreshold < 50 || row.warningThreshold > 100)) {
      return setFormError('Amounts must be non-negative and warning thresholds must be between 50% and 100%.');
    }
    if (budgets.some((budget) => budget.month === draft.month && budget.id !== editing?.id)) return setFormError(`A budget already exists for ${draft.month}.`);

    const saved = createBudget({ ...draft, name: draft.name.trim(), notes: draft.notes.trim() }, editing ?? undefined);
    commitBudgets(editing ? budgets.map((budget) => budget.id === editing.id ? saved : budget) : [saved, ...budgets]);
    setSelectedMonth(saved.month);
    setFormOpen(false);
  };

  const deleteBudget = (budget: MonthlyBudget) => {
    if (window.confirm(`Delete budget “${budget.name}”? Expense records will remain unchanged.`)) commitBudgets(budgets.filter((row) => row.id !== budget.id));
  };

  const askCoach = async (override?: string) => {
    const question = (override ?? aiQuestion).trim();
    if (!question || aiLoading) return;
    if (!activeBudget && monthExpenses.length === 0 && monthlyIncome <= 0) {
      setAiAnswer('There is not enough recorded personal-finance data to answer this yet. Add income, create a budget, or record expenses first.');
      return;
    }
    const snapshot = {
      month: selectedMonth,
      monthlyIncomeINR: monthlyIncome || null,
      actualSpending,
      budget: activeBudget ? {
        plannedTotal,
        savingsTarget,
        remainingBudget,
        utilizationPercent: Number(utilization.toFixed(1)),
        categories: categoryRows.map((row) => ({ category: row.category, planned: row.plannedAmount, spent: row.spent, remaining: row.remaining, usagePercent: Number(row.usage.toFixed(1)), status: row.status.label })),
      } : null,
    };
    const prompt = `You are ArthaMind Budget Coach inside Artha Bench Pro. Use ONLY this displayed/recorded snapshot. Never invent income, expenses, balances, savings, affordability, or goals. Label assumptions clearly and state missing data. Give practical Indian INR-based educational guidance only, not financial, tax, legal, or investment advice.\nQuestion: ${question.slice(0, 350)}\nSnapshot: ${JSON.stringify(snapshot)}`.slice(0, 1950);
    setAiLoading(true); setAiQuestion('');
    try {
      const response = await askTutorAI(prompt, [], { country: 'India', currency: 'INR', language: 'english', level: 'advanced', mode: 'explain', detail: 'detailed', useOfficialSources: false });
      setAiAnswer(response.answer);
    } catch {
      setAiAnswer('ArthaMind Budget Coach could not complete this request right now. Your stored budget and expense records remain unchanged.');
    } finally { setAiLoading(false); }
  };

  const months = [...new Set([currentMonthKey(), selectedMonth, ...budgets.map((budget) => budget.month)])].sort().reverse();

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-7 sm:px-6" onMouseEnter={() => setExpenseRevision((value) => value + 1)}>
      <section className="rounded-3xl border border-brand/20 bg-surface p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-brand-soft px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-brand-hover">ArthaMind · Personal Finance</span><span className="rounded-full border border-line bg-canvas px-3 py-1 text-[10px] font-bold text-secondary">Income + Expenses linked</span></div><h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">Budgeting</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">Plan monthly allocations, compare budgets with recorded expenses, and use grounded AI coaching. Educational guidance only — not financial advice.</p></div>
          <div className="flex flex-wrap gap-2"><select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="Budget month" className="rounded-xl border border-line bg-canvas px-4 py-3 text-sm font-bold text-ink">{months.map((month) => <option key={month}>{month}</option>)}</select><button type="button" onClick={activeBudget ? () => openEdit(activeBudget) : openCreate} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-white hover:bg-brand-hover">{activeBudget ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{activeBudget ? 'Edit Budget' : 'Create Budget'}</button></div>
        </div>
      </section>

      {exceedsIncome && <section className="flex gap-3 rounded-2xl border border-warning-fill/30 bg-warning-soft p-4"><AlertTriangle className="h-5 w-5 shrink-0 text-warning" /><div><p className="font-black text-warning">Planned commitments exceed recorded income.</p><p className="mt-1 text-xs leading-5 text-secondary">Budget + savings target: {formatINR(totalCommitment)} · estimated INR income: {formatINR(monthlyIncome)}.</p></div></section>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ['Monthly income', monthlyIncome > 0 ? formatINR(monthlyIncome) : 'Not recorded', 'Existing Income data', WalletCards],
          ['Planned budget', activeBudget ? formatINR(plannedTotal) : 'No budget', activeBudget ? `${activeBudget.categories.length} categories` : 'Create a monthly plan', Target],
          ['Actual spending', formatINR(actualSpending), `${monthExpenses.length} linked expenses`, CreditCard],
          ['Remaining budget', activeBudget ? formatINR(remainingBudget) : '—', 'Planned less spent', CheckCircle2],
          ['Savings target', activeBudget ? formatINR(savingsTarget) : '—', 'Optional goal', PiggyBank],
          ['Budget utilization', activeBudget ? `${utilization.toFixed(1)}%` : '—', activeBudget ? overallStatus.label : 'Requires a budget', Sparkles],
        ].map(([label, value, note, Icon]) => <div key={label as string} className="rounded-2xl border border-line bg-surface p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.14em] text-secondary">{label as string}</p><p className="mt-2 text-lg font-black text-ink">{value as string}</p><p className="mt-1 text-[9px] text-secondary">{note as string}</p></div>{React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: 'h-4 w-4 text-interactive' })}</div></div>)}
      </section>

      {activeBudget ? <>
        <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black text-ink">{activeBudget.name}</h2><span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${overallStatus.className}`}>{overallStatus.label}</span></div><p className="mt-1 text-xs text-secondary">{activeBudget.month}{activeBudget.notes ? ` · ${activeBudget.notes}` : ''}</p></div><button type="button" onClick={() => deleteBudget(activeBudget)} className="inline-flex items-center gap-1.5 rounded-xl border border-danger/20 px-3 py-2 text-xs font-bold text-danger hover:bg-danger-soft"><Trash2 className="h-3.5 w-3.5" /> Delete</button></div><div className="mt-5"><div className="flex justify-between text-xs"><span className="font-bold text-ink">Overall utilization</span><span className="font-mono text-secondary">{formatINR(actualSpending)} / {formatINR(plannedTotal)}</span></div><div className="mt-2 h-4 overflow-hidden rounded-full bg-subtle"><div className={`h-full rounded-full ${utilization > 100 ? 'bg-danger' : utilization >= 80 ? 'bg-warning-fill' : 'bg-brand'}`} style={{ width: `${Math.min(100, utilization)}%` }} /></div></div></section>
        <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><h2 className="text-lg font-black text-ink">Category budget tracking</h2><p className="mt-1 text-xs text-secondary">Actual spend comes directly from matching categories in Expenses.</p><div className="mt-5 overflow-x-auto rounded-2xl border border-line"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-subtle text-[9px] uppercase tracking-wider text-secondary"><tr><th className="px-3 py-3">Category</th><th className="px-3 py-3 text-right">Planned</th><th className="px-3 py-3 text-right">Spent</th><th className="px-3 py-3 text-right">Remaining</th><th className="px-3 py-3 text-right">Usage %</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Progress</th></tr></thead><tbody className="divide-y divide-line">{categoryRows.map((row) => <tr key={row.id}><td className="px-3 py-3 font-bold text-ink">{row.category}</td><td className="px-3 py-3 text-right font-mono text-secondary">{formatINR(row.plannedAmount)}</td><td className="px-3 py-3 text-right font-mono text-secondary">{formatINR(row.spent)}</td><td className={`px-3 py-3 text-right font-mono font-bold ${row.remaining < 0 ? 'text-danger' : 'text-ink'}`}>{formatINR(row.remaining)}</td><td className="px-3 py-3 text-right font-mono text-secondary">{row.usage > 900 ? '>900%' : `${row.usage.toFixed(1)}%`}</td><td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[9px] font-bold ${row.status.className}`}>{row.status.label}</span></td><td className="px-3 py-3"><div className="h-2 w-28 overflow-hidden rounded-full bg-subtle"><div className={`h-full rounded-full ${row.usage > 100 ? 'bg-danger' : row.usage >= row.warningThreshold ? 'bg-warning-fill' : 'bg-brand'}`} style={{ width: `${Math.min(100, row.usage)}%` }} /></div><p className="mt-1 text-[8px] text-secondary">warn at {row.warningThreshold}%</p></td></tr>)}</tbody></table></div></section>
      </> : <section className="rounded-3xl border border-line bg-surface p-10 text-center shadow-sm"><PiggyBank className="mx-auto h-10 w-10 text-interactive" /><h2 className="mt-4 text-xl font-black text-ink">Create your first monthly budget</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-secondary">Start from a fully editable recommended template using recorded INR income when available.</p><button type="button" onClick={openCreate} className="mt-5 rounded-xl bg-brand px-5 py-3 text-sm font-black text-white hover:bg-brand-hover">Create monthly budget</button></section>}

      <section className="rounded-3xl border border-interactive/25 bg-surface shadow-sm"><div className="border-b border-line bg-interactive-soft/40 p-5 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-interactive/25 bg-surface text-interactive"><Sparkles className="h-5 w-5" /></div><div><h2 className="text-lg font-black text-ink">ArthaMind AI Budget Coach</h2><p className="mt-1 text-xs leading-5 text-secondary">Uses recorded Income, Expenses, and the selected budget only. Assumptions are labeled.</p></div></div></div><div className="grid gap-4 p-5 lg:grid-cols-[1fr_320px] sm:p-6"><div><div className="min-h-32 rounded-2xl border border-line bg-canvas p-4 text-sm leading-6 text-secondary whitespace-pre-wrap">{aiLoading ? <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin text-interactive" /> Reviewing the selected budget…</span> : aiAnswer || 'Ask which category is near its limit, whether a planned expense fits, or how your allocation compares with recorded income.'}</div><div className="mt-3 flex gap-2"><input value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void askCoach(); }} placeholder="Ask about the selected budget…" className="min-w-0 flex-1 rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-ink outline-none focus:border-interactive" /><button type="button" onClick={() => void askCoach()} disabled={!aiQuestion.trim() || aiLoading} className="inline-flex items-center gap-2 rounded-xl bg-interactive px-4 py-3 text-sm font-black text-white disabled:opacity-40"><Bot className="h-4 w-4" /> Ask</button></div></div><div className="space-y-2">{['Can I afford this expense based on my current budget?', 'Which category is likely to exceed its budget?', 'Suggest a realistic savings allocation.', 'Create a simple student budget based on my income.', 'Explain why I am over budget this month.'].map((question) => <button key={question} type="button" onClick={() => void askCoach(question)} className="w-full rounded-xl border border-line bg-canvas p-3 text-left text-xs font-semibold leading-5 text-secondary hover:border-interactive/30 hover:text-ink">{question}</button>)}</div></div></section>

      {formOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true"><form onSubmit={saveBudget} className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-line bg-surface p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black text-ink">{editing ? 'Edit monthly budget' : 'Create monthly budget'}</h2><p className="mt-1 text-xs text-secondary">Recommended values are editable suggestions.</p></div><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-line p-2 text-secondary"><X className="h-4 w-4" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-secondary">Budget name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink" /></label><label className="text-xs font-bold text-secondary">Month<input required type="month" value={draft.month} onChange={(event) => setDraft({ ...draft, month: event.target.value })} className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink" /></label><label className="text-xs font-bold text-secondary">Savings target INR<input min="0" type="number" value={draft.savingsTarget} onChange={(event) => setDraft({ ...draft, savingsTarget: Number(event.target.value) })} className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink" /></label><label className="text-xs font-bold text-secondary sm:col-span-2">Notes<textarea rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink" /></label></div><div className="mt-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black text-ink">Category plan</h3><p className="text-xs text-secondary">Edit planned amount and warning threshold.</p></div><button type="button" onClick={() => setDraft({ ...draft, categories: recommendedCategories(monthlyIncomeEstimate(draft.month)) })} className="rounded-xl border border-interactive/25 bg-interactive-soft px-3 py-2 text-xs font-bold text-interactive">Reset template</button></div><div className="mt-4 space-y-2">{draft.categories.map((row, index) => <div key={row.id} className="grid gap-2 rounded-xl border border-line bg-canvas p-3 sm:grid-cols-[1fr_150px_130px_auto] sm:items-end"><label className="text-[10px] font-bold text-secondary">Category<select value={row.category} onChange={(event) => setDraft({ ...draft, categories: draft.categories.map((item, i) => i === index ? { ...item, category: event.target.value } : item) })} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-xs text-ink">{EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="text-[10px] font-bold text-secondary">Planned<input min="0" type="number" value={row.plannedAmount} onChange={(event) => setDraft({ ...draft, categories: draft.categories.map((item, i) => i === index ? { ...item, plannedAmount: Number(event.target.value) } : item) })} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-xs text-ink" /></label><label className="text-[10px] font-bold text-secondary">Warn at %<input min="50" max="100" type="number" value={row.warningThreshold} onChange={(event) => setDraft({ ...draft, categories: draft.categories.map((item, i) => i === index ? { ...item, warningThreshold: Number(event.target.value) } : item) })} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-xs text-ink" /></label><button type="button" onClick={() => setDraft({ ...draft, categories: draft.categories.filter((_, i) => i !== index) })} className="rounded-lg border border-danger/20 p-2 text-danger"><Trash2 className="h-4 w-4" /></button></div>)}</div><div className="mt-3 grid gap-2 rounded-xl border border-dashed border-line-strong bg-subtle/40 p-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"><label className="text-[10px] font-bold text-secondary">Add category<select value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-xs text-ink">{EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="text-[10px] font-bold text-secondary">Planned INR<input min="0" type="number" value={newPlannedAmount || ''} onChange={(event) => setNewPlannedAmount(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-xs text-ink" /></label><button type="button" onClick={addDraftCategory} className="inline-flex items-center justify-center gap-1 rounded-lg border border-brand/25 bg-brand-soft px-3 py-2 text-xs font-bold text-brand-hover"><Plus className="h-3.5 w-3.5" /> Add / update</button></div></div>{formError && <div className="mt-4 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger">{formError}</div>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-secondary">Cancel</button><button type="submit" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-white">{editing ? 'Save budget' : 'Create budget'}</button></div></form></div>}
    </div>
  );
};
