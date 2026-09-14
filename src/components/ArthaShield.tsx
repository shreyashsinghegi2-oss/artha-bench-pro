import React, { useEffect, useState } from 'react';
import { AlertTriangle, BadgeCheck, CheckCircle2, ChevronDown, Database, EyeOff, LockKeyhole, RefreshCw, Shield, Trash2, WalletCards, X } from 'lucide-react';
import { loadAiDataContext } from '../services/aiDataContext';
import {
  loadEmergencyMoneyPlan,
  loadShieldPreferences,
  redactSecrets,
  runSafetyReview,
  saveEmergencyMoneyPlan,
  setPrivateSession,
  setVerifyTutorCalculations,
  type FreshnessRecord,
  type ProviderHealthRecord,
  type SafetyReview,
  type EmergencyMoneyPlan,
} from '../services/arthaShield';

interface ArthaShieldProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (destination: any) => void;
}

type ShieldTab = 'privacy' | 'readiness' | 'aiTrust' | 'dataQuality';

const TAB_DEFINITIONS: Array<{ id: ShieldTab; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'privacy', label: 'Privacy Guard', Icon: LockKeyhole },
  { id: 'readiness', label: 'Financial Readiness', Icon: WalletCards },
  { id: 'aiTrust', label: 'AI Trust Guard', Icon: BadgeCheck },
  { id: 'dataQuality', label: 'Data Quality Guard', Icon: Database },
];

const CONTEXT_FIELDS: Array<{ key: keyof ReturnType<typeof loadAiDataContext>; label: string }> = [
  { key: 'income', label: 'Income' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'emis', label: 'EMIs' },
  { key: 'goals', label: 'Goals' },
  { key: 'paperPortfolio', label: 'Paper portfolio' },
  { key: 'learningProgress', label: 'Learning progress' },
];

const emptyPlan: EmergencyMoneyPlan = {
  essentialExpenses: null,
  targetCashBuffer: null,
  savingsGoal: null,
  importantCommitments: [],
  nextActions: [],
};

export const ArthaShield: React.FC<ArthaShieldProps> = ({ open, onClose, onNavigate }) => {
  const [tab, setTab] = useState<ShieldTab>('privacy');
  const [review, setReview] = useState<SafetyReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [secretInput, setSecretInput] = useState('');
  const [secretResult, setSecretResult] = useState<{ safe: boolean; text: string; findings: string[] } | null>(null);
  const [context, setContext] = useState(loadAiDataContext());
  const [preferences, setPreferences] = useState(loadShieldPreferences());
  const [plan, setPlan] = useState<EmergencyMoneyPlan>(loadEmergencyMoneyPlan() || emptyPlan);
  const [expanded, setExpanded] = useState<string | null>(null);

  const runReview = () => {
    setBusy(true);
    setStatus('');
    window.setTimeout(() => {
      const providerHealth: ProviderHealthRecord[] = [];
      const freshness: FreshnessRecord[] = [];
      const currentContext = loadAiDataContext();
      const nextReview = runSafetyReview({
        providerHealth,
        freshness,
        evaluationCompleted: false,
        recordedExpenses: null,
        recurringCommitments: null,
        emiRecords: null,
        budgetCategories: currentContext.budgets ? 1 : 0,
        emergencyTarget: plan.targetCashBuffer,
        goalCoverage: null,
      });
      setReview(nextReview);
      setContext(currentContext);
      setPreferences(loadShieldPreferences());
      setBusy(false);
      setStatus('Safety review completed using the checks currently available to this build.');
    }, 220);
  };

  useEffect(() => {
    if (!open) return;
    setTab('privacy');
    setContext(loadAiDataContext());
    setPreferences(loadShieldPreferences());
    setPlan(loadEmergencyMoneyPlan() || emptyPlan);
    setReview(null);
    setExpanded(null);
    runReview();
  }, [open]);

  if (!open) return null;

  const updateContext = (key: keyof ReturnType<typeof loadAiDataContext>) => {
    const nextValue = !context[key];
    const next = { ...context, [key]: nextValue };
    localStorage.setItem('arthabench_ai_context_v1', JSON.stringify(next));
    setContext(next);
  };

  const topRisks = review?.topRisks ?? [];

  const openRisk = (risk: string) => {
    if (risk === 'Financial readiness data') setTab('readiness');
    else if (risk === 'AI provider health' || risk === 'Completed evaluation evidence') setTab('aiTrust');
    else if (risk === 'Market/data freshness') setTab('dataQuality');
    else setTab('privacy');
  };

  return (
    <div className="fixed inset-0 z-[125] overflow-y-auto bg-slate-950 text-white" role="dialog" aria-modal="true" aria-label="ArthaShield Financial Safety Centre">
      <div className="mx-auto min-h-screen max-w-[1500px] px-4 py-5 sm:px-7 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300"><Shield className="h-6 w-6" /></div>
            <div>
              <div className="text-lg font-black">🛡️ ArthaShield</div>
              <div className="text-xs text-slate-300">Financial Safety Centre · privacy-first review</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800" aria-label="Close ArthaShield"><X className="mr-1 inline h-4 w-4" />Close</button>
        </header>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[.16em] text-emerald-300">Safety review</div>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">Review privacy, readiness, AI trust, and data quality.</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">ArthaShield reports only what its connected checks can actually establish. It does not control banks, lenders, payments, investments, insurance claims, or fraud systems.</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Safety score</div>
              <div className="mt-1 text-3xl font-black text-emerald-300">{review ? `${review.score ?? 'Data needed'}/100` : 'Data needed'}</div>
              <div className="text-[10px] text-slate-400">Computed from completed checks only</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {TAB_DEFINITIONS.map(({ id, label, Icon }) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${tab === id ? 'bg-emerald-400 text-slate-950' : 'border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'}`} aria-pressed={tab === id}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
        </section>

        {busy && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-live="polite">
            {['Reviewing access permissions', 'Checking stored data', 'Validating AI and data trust'].map((label) => (
              <div key={label} className="h-24 animate-pulse rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="h-3 w-2/3 rounded bg-slate-800" /><div className="mt-4 h-2 w-full rounded bg-slate-800" /><div className="mt-2 h-2 w-4/5 rounded bg-slate-800" /><span className="sr-only">{label}</span></div>
            ))}
          </div>
        )}

        {!busy && (
          <>
            {status && <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200" role="status">{status}</div>}
            <main className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                {tab === 'privacy' && (
                  <>
                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <h2 className="text-sm font-black">Personal AI data context</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-300">These switches reflect the central AI consent state. Revoking a category removes it from the enabled context.</p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {CONTEXT_FIELDS.map(({ key, label }) => (
                          <button key={String(key)} type="button" onClick={() => updateContext(key)} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs font-bold text-slate-200"><span>{label}</span><span className={context[key] ? 'text-emerald-300' : 'text-slate-500'}>{context[key] ? 'Enabled' : 'Disabled'}</span></button>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <h2 className="text-sm font-black">Private session</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-300">This toggle records a session preference. Chat components must honor it before writing current-session chat to local storage.</p>
                      <button type="button" onClick={() => { const next = !preferences.privateSession; setPrivateSession(next); setPreferences({ ...preferences, privateSession: next }); }} className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs font-bold text-slate-200"><span>Private session</span><span className="text-emerald-300">{preferences.privateSession ? 'On' : 'Off'}</span></button>
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <h2 className="text-sm font-black">Secret safety check</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-300">Scan text locally before sending it to an external model. Supported OTPs, API keys, private keys, card numbers, passwords, and bank credentials are redacted.</p>
                      <textarea value={secretInput} onChange={(event) => setSecretInput(event.target.value)} className="mt-4 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-emerald-400" placeholder="Paste the text you are about to send…" />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setSecretResult(redactSecrets(secretInput))} className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950">Scan before sending</button>
                        {secretResult && <span className={`rounded-xl px-3 py-2 text-xs font-bold ${secretResult.safe ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300'}`}>{secretResult.safe ? 'No supported secret pattern detected' : `Blocked/redacted: ${secretResult.findings.join(', ')}`}</span>}
                      </div>
                      {secretResult && !secretResult.safe && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs text-slate-300">{secretResult.text}</pre>}
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <h2 className="text-sm font-black">Local privacy controls</h2>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => { localStorage.removeItem('arthabench_ai_context_usage_v1'); setStatus('AI context usage log cleared.'); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200"><EyeOff className="h-4 w-4" />Clear usage log</button>
                        <button type="button" onClick={() => { for (const key of Object.keys(localStorage)) if (/chat|conversation|ai.*history|history.*ai/i.test(key)) localStorage.removeItem(key); setStatus('Local AI chat-history keys cleared where supported.'); }} className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 px-3 py-2 text-xs font-bold text-red-300"><Trash2 className="h-4 w-4" />Clear local AI history</button>
                      </div>
                    </section>
                  </>
                )}

                {tab === 'readiness' && (
                  <>
                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <h2 className="text-sm font-black">Emergency Money Plan</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-300">No emergency-fund readiness ratio is claimed unless the required inputs exist.</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-bold text-slate-300">Essential monthly expenses<input type="number" value={plan.essentialExpenses ?? ''} onChange={(event) => setPlan({ ...plan, essentialExpenses: event.target.value === '' ? null : Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
                        <label className="text-xs font-bold text-slate-300">Target cash buffer<input type="number" value={plan.targetCashBuffer ?? ''} onChange={(event) => setPlan({ ...plan, targetCashBuffer: event.target.value === '' ? null : Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
                        <label className="text-xs font-bold text-slate-300">Savings goal<input type="number" value={plan.savingsGoal ?? ''} onChange={(event) => setPlan({ ...plan, savingsGoal: event.target.value === '' ? null : Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
                        <label className="text-xs font-bold text-slate-300">Important commitments<input value={plan.importantCommitments.join(', ')} onChange={(event) => setPlan({ ...plan, importantCommitments: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
                      </div>
                      <button type="button" onClick={() => { saveEmergencyMoneyPlan(plan); setStatus('Emergency Money Plan saved.'); }} className="mt-4 rounded-xl bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950">Save plan</button>
                    </section>
                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <h2 className="text-sm font-black">Readiness review</h2>
                      <div className="mt-4 space-y-2 text-xs">
                        {[['Expenses', context.expenses], ['Recurring commitments', false], ['EMI/debt records', context.emis], ['Budget categories', context.budgets], ['Emergency target', plan.targetCashBuffer !== null], ['Goals', context.goals]].map(([label, available]) => <div key={String(label)} className="flex justify-between rounded-xl bg-slate-950 px-3 py-2"><span>{String(label)}</span><b className={available ? 'text-emerald-300' : 'text-amber-300'}>{available ? 'Available' : 'Data needed'}</b></div>)}
                      </div>
                    </section>
                  </>
                )}

                {tab === 'aiTrust' && (
                  <>
                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <h2 className="text-sm font-black">Calculation verification</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-300">Tutor calculations should not be called verified unless applicable deterministic checks actually pass.</p>
                      <button type="button" onClick={() => { const next = !preferences.verifyTutorCalculations; setVerifyTutorCalculations(next); setPreferences({ ...preferences, verifyTutorCalculations: next }); }} className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs font-bold text-slate-200"><span>Always verify calculations in tutor responses</span><span className="text-emerald-300">{preferences.verifyTutorCalculations ? 'On' : 'Off'}</span></button>
                    </section>
                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h2 className="text-sm font-black">ArthaProof Decision Receipt</h2><p className="mt-2 text-xs leading-5 text-slate-300">Open the existing Evaluation Lab for actual verification evidence. ArthaShield does not manufacture a verified badge.</p><button type="button" onClick={() => onNavigate('evaluation-lab')} className="mt-4 rounded-xl bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950">Open Evaluation Lab</button></section>
                  </>
                )}

                {tab === 'dataQuality' && (
                  <>
                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h2 className="text-sm font-black">Data freshness</h2><p className="mt-2 text-xs leading-5 text-slate-300">Only actual source records should populate freshness. Unknown status is never promoted to Live.</p><div className="mt-4 rounded-xl bg-slate-950 p-3 text-xs text-slate-300">Expected states: Live, Delayed, End-of-day, Cached, Unavailable, Illustrative.</div></section>
                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h2 className="text-sm font-black">Provider health</h2><p className="mt-2 text-xs leading-5 text-slate-300">No provider is marked healthy by default. This build currently shows unknown until a server-side diagnostics result is connected.</p><button type="button" onClick={runReview} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200"><RefreshCw className="h-4 w-4" />Run review again</button></section>
                  </>
                )}
              </div>

              <aside className="space-y-4">
                <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                  <div className="text-xs font-black text-slate-200">Top 3 risks</div>
                  {topRisks.length ? <div className="mt-3 space-y-2">{topRisks.map((risk) => <button key={risk} type="button" onClick={() => openRisk(risk)} className="flex w-full items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-left text-xs font-bold text-amber-200"><AlertTriangle className="h-4 w-4 shrink-0" />{risk}</button>)}</div> : <div className="mt-3 text-xs text-slate-400">Run a completed review to identify actionable risks.</div>}
                  <button type="button" onClick={() => { if (topRisks[0]) { openRisk(topRisks[0]); setStatus(`Opening the first computed improvement: ${topRisks[0]}`); } else { setStatus('No computed risk is available yet.'); } }} className="mt-4 w-full rounded-xl bg-emerald-400 px-3 py-2.5 text-xs font-black text-slate-950">Fix My Top 3 Risks</button>
                </section>

                <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                  <div className="text-xs font-black text-slate-200">Review details</div>
                  {review?.checks.map((check) => <button key={check.id} type="button" onClick={() => setExpanded(expanded === check.id ? null : check.id)} className="mt-2 block w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-left"><div className="flex items-center justify-between text-xs font-bold"><span>{check.title}</span><span className={check.status === 'ready' ? 'text-emerald-300' : check.status === 'critical' ? 'text-red-300' : 'text-amber-300'}>{check.status}</span></div>{expanded === check.id && <div className="mt-2 text-[10px] leading-5 text-slate-400"><div>{check.explanation}</div><div className="mt-1">Inputs: {check.inputs.length ? check.inputs.join(', ') : 'None recorded'}</div>{check.action && <div className="mt-1 font-bold text-emerald-300">Action: {check.action}</div>}</div>}<ChevronDown className={`mt-1 h-3 w-3 text-slate-500 ${expanded === check.id ? 'rotate-180' : ''}`} /></button>)}
                </section>
              </aside>
            </main>
          </>
        )}

        <footer className="mt-6 pb-8 text-[11px] leading-5 text-slate-400">ArthaShield is a review and readiness layer. It does not control bank accounts, payments, lenders, investments, insurance claims, fraud systems, or debt-relief decisions.</footer>
      </div>
    </div>
  );
};
