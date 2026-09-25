import React, { useEffect, useState } from 'react';
import { Brain, Sparkles } from 'lucide-react';
import type { StructuredFinancialAnswer } from '../../types';
import { StructuredFinancialAnswerView } from '../ai/StructuredFinancialAnswer';
import { ThinkingSteps } from '../ai/ThinkingSteps';
import './planners.css';

export type Tone = 'good' | 'warn' | 'bad' | 'info';
export const inr = (v: number) => `${v < 0 ? '−' : ''}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`;
export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;

/** Inputs kept in this browser so the plan is there next time. */
export function useStoredState<T extends object>(key: string, initial: () => T): [T, (patch: Partial<T>) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); if (raw) return { ...initial(), ...JSON.parse(raw) }; } catch { /* storage blocked */ }
    return initial();
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } }, [key, value]);
  return [value, (patch) => setValue((v) => ({ ...v, ...patch })), () => setValue(initial())];
}

/** A money, percentage or plain number field with a slider; values are stored as numbers. */
export const Field: React.FC<{ label: string; value: number; onChange: (v: number) => void; kind?: 'money' | 'pct' | 'num'; min?: number; max: number; step?: number; hint?: string; suffix?: string }> = ({ label, value, onChange, kind = 'money', min = 0, max, step, hint, suffix }) => {
  const shown = kind === 'pct' ? +(value * 100).toFixed(2) : value;
  const [text, setText] = useState(kind === 'money' ? Math.round(shown).toLocaleString('en-IN') : String(shown));
  useEffect(() => { setText(kind === 'money' ? Math.round(shown).toLocaleString('en-IN') : String(shown)); }, [shown, kind]);
  const commit = (raw: string) => {
    const n = Number(raw.replace(/[₹,\s%]/g, ''));
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(kind === 'pct' ? max * 100 : max, Math.max(kind === 'pct' ? min * 100 : min, n));
    onChange(kind === 'pct' ? clamped / 100 : clamped);
  };
  const sMin = kind === 'pct' ? min * 100 : min, sMax = kind === 'pct' ? max * 100 : max;
  return <label className="pk-field">
    <span className="pk-label">{label}{hint && <small>{hint}</small>}</span>
    <span className="pk-input">{kind === 'money' && <i>₹</i>}<input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }}/>{kind === 'pct' && <i>%</i>}{suffix && <i>{suffix}</i>}</span>
    <input type="range" min={sMin} max={sMax} step={step ?? (kind === 'pct' ? 0.5 : kind === 'money' ? Math.max(500, Math.round(sMax / 400 / 500) * 500) : 1)} value={Math.min(sMax, Math.max(sMin, shown))} onChange={(e) => onChange(kind === 'pct' ? Number(e.target.value) / 100 : Number(e.target.value))} aria-label={label}/>
  </label>;
};

export const Kpi: React.FC<{ label: string; value: string; note?: string; tone: Tone; big?: boolean }> = ({ label, value, note, tone, big }) =>
  <article className={`pk-kpi ${tone} ${big ? 'big' : ''}`}><small>{label}</small><b>{value}</b>{note && <span>{note}</span>}</article>;

export const Card: React.FC<{ title: string; tone?: Tone; status?: string; sub?: string; children: React.ReactNode; className?: string }> = ({ title, tone = 'info', status, sub, children, className }) =>
  <article className={`pk-card ${tone} ${className ?? ''}`}><header><h3>{title}</h3>{status && <span className={`pk-status ${tone}`}>{status}</span>}{sub && <small>{sub}</small>}</header>{children}</article>;

/** Area chart for a yearly series; points can switch colour by phase. */
export const AreaChart: React.FC<{ points: Array<{ x: number; y: number; phase?: string }>; colors: Record<string, string>; xLabel: (x: number) => string; yLabel: (y: number) => string; marker?: { x: number; label: string } }> = ({ points, colors, xLabel, yLabel, marker }) => {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 640, H = 220, pad = { l: 8, r: 8, t: 10, b: 22 };
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(1, ...ys);
  const X = (x: number) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (W - pad.l - pad.r);
  const Y = (y: number) => pad.t + (1 - y / y1) * (H - pad.t - pad.b);
  const phases: string[] = [...new Set<string>(points.map((p) => p.phase ?? 'a'))];
  const h = hover != null ? points[hover] : null;
  return <div className="pk-chart">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projection chart" onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const x = x0 + ((e.clientX - r.left) / r.width) * (x1 - x0); setHover(points.reduce((best, p, i) => (Math.abs(p.x - x) < Math.abs(points[best].x - x) ? i : best), 0)); }}>
      <defs>{phases.map((ph) => <linearGradient key={ph} id={`pk-g-${ph}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={colors[ph] ?? '#059669'} stopOpacity=".35"/><stop offset="1" stopColor={colors[ph] ?? '#059669'} stopOpacity="0"/></linearGradient>)}</defs>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={pad.l} x2={W - pad.r} y1={Y(y1 * f)} y2={Y(y1 * f)} className="pk-grid"/>)}
      {phases.map((ph) => {
        const seg = points.filter((p, i) => (p.phase ?? 'a') === ph || (points[i + 1] && (points[i + 1].phase ?? 'a') === ph));
        if (seg.length < 2) return null;
        const line = seg.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
        return <g key={ph}><path d={`${line} L${X(seg[seg.length - 1].x)} ${Y(0)} L${X(seg[0].x)} ${Y(0)} Z`} fill={`url(#pk-g-${ph})`}/><path d={line} fill="none" stroke={colors[ph] ?? '#059669'} strokeWidth="2.4" strokeLinejoin="round" className="pk-line"/></g>;
      })}
      {marker && <g><line x1={X(marker.x)} x2={X(marker.x)} y1={pad.t} y2={H - pad.b} stroke="#dc2626" strokeDasharray="4 4"/><text x={X(marker.x) + 4} y={pad.t + 12} className="pk-marker">{marker.label}</text></g>}
      {h && <g><line x1={X(h.x)} x2={X(h.x)} y1={pad.t} y2={H - pad.b} className="pk-cursor"/><circle cx={X(h.x)} cy={Y(h.y)} r="4.5" fill={colors[h.phase ?? 'a'] ?? '#059669'} stroke="#fff" strokeWidth="2"/></g>}
      <text x={pad.l} y={H - 5} className="pk-axis">{xLabel(x0)}</text><text x={W - pad.r} y={H - 5} textAnchor="end" className="pk-axis">{xLabel(x1)}</text>
    </svg>
    {h && <div className="pk-tip"><b>{xLabel(h.x)}</b> · {yLabel(h.y)}</div>}
  </div>;
};

/** Horizontal bars comparing a few amounts. */
export const Bars: React.FC<{ rows: Array<{ label: string; value: number; color: string; note?: string }> }> = ({ rows }) => {
  const peak = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return <div className="pk-bars">{rows.map((r) => <div key={r.label} className="pk-bar"><span>{r.label}</span><i><b style={{ width: `${Math.max(2, (Math.abs(r.value) / peak) * 100)}%`, background: r.color }}/></i><em>{inr(r.value)}{r.note ? <small> {r.note}</small> : null}</em></div>)}</div>;
};

/** The AI reads the plan on screen (every number) plus live data, and answers for this person. */
export const PlanAI: React.FC<{ title: string; summary: string; questions: string[] }> = ({ title, summary, questions }) => {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<StructuredFinancialAnswer | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const ask = async (question: string) => {
    if (busy || !question.trim()) return;
    setBusy(true); setError(''); setAnswer(null);
    try {
      const res = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        task: 'cfo',
        prompt: `You are reviewing the user's ${title}. Use every number below (they come from tested formulas on screen), current Indian rates and costs from the live context, and answer for this person. Show the numbers behind each point and give concrete steps with amounts.\n\nPLAN\n${summary}\n\nQuestion: ${question}`,
        context: { country: 'India', currency: 'INR', language: 'english', detail: 'detailed' },
      }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The AI could not answer right now.');
      if (data.structuredAnswer) setAnswer(data.structuredAnswer); else throw new Error('No answer came back. Please try again.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  return <article className="pk-card info pk-ai">
    <header><h3><Brain size={16}/> AI review of this plan</h3><span className="pk-status info"><Sparkles size={11}/> Live data</span><small>The AI reads every number here plus current rates, fees and news.</small></header>
    <div className="pk-ai-quick">{questions.map((x, i) => <button key={x} type="button" className={i === 0 ? 'primary' : ''} disabled={busy} onClick={() => void ask(x)}>{x}</button>)}</div>
    <form className="pk-ai-form" onSubmit={(e) => { e.preventDefault(); void ask(q); }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything about this plan…" aria-label="Ask about this plan"/><button type="submit" disabled={busy || !q.trim()}>Ask</button></form>
    <ThinkingSteps active={busy}/>
    {error && <p className="pk-error">{error}</p>}
    {answer && <StructuredFinancialAnswerView answer={answer} compact/>}
  </article>;
};

export const PlannerHeader: React.FC<{ kicker: string; title: string; text: string; onReset: () => void }> = ({ kicker, title, text, onReset }) =>
  <header className="pk-head"><div><small>{kicker}</small><h1>{title}</h1><p>{text}</p></div><button type="button" onClick={onReset}>Reset to defaults</button></header>;
