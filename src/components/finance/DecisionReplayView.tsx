import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BrainCircuit, Calculator, ChevronDown, CircleAlert, Database, Gauge, Info, ListChecks, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { pathForDestination } from '../../appRoutes';
import { DecisionReplayChanges, DecisionReplayHorizon, DecisionReplayResponse, runDecisionReplay } from '../../services/decisionReplayApi';
import { consumeEmiReplayIntent } from '../../services/emiIntelligence';
import { StructuredFinancialAnswerView } from '../ai/StructuredFinancialAnswer';

const ZERO_CHANGES: DecisionReplayChanges = {
  monthlyIncomeDelta: 0,
  expenseReductionPercent: 0,
  additionalMonthlyExpense: 0,
  newMonthlyEmi: 0,
  savingsTargetDelta: 0,
};

const inputClass = 'w-full rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-xs text-ink outline-none transition focus:border-interactive focus:ring-2 focus:ring-interactive/15';

type ValidationState = Partial<Record<keyof DecisionReplayChanges, string>>;

type Tone = 'positive' | 'neutral' | 'caution';

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 'Not available';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function signedMoney(value: number) {
  const formatted = money(Math.abs(value));
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatted}`;
}

function scenarioLines(changes: DecisionReplayChanges): string[] {
  const lines: string[] = [];
  if (changes.monthlyIncomeDelta > 0) lines.push(`Monthly income increases by ${money(changes.monthlyIncomeDelta)}`);
  if (changes.monthlyIncomeDelta < 0) lines.push(`Monthly income decreases by ${money(Math.abs(changes.monthlyIncomeDelta))}`);
  if (changes.expenseReductionPercent > 0) lines.push(`Recorded spending decreases by ${changes.expenseReductionPercent}%`);
  if (changes.additionalMonthlyExpense > 0) lines.push(`Additional monthly expense increases by ${money(changes.additionalMonthlyExpense)}`);
  if (changes.additionalMonthlyExpense < 0) lines.push(`Additional monthly expense decreases by ${money(Math.abs(changes.additionalMonthlyExpense))}`);
  if (changes.newMonthlyEmi > 0) lines.push(`A new monthly EMI / commitment of ${money(changes.newMonthlyEmi)} is added`);
  if (changes.newMonthlyEmi < 0) lines.push(`Monthly EMI / commitment changes by ${signedMoney(changes.newMonthlyEmi)}`);
  if (changes.savingsTargetDelta > 0) lines.push(`Savings target increases by ${money(changes.savingsTargetDelta)} per month`);
  if (changes.savingsTargetDelta < 0) lines.push(`Savings target decreases by ${money(Math.abs(changes.savingsTargetDelta))} per month`);
  return lines;
}

function sameChanges(a: DecisionReplayChanges, b: DecisionReplayChanges) {
  return a.monthlyIncomeDelta === b.monthlyIncomeDelta
    && a.expenseReductionPercent === b.expenseReductionPercent
    && a.additionalMonthlyExpense === b.additionalMonthlyExpense
    && a.newMonthlyEmi === b.newMonthlyEmi
    && a.savingsTargetDelta === b.savingsTargetDelta;
}

function impactTone(value: number): Tone {
  if (value > 0) return 'positive';
  if (value < 0) return 'caution';
  return 'neutral';
}

function impactLabel(value: number) {
  if (value > 0) return 'Higher calculated monthly surplus';
  if (value < 0) return 'Lower calculated monthly surplus';
  return 'No material change from baseline';
}

export const DecisionReplayView: React.FC = () => {
  const auth = useAuth();
  const [horizonMonths, setHorizonMonths] = useState<DecisionReplayHorizon>(6);
  const [changes, setChanges] = useState<DecisionReplayChanges>(ZERO_CHANGES);
  const [response, setResponse] = useState<DecisionReplayResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationState>({});
  const [announcement, setAnnouncement] = useState('');
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);

  const changed = useMemo(() => Object.values(changes).some((value) => value !== 0), [changes]);
  const summaryLines = useMemo(() => scenarioLines(changes), [changes]);

  useEffect(() => {
    const intent = consumeEmiReplayIntent();
    if (!intent) return;
    setHorizonMonths(intent.horizonMonths);
    setChanges(intent.changes);
    setResponse(null);
    setError(null);
    setValidation({});
    setHandoffNotice(`${intent.label} has been loaded as temporary scenario inputs. Review the assumptions below, then run the deterministic replay when you are ready.`);
    setAnnouncement('Temporary EMI scenario inputs loaded. No EMI record or saved finance data was changed.');
  }, []);

  useEffect(() => {
    if (!response?.replay) return;
    setAnnouncement(`Decision Replay results loaded for ${response.replay.horizonMonths} month${response.replay.horizonMonths === 1 ? '' : 's'}. No saved finance records were changed.`);
  }, [response]);

  if (!auth.session || !auth.user) {
    return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-sm"><ShieldCheck className="mx-auto h-9 w-9 text-brand" /><h1 className="mt-4 text-2xl font-black text-ink">Decision Replay is private</h1><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-secondary">Sign in to run counterfactual scenarios against your own recorded finance workspace.</p></div></div>;
  }

  const setNumber = (key: keyof DecisionReplayChanges, raw: string) => {
    let value = Number(raw);
    if (!Number.isFinite(value)) value = 0;

    if (key === 'expenseReductionPercent' && (value < 0 || value > 100)) {
      setValidation((current) => ({ ...current, [key]: 'Enter a value between 0% and 100%.' }));
      value = Math.min(100, Math.max(0, value));
    } else {
      setValidation((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    }

    setChanges((current) => ({ ...current, [key]: value }));
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
    setValidation({});
    setHandoffNotice(null);
  };

  const reset = () => {
    setChanges(ZERO_CHANGES);
    setResponse(null);
    setError(null);
    setValidation({});
    setHandoffNotice(null);
  };

  const replay = response?.replay;
  const noEligibleData = Boolean(replay && replay.dataBasis.recurringIncomeSources === 0 && replay.dataBasis.currentMonthExpenseRecords === 0 && replay.dataBasis.budgetCategories === 0 && replay.dataBasis.activeEmis === 0);
  const resultsStale = Boolean(replay && (horizonMonths !== replay.horizonMonths || !sameChanges(changes, replay.changes)));

  return <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-7 sm:px-6">
    <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
    {handoffNotice && <div role="status" className="rounded-2xl border border-interactive/25 bg-interactive-soft p-4 text-[10px] leading-5 text-secondary"><strong className="text-ink">Temporary EMI scenario loaded.</strong> {handoffNotice} No EMI record or saved finance data has been changed.</div>}

    <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]">
        <div className="p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-interactive/20 bg-interactive-soft px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-interactive"><Sparkles className="h-3.5 w-3.5" /> Signed-in experimental feature</div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">ArthaMind Decision Replay</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">Change one or more monthly assumptions and replay the impact against your actual recorded income, expenses, budget and EMI commitments—without changing a single saved record.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[10px] text-secondary">
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-3 py-1.5">Deterministic Decimal.js math <HelpTip label="Deterministic calculation" text="The same recorded data and same inputs produce the same result every time." /></span>
            <span className="rounded-full border border-line bg-canvas px-3 py-1.5">Private Supabase workspace</span>
            <span className="rounded-full border border-line bg-canvas px-3 py-1.5">Optional ArthaMind explanation</span>
          </div>
        </div>
        <div className="border-t border-line bg-canvas p-6 lg:border-l lg:border-t-0 sm:p-8"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" /><div><h2 className="flex items-center gap-1 text-sm font-black text-ink">Counterfactual, not predictive <HelpTip label="Counterfactual" text="A ‘what-if’ scenario based on your selected assumptions. It does not predict what will actually happen." /></h2><p className="mt-1 text-xs leading-5 text-secondary">Decision Replay holds your selected changes constant. It does not predict markets, salary growth, inflation, taxes, lender decisions or unexpected expenses.</p></div></div><div className="mt-5 rounded-2xl border border-line bg-surface p-4 text-[10px] leading-5 text-secondary"><strong className="text-ink">Nothing is saved automatically.</strong> This workspace is a temporary scenario sandbox until you explicitly update a real finance module yourself.</div></div>
      </div>
    </section>

    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="decision-replay-how-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-brand">How it works</div><h2 id="decision-replay-how-title" className="mt-1 text-lg font-black text-ink">Three steps, no saved records changed</h2></div>
        <span className="rounded-full border border-interactive/20 bg-interactive-soft px-3 py-1.5 text-[10px] font-black text-interactive">Calculated scenario — not a forecast or financial advice.</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <StepCard step="1" title="Start with your recorded baseline" text="Decision Replay securely reads your saved income, expenses, budget and EMI data." tooltip="Your current finance position calculated from saved workspace records." />
        <StepCard step="2" title="Change one or more assumptions" text="Adjust monthly income, spending, expenses, EMI commitments or savings goals." />
        <StepCard step="3" title="Compare the calculated impact" text="See how the selected scenario differs from your current recorded baseline." />
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[0.86fr_1.14fr]">
      <div className="space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-brand">Scenario controls</div><h2 className="mt-1 text-lg font-black text-ink">What do you want to replay?</h2><p className="mt-1 text-[10px] leading-5 text-secondary">Temporary scenario input only — no saved records are changed.</p></div>

        <div className="grid gap-2 sm:grid-cols-2">
          <PresetButton label="Reduce spending 10%" description="Tests the effect of reducing eligible recorded spending by 10%." onClick={() => preset({ expenseReductionPercent: 10 })} />
          <PresetButton label="Add ₹5,000 income" description="Tests a ₹5,000 monthly increase to recorded income." onClick={() => preset({ monthlyIncomeDelta: 5000 })} />
          <PresetButton label="Stress-test ₹8,000 EMI" description="Tests the effect of adding an ₹8,000 recurring monthly commitment." onClick={() => preset({ newMonthlyEmi: 8000 })} />
          <button type="button" onClick={reset} title="Clears temporary scenario inputs. It does not change saved finance records." aria-label="Reset temporary scenario inputs. This does not change saved finance records." className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-line bg-canvas px-3 py-2 text-[10px] font-bold text-secondary transition hover:border-interactive/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive"><RotateCcw className="h-3 w-3" /> Reset</button>
        </div>

        <Field label="Replay horizon" helper={`The selected monthly changes are applied once per month for ${horizonMonths} month${horizonMonths === 1 ? '' : 's'}.`} tooltip="The number of months over which the selected monthly changes are applied." helperId="replay-horizon-help">
          <select value={horizonMonths} onChange={(event) => setHorizonMonths(Number(event.target.value) as DecisionReplayHorizon)} className={inputClass} aria-describedby="replay-horizon-help"><option value={1}>1 month</option><option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option></select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Monthly income change (₹)" helper="Per month. Positive and negative values are allowed; use a negative value to test a monthly income decrease." helperId="income-change-help">
            <input type="number" step="500" inputMode="decimal" className={inputClass} value={changes.monthlyIncomeDelta} onChange={(e) => setNumber('monthlyIncomeDelta', e.target.value)} aria-describedby="income-change-help income-change-format" />
            <ValuePreview id="income-change-format" text={`${signedMoney(changes.monthlyIncomeDelta)} per month`} />
          </Field>
          <Field label="Reduce recorded spending by (%)" helper="Eligible expenses already saved in your workspace. Enter a value between 0% and 100%." tooltip="Expenses already saved in your workspace that are eligible for this scenario calculation." helperId="spending-reduction-help" error={validation.expenseReductionPercent}>
            <input type="number" min="0" max="100" step="1" inputMode="decimal" className={inputClass} value={changes.expenseReductionPercent} onChange={(e) => setNumber('expenseReductionPercent', e.target.value)} aria-describedby="spending-reduction-help spending-reduction-error" aria-invalid={Boolean(validation.expenseReductionPercent)} />
          </Field>
          <Field label="Additional monthly expense (₹)" helper="Per month. This is applied once per month for the selected replay horizon." helperId="additional-expense-help">
            <input type="number" min="0" step="500" inputMode="decimal" className={inputClass} value={changes.additionalMonthlyExpense} onChange={(e) => setNumber('additionalMonthlyExpense', e.target.value)} aria-describedby="additional-expense-help additional-expense-format" />
            <ValuePreview id="additional-expense-format" text={`${money(changes.additionalMonthlyExpense)} per month`} />
          </Field>
          <Field label="New monthly EMI / commitment (₹)" helper="Per month. A recurring payment such as a loan EMI or other fixed obligation." tooltip="A recurring monthly payment such as a loan EMI or other fixed obligation." helperId="emi-help">
            <input type="number" min="0" step="500" inputMode="decimal" className={inputClass} value={changes.newMonthlyEmi} onChange={(e) => setNumber('newMonthlyEmi', e.target.value)} aria-describedby="emi-help emi-format" />
            <ValuePreview id="emi-format" text={`${money(changes.newMonthlyEmi)} per month`} />
          </Field>
          <Field label="Savings-target change (₹)" helper="Per month. This adjusts the scenario savings goal only; it does not automatically transfer or save money." tooltip="An adjustment to your monthly savings goal; it does not automatically transfer or save money." helperId="savings-help">
            <input type="number" step="500" inputMode="decimal" className={inputClass} value={changes.savingsTargetDelta} onChange={(e) => setNumber('savingsTargetDelta', e.target.value)} aria-describedby="savings-help savings-format" />
            <ValuePreview id="savings-format" text={`${signedMoney(changes.savingsTargetDelta)} per month`} />
          </Field>
        </div>

        <section className="rounded-2xl border border-interactive/20 bg-interactive-soft p-4" aria-labelledby="scenario-summary-title">
          <div className="flex items-start justify-between gap-3"><div><h3 id="scenario-summary-title" className="text-xs font-black text-ink">Scenario summary</h3><p className="mt-1 text-[10px] text-secondary">Review your assumptions before calculating the replay.</p></div><ListChecks className="h-4 w-4 shrink-0 text-interactive" /></div>
          {summaryLines.length ? <div className="mt-3"><p className="text-[10px] font-semibold text-ink">For the next {horizonMonths} month{horizonMonths === 1 ? '' : 's'}, you are testing:</p><ul className="mt-2 space-y-1.5 text-[10px] leading-5 text-secondary">{summaryLines.map((line) => <li key={line}>• {line}</li>)}</ul></div> : <p className="mt-3 text-[10px] leading-5 text-secondary">No changes selected yet. You can still run a zero-change replay to view your recorded baseline.</p>}
          <div className="mt-3 border-t border-interactive/15 pt-3 text-[9px] leading-4 text-secondary">Preview only. Final calculations run only after you select “Run deterministic replay”.</div>
        </section>

        <section className="rounded-2xl border border-line bg-canvas p-4" aria-labelledby="what-compare-title">
          <h3 id="what-compare-title" className="text-xs font-black text-ink">What this replay will compare</h3>
          <div className="mt-3 grid gap-2 text-[10px] leading-5 text-secondary sm:grid-cols-2">
            {['Current baseline cash flow', 'Scenario cash flow after selected changes', 'Monthly surplus or deficit difference', 'Estimated impact over the selected replay horizon', 'Savings-target gap or change', 'Recurring commitment and EMI pressure', 'Relevant budget pressure, when budget records exist'].map((item) => <div key={item} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-interactive" />{item}</div>)}
          </div>
          <p className="mt-3 border-t border-line pt-3 text-[9px] leading-4 text-secondary">These are deterministic comparisons based on recorded workspace data and selected assumptions. They are not predictions.</p>
        </section>

        <button type="button" disabled={loading} onClick={() => void run(false)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-white transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive disabled:opacity-50"><Calculator className="h-4 w-4" /> {loading ? 'Replaying…' : 'Run deterministic replay'}</button>
        {!changed && <p className="text-center text-[9px] leading-4 text-secondary">A zero-change replay is valid and shows your current recorded baseline.</p>}
      </div>

      <div className="space-y-4">
        {resultsStale && <div role="status" className="rounded-2xl border border-warning-fill/25 bg-warning-soft p-4 text-[10px] leading-5 text-secondary"><strong className="text-ink">Scenario inputs changed after the last replay.</strong> Results below still reflect the last completed deterministic calculation. Run the replay again to apply the current temporary inputs.</div>}

        {!replay ? <EmptyReplayState /> : noEligibleData ? <NoDataState /> : <>
          <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="replay-results-title">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-interactive">Replay result</div><h2 id="replay-results-title" className="mt-1 text-xl font-black text-ink">What changed</h2><p className="mt-1 text-[10px] text-secondary">Deterministic calculation completed against the recorded baseline.</p></div><span className={`rounded-full border px-3 py-1 text-[10px] font-black ${replay.dataBasis.completeness === 'High' ? 'border-success-fill/25 bg-success-soft text-success' : replay.dataBasis.completeness === 'Medium' ? 'border-warning-fill/25 bg-warning-soft text-warning' : 'border-line-strong bg-subtle text-secondary'}`}>Data completeness: {replay.dataBasis.completeness}</span></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Current baseline cash flow" value={money(replay.baseline.recordedNetCashFlow)} /><Metric label="Temporary scenario cash flow" value={money(replay.scenario.projectedMonthlyCashFlowAfterNewCommitment)} /><Metric label="Monthly impact" value={signedMoney(replay.impact.monthlyCashFlowChange)} tone={impactTone(replay.impact.monthlyCashFlowChange)} note={impactLabel(replay.impact.monthlyCashFlowChange)} /><Metric label={`Impact over ${replay.horizonMonths} month${replay.horizonMonths === 1 ? '' : 's'}`} value={signedMoney(replay.impact.horizonCashFlowChange)} tone={impactTone(replay.impact.horizonCashFlowChange)} /></div>
          </section>

          <section className="grid gap-4 md:grid-cols-2" aria-label="Baseline and temporary scenario comparison">
            <Comparison title="Your recorded baseline" rows={[["Monthly income", money(replay.baseline.monthlyIncome)],["Recorded expenses", money(replay.baseline.recordedMonthlyExpenses)],["Recorded net cash flow", money(replay.baseline.recordedNetCashFlow)],["Active EMI commitment", money(replay.baseline.activeMonthlyEmiCommitment)],["EMI commitment ratio", replay.baseline.emiCommitmentRatioPercent == null ? 'Not available' : `${replay.baseline.emiCommitmentRatioPercent}%`],["Budget headroom", money(replay.baseline.budgetHeadroom)],["Savings target", money(replay.baseline.savingsTarget)]]} />
            <Comparison title="Your temporary scenario" rows={[["Monthly income", money(replay.scenario.monthlyIncome)],["Monthly expenses", money(replay.scenario.monthlyExpenses)],["Scenario cash flow", money(replay.scenario.projectedMonthlyCashFlowAfterNewCommitment)],["Active + new EMI", money(replay.scenario.activePlusNewMonthlyEmi)],["EMI commitment ratio", replay.scenario.emiCommitmentRatioPercent == null ? 'Not available' : `${replay.scenario.emiCommitmentRatioPercent}%`],["Budget headroom", money(replay.scenario.budgetHeadroom)],["Savings target", money(replay.scenario.savingsTarget)]]} />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <ResultPanel title="Monthly impact" rows={[["Calculated cash-flow difference", signedMoney(replay.impact.monthlyCashFlowChange)],["Interpretation", impactLabel(replay.impact.monthlyCashFlowChange)]]} />
            <ResultPanel title={`Impact over ${replay.horizonMonths} month${replay.horizonMonths === 1 ? '' : 's'}`} rows={[["Calculated horizon difference", signedMoney(replay.impact.horizonCashFlowChange)],["Monthly assumptions applied", `${replay.horizonMonths} time${replay.horizonMonths === 1 ? '' : 's'}`]]} />
            <ResultPanel title="Savings-target impact" rows={[["Recorded target", money(replay.baseline.savingsTarget)],["Scenario target", money(replay.scenario.savingsTarget)],["Temporary target change", signedMoney(replay.changes.savingsTargetDelta)]]} />
          </section>

          <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="budget-pressure-title">
            <h2 id="budget-pressure-title" className="text-lg font-black text-ink">Budget and commitment pressure</h2>
            <p className="mt-1 text-[10px] text-secondary">Descriptive comparison only. This is not an affordability or lending decision.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ResultPanel title="Budget context" rows={[["Baseline headroom", money(replay.baseline.budgetHeadroom)],["Scenario headroom", money(replay.scenario.budgetHeadroom)],["Configured budget", money(replay.baseline.plannedBudget)]]} compact />
              <ResultPanel title="Recurring commitment context" rows={[["Baseline monthly EMI", money(replay.baseline.activeMonthlyEmiCommitment)],["Scenario active + new EMI", money(replay.scenario.activePlusNewMonthlyEmi)],["Scenario EMI ratio", replay.scenario.emiCommitmentRatioPercent == null ? 'Not available' : `${replay.scenario.emiCommitmentRatioPercent}%`]]} compact />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <InfoPanel title="Assumptions applied" items={replay.assumptions.length ? replay.assumptions : ['No scenario changes were applied; this is a zero-change baseline replay.']} />
            <InfoPanel title="Data included" items={[`Income sources: ${replay.dataBasis.recurringIncomeSources}`, `Expense records: ${replay.dataBasis.currentMonthExpenseRecords}`, `Budget categories: ${replay.dataBasis.budgetCategories}`, `Active EMIs: ${replay.dataBasis.activeEmis}`]} />
            <InfoPanel title="Not included in this calculation" items={['Market movements', 'Salary growth', 'Inflation', 'Taxes', 'Lender decisions', 'Unexpected expenses']} />
          </section>

          <details className="overflow-hidden rounded-3xl border border-line bg-canvas">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-interactive"><div className="flex items-center gap-3"><Database className="h-4 w-4 text-interactive" /><div><div className="text-sm font-black text-ink">How this result was calculated</div><div className="mt-0.5 text-[9px] text-secondary">Transparency and traceability</div></div></div><ChevronDown className="h-4 w-4 text-secondary" /></summary>
            <div className="border-t border-line p-5 text-[10px] leading-5 text-secondary">
              <div className="grid gap-3 sm:grid-cols-2">
                <TraceRow label="Replay horizon" value={`${replay.horizonMonths} month${replay.horizonMonths === 1 ? '' : 's'}`} />
                <TraceRow label="Calculation timestamp" value={new Date(replay.calculatedAt).toLocaleString('en-IN')} />
                <TraceRow label="Temporary assumptions" value={scenarioLines(replay.changes).join(' · ') || 'No changes — baseline replay'} />
                <TraceRow label="Recorded data categories" value="Income, expenses, budgets and EMI commitments when present" />
              </div>
              <div className="mt-4 space-y-1 rounded-2xl border border-line bg-surface p-4"><div>• No saved records were changed.</div><div>• This result is deterministic and counterfactual, not predictive.</div><div>• Excluded: market movements, salary growth, inflation, taxes, lender decisions and unexpected expenses.</div></div>
            </div>
          </details>

          <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-brand">Optional ArthaMind explanation</div><h2 className="mt-1 text-lg font-black text-ink">Scenario Interpreter</h2><p className="mt-1 text-xs leading-5 text-secondary">ArthaMind receives the exact deterministic replay output and explains the largest calculated drivers. It does not replace or modify the Decimal.js calculation.</p></div><button type="button" disabled={explaining} onClick={() => void run(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-interactive/30 bg-interactive-soft px-4 py-2.5 text-xs font-black text-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive disabled:opacity-50"><BrainCircuit className="h-4 w-4" />{explaining ? 'Explaining…' : 'Explain with ArthaMind'}</button></div>{response?.structuredAnswer && <div className="mt-5"><StructuredFinancialAnswerView answer={response.structuredAnswer} /></div>}</section>

          {response?.disclaimer && <section className="rounded-2xl border border-line bg-canvas p-4 text-[10px] leading-5 text-secondary"><div className="flex items-start gap-2"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><div><strong className="text-ink">Decision Replay safety note.</strong> {response.disclaimer}</div></div></section>}
        </>}
        {error && <div role="alert" className="rounded-2xl border border-danger/25 bg-danger-soft p-4 text-xs leading-5 text-danger">{error}</div>}
      </div>
    </section>
  </div>;
};

const HelpTip: React.FC<{ label: string; text: string }> = ({ label, text }) => <span className="group relative inline-flex align-middle"><button type="button" aria-label={`${label}: ${text}`} className="inline-flex h-5 w-5 items-center justify-center rounded-full text-secondary hover:text-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-interactive"><Info className="h-3 w-3" /></button><span role="tooltip" className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-50 hidden w-64 -translate-x-1/2 rounded-xl border border-line bg-surface p-3 text-left text-[9px] font-medium normal-case leading-4 tracking-normal text-secondary shadow-xl group-hover:block group-focus-within:block"><strong className="block text-ink">{label}</strong><span className="mt-1 block">{text}</span></span></span>;

const StepCard: React.FC<{ step: string; title: string; text: string; tooltip?: string }> = ({ step, title, text, tooltip }) => <article className="rounded-2xl border border-line bg-canvas p-4"><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-interactive/20 bg-interactive-soft text-xs font-black text-interactive">{step}</span><div><h3 className="flex items-center gap-1 text-xs font-black text-ink">{title}{tooltip && <HelpTip label="Baseline" text={tooltip} />}</h3><p className="mt-1 text-[10px] leading-5 text-secondary">{text}</p></div></div></article>;

const PresetButton: React.FC<{ label: string; description: string; onClick: () => void }> = ({ label, description, onClick }) => <button type="button" onClick={onClick} title={description} aria-label={`${label}. ${description}`} className="min-h-11 rounded-xl border border-line bg-canvas px-3 py-2 text-[10px] font-bold text-ink transition hover:border-interactive/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive">{label}</button>;

const Field: React.FC<React.PropsWithChildren<{ label: string; helper: string; helperId: string; tooltip?: string; error?: string }>> = ({ label, helper, helperId, tooltip, error, children }) => <label className="block"><span className="mb-1.5 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-secondary">{label}{tooltip && <HelpTip label={label} text={tooltip} />}</span>{children}<span id={helperId} className="mt-1.5 block text-[9px] leading-4 text-secondary">{helper}</span>{error && <span id="spending-reduction-error" role="status" className="mt-1 block text-[9px] font-semibold text-warning">{error}</span>}</label>;

const ValuePreview: React.FC<{ id: string; text: string }> = ({ id, text }) => <span id={id} className="mt-1 block text-[9px] font-semibold text-ink">Scenario value: {text}</span>;

const Metric: React.FC<{ label: string; value: string; tone?: Tone; note?: string }> = ({ label, value, tone = 'neutral', note }) => <div className="rounded-2xl border border-line bg-canvas p-4"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">{label}</div><div className={`mt-2 text-lg font-black ${tone === 'positive' ? 'text-success' : tone === 'caution' ? 'text-warning' : 'text-ink'}`}>{value}</div>{note && <div className="mt-1 text-[9px] leading-4 text-secondary">{note}</div>}</div>;

const Comparison: React.FC<{ title: string; rows: Array<[string, string]> }> = ({ title, rows }) => <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm"><h2 className="text-base font-black text-ink">{title}</h2><div className="mt-3 divide-y divide-line">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-[10px]"><span className="text-secondary">{label}</span><span className="text-right font-black text-ink">{value}</span></div>)}</div></section>;

const ResultPanel: React.FC<{ title: string; rows: Array<[string, string]>; compact?: boolean }> = ({ title, rows, compact }) => <article className={`rounded-2xl border border-line bg-canvas ${compact ? 'p-4' : 'p-5'}`}><h3 className="text-xs font-black text-ink">{title}</h3><div className="mt-3 space-y-2">{rows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 text-[10px] leading-5"><span className="text-secondary">{label}</span><span className="text-right font-black text-ink">{value}</span></div>)}</div></article>;

const InfoPanel: React.FC<{ title: string; items: string[] }> = ({ title, items }) => <section className="rounded-2xl border border-line bg-canvas p-4"><h3 className="text-xs font-black text-ink">{title}</h3><ul className="mt-3 space-y-1.5 text-[10px] leading-5 text-secondary">{items.map((item) => <li key={item}>• {item}</li>)}</ul></section>;

const TraceRow: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-xl border border-line bg-surface p-3"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">{label}</div><div className="mt-1 text-[10px] font-semibold text-ink">{value}</div></div>;

const EmptyReplayState: React.FC = () => <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-line-strong bg-surface p-6 text-center sm:p-8"><div className="max-w-xl"><Gauge className="mx-auto h-9 w-9 text-interactive" /><h2 className="mt-4 text-lg font-black text-ink">Explore the impact before changing real records</h2><p className="mx-auto mt-2 text-xs leading-6 text-secondary">Choose a preset or enter your own monthly assumptions. When you run the replay, ArthaMind compares your temporary scenario with your recorded finance baseline without saving anything.</p><div className="mt-5 grid gap-2 sm:grid-cols-3"><Placeholder label="Cash-flow difference" /><Placeholder label="Savings-target impact" /><Placeholder label="Recurring commitment pressure" /></div><div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-interactive/25 bg-interactive-soft px-4 py-2 text-[10px] font-black text-interactive">Configure a scenario above</div></div></div>;

const Placeholder: React.FC<{ label: string }> = ({ label }) => <div className="rounded-2xl border border-line bg-canvas p-3 text-[10px] font-semibold text-secondary">{label}</div>;

const NoDataState: React.FC = () => <section className="rounded-3xl border border-line bg-surface p-6 text-center shadow-sm sm:p-8"><Database className="mx-auto h-9 w-9 text-interactive" /><h2 className="mt-4 text-lg font-black text-ink">Add finance records to create a stronger baseline</h2><p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-secondary">Decision Replay works best when your workspace contains recorded income, expenses, budgets or EMI commitments.</p><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><ModuleLink label="Add income" href={pathForDestination('income')} /><ModuleLink label="Track expenses" href={pathForDestination('expenses')} /><ModuleLink label="Set a budget" href={pathForDestination('budgeting')} /><ModuleLink label="Manage EMI" href={pathForDestination('emi-manager')} /></div><p className="mt-4 text-[9px] leading-4 text-secondary">You can continue configuring temporary scenario inputs above. No navigation is forced and no fake zero-result insight is shown.</p></section>;

const ModuleLink: React.FC<{ label: string; href: string }> = ({ label, href }) => <a href={href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2 text-[10px] font-black text-ink transition hover:border-interactive/40 hover:text-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive">{label}<ArrowRight className="h-3.5 w-3.5" /></a>;
