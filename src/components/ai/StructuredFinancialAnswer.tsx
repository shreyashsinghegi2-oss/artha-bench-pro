import React from 'react';
import {
  Calculator,
  CheckCircle2,
  CircleAlert,
  Database,
  Lightbulb,
  ListChecks,
  ShieldAlert,
} from 'lucide-react';
import { FinancialExampleDataStatus, StructuredFinancialAnswer } from '../../types';

interface StructuredFinancialAnswerProps {
  answer: StructuredFinancialAnswer;
  disclaimer?: string;
  compact?: boolean;
}

const STATUS_LABELS: Record<FinancialExampleDataStatus, string> = {
  live: 'Live data',
  latest_available: 'Latest official data',
  delayed: 'Delayed data',
  illustrative: 'Illustrative',
  not_applicable: 'Conceptual',
};

const STATUS_STYLES: Record<FinancialExampleDataStatus, string> = {
  live: 'border-success-fill/25 bg-success-soft text-success',
  latest_available: 'border-interactive bg-interactive-soft text-interactive',
  delayed: 'border-warning-fill/25 bg-warning-soft text-warning',
  illustrative: 'border-interactive bg-interactive-soft text-interactive',
  not_applicable: 'border-line bg-subtle text-secondary',
};

const SectionHeading: React.FC<React.PropsWithChildren<{ icon: React.ComponentType<{ className?: string }> }>> = ({ icon: Icon, children }) => (
  <div className="mb-2.5 flex items-center gap-2">
    <Icon className="h-4 w-4 text-interactive" aria-hidden="true" />
    <h4 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink">{children}</h4>
  </div>
);

export const StructuredFinancialAnswerView: React.FC<StructuredFinancialAnswerProps> = ({
  answer,
  disclaimer = 'Educational analysis only — verify consequential financial, tax, legal, or investment decisions with an appropriate official source or qualified professional.',
  compact = false,
}) => (
  <article className={`w-full overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-sm ${compact ? 'text-[12px]' : 'text-sm'}`}>
    <header className="border-b border-line bg-surface px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-interactive">ArthaMind structured answer</p>
          <h3 className="mt-1.5 text-base font-extrabold leading-snug text-ink sm:text-lg">{answer.title}</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success-fill/25 bg-success-soft px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-success">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Evaluation-ready
        </span>
      </div>
    </header>

    <div className={`space-y-5 ${compact ? 'p-4' : 'p-4 sm:p-5'}`}>
      <section aria-labelledby="direct-answer-heading">
        <SectionHeading icon={Lightbulb}>Direct answer</SectionHeading>
        <p id="direct-answer-heading" className="rounded-xl border border-interactive bg-interactive-soft/70 px-3.5 py-3 font-semibold leading-6 text-ink">{answer.directAnswer}</p>
      </section>

      <section className="rounded-xl border border-line bg-subtle p-3.5" aria-labelledby="assumptions-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading icon={CircleAlert}>Assumptions and context</SectionHeading>
          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${STATUS_STYLES[answer.example.dataStatus]}`}>{STATUS_LABELS[answer.example.dataStatus]}</span>
        </div>
        {answer.example.dataAsOf && <p className="mb-2 text-[10px] font-medium text-secondary">Data as of {answer.example.dataAsOf}</p>}
        <ul className="space-y-1.5 leading-5 text-secondary">
          {answer.example.inputs.length
            ? answer.example.inputs.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)
            : <li>• No additional quantitative assumptions were required beyond the supplied context.</li>}
        </ul>
      </section>

      <section className="overflow-hidden rounded-xl border border-interactive/25 bg-interactive-soft" aria-labelledby="formula-heading">
        <div className="flex items-center gap-2 border-b border-interactive px-3.5 py-2.5">
          <Calculator className="h-4 w-4 text-interactive" aria-hidden="true" />
          <h4 id="formula-heading" className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink">Formula or rule</h4>
        </div>
        <div className="space-y-3 p-3.5">
          <div className="overflow-x-auto rounded-lg border border-line bg-surface px-3 py-3 font-mono text-[12px] font-semibold leading-6 text-interactive">{answer.formula.expression}</div>
          {answer.formula.variables.length > 0 && (
            <dl className="grid gap-2 sm:grid-cols-2">
              {answer.formula.variables.map((variable, index) => (
                <div key={`${variable.symbol}-${index}`} className="rounded-lg border border-line bg-surface px-3 py-2">
                  <dt className="font-mono text-[11px] font-extrabold text-interactive">{variable.symbol}</dt>
                  <dd className="mt-0.5 text-[11px] leading-4 text-secondary">{variable.meaning}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="text-[11px] leading-5 text-secondary">{answer.formula.whenToUse}</p>
        </div>
      </section>

      <section aria-labelledby="step-by-step-heading">
        <SectionHeading icon={ListChecks}>Step-by-step calculation or reasoning</SectionHeading>
        <ol className="space-y-2.5">
          {answer.steps.map((step, index) => (
            <li key={`${step.title}-${index}`} className="flex gap-3 rounded-xl border border-line bg-subtle px-3 py-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-interactive text-[10px] font-extrabold text-white">{index + 1}</span>
              <div className="min-w-0"><p className="font-bold leading-5 text-ink">{step.title}</p><p className="mt-0.5 leading-5 text-secondary">{step.explanation}</p></div>
            </li>
          ))}
        </ol>
        {answer.example.calculation.length > 0 && (
          <div className="mt-3 rounded-xl border border-line bg-canvas p-3.5">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-secondary">Calculation details</p>
            <ol className="space-y-1.5">
              {answer.example.calculation.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 font-mono text-[11px] leading-5 text-secondary"><span className="font-sans font-extrabold text-interactive">{index + 1}.</span><span>{item}</span></li>)}
            </ol>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-success-fill/25 bg-success-soft p-3.5" aria-labelledby="final-result-heading">
        <h4 id="final-result-heading" className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-success">Final result and interpretation</h4>
        <p className="mt-2 font-bold leading-6 text-ink">{answer.example.result}</p>
        {answer.interpretation.length > 0 && <ul className="mt-2 space-y-1.5 leading-5 text-secondary">{answer.interpretation.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul>}
      </section>

      {answer.keyTakeaways.length > 0 && (
        <section className="rounded-xl border border-interactive bg-interactive-soft/60 p-3.5" aria-labelledby="if-needed-heading">
          <h4 id="if-needed-heading" className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink">If needed</h4>
          <ul className="mt-2 space-y-1.5 leading-5 text-secondary">{answer.keyTakeaways.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul>
        </section>
      )}

      <section className="rounded-xl border border-warning-fill/25 bg-warning-soft p-3.5" aria-labelledby="limitations-heading">
        <div className="mb-2 flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-warning" aria-hidden="true" /><h4 id="limitations-heading" className="text-[10px] font-extrabold uppercase tracking-wider text-ink">Limitations and verification</h4></div>
        {answer.risks.length > 0 && <ul className="space-y-1.5 leading-5 text-secondary">{answer.risks.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul>}
        {answer.sources.length > 0 && (
          <div className="mt-3 border-t border-warning-fill/20 pt-3">
            <div className="mb-2 flex items-center gap-2"><Database className="h-3.5 w-3.5 text-secondary" aria-hidden="true" /><span className="text-[10px] font-extrabold uppercase tracking-wider text-ink">Sources and freshness</span></div>
            <div className="flex flex-wrap gap-2">{answer.sources.map((source, index) => <span key={`${source.name}-${index}`} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[10px] leading-4 text-secondary"><strong className="text-ink">{source.name}</strong>{source.dataDate ? ` · ${source.dataDate}` : ''} · {source.freshness}</span>)}</div>
          </div>
        )}
        <p className="mt-3 border-t border-warning-fill/20 pt-3 text-[10px] font-medium leading-4 text-secondary">{disclaimer}</p>
      </section>
    </div>
  </article>
);
