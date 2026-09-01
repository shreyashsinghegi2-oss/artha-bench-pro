import React, { useMemo, useState } from 'react';
import { ArrowRight, GitBranch, RotateCcw, ShieldCheck, Sparkles, Waves } from 'lucide-react';
import { AppNavigationDestination } from '../../navigationTypes';
import { buildFinancialTwin, FinancialTwinInputs } from '../../services/financialTwin';
import { formatINR } from '../../services/personalFinanceStorage';
import { EmbeddedFinanceAdvisor } from './EmbeddedFinanceAdvisor';

type Props = { onNavigate: (destination: AppNavigationDestination) => void };

const ZERO: FinancialTwinInputs = { incomeDeltaPercent: 0, expenseDeltaPercent: 0, additionalMonthlyEmi: 0, savingsTargetDelta: 0 };
const inputClass = 'w-full rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-xs text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/15';

function formatMetric(value: number | null, unit: 'INR' | 'percent' | 'score') {
  if (value == null) return 'Data needed';
  if (unit === 'INR') return formatINR(value);
  if (unit === 'percent') return `${value.toFixed(1)}%`;
  return `${value.toFixed(0)}/100`;
}

export const FinancialRippleTwinView: React.FC<Props> = ({ onNavigate }) => {
  const [inputs, setInputs] = useState<FinancialTwinInputs>(ZERO);
  const result = useMemo(() => buildFinancialTwin(inputs), [inputs]);
  const advisorEvidence = useMemo<Record<string, unknown>>(() => ({ ...result, boundary: 'Financial Ripple Twin is a deterministic counterfactual comparison only. No records are saved or changed and no future outcome is predicted.' }), [result]);

  const update = (key: keyof FinancialTwinInputs, value: string) => {
    const number = Number(value);
    setInputs((current) => ({ ...current, [key]: Number.isFinite(number) ? number : 0 }));
  };

  return <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-7 sm:px-6">
    <section className="overflow-hidden rounded-3xl border border-interactive/20 bg-surface shadow-sm">
      <div className="grid gap-0 xl:grid-cols-[1.15fr_.85fr]">
        <div className="p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-interactive/20 bg-interactive-soft px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-interactive"><Waves className="h-3.5 w-3.5" /> ArthaMind Financial Ripple Twin</div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">See one financial change ripple across your whole workspace</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">Change income, expenses, a temporary EMI, or your savings target and compare the deterministic ripple across cash flow, commitment load, budget headroom and savings-target coverage at the same time.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[10px] text-secondary"><span className="rounded-full border border-line bg-canvas px-3 py-1.5">No autosave</span><span className="rounded-full border border-line bg-canvas px-3 py-1.5">Counterfactual, not predictive</span><span className="rounded-full border border-line bg-canvas px-3 py-1.5">Recorded workspace baseline</span></div>
        </div>
        <div className="border-t border-line bg-canvas p-6 xl:border-l xl:border-t-0 sm:p-8">
          <div className="text-[9px] font-black uppercase tracking-wider text-secondary">Current baseline month</div>
          <div className="mt-2 text-2xl font-black text-ink">{result.month}</div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[9px]"><Mini label="Income" value={formatINR(result.baseline.income)} /><Mini label="Expenses" value={formatINR(result.baseline.expenses)} /><Mini label="Active EMI" value={formatINR(result.baseline.monthlyEmi)} /><Mini label="Budget" value={result.baseline.budgetPlanned == null ? 'Not configured' : formatINR(result.baseline.budgetPlanned)} /></div>
        </div>
      </div>
    </section>

    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-[10px] font-black uppercase tracking-wider text-brand">Temporary assumptions</div><h2 className="mt-1 text-xl font-black text-ink">Build the ripple</h2><p className="mt-1 text-xs text-secondary">Inputs affect only this temporary comparison. They never overwrite Income, Expenses, Budgets or EMI records.</p></div><button type="button" onClick={() => setInputs(ZERO)} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-bold text-ink"><RotateCcw className="h-3.5 w-3.5" /> Reset</button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Income change %"><input className={inputClass} type="number" step="1" value={inputs.incomeDeltaPercent} onChange={(event) => update('incomeDeltaPercent', event.target.value)} /></Field>
        <Field label="Expense change %"><input className={inputClass} type="number" step="1" value={inputs.expenseDeltaPercent} onChange={(event) => update('expenseDeltaPercent', event.target.value)} /></Field>
        <Field label="Additional monthly EMI (₹)"><input className={inputClass} type="number" min="0" step="500" value={inputs.additionalMonthlyEmi} onChange={(event) => update('additionalMonthlyEmi', event.target.value)} /></Field>
        <Field label="Savings target delta (₹)"><input className={inputClass} type="number" step="500" value={inputs.savingsTargetDelta} onChange={(event) => update('savingsTargetDelta', event.target.value)} /></Field>
      </div>
      <p className="mt-3 text-[9px] leading-4 text-secondary">Calculated scenario — not a forecast or financial advice. Negative income or expense percentages are treated as user-selected counterfactual assumptions, not predictions.</p>
    </section>

    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-interactive" /><h2 className="text-xl font-black text-ink">Cross-module ripple map</h2></div>
      <div className="mt-5 grid gap-3 lg:grid-cols-5">
        {result.metrics.map((metric) => <article key={metric.key} className="rounded-2xl border border-line bg-canvas p-4"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">{metric.label}</div><div className="mt-3 grid grid-cols-2 gap-2"><Mini label="Baseline" value={formatMetric(metric.baseline, metric.unit)} /><Mini label="Scenario" value={formatMetric(metric.scenario, metric.unit)} /></div><div className={`mt-3 rounded-xl border px-3 py-2 text-[10px] font-black ${metric.direction === 'improves' ? 'border-success-fill/25 bg-success-soft text-success' : metric.direction === 'worsens' ? 'border-warning-fill/25 bg-warning-soft text-warning' : 'border-line bg-surface text-secondary'}`}>{metric.delta == null ? 'Data needed' : `${metric.delta > 0 ? '+' : ''}${metric.delta}${metric.unit === 'INR' ? ' INR' : metric.unit === 'percent' ? ' pp' : ' pts'} · ${metric.direction}`}</div><details className="mt-3 text-[9px] leading-4 text-secondary"><summary className="cursor-pointer font-black text-ink">Evidence & limits</summary><div className="mt-2 space-y-1">{metric.evidence.map((item) => <div key={item}>• {item}</div>)}<div className="pt-1">Limit: {metric.limitation}</div></div></details></article>)}
      </div>
    </section>

    <section className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
      <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6"><div className="text-[10px] font-black uppercase tracking-wider text-interactive">Ripple summary</div><div className="mt-4 space-y-2">{result.rippleSummary.map((item) => <div key={item} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-secondary">{item}</div>)}</div></div>
      <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6"><div className="text-[10px] font-black uppercase tracking-wider text-warning">Data limitations</div>{result.dataLimitations.length ? <div className="mt-4 space-y-2">{result.dataLimitations.map((item) => <div key={item} className="rounded-xl border border-warning-fill/20 bg-warning-soft px-3 py-2 text-[10px] leading-4 text-secondary">{item}</div>)}</div> : <p className="mt-4 text-xs text-secondary">Core current-month inputs are present. This still remains a counterfactual calculation rather than a prediction.</p>}</div>
    </section>

    <EmbeddedFinanceAdvisor
      module="financial-twin"
      title="Ripple Twin Advisor"
      description="Ask ArthaMind to explain which recorded input caused each cross-module change, what remains uncertain, and which module you can inspect next. The advisor cannot save the scenario or convert it into a recommendation."
      questions={['Which assumption creates the largest ripple?', 'What data gap makes this comparison less reliable?', 'Explain the cash-flow and EMI interaction.', 'Which module should I review to verify these inputs?']}
      responseSections={['Scenario summary', 'Largest ripple', 'Cross-module interaction', 'Evidence used', 'Data gaps', 'Next review locations', 'Limits']}
      evidence={advisorEvidence}
    />

    <section className="rounded-3xl border border-line bg-canvas p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /><div><div className="text-xs font-black text-ink">Decision boundary</div><p className="mt-2 text-[10px] leading-5 text-secondary">Financial Ripple Twin does not predict salary, spending, loan approval, repayment performance or market outcomes. It does not change saved records. For the existing server-backed scenario engine, continue to Decision Replay.</p><button type="button" onClick={() => onNavigate('decision-replay')} className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black text-interactive">Open Decision Replay <ArrowRight className="h-3 w-3" /></button></div></div></section>
  </div>;
};

const Field: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => <label><span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-secondary">{label}</span>{children}</label>;
const Mini: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-xl border border-line bg-surface p-2.5"><div className="text-[8px] font-black uppercase text-secondary">{label}</div><div className="mt-1 text-[10px] font-black text-ink">{value}</div></div>;
