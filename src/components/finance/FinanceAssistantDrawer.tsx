import React, { useEffect, useMemo, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import { Bot, LockKeyhole, Send, Settings2, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { AppNavigationDestination } from '../../navigationTypes';
import { loadAiDataContext, logAiContextUsage } from '../../services/aiDataContext';
import { loadEmiRecords } from '../../services/emiStorage';
import { saveFeedback } from '../../services/feedbackStorage';
import { loadIncomeSources, monthlyEquivalent } from '../../services/incomeStorage';
import { askTutorAI } from '../../services/learningApi';
import { currentMonthKey, expensesForMonth, loadBudgets, loadExpenses, monthlyIncomeEstimate } from '../../services/personalFinanceStorage';

const HISTORY_KEY = 'arthabench_finance_assistant_history_v1';
type Period = 'this-month' | 'last-month' | '3-months';
type Message = { id: string; role: 'user' | 'assistant'; text: string; at: string };

type Props = { module: AppNavigationDestination; onManageContext: () => void };

const questions: Partial<Record<AppNavigationDestination, string[]>> = {
  overview: ['Summarise my finances for this month.', 'What should I review before month-end?', 'Which data is missing from my workspace?'],
  income: ['How does this month’s income compare with my recorded history?', 'Which income sources are recurring?', 'What income information is missing?'],
  expenses: ['Which categories increased the most?', 'Show my largest expenses this month.', 'Which expense categories should I review?'],
  budgeting: ['Which budgets are near their limit?', 'Explain my overspending categories.', 'Help me make a monthly budget review checklist.'],
  'finance-reports': ['What changed compared with the previous period?', 'Explain my spending breakdown.', 'What are my top three review actions?'],
  'emi-manager': ['Which EMI is due next?', 'Explain my estimated EMI schedule.', 'What details are missing to calculate my repayment estimate?'],
};

function periodMonths(period: Period): string[] {
  const current = currentMonthKey();
  const [year, month] = current.split('-').map(Number);
  const count = period === '3-months' ? 3 : 1;
  const offset = period === 'last-month' ? 1 : 0;
  return Array.from({ length: count }, (_, index) => new Date(Date.UTC(year, month - 1 - offset - index, 1)).toISOString().slice(0, 7)).reverse();
}

function loadHistory(): Message[] {
  try { const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export const FinanceAssistantDrawer: React.FC<Props> = ({ module, onManageContext }) => {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<Period>('this-month');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [busy, setBusy] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const prefs = loadAiDataContext();
  const enabledCategories = useMemo(() => [prefs.income && 'Income', prefs.expenses && 'Expenses', prefs.budgets && 'Budgets', prefs.emis && 'EMIs', prefs.goals && 'Goals'].filter(Boolean) as string[], [prefs.income, prefs.expenses, prefs.budgets, prefs.emis, prefs.goals]);
  const monthKeys = periodMonths(period);
  const periodLabel = period === 'this-month' ? monthKeys[0] : period === 'last-month' ? monthKeys[0] : `${monthKeys[0]} to ${monthKeys.at(-1)}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const buildSnapshot = () => {
    const snapshot: Record<string, unknown> = { period: periodLabel };
    if (prefs.income) {
      const sources = loadIncomeSources().filter((source) => source.currency.toUpperCase() === 'INR');
      snapshot.income = { estimatedMonthlyINR: monthlyIncomeEstimate(monthKeys.at(-1) || currentMonthKey(), sources), sources: sources.map((source) => ({ type: source.type, frequency: source.frequency, amount: source.amount, activeFrom: source.startDate, activeTo: source.endDate ?? null })) };
    }
    if (prefs.expenses) {
      const rows = loadExpenses().filter((row) => monthKeys.some((month) => row.date.startsWith(month)));
      const categories = rows.reduce<Record<string, number>>((totals, row) => { totals[row.category] = new Decimal(totals[row.category] ?? 0).plus(row.amount).toNumber(); return totals; }, {});
      snapshot.expenses = { count: rows.length, totalINR: rows.reduce((sum, row) => new Decimal(sum).plus(row.amount).toNumber(), 0), categories };
    }
    if (prefs.budgets) snapshot.budgets = loadBudgets().filter((row) => monthKeys.includes(row.month)).map((row) => ({ month: row.month, name: row.name, categories: row.categories.map((category) => ({ category: category.category, plannedAmount: category.plannedAmount, warningThreshold: category.warningThreshold })) }));
    if (prefs.emis) snapshot.emis = loadEmiRecords().map((row) => ({ name: row.name, status: row.status, emiAmount: row.emiAmount, outstandingBalance: row.outstandingBalance, nextDueDate: row.nextDueDate, remainingInstallments: row.remainingInstallments }));
    if (prefs.goals) snapshot.goals = auth.profile?.financial_goal ? [auth.profile.financial_goal] : [];
    return snapshot;
  };

  const completeness = () => {
    let score = 0; let total = 0;
    if (prefs.income) { total++; if (loadIncomeSources().length) score++; }
    if (prefs.expenses) { total++; if (loadExpenses().length) score++; }
    if (prefs.budgets) { total++; if (loadBudgets().length) score++; }
    if (prefs.emis) { total++; if (loadEmiRecords().length) score++; }
    if (!total || score === 0) return 'Low';
    return score === total && total >= 2 ? 'High' : 'Medium';
  };

  const ask = async (override?: string) => {
    const next = (override ?? question).trim();
    if (!next || busy) return;
    if (!auth.user || !auth.session) { setMessages((rows) => [...rows, { id: crypto.randomUUID(), role: 'assistant', text: 'Sign in to ask ArthaMind questions about personal finance records.', at: new Date().toISOString() }]); return; }
    if (!enabledCategories.length) { setMessages((rows) => [...rows, { id: crypto.randomUUID(), role: 'assistant', text: 'Enable personal finance context to ask questions about your data. Use “Manage AI context” to choose categories.', at: new Date().toISOString() }]); return; }
    const snapshot = buildSnapshot();
    const dataCompleteness = completeness();
    const prompt = `You are ArthaMind inside the ${module} personal-finance module. Use ONLY the authorized JSON snapshot. Do not infer disabled categories or invent transactions. Follow the centralized ArthaMind financial response contract used by the tutor. In assumptions/context, state the selected period and enabled categories. In reasoning, distinguish facts from the snapshot from general educational guidance. Mention data completeness (${dataCompleteness}) as record coverage, not as an accuracy score. If the data is insufficient to support a strength, concern, comparison, or action, say that directly. Educational review actions are allowed; do not provide investment, tax, legal, loan-approval, refinancing, eligibility, creditworthiness, or guaranteed-savings instructions. Selected period: ${periodLabel}. Enabled categories: ${enabledCategories.join(', ')}. Question: ${next.slice(0, 350)}. Authorized snapshot: ${JSON.stringify(snapshot)}`.slice(0, 3500);
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', text: next, at: new Date().toISOString() };
    setMessages((rows) => [...rows, userMessage]); setQuestion(''); setBusy(true); setFeedbackSaved(false);
    try {
      const response = await askTutorAI(prompt, messages.slice(-6).map((row) => ({ role: row.role, content: row.text })), { country: 'India', currency: 'INR', language: 'english', level: 'advanced', mode: 'explain', detail: 'detailed', useOfficialSources: false });
      const assistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant', text: response.answer, at: new Date().toISOString() };
      const nextHistory = [...messages, userMessage, assistantMessage].slice(-30);
      setMessages(nextHistory);
      if (prefs.saveConversation) localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
      logAiContextUsage({ module, period: periodLabel, categories: enabledCategories });
    } catch {
      setMessages((rows) => [...rows, { id: crypto.randomUUID(), role: 'assistant', text: 'ArthaMind could not complete this request right now. Your stored finance records were not changed.', at: new Date().toISOString() }]);
    } finally { setBusy(false); }
  };

  const suggested = questions[module] ?? questions.overview!;
  const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');

  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white shadow-lg transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive" aria-haspopup="dialog" aria-expanded={open}><Bot className="h-5 w-5" /><span className="hidden sm:inline">Ask ArthaMind</span></button>
    {open && <div className="fixed inset-0 z-[110] bg-slate-950/45" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><aside role="dialog" aria-modal="true" aria-label="Ask ArthaMind" className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-3xl border border-line bg-surface p-4 shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[440px] sm:rounded-none sm:border-y-0 sm:border-r-0 sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-wider text-brand">Personal finance assistant</div><h2 className="mt-1 text-xl font-black text-ink">Ask ArthaMind</h2><p className="mt-1 text-[10px] leading-4 text-secondary">Uses only the finance categories and period you enable.</p></div><button ref={closeRef} type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line p-2 text-secondary" aria-label="Close Ask ArthaMind"><X className="h-4 w-4" /></button></div>
      <div className="mt-4 flex flex-wrap gap-2"><select aria-label="Assistant period" value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink"><option value="this-month">This month</option><option value="last-month">Last month</option><option value="3-months">Last 3 months</option></select><button type="button" onClick={onManageContext} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-bold text-ink"><Settings2 className="h-3.5 w-3.5" /> Manage AI context</button></div>
      <div className="mt-3 rounded-xl border border-line bg-canvas p-3"><div className="flex items-center gap-2 text-[10px] font-bold text-ink"><LockKeyhole className="h-3.5 w-3.5 text-brand" /> Enabled: {enabledCategories.join(', ') || 'No personal categories'}</div><div className="mt-1 text-[9px] text-secondary">Data completeness: {completeness()} · this is record coverage, not an accuracy score.</div></div>
      <div className="mt-4 flex flex-wrap gap-2">{suggested.map((item) => <button key={item} type="button" onClick={() => void ask(item)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-left text-[10px] font-semibold text-secondary hover:border-brand/35 hover:text-ink">{item}</button>)}</div>
      <div className="mt-4 max-h-[42vh] space-y-3 overflow-y-auto rounded-2xl border border-line bg-canvas p-3">{messages.length ? messages.map((message) => <div key={message.id} className={`rounded-xl p-3 text-xs leading-5 ${message.role === 'user' ? 'ml-7 bg-interactive-soft text-ink' : 'mr-3 border border-line bg-surface text-secondary'}`}><div className="mb-1 text-[9px] font-black uppercase text-ink">{message.role === 'user' ? 'You' : 'ArthaMind'}</div><div className="whitespace-pre-wrap">{message.text}</div></div>) : <p className="p-4 text-center text-xs leading-5 text-secondary">Ask a question about the categories you have explicitly enabled.</p>}</div>
      <div className="mt-3 flex gap-2"><textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about this finance module…" className="min-w-0 flex-1 resize-none rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink outline-none focus:border-interactive" /><button type="button" disabled={busy || !question.trim()} onClick={() => void ask()} className="rounded-xl bg-brand px-3 text-white disabled:opacity-40" aria-label="Send question"><Send className="h-4 w-4" /></button></div>
      {latestAssistant && <div className="mt-3 rounded-xl border border-line p-3 text-[10px] text-secondary"><span className="font-bold text-ink">Response feedback:</span> <button type="button" disabled={feedbackSaved} onClick={() => { saveFeedback({ userId: auth.user?.id ?? null, kind:'ai', module, rating:'helpful', category:null, comment:'' }); setFeedbackSaved(true); }} className="ml-2 font-bold text-interactive">Helpful</button><button type="button" disabled={feedbackSaved} onClick={() => { saveFeedback({ userId: auth.user?.id ?? null, kind:'ai', module, rating:'not-helpful', category:null, comment:'' }); setFeedbackSaved(true); }} className="ml-3 font-bold text-interactive">Not helpful</button><button type="button" disabled={feedbackSaved} onClick={() => { saveFeedback({ userId: auth.user?.id ?? null, kind:'ai', module, rating:'incorrect-outdated', category:'explanation', comment:'' }); setFeedbackSaved(true); }} className="ml-3 font-bold text-warning">Incorrect / outdated</button>{feedbackSaved && <span className="ml-2 text-success">Saved</span>}</div>}
      <p className="mt-3 text-[9px] leading-4 text-secondary">Educational money-management support only. ArthaMind does not provide investment, tax, legal, lending approval, refinancing or guaranteed-savings advice.</p>
    </aside></div>}
  </>;
};
