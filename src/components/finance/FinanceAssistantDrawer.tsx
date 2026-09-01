import React, { useEffect, useMemo, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import { Bot, ChevronDown, ExternalLink, LockKeyhole, Send, Settings2, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { AppNavigationDestination } from '../../navigationTypes';
import { loadAiDataContext, logAiContextUsage } from '../../services/aiDataContext';
import { loadEmiRecords } from '../../services/emiStorage';
import { saveFeedback } from '../../services/feedbackStorage';
import { loadIncomeSources } from '../../services/incomeStorage';
import { askTutorAI } from '../../services/learningApi';
import { currentMonthKey, loadBudgets, loadExpenses, monthlyIncomeEstimate } from '../../services/personalFinanceStorage';

const HISTORY_KEY = 'arthabench_finance_assistant_history_v1';
type Period = 'this-month' | 'last-month' | '3-months';
type IntelligenceStatus = 'Stable' | 'Watch' | 'Review' | 'Data needed';
type Message = { id: string; role: 'user' | 'assistant'; text: string; at: string; status?: IntelligenceStatus };

type Props = { module: AppNavigationDestination; onManageContext: () => void };
type ExpertConfig = {
  name: string;
  purpose: string;
  questions: string[];
  sections: string[];
  note?: string;
};

const experts: Partial<Record<AppNavigationDestination, ExpertConfig>> = {
  overview: {
    name: 'Financial Intelligence Brief',
    purpose: 'Executive review of recorded income, outflow, budgets, commitments, changes and data coverage.',
    questions: ['What changed in my finances this period?', 'What are the biggest recorded drivers?', 'Which workspace items need review?'],
    sections: ['Executive signal', 'What changed', 'Key drivers', 'Watchlist', 'Suggested next review inside Artha Bench', 'Evidence used', 'Data limitations'],
  },
  income: {
    name: 'Income Analyst',
    purpose: 'Analyze recorded income consistency, source mix, changes and relationship to recorded outflow.',
    questions: ['How consistent is my recorded income?', 'Which income sources are most concentrated?', 'What changed in my recorded income?'],
    sections: ['Income snapshot', 'Trend and consistency', 'Source mix or concentration', 'Changes to review', 'Financial impact context', 'Evidence used', 'Data limitations'],
  },
  expenses: {
    name: 'Spending Analyst',
    purpose: 'Analyze recorded spending patterns, category drivers, changes and potential recurring outflows.',
    questions: ['What is driving my spending?', 'Which categories changed the most?', 'Which recorded expenses need review?'],
    sections: ['Spending snapshot', 'Largest drivers', 'Changes from prior period', 'Potential recurring commitments', 'Categories to review', 'Evidence used', 'Data limitations'],
  },
  budgeting: {
    name: 'Budget Coach',
    purpose: 'Compare actual recorded spending with configured budgets without predicting end-of-period outcomes.',
    questions: ['Which budgets need review?', 'Where is recorded spending closest to a configured limit?', 'What budget data is missing?'],
    sections: ['Budget health', 'Categories needing attention', 'Remaining runway', 'Spending-to-budget variance', 'Suggested workspace review', 'Evidence used', 'Data limitations'],
  },
  'finance-reports': {
    name: 'Financial Report Analyst',
    purpose: 'Turn the selected recorded period into a concise, auditable financial review.',
    questions: ['Summarize this period using my recorded data.', 'What changed compared with the prior period?', 'What are the main recorded drivers?'],
    sections: ['Period summary', 'Key movements', 'Major drivers', 'Budget and commitments context', 'Data-quality notes', 'Evidence used', 'Review actions inside the product'],
  },
  'emi-manager': {
    name: 'Commitment Analyst',
    purpose: 'Analyze recorded EMI and recurring commitments in the context of recorded income and cash flow.',
    questions: ['How are recurring commitments affecting my recorded cash flow?', 'Which recorded commitments are upcoming?', 'What commitment data should I review?'],
    sections: ['Commitment snapshot', 'Upcoming obligations', 'Income-to-commitment context', 'Cash-flow pressure indicators', 'Review items', 'Evidence used', 'Data limitations'],
  },
  'decision-replay': {
    name: 'Scenario Interpreter',
    purpose: 'Explain completed deterministic replay results without modifying or replacing the replay calculation.',
    questions: ['What caused the biggest difference in this scenario?', 'Which assumptions drove the replay change?', 'What was excluded from this calculation?'],
    sections: ['Replay conclusion', 'Largest calculated drivers', 'Monthly impact', 'Horizon impact', 'Assumptions applied', 'What was included', 'What was excluded', 'Data limitations', 'Next review locations in the platform'],
    note: 'For an exact replay interpretation, run the replay first and use “Explain with ArthaMind” inside the replay results. That control passes the exact deterministic server result to ArthaMind.',
  },
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

function parseIntelligenceAnswer(answer: string): { text: string; status?: IntelligenceStatus } {
  const match = answer.match(/^\s*STATUS:\s*(Stable|Watch|Review|Data needed)\s*\n?/i);
  if (!match) return { text: answer };
  const normalized = match[1].toLowerCase();
  const status: IntelligenceStatus = normalized === 'stable' ? 'Stable' : normalized === 'watch' ? 'Watch' : normalized === 'review' ? 'Review' : 'Data needed';
  return { text: answer.slice(match[0].length).trim(), status };
}

function statusClass(status: IntelligenceStatus) {
  if (status === 'Stable') return 'border-success-fill/25 bg-success-soft text-success';
  if (status === 'Watch') return 'border-warning-fill/25 bg-warning-soft text-warning';
  if (status === 'Review') return 'border-danger/20 bg-danger-soft text-danger';
  return 'border-line-strong bg-subtle text-secondary';
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
  const expert = experts[module] ?? experts.overview!;
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
    const snapshot: Record<string, unknown> = {
      period: periodLabel,
      generatedAt: new Date().toISOString(),
      authorizedCategories: enabledCategories,
      privacyBoundary: 'Authenticated workspace categories explicitly enabled by the signed-in user only.',
    };
    if (prefs.income) {
      const sources = loadIncomeSources().filter((source) => source.currency.toUpperCase() === 'INR');
      snapshot.income = { estimatedMonthlyINR: monthlyIncomeEstimate(monthKeys.at(-1) || currentMonthKey(), sources), sourceCount: sources.length, sources: sources.map((source) => ({ type: source.type, frequency: source.frequency, amount: source.amount, activeFrom: source.startDate, activeTo: source.endDate ?? null })) };
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

  const recordSummary = () => {
    const parts: string[] = [];
    if (prefs.income) parts.push(`${loadIncomeSources().length} income source${loadIncomeSources().length === 1 ? '' : 's'}`);
    if (prefs.expenses) {
      const count = loadExpenses().filter((row) => monthKeys.some((month) => row.date.startsWith(month))).length;
      parts.push(`${count} expense record${count === 1 ? '' : 's'}`);
    }
    if (prefs.budgets) {
      const count = loadBudgets().filter((row) => monthKeys.includes(row.month)).length;
      parts.push(`${count} budget${count === 1 ? '' : 's'}`);
    }
    if (prefs.emis) parts.push(`${loadEmiRecords().length} EMI record${loadEmiRecords().length === 1 ? '' : 's'}`);
    return parts;
  };

  const ask = async (override?: string) => {
    const next = (override ?? question).trim();
    if (!next || busy) return;
    if (!auth.user || !auth.session) { setMessages((rows) => [...rows, { id: crypto.randomUUID(), role: 'assistant', text: 'Sign in to ask ArthaMind questions about personal finance records.', at: new Date().toISOString(), status: 'Data needed' }]); return; }
    if (!enabledCategories.length) { setMessages((rows) => [...rows, { id: crypto.randomUUID(), role: 'assistant', text: 'Enable personal finance context to ask questions about your data. Use “Manage AI context” to choose categories.', at: new Date().toISOString(), status: 'Data needed' }]); return; }
    const snapshot = buildSnapshot();
    const dataCompleteness = completeness();
    const replayBoundary = module === 'decision-replay' ? 'The generic finance snapshot does NOT contain a completed Decision Replay result. Do not claim to interpret a replay from this snapshot. Direct the user to the dedicated “Explain with ArthaMind” control after a replay when exact replay calculations are required.' : '';
    const prompt = `You are ArthaMind Finance Intelligence Mode — ${expert.name} — inside the ${module} finance module. Purpose: ${expert.purpose} Use ONLY the authorized JSON snapshot below. Do not behave like a generic finance tutor. Learning/Tutorial mode is separate and must remain separate. Analyze recorded data, deterministic values, patterns, trade-offs, anomalies and data limitations only when supported. Never invent balances, transactions, income, bills, goals, market data or missing facts. Never provide investment/trading advice, tax/legal advice, lending approval, affordability approval, refinancing instructions, guarantees or predictions. Clearly distinguish facts, deterministic calculations, temporary assumptions and AI interpretation. If evidence is insufficient, say exactly: “ArthaMind cannot form a reliable trend insight yet because the selected period contains limited recorded data. Add or categorize more records to improve the analysis.” Start the answer with exactly one status line: STATUS: Stable, STATUS: Watch, STATUS: Review, or STATUS: Data needed. Use Stable only for a supported descriptive stable state; Watch only for an observed trend/threshold worth monitoring; Review only for a verified pressure, overdue record or exceeded threshold; Data needed when records are insufficient. Then use these exact section headings in order when relevant: ${expert.sections.join(' | ')}. Include visible evidence from the snapshot and a data-limitations section. Selected period: ${periodLabel}. Enabled categories: ${enabledCategories.join(', ')}. Data completeness: ${dataCompleteness} (record coverage only, not an accuracy score). ${replayBoundary} Question: ${next.slice(0, 350)}. Authorized snapshot: ${JSON.stringify(snapshot)}`.slice(0, 5000);
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', text: next, at: new Date().toISOString() };
    setMessages((rows) => [...rows, userMessage]); setQuestion(''); setBusy(true); setFeedbackSaved(false);
    try {
      const response = await askTutorAI(prompt, messages.slice(-6).map((row) => ({ role: row.role, content: row.text })), { country: 'India', currency: 'INR', language: 'english', level: 'advanced', mode: 'explain', detail: 'detailed', useOfficialSources: false });
      const parsed = parseIntelligenceAnswer(response.answer);
      const assistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant', text: parsed.text, at: new Date().toISOString(), status: parsed.status ?? (dataCompleteness === 'Low' ? 'Data needed' : undefined) };
      const nextHistory = [...messages, userMessage, assistantMessage].slice(-30);
      setMessages(nextHistory);
      if (prefs.saveConversation) localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
      logAiContextUsage({ module, period: periodLabel, categories: enabledCategories });
    } catch {
      setMessages((rows) => [...rows, { id: crypto.randomUUID(), role: 'assistant', text: 'ArthaMind could not complete this request right now. Your stored finance records were not changed.', at: new Date().toISOString(), status: 'Data needed' }]);
    } finally { setBusy(false); }
  };

  const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  const evidenceRows = recordSummary();

  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-40 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white shadow-lg transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive" aria-haspopup="dialog" aria-expanded={open}><Bot className="h-5 w-5" /><span className="hidden sm:inline">Ask ArthaMind</span></button>
    {open && <div className="fixed inset-0 z-[110] bg-slate-950/45" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><aside role="dialog" aria-modal="true" aria-label={`ArthaMind ${expert.name}`} className="absolute inset-x-0 bottom-0 max-h-[94vh] overflow-y-auto rounded-t-3xl border border-line bg-surface p-4 shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[460px] sm:rounded-none sm:border-y-0 sm:border-r-0 sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-wider text-brand">Finance intelligence mode</div><h2 className="mt-1 text-xl font-black text-ink">{expert.name}</h2><p className="mt-1 text-[10px] leading-4 text-secondary">{expert.purpose}</p></div><button ref={closeRef} type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line p-2 text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-interactive" aria-label="Close Ask ArthaMind"><X className="h-4 w-4" /></button></div>
      <div className="mt-4 flex flex-wrap gap-2"><select aria-label="Assistant period" value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink"><option value="this-month">This month</option><option value="last-month">Last month</option><option value="3-months">Last 3 months</option></select><button type="button" onClick={onManageContext} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-bold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-interactive"><Settings2 className="h-3.5 w-3.5" /> Manage AI context</button></div>
      <div className="mt-3 rounded-xl border border-line bg-canvas p-3"><div className="flex items-center gap-2 text-[10px] font-bold text-ink"><LockKeyhole className="h-3.5 w-3.5 text-brand" /> Enabled: {enabledCategories.join(', ') || 'No personal categories'}</div><div className="mt-1 text-[9px] text-secondary">Data completeness: {completeness()} · record coverage, not an accuracy score.</div><div className="mt-1 text-[9px] text-secondary">Evidence: {evidenceRows.length ? evidenceRows.join(' · ') : 'No enabled finance records detected for this period.'}</div></div>
      {expert.note && <div className="mt-3 rounded-xl border border-interactive/20 bg-interactive-soft p-3 text-[10px] leading-5 text-secondary"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-interactive" />{expert.note}</div>}
      <div className="mt-4 flex flex-wrap gap-2">{expert.questions.map((item) => <button key={item} type="button" onClick={() => void ask(item)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-left text-[10px] font-semibold text-secondary hover:border-brand/35 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-interactive">{item}</button>)}</div>
      <div className="mt-4 max-h-[43vh] space-y-3 overflow-y-auto rounded-2xl border border-line bg-canvas p-3" aria-live="polite">{messages.length ? messages.map((message) => message.role === 'user' ? <div key={message.id} className="ml-7 rounded-xl bg-interactive-soft p-3 text-xs leading-5 text-ink"><div className="mb-1 text-[9px] font-black uppercase text-ink">You</div><div className="whitespace-pre-wrap">{message.text}</div></div> : <article key={message.id} className="mr-1 overflow-hidden rounded-xl border border-line bg-surface text-secondary"><div className={`flex items-center justify-between gap-2 border-b px-3 py-2 text-[9px] font-black uppercase tracking-wider ${message.status ? statusClass(message.status) : 'border-line bg-subtle text-secondary'}`}><span>{message.status ?? 'AI interpretation'}</span><span>ArthaMind</span></div><div className="p-3 text-xs leading-5"><div className="whitespace-pre-wrap">{message.text}</div><details className="mt-3 rounded-lg border border-line bg-canvas px-3 py-2"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[9px] font-black text-ink">Data used <ChevronDown className="h-3 w-3" /></summary><div className="mt-2 space-y-1 text-[9px] leading-4 text-secondary"><div>Selected period: {periodLabel}</div><div>Enabled categories: {enabledCategories.join(', ') || 'None'}</div><div>Record coverage: {completeness()}</div><div>No saved records were changed by this explanation.</div><div>AI interpretation does not replace deterministic calculations.</div></div></details></div></article>) : <p className="p-4 text-center text-xs leading-5 text-secondary">Ask a question about the finance categories you explicitly enabled. ArthaMind will separate recorded facts from AI interpretation and state when the evidence is insufficient.</p>}</div>
      <div className="mt-3 flex gap-2"><textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={`Ask ${expert.name} about this module…`} className="min-w-0 flex-1 resize-none rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/15" aria-label={`Ask ${expert.name}`} /><button type="button" disabled={busy || !question.trim()} onClick={() => void ask()} className="min-w-11 rounded-xl bg-brand px-3 text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive" aria-label="Send question"><Send className="mx-auto h-4 w-4" /></button></div>
      {latestAssistant && <div className="mt-3 rounded-xl border border-line p-3 text-[10px] text-secondary"><span className="font-bold text-ink">Response feedback:</span> <button type="button" disabled={feedbackSaved} onClick={() => { saveFeedback({ userId: auth.user?.id ?? null, kind:'ai', module, rating:'helpful', category:null, comment:'' }); setFeedbackSaved(true); }} className="ml-2 font-bold text-interactive">Helpful</button><button type="button" disabled={feedbackSaved} onClick={() => { saveFeedback({ userId: auth.user?.id ?? null, kind:'ai', module, rating:'not-helpful', category:null, comment:'' }); setFeedbackSaved(true); }} className="ml-3 font-bold text-interactive">Not helpful</button><button type="button" disabled={feedbackSaved} onClick={() => { saveFeedback({ userId: auth.user?.id ?? null, kind:'ai', module, rating:'incorrect-outdated', category:'explanation', comment:'' }); setFeedbackSaved(true); }} className="ml-3 font-bold text-warning">Incorrect / outdated</button>{feedbackSaved && <span className="ml-2 text-success">Saved</span>}</div>}
      <div className="mt-3 flex flex-col gap-2 rounded-xl border border-line bg-canvas p-3 text-[9px] leading-4 text-secondary"><p>Finance Intelligence mode uses authorized workspace data for professional analysis. It does not provide investment, tax, legal, lending approval, refinancing or guaranteed-savings advice.</p><a href="/workspace/learning" className="inline-flex items-center gap-1 font-black text-interactive">Learn about this in Learning Workspace <ExternalLink className="h-3 w-3" /></a></div>
    </aside></div>}
  </>;
};
