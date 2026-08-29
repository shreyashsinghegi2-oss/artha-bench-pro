import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, ChartNoAxesCombined, CheckCircle2, FlaskConical, ReceiptText, ShieldCheck, WalletCards, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { AppNavigationDestination } from '../../navigationTypes';
import { loadAiDataContext, saveAiDataContext } from '../../services/aiDataContext';

type Props = { onNavigate: (destination: AppNavigationDestination) => void };
type Intent = 'spending' | 'income-budget' | 'emi' | 'learning' | 'markets' | 'evaluation';

type ContextKey = 'income' | 'expenses' | 'budgets' | 'emis';
const intents: Array<{ id: Intent; title: string; icon: React.ComponentType<{ className?: string }>; destination: AppNavigationDestination }> = [
  { id: 'spending', title: 'Understand my spending', icon: ReceiptText, destination: 'expenses' },
  { id: 'income-budget', title: 'Set up income and budgets', icon: WalletCards, destination: 'income' },
  { id: 'emi', title: 'Track EMIs and commitments', icon: CheckCircle2, destination: 'emi-manager' },
  { id: 'learning', title: 'Learn finance basics', icon: BookOpen, destination: 'learning' },
  { id: 'markets', title: 'Explore markets', icon: ChartNoAxesCombined, destination: 'markets' },
  { id: 'evaluation', title: 'Test a financial AI answer', icon: FlaskConical, destination: 'evaluation-lab' },
];
const goals = ['Build a monthly money routine', 'Understand an investment concept', 'Compare financial AI answers', 'Track expenses and budgets', 'Plan EMI commitments', 'Learn about markets'];

export const FirstTimeOnboardingGate: React.FC<Props> = ({ onNavigate }) => {
  const auth = useAuth();
  const [step, setStep] = useState(1);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [goal, setGoal] = useState('');
  const [privacyMode, setPrivacyMode] = useState<'public' | 'selected'>('public');
  const [contexts, setContexts] = useState<Record<ContextKey, boolean>>({ income: false, expenses: false, budgets: false, emis: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (auth.authOpen && auth.authScreen === 'onboarding') auth.closeAuth();
  }, [auth.authOpen, auth.authScreen]);

  const chosen = useMemo(() => intents.find((item) => item.id === intent) ?? null, [intent]);
  if (!auth.user || !auth.profile || auth.profile.onboarding_completed) return null;

  const finish = async (destination?: AppNavigationDestination) => {
    if (busy) return;
    setBusy(true);
    try {
      const existing = loadAiDataContext();
      const selected = privacyMode === 'selected';
      saveAiDataContext({
        ...existing,
        income: selected && contexts.income,
        expenses: selected && contexts.expenses,
        budgets: selected && contexts.budgets,
        emis: selected && contexts.emis,
        personalFinance: selected && (contexts.income || contexts.expenses || contexts.emis),
        budgetsAndGoals: selected && contexts.budgets,
      });
      await auth.saveProfile({
        primary_goal: intent ?? 'all',
        financial_goal: goal || auth.profile.financial_goal || null,
        personal_data_insights_enabled: selected,
        onboarding_completed: true,
      });
      onNavigate(destination ?? chosen?.destination ?? 'overview');
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
    <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-line bg-surface p-5 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[0.15em] text-brand">ArthaMind AI × Artha Bench Pro</div><h2 id="onboarding-title" className="mt-2 text-2xl font-black text-ink">{step === 1 ? 'What would you like help with first?' : step === 2 ? 'Choose a goal' : step === 3 ? 'Choose your privacy level' : 'Start with one focused action'}</h2><p className="mt-2 text-xs leading-5 text-secondary">Step {step} of 4 · You can change these choices later. No bank password, PAN, Aadhaar, UPI PIN or card credential is requested.</p></div><button type="button" onClick={() => void finish('overview')} className="rounded-xl p-2 text-secondary hover:bg-subtle" aria-label="Skip onboarding"><X className="h-4 w-4" /></button></div>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-subtle"><div className="h-full bg-brand transition-[width] duration-200" style={{ width: `${step * 25}%` }} /></div>

      {step === 1 && <div className="mt-6 grid gap-3 sm:grid-cols-2">{intents.map(({ id, title, icon: Icon }) => <button key={id} type="button" onClick={() => setIntent(id)} aria-pressed={intent === id} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${intent === id ? 'border-brand bg-brand-soft' : 'border-line bg-canvas hover:border-brand/30'}`}><Icon className="h-5 w-5 text-brand" /><span className="text-sm font-black text-ink">{title}</span></button>)}</div>}
      {step === 2 && <div className="mt-6 grid gap-2">{goals.map((item) => <button type="button" key={item} onClick={() => setGoal(item)} aria-pressed={goal === item} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${goal === item ? 'border-interactive bg-interactive-soft text-interactive' : 'border-line bg-canvas text-ink'}`}>{item}</button>)}</div>}
      {step === 3 && <div className="mt-6 space-y-3"><button type="button" onClick={() => setPrivacyMode('public')} className={`w-full rounded-2xl border p-4 text-left ${privacyMode === 'public' ? 'border-brand bg-brand-soft' : 'border-line bg-canvas'}`}><div className="flex items-center gap-2 font-black text-ink"><ShieldCheck className="h-5 w-5 text-brand" />Use public information only <span className="rounded-full bg-surface px-2 py-0.5 text-[9px] text-secondary">Default</span></div><p className="mt-1 text-xs text-secondary">ArthaMind will not use your personal finance records.</p></button><button type="button" onClick={() => setPrivacyMode('selected')} className={`w-full rounded-2xl border p-4 text-left ${privacyMode === 'selected' ? 'border-brand bg-brand-soft' : 'border-line bg-canvas'}`}><div className="font-black text-ink">Use selected personal finance context</div><p className="mt-1 text-xs text-secondary">Personal context is optional. You choose the categories ArthaMind can use, and can change this anytime.</p></button>{privacyMode === 'selected' && <div className="grid gap-2 rounded-2xl border border-line bg-canvas p-4 sm:grid-cols-2">{([['income','Income'],['expenses','Expenses'],['budgets','Budgets'],['emis','EMIs']] as Array<[ContextKey,string]>).map(([key,label]) => <label key={key} className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink"><span>{label}</span><input type="checkbox" checked={contexts[key]} onChange={(e) => setContexts({ ...contexts, [key]: e.target.checked })} /></label>)}</div>}</div>}
      {step === 4 && <div className="mt-6 rounded-3xl border border-line bg-canvas p-6 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"><ArrowRight className="h-6 w-6" /></div><h3 className="mt-4 text-lg font-black text-ink">{chosen?.title ?? 'Open your Financial Workspace'}</h3><p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-secondary">Start with one useful action. You can explore the rest of Artha Bench Pro from the workspace navigation at any time.</p><button type="button" disabled={busy} onClick={() => void finish()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-white disabled:opacity-50">Continue <ArrowRight className="h-4 w-4" /></button></div>}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4"><button type="button" disabled={step === 1 || busy} onClick={() => setStep((value) => Math.max(1, value - 1))} className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-secondary disabled:opacity-40">Back</button><div className="flex gap-2">{step < 4 && <button type="button" onClick={() => setStep((value) => Math.min(4, value + 1))} className="rounded-xl px-4 py-2 text-xs font-bold text-secondary">Skip optional</button>}{step < 4 && <button type="button" onClick={() => setStep((value) => Math.min(4, value + 1))} className="rounded-xl bg-brand px-4 py-2 text-xs font-black text-white">Next</button>}</div></div>
    </div>
  </div>;
};
