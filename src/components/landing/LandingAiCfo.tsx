import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Gauge, Sparkles } from 'lucide-react';
import type { AppNavigationDestination } from '../../navigationTypes';
import { AiCfoChat } from '../ai/AiCfoChat';
import { buildCfoHealthReport, cfoReviewPrompt, formatInr, validateCfoInputs, type CfoInputs, type CfoStatus } from '../../services/cfoAnalysis';
import { detectArthaPilotIntent } from '../../services/arthaPilotRouter';
import './cfoLanding.css';

const FIELDS: Array<{ key: keyof CfoInputs; label: string; hint: string }> = [
  { key: 'monthlyIncome', label: 'Monthly take-home', hint: 'Salary or business drawings after tax' },
  { key: 'monthlyExpenses', label: 'Monthly expenses', hint: 'Rent, groceries, bills, lifestyle (no EMIs)' },
  { key: 'monthlyEmi', label: 'Total EMIs', hint: 'Home, car, personal, credit-card EMIs' },
  { key: 'emergencySavings', label: 'Emergency savings', hint: 'Savings account, FDs, liquid funds' },
];
const EXAMPLE: CfoInputs = { monthlyIncome: 120000, monthlyExpenses: 62000, monthlyEmi: 28000, emergencySavings: 250000 };
const STATUS_TONE: Record<CfoStatus, string> = { Strong: 'good', Stable: 'ok', Watch: 'warn', Critical: 'bad' };

/** Eases a displayed number toward its target so score changes feel alive. */
function useAnimatedNumber(target: number, duration = 700): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(target); from.current = target; return; }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const next = origin + (target - origin) * (1 - (1 - t) ** 3);
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick); else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); from.current = target; };
  }, [target, duration]);
  return value;
}

type Prompt = { id: number; text: string } | null;

/** `externalPrompt` lets other parts of the page (module cards) hand a question to this chat. */
export const LandingAiCfo: React.FC<{ onEnter: (destination: AppNavigationDestination) => void; externalPrompt?: Prompt }> = ({ onEnter, externalPrompt = null }) => {
  const [raw, setRaw] = useState<Record<keyof CfoInputs, string>>(() => Object.fromEntries(Object.entries(EXAMPLE).map(([k, v]) => [k, String(v)])) as Record<keyof CfoInputs, string>);
  const [reviewPrompt, setReviewPrompt] = useState<Prompt>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const inputs: CfoInputs = useMemo(() => ({
    monthlyIncome: Number(raw.monthlyIncome.replace(/,/g, '')),
    monthlyExpenses: Number(raw.monthlyExpenses.replace(/,/g, '')),
    monthlyEmi: Number(raw.monthlyEmi.replace(/,/g, '')),
    emergencySavings: Number(raw.emergencySavings.replace(/,/g, '')),
  }), [raw]);
  const error = validateCfoInputs(inputs);
  const report = useMemo(() => (error ? null : buildCfoHealthReport(inputs)), [inputs, error]);
  const score = useAnimatedNumber(report?.score ?? 0);
  const circumference = 2 * Math.PI * 52;
  const latestPrompt = [reviewPrompt, externalPrompt].filter((item): item is NonNullable<Prompt> => item !== null).sort((a, b) => b.id - a.id)[0] ?? null;

  const askForCommentary = () => {
    if (!report) return;
    setReviewPrompt({ id: Date.now(), text: cfoReviewPrompt(inputs, report) });
    chatRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  };

  return <section id="ai-cfo" className="cl-section cfo-land cl-reveal-section">
    <div className="cl-wrap">
      <div className="cl-eyebrow">AI CFO</div>
      <h2>Your personal CFO, in plain rupees.</h2>
      <p className="cl-sub">Get an instant, verified health check of your money, then ask the AI CFO anything: tax regime, EMIs, goals or business cash flow.</p>
      <div className="cfo-land-grid">
        <div className="cfo-check cl-card">
          <div className="cfo-check-head"><span className="cfo-check-icon"><Gauge size={17}/></span><div><b>Instant CFO health check</b><small>Calculated on your device. Nothing is stored or sent.</small></div></div>
          <div className="cfo-fields">
            {FIELDS.map((field) => <label key={field.key} className="cfo-field">
              <span>{field.label}</span>
              <div className="cfo-input"><i>₹</i><input inputMode="numeric" value={raw[field.key]} aria-describedby={`hint-${field.key}`}
                onChange={(event) => setRaw((current) => ({ ...current, [field.key]: event.target.value.replace(/[^\d.,]/g, '') }))}/></div>
              <small id={`hint-${field.key}`}>{field.hint}</small>
            </label>)}
          </div>
          {error ? <p className="cfo-error" role="alert">{error}</p> : report && <div className="cfo-result">
            <div className="cfo-score" data-tone={STATUS_TONE[report.status]}>
              <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" className="cfo-score-track"/><circle cx="60" cy="60" r="52" className="cfo-score-arc" style={{ strokeDasharray: circumference, strokeDashoffset: circumference * (1 - report.score / 100) }}/></svg>
              <div><b>{Math.round(score)}</b><small>/100</small><span>{report.status}</span></div>
            </div>
            <div className="cfo-metrics">
              {report.metrics.map((metric) => <div key={metric.key} className="cfo-metric" data-tone={STATUS_TONE[metric.status]}>
                <div><span>{metric.label}</span><b>{metric.display}</b></div>
                <div className="cfo-bar"><i style={{ transform: `scaleX(${Math.max(0.02, metric.progress)})` }}/></div>
                <small>Target: {metric.target}</small>
              </div>)}
            </div>
            <p className="cfo-summary" aria-live="polite">{report.summary}</p>
            <ol className="cfo-actions">{report.actions.map((action, index) => <li key={action.title} style={{ '--i': index } as React.CSSProperties}>
              <span className="cfo-horizon">{action.horizon}</span><b>{action.title}{action.amount != null && action.amount > 0 && <em>{formatInr(action.amount)}</em>}</b><p>{action.detail}</p>
            </li>)}</ol>
            <div className="cfo-check-cta">
              <button type="button" className="cl-primary" onClick={askForCommentary}><Sparkles size={15}/>Get AI CFO commentary</button>
              <button type="button" className="cl-secondary" onClick={() => onEnter('financial-health')}>Track this in my workspace<ArrowRight size={15}/></button>
            </div>
          </div>}
        </div>
        <div className="cfo-chat-wrap" ref={chatRef}>
          <AiCfoChat externalPrompt={latestPrompt} suggestFor={(question) => {
            const route = detectArthaPilotIntent(question);
            return route.destination ? { label: `Open ${route.workspaceLabel}`, onOpen: () => onEnter(route.destination as AppNavigationDestination) } : null;
          }}/>
        </div>
      </div>
    </div>
  </section>;
};
