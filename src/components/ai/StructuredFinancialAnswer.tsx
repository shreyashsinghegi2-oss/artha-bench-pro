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
  live: 'Live data example',
  latest_available: 'Latest official data',
  delayed: 'Delayed data example',
  illustrative: 'Illustrative example',
  not_applicable: 'Conceptual example',
};

const STATUS_STYLES: Record<FinancialExampleDataStatus, string> = {
  live: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  latest_available: 'border-sky-200 bg-sky-50 text-sky-700',
  delayed: 'border-amber-200 bg-amber-50 text-amber-700',
  illustrative: 'border-violet-200 bg-violet-50 text-violet-700',
  not_applicable: 'border-slate-200 bg-slate-50 text-slate-600',
};

export const StructuredFinancialAnswerView: React.FC<StructuredFinancialAnswerProps> = ({
  answer,
  disclaimer = 'Educational analysis only — not investment advice.',
  compact = false,
}) => (
  <article
    className={`w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-[0_16px_44px_rgba(15,23,42,0.10)] ${
      compact ? 'text-[12px]' : 'text-sm'
    }`}
  >
    <header className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 px-4 py-4 text-white sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-indigo-300">
            Artha structured answer
          </p>
          <h3 className="mt-1.5 text-base font-extrabold leading-snug text-white sm:text-lg">
            {answer.title}
          </h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
          <CheckCircle2 className="h-3 w-3" /> Structured
        </span>
      </div>
    </header>

    <div className={`space-y-5 ${compact ? 'p-4' : 'p-4 sm:p-5'}`}>
      <section aria-labelledby="direct-answer-heading">
        <div className="mb-2 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-indigo-600" />
          <h4 id="direct-answer-heading" className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-900">
            Direct answer
          </h4>
        </div>
        <p className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3.5 py-3 leading-6 text-slate-700">
          {answer.directAnswer}
        </p>
      </section>

      <section aria-labelledby="step-by-step-heading">
        <div className="mb-3 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-indigo-600" />
          <h4 id="step-by-step-heading" className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-900">
            Step-by-step
          </h4>
        </div>
        <ol className="space-y-2.5">
          {answer.steps.map((step, index) => (
            <li key={`${step.title}-${index}`} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-extrabold text-white">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="font-bold leading-5 text-slate-900">{step.title}</p>
                <p className="mt-0.5 leading-5 text-slate-600">{step.explanation}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white" aria-labelledby="formula-heading">
        <div className="flex items-center gap-2 border-b border-indigo-100 px-3.5 py-2.5">
          <Calculator className="h-4 w-4 text-indigo-600" />
          <h4 id="formula-heading" className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-900">
            Formula or method
          </h4>
        </div>
        <div className="space-y-3 p-3.5">
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 px-3 py-3 font-mono text-[12px] font-semibold leading-6 text-indigo-100">
            {answer.formula.expression}
          </div>
          {answer.formula.variables.length > 0 && (
            <dl className="grid gap-2 sm:grid-cols-2">
              {answer.formula.variables.map((variable, index) => (
                <div key={`${variable.symbol}-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <dt className="font-mono text-[11px] font-extrabold text-indigo-700">{variable.symbol}</dt>
                  <dd className="mt-0.5 text-[11px] leading-4 text-slate-600">{variable.meaning}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="text-[11px] leading-5 text-slate-600">{answer.formula.whenToUse}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white" aria-labelledby="worked-example-heading">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3.5 py-3">
          <h4 id="worked-example-heading" className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-900">
            Worked example
          </h4>
          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${STATUS_STYLES[answer.example.dataStatus]}`}>
            {STATUS_LABELS[answer.example.dataStatus]}
          </span>
        </div>
        <div className="space-y-3 p-3.5">
          <div>
            <p className="font-bold text-slate-900">{answer.example.title}</p>
            {answer.example.dataAsOf && (
              <p className="mt-1 text-[10px] font-medium text-slate-500">Data as of {answer.example.dataAsOf}</p>
            )}
          </div>
          {answer.example.inputs.length > 0 && (
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Inputs</p>
              <ul className="space-y-1 text-slate-700">
                {answer.example.inputs.map((input, index) => <li key={`${input}-${index}`}>• {input}</li>)}
              </ul>
            </div>
          )}
          {answer.example.calculation.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Calculation</p>
              <ol className="space-y-1.5">
                {answer.example.calculation.map((calculation, index) => (
                  <li key={`${calculation}-${index}`} className="flex gap-2 font-mono text-[11px] leading-5 text-slate-700">
                    <span className="font-sans font-extrabold text-indigo-600">{index + 1}.</span>
                    <span>{calculation}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Result</p>
            <p className="mt-1 font-bold leading-5 text-emerald-950">{answer.example.result}</p>
          </div>
        </div>
      </section>

      {(answer.interpretation.length > 0 || answer.risks.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-3.5" aria-labelledby="interpretation-heading">
            <div className="mb-2 flex items-center gap-2">
              <CircleAlert className="h-4 w-4 text-sky-700" />
              <h4 id="interpretation-heading" className="text-[10px] font-extrabold uppercase tracking-wider text-sky-950">What it means</h4>
            </div>
            <ul className="space-y-1.5 leading-5 text-slate-700">
              {answer.interpretation.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}
            </ul>
          </section>
          <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5" aria-labelledby="risk-heading">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-700" />
              <h4 id="risk-heading" className="text-[10px] font-extrabold uppercase tracking-wider text-amber-950">Risks & limitations</h4>
            </div>
            <ul className="space-y-1.5 leading-5 text-slate-700">
              {answer.risks.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}
            </ul>
          </section>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-slate-950 px-3.5 py-3 text-white" aria-labelledby="takeaways-heading">
        <h4 id="takeaways-heading" className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo-300">
          Key takeaways
        </h4>
        <ul className="mt-2 space-y-1.5 leading-5 text-slate-200">
          {answer.keyTakeaways.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {answer.sources.length > 0 && (
        <section className="border-t border-slate-200 pt-4" aria-labelledby="sources-heading">
          <div className="mb-2 flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-slate-500" />
            <h4 id="sources-heading" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
              Data & sources
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {answer.sources.map((source, index) => (
              <span key={`${source.name}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] leading-4 text-slate-600">
                <strong className="text-slate-800">{source.name}</strong>
                {source.dataDate ? ` · ${source.dataDate}` : ''} · {source.freshness}
              </span>
            ))}
          </div>
        </section>
      )}

      <p className="border-t border-slate-200 pt-3 text-[10px] font-medium leading-4 text-slate-500">
        {disclaimer}
      </p>
    </div>
  </article>
);
