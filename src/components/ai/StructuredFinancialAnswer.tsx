import React from 'react';
import { BarChart3, Calculator, CheckCircle2, Database, GitCompare, Lightbulb, LineChart, ListChecks, Newspaper, ShieldAlert, Sparkles, Stethoscope } from 'lucide-react';
import { StructuredFinancialAnswer, WebSearchStatus } from '../../types';
import { RichFinancialText } from './RichFinancialText';
import { ListenBar } from '../voice/ListenBar';
import './structuredAnswer.css';

type Kind = 'calc' | 'market' | 'plan' | 'compare' | 'analysis' | 'concept';
const KIND: Record<Kind, { label: string; steps: string; icon: React.ComponentType<{ className?: string }> }> = {
  calc: { label: 'Calculation', steps: 'Working', icon: Calculator },
  market: { label: 'Market & news insight', steps: 'What is going on', icon: LineChart },
  plan: { label: 'Action plan', steps: 'What to do, in order', icon: ListChecks },
  compare: { label: 'Comparison', steps: 'Option by option', icon: GitCompare },
  analysis: { label: 'Your money analysis', steps: 'Findings, most urgent first', icon: Stethoscope },
  concept: { label: 'Explanation', steps: 'Key ideas', icon: Lightbulb },
};

const clean = (v: string) => v.replace(/\\\[|\\\]|```/g, '').replace(/^\s*#+\s*/gm, '').replace(/\\#/g, '#').replace(/\\text\{([^}]*)\}/g, '$1').trim();
const NO_FORMULA = /^(n\/?a|none|not applicable|no calculation|a formula is shown only)/i;

function kindOf(a: StructuredFinancialAnswer): Kind {
  const text = `${a.title} ${a.directAnswer} ${a.steps.map((s) => s.title).join(' ')}`.toLowerCase();
  if (a.steps.some((s) => /^(at risk|watch|healthy)\b/i.test(s.title.trim()))) return 'analysis';
  if (/\bvs\.?\b|versus|compare|comparison|which is better/.test(text)) return 'compare';
  if (/what happened|market|nifty|sensex|stock|shares|news|price|crypto|bitcoin|nav\b/.test(text) && (a.sources?.length ?? 0) > 0) return 'market';
  const hasFormula = !!a.formula?.expression && !NO_FORMULA.test(a.formula.expression.trim());
  if (hasFormula || (a.example?.calculation?.length ?? 0) > 0) return 'calc';
  if (/\bplan\b|should i|next step|priorit|action|where to invest|how do i/.test(text)) return 'plan';
  return 'concept';
}

/** Status colour for a step whose title starts with a status word (analysis answers). */
function stepTone(title: string) {
  const t = title.trim().toLowerCase();
  return t.startsWith('at risk') ? 'bad' : t.startsWith('watch') ? 'warn' : t.startsWith('healthy') ? 'good' : '';
}

/** Rupee or plain numbers in "Label: value" inputs, drawn as a small bar chart when there are 2 to 6. */
function chartData(a: StructuredFinancialAnswer): Array<{ label: string; value: number; text: string }> {
  const rows = [...(a.example?.inputs ?? [])].flatMap((line) => {
    const m = clean(line).match(/^([^:=]{2,40})[:=]\s*(-?₹?\s?[\d,]+(?:\.\d+)?)(\s*(?:%|lakh|crore)?)/i);
    if (!m) return [];
    const value = Number(m[2].replace(/[₹,\s]/g, ''));
    return Number.isFinite(value) && value > 0 && !/%/.test(m[3]) ? [{ label: m[1].trim(), value, text: `${m[2].trim()}${m[3] ?? ''}` }] : [];
  });
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(r.label) ? false : (seen.add(r.label), true)));
  return unique.length >= 2 && unique.length <= 6 ? unique : [];
}

const COLORS = ['#0F766E', '#1E3A8A', '#C9A227', '#14B8A6', '#0E7490', '#16A34A', '#B45309'];

export const StructuredFinancialAnswerView: React.FC<{ answer: StructuredFinancialAnswer; disclaimer?: string; compact?: boolean }> = ({ answer, disclaimer = 'Educational material only. Verify consequential financial, tax, legal or investment decisions with an appropriate official source.', compact = false }) => {
  const kind = kindOf(answer);
  const K = KIND[kind];
  const Icon = K.icon;
  const direct = clean(answer.directAnswer || '');
  const formula = clean(answer.formula?.expression || '');
  const showFormula = !!formula && !NO_FORMULA.test(formula);
  const live = (answer.sources?.length ?? 0) > 0;
  const chart = chartData(answer);
  const peak = Math.max(1, ...chart.map((c) => c.value));
  return <article className={`sa sa-${kind} w-full overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-sm ${compact ? 'text-xs' : 'text-sm'}`}>
    <header className="sa-head">
      <span className="sa-ico"><Icon className="h-4 w-4"/></span>
      <div className="min-w-0 flex-1"><div className="sa-kind">{K.label}</div><h3 className="mt-0.5 text-base font-extrabold leading-snug sm:text-lg">{clean(answer.title)}</h3></div>
      <span className={`sa-badge ${live ? 'live' : ''}`}>{live ? <><CheckCircle2 className="h-3 w-3"/>Checked with live data</> : <><Sparkles className="h-3 w-3"/>ArthaMind answer</>}</span>
    </header>
    <div className="space-y-3.5 p-4">
      {direct && <section className="sa-direct"><RichFinancialText value={direct}/></section>}

      {chart.length > 0 && <section className="sa-chart" aria-label="Numbers at a glance">
        <div className="sa-label"><BarChart3 className="h-3.5 w-3.5"/>At a glance</div>
        {chart.map((c, i) => <div key={c.label} className="sa-bar"><span>{c.label}</span><i><b style={{ width: `${Math.max(3, (c.value / peak) * 100)}%`, background: COLORS[i % COLORS.length] }}/></i><em>{c.text}</em></div>)}
      </section>}

      {answer.steps?.length > 0 && <section>
        <div className="sa-label">{K.steps}</div>
        <div className="space-y-2">{answer.steps.map((s, i) => <div key={i} className={`sa-step ${stepTone(s.title)}`}>
          <span className="sa-num">{i + 1}</span>
          <div className="min-w-0"><div className="font-bold">{clean(s.title)}</div><RichFinancialText value={clean(s.explanation)} className="mt-1 text-secondary"/></div>
        </div>)}</div>
      </section>}

      {false && showFormula && <section className="sa-formula">
        <div className="sa-label"><Calculator className="h-3.5 w-3.5"/>Formula</div>
        <div className="rounded-lg bg-surface p-3 font-mono text-xs font-semibold text-teal-700"><RichFinancialText value={formula}/></div>
        {answer.formula.variables?.length > 0 && <div className="mt-2 grid gap-2 sm:grid-cols-2">{answer.formula.variables.map((v, i) => <div key={i} className="rounded-lg border border-line bg-surface p-2"><b className="font-mono text-teal-700">{clean(v.symbol)}</b><div className="text-xs text-secondary">{clean(v.meaning)}</div></div>)}</div>}
      </section>}

      {answer.example?.result && <section className="sa-result">
        <div className="sa-label">Result</div>
        <div className="mt-1 font-bold"><RichFinancialText value={clean(answer.example.result)}/></div>
        {/* Step-by-step arithmetic and formulas are not shown to users: the plain result above is the answer. */}
      </section>}

      {answer.keyTakeaways?.length > 0 && <section className="sa-takeaways">
        <div className="sa-label">{kind === 'analysis' ? 'Your next actions' : 'Key takeaways'}</div>
        <ul>{answer.keyTakeaways.map((x, i) => <li key={i}><RichFinancialText value={clean(x)}/></li>)}</ul>
      </section>}

      {(answer.verifiedNumbers?.length ?? 0) > 0 && <section className="sa-sources">
        <div className="sa-label"><Calculator className="h-3.5 w-3.5"/>Calculated by the app, not a language model</div>
        <div className="flex flex-wrap gap-2">{answer.verifiedNumbers!.map((v) => <span key={v.id} className="rounded-lg border border-line bg-subtle px-2 py-1 text-xs text-secondary" title={v.assumptions.join(' ')}><b className="text-ink">{v.display}</b> · {v.label}{v.certified && v.badge ? <> · <CheckCircle2 className="inline h-3 w-3 align-[-2px]"/> {v.badge}</> : null}</span>)}</div>
      </section>}

      <WebStatusLine status={answer.webStatus}/>
      {answer.sources?.length > 0 && <section className="sa-sources">
        <div className="sa-label"><Database className="h-3.5 w-3.5"/>{kind === 'market' ? <><Newspaper className="h-3.5 w-3.5"/>Live sources</> : 'Sources'}</div>
        <div className="flex flex-wrap gap-2">{answer.sources.map((s, i) => {
          // Short chip label: "[n] Publisher"; the full title and date appear as the tooltip.
          const [head = '', ...rest] = clean(s.name).split(' · ');
          const label = head.trim();
          const detail = [rest.join(' · '), s.dataDate ? `as of ${s.dataDate}` : ''].filter(Boolean).join(' · ');
          const safe = s.url && /^https?:\/\//i.test(s.url) ? s.url : undefined;
          return safe
            ? <a key={i} href={safe} target="_blank" rel="noopener noreferrer nofollow" title={detail} className="sa-chip">{label}</a>
            : <span key={i} title={detail} className="sa-chip is-static">{label}</span>;
        })}</div>
      </section>}

      {answer.risks?.length > 0 && <section className="sa-risks">
        <div className="sa-label"><ShieldAlert className="h-3.5 w-3.5"/>Worth knowing</div>
        {answer.risks.map((x, i) => <div key={i} className="text-xs text-secondary">{clean(x)}</div>)}
      </section>}

      <ListenBar compact={compact} text={[direct, ...(answer.keyTakeaways ?? []).map(clean), ...(answer.risks ?? []).slice(0, 2).map(clean)].filter(Boolean).join('\n')}/>
      <div className="border-t border-line pt-3 text-xs text-secondary">{disclaimer}</div>
    </div>
  </article>;
};

/** Live or cached web data, with the time the cached copy was fetched (IST). */
export const WebStatusLine: React.FC<{ status?: WebSearchStatus }> = ({ status }) => {
  if (!status) return null;
  if (status.state === 'unavailable') {
    return <p className="sa-web-status is-unavailable" role="status">Live web data unavailable. Answer based on saved profile and verified calculations.</p>;
  }
  if (status.state === 'cached') {
    const when = status.fetchedAt ? new Date(status.fetchedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' IST' : '';
    return <p className="sa-web-status">Cached web data{when ? ` · as of ${when}` : ''}</p>;
  }
  return <p className="sa-web-status">Live web data</p>;
};
