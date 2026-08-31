import React, { useMemo, useState } from 'react';
import { ArrowRight, BrainCircuit, Calculator, CircleAlert, Gauge, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { DecisionReplayChanges, DecisionReplayHorizon, DecisionReplayResponse, runDecisionReplay } from '../../services/decisionReplayApi';
import { StructuredFinancialAnswerView } from '../ai/StructuredFinancialAnswer';

const ZERO_CHANGES: DecisionReplayChanges = {
  monthlyIncomeDelta: 0,
  expenseReductionPercent: 0,
  additionalMonthlyExpense: 0,
  newMonthlyEmi: 0,
  savingsTargetDelta: 0,
};

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 'Not available';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function signedMoney(value: number) {
  const formatted = money(Math.abs(value));
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatted}`;
}

const inputClass = 'w-full rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-xs text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/15';

export const DecisionReplayView: React.FC = () => {
  const auth = useAuth();
  const [horizonMonths, setHorizonMonths] = useState<DecisionReplayHorizon>(6);
  const [changes, setChanges] = useState<DecisionReplayChanges>(ZERO_CHANGES);
  const [response, setResponse] = useState<DecisionReplayResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = useMemo(() => Object.values(changes).some((value) => value !== 0), [changes]);

  if (!auth.session || !auth.user) {
    return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-sm"><ShieldCheck className="mx-auto h-9 w-9 text-brand" /><h1 className="mt-4 text-2xl font-black text-ink">Decision Replay is private</h1><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-secondary">Sign in to run counterfactual scenarios against your own recorded finance workspace.</p></div></div>;
  }

  const setNumber = (key: keyof DecisionReplayChanges, raw: string) => {
    const value = Number(raw);
    setChanges((current) => ({ ...current, [key]: Number.isFinite(value) ? value : 0 }));
  };

  const run = async (explain: boolean) => {
    setError(null);
    explain ? setExplaining(true) : setLoading(true);
    try {
      const result = await runDecisionReplay({ token: auth.session!.access_token, horizonMonths, changes, explain });
      setResponse(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Decision Replay could not run.');
    } finally {
      setLoading(false);
      setExplaining(false);
    }
  };

  const preset = (next: Partial<DecisionReplayChanges>) => {
    setChanges({ ...ZERO_CHANGES, ...next });
    setResponse(null);
    setError(null);
  };

  const replay = response?.replay;

  return <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-7 sm:px-6">
    <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]">
        <div className="p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-interactive/20 bg-interactive-soft px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-interactive"><Sparkles className="h-3.5 w-3.5" /> Signed-in experimental feature</div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">ArthaMind Decision Replay</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">Change one or more monthly assumptions and replay the impact against your actual recorded income, expenses, budget and EMI commitments—without changing a single saved record.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[10px] text-secondary"><span className="rounded-full border border-line bg-canvas px-3 py-1.5">Deterministic Decimal.js math</span><span className="rounded-full border border-line bg-canvas px-3 py-1.5">Private Supabase workspace</span><span className="rounded-full border border-line bg-canvas px-3 py-1.5">Optional ArthaMind explanation</span></div>
        </div>
        <div className="border-t border-line bg-canvas p-6 lg:border-l lg:border-t-0 sm:p-8"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" /><div><h2 className="text-sm font-black text-ink">Counterfactual, not predictive</h2><p className="mt-1 text-xs leading-5 text-secondary">Decision Replay holds your selected changes constant. It does not predict markets, salary growth, inflation, taxes, lender decisions or unexpected expenses.</p></div></div><div className="mt-5 rounded-2xl border border-line bg-surface p-4 text-[10px] leading-5 text-secondary"><strong className="text-ink">Nothing is saved automatically.</strong> This workspace is a temporary scenario sandbox until you explicitly update a real finance module yourself.</div></div>
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-brand">Scenario controls</div><h2 className="mt-1 text-lg font-black text-ink">What do you want to replay?</h2></div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => preset({ expenseReductionPercent: 10 })} className="rounded-xl border border-line bg-canvas px-3 py-2 text-[10px] font-bold text-ink hover:border-interactive/40">Reduce spending 10%</button>
          <button type="button" onClick={() => preset({ monthlyIncomeDelta: 5000 })} className="rounded-xl border border-line bg-canvas px-3 py-2 text-[10px] font-bold text-ink hover:border-interactive/40">Add ₹5,000 income</button>
          <button type="button" onClick={() => preset({ newMonthlyEmi: 8000 })} className="rounded-xl border border-line bg-canvas px-3 py-2 text-[10px] font-bold text-ink hover:border-interactive/40">Stress-test ₹8,000 EMI</button>
          <button type="button" onClick={() => { setChanges(ZERO_CHANGES); setResponse(null); setError(null); }} className="inline-flex items-center gap-1 rounded-xl border border-line bg-canvas px-3 py-2 text-[10px] font-bold text-secondary"><RotateCcw className="h-3 w-3" /> Reset</button>
        </div>

        <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-secondary">Replay horizon</span><select value={horizonMonths} onChange={(event) => setHorizonMonths(Number(event.target.value) as DecisionReplayHorizon)} className={inputClass}><option value={1}>1 month</option><option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option></select></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Monthly income change (₹)"><input type="number" step="500" className={inputClass} value={changes.monthlyIncomeDelta} onChange={(e) => setNumber('monthlyIncomeDelta', e.target.value)} /></Field>
          <Field label="Reduce recorded spending by (%)"><input type="number" min="0" max="100" step="1" className={inputClass} value={changes.expenseReductionPercent} onChange={(e) => setNumber('expenseReductionPercent', e.target.value)} /></Field>
          <Field label="Additional monthly expense (₹)"><input type="number" min="0" step="500" className={inputClass} value={changes.additionalMonthlyExpense} onChange={(e) => setNumber('additionalMonthlyExpense', e.target.value)} /></Field>
          <Field label="New monthly EMI / commitment (₹)"><input type="number" min="0" step="500" className={inputClass} value={changes.newMonthlyEmi} onChange={(e) => setNumber('newMonthlyEmi', e.target.value)} /></Field>
          <Field label="Savings-target change (₹)"><input type="number" step="500" className={inputClass} value={changes.savingsTargetDelta} onChange={(e) => setNumber('savingsTargetDelta', e.target.value)} /></Field>
        </div>
        <button type="button" disabled={loading} onClick={() => void run(false)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-white transition hover:bg-brand-hover disabled:opacity-50"><Calculator className="h-4 w-4" /> {loading ? 'Replaying…' : 'Run deterministic replay'}</button>
        {!changed && <p className="text-center text-[9px] leading-4 text-secondary">A zero-change replay is valid and shows your current recorded baseline.</p>}
      </div>

      <div className="space-y-4">
        {!replay ? <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-line-strong bg-surface p-8 text-center"><div><Gauge className="mx-auto h-9 w-9 text-interactive" /><h2 className="mt-4 text-lg font-black text-ink">Run a replay to see the delta</h2><p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-secondary">ArthaMind will read your authenticated workspace server-side, calculate a baseline, then compare your scenario without writing anything back.</p></div></div> : <>
          <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-interactive">Replay result</div><h2 className="mt-1 text-xl font-black text-ink">Recorded baseline vs scenario</h2></div><span className={`rounded-full border px-3 py-1 text-[10px] font-black ${replay.dataBasis.completeness === 'High' ? 'border-success-fill/25 bg-success-soft text-success' : replay.dataBasis.completeness === 'Medium' ? 'border-warning-fill/25 bg-warning-soft text-warning' : 'border-danger/25 bg-danger-soft text-danger'}`}>Data completeness: {replay.dataBasis.completeness}</span></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Baseline cash flow" value={money(replay.baseline.recordedNetCashFlow)} /><Metric label="Scenario cash flow" value={money(replay.scenario.projectedMonthlyCashFlowAfterNewCommitment)} /><Metric label="Monthly change" value={signedMoney(replay.impact.monthlyCashFlowChange)} emphasis={replay.impact.monthlyCashFlowChange >= 0 ? 'positive' : 'negative'} /><Metric label={`${replay.horizonMonths}-month change`} value={signedMoney(replay.impact.horizonCashFlowChange)} emphasis={replay.impact.horizonCashFlowChange >= 0 ? 'positive' : 'negative'} /></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2"><Comparison title="Recorded baseline" rows={[["Monthly income", money(replay.baseline.monthlyIncome)],["Recorded expenses", money(replay.baseline.recordedMonthlyExpenses)],["Active EMI commitment", money(replay.baseline.activeMonthlyEmiCommitment)],["EMI commitment ratio", replay.baseline.emiCommitmentRatioPercent == null ? 'Not available' : `${replay.baseline.emiCommitmentRatioPercent}%`],["Budget headroom", money(replay.baseline.budgetHeadroom)],["Savings target", money(replay.baseline.savingsTarget)]]} /><Comparison title="Scenario" rows={[["Monthly income", money(replay.scenario.monthlyIncome)],["Monthly expenses", money(replay.scenario.monthlyExpenses)],["Active + new EMI", money(replay.scenario.activePlusNewMonthlyEmi)],["EMI commitment ratio", replay.scenario.emiCommitmentRatioPercent == null ? 'Not available' : `${replay.scenario.emiCommitmentRatioPercent}%`],["Budget headroom", money(replay.scenario.budgetHeadroom)],["Savings target", money(replay.scenario.savingsTarget)]]} /></div>
          </section>

          <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-brand">ArthaMind explanation</div><h2 className="mt-1 text-lg font-black text-ink">Explain the replay without changing the math</h2><p className="mt-1 text-xs text-secondary">The AI receives the deterministic replay output, not permission to invent extra account facts.</p></div><button type="button" disabled={explaining} onClick={() => void run(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-interactive/30 bg-interactive-soft px-4 py-2.5 text-xs font-black text-interactive disabled:opacity-50"><BrainCircuit className="h-4 w-4" />{explaining ? 'Explaining…' : 'Explain with ArthaMind'}</button></div>{response?.structuredAnswer && <div className="mt-5"><StructuredFinancialAnswerView answer={response.structuredAnswer} /></div>}</section>

          <section className="rounded-3xl border border-line bg-canvas p-5"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><div><div className="text-xs font-black text-ink">Assumptions and data basis</div><ul className="mt-2 space-y-1 text-[10px] leading-5 text-secondary">{replay.assumptions.map((item) => <li key={item}>• {item}</li>)}</ul><div className="mt-3 flex flex-wrap gap-2 text-[9px] text-secondary"><span className="rounded-full border border-line bg-surface px-2.5 py-1">Income sources: {replay.dataBasis.recurringIncomeSources}</span><span className="rounded-full border border-line bg-surface px-2.5 py-1">Expense records: {replay.dataBasis.currentMonthExpenseRecords}</span><span className="rounded-full border border-line bg-surface px-2.5 py-1">Budget categories: {replay.dataBasis.budgetCategories}</span><span className="rounded-full border border-line bg-surface px-2.5 py-1">Active EMIs: {replay.dataBasis.activeEmis}</span></div></div></div></section>
        </>}
        {error && <div role="alert" className="rounded-2xl border border-danger/25 bg-danger-soft p-4 text-xs leading-5 text-danger">{error}</div>}
      </div>
    </section>
  </div>;
};

const Field: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-secondary">{label}</span>{children}</label>;
const Metric: React.FC<{ label: string; value: string; emphasis?: 'positive' | 'negative' }> = ({ label, value, emphasis }) => <div className="rounded-2xl border border-line bg-canvas p-4"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">{label}</div><div className={`mt-2 text-lg font-black ${emphasis === 'positive' ? 'text-success' : emphasis === 'negative' ? 'text-danger' : 'text-ink'}`}>{value}</div></div>;
const Comparison: React.FC<{ title: string; rows: Array<[string, string]> }> = ({ title, rows }) => <div className="rounded-2xl border border-line bg-canvas p-4"><h3 className="text-xs font-black text-ink">{title}</h3><div className="mt-3 divide-y divide-line">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 py-2 text-[10px]"><span className="text-secondary">{label}</span><span className="text-right font-black text-ink">{value}</span></div>)}</div></div>;
