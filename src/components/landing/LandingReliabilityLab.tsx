import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { AlertTriangle, BookOpen, Calculator, CheckCircle2, Database, LineChart, RotateCcw } from 'lucide-react';
import './reliabilityLab.css';

/**
 * AI Reliability Lab demo that plays by itself: Answer → Evaluate → Evidence → Reliability, then loops.
 * It runs whenever it is on screen (hover never pauses it) and shows the final state for reduced motion.
 */

const QUESTION = 'What happens to my savings if inflation rises?';
// ₹1,00,000 at 4% after tax = ₹1,04,000; ÷ 1.06 for 6% inflation = ₹98,113 in today's money.
const ANSWER = 'If prices rise faster than your return, your money buys less. With 6% inflation, ₹1,00,000 earning 4% after tax is worth about ₹98,100 in today’s money after a year.';

const CHECKS: Array<{ name: string; ok: boolean; note: string }> = [
  { name: 'Reasoning', ok: true, note: 'Logic holds' },
  { name: 'Numerical accuracy', ok: true, note: '₹1,04,000 ÷ 1.06 = ₹98,113' },
  { name: 'Grounding', ok: true, note: 'Uses the stated rates' },
  { name: 'Risk awareness', ok: true, note: 'Flags lost buying power' },
  { name: 'Explainability', ok: true, note: 'Plain-language steps' },
  { name: 'Evidence', ok: false, note: 'Needs a CPI source' },
];
const EVIDENCE: Array<{ name: string; detail: string; icon: React.ComponentType<{ size?: number }>; ok: boolean }> = [
  { name: 'Calculation', detail: 'Deterministic, re-run and matched', icon: Calculator, ok: true },
  { name: 'Structured knowledge', detail: 'Real vs nominal return', icon: BookOpen, ok: true },
  { name: 'Economic data', detail: 'Current CPI inflation not cited', icon: LineChart, ok: false },
  { name: 'Market data', detail: 'Not needed for this question', icon: Database, ok: true },
];
const STEPS = ['Answer', 'Evaluate', 'Evidence', 'Reliability'] as const;

// Timeline (ms from start of a run).
const T = { answerEnd: 2600, checkEvery: 380, evidenceStart: 5200, evidenceEvery: 380, scoreAt: 7000, loopAt: 11500 };
const passed = CHECKS.filter((c) => c.ok).length;

export const LandingReliabilityLab: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const reduced = Boolean(useReducedMotion());
  const [run, setRun] = useState(0);
  const [elapsed, setElapsed] = useState(reduced ? T.loopAt : 0);

  useEffect(() => {
    if (reduced) { setElapsed(T.loopAt); return; }
    if (!inView) return;
    const start = performance.now() - elapsed;
    let frame = 0;
    const tick = (now: number) => {
      const t = now - start;
      if (t >= T.loopAt + 1800) { setElapsed(0); setRun((r) => r + 1); return; }
      setElapsed(t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, run]); // eslint-disable-line react-hooks/exhaustive-deps

  const typed = Math.round(Math.min(1, elapsed / T.answerEnd) * ANSWER.length);
  const checksDone = Math.max(0, Math.min(CHECKS.length, Math.floor((elapsed - T.answerEnd) / T.checkEvery) + 1));
  const evidenceDone = Math.max(0, Math.min(EVIDENCE.length, Math.floor((elapsed - T.evidenceStart) / T.evidenceEvery) + 1));
  const scored = elapsed >= T.scoreAt;
  const step = scored ? 3 : elapsed >= T.evidenceStart ? 2 : elapsed >= T.answerEnd ? 1 : 0;
  const progress = Math.min(1, elapsed / T.scoreAt);
  const score = scored ? passed : Math.min(passed, CHECKS.slice(0, checksDone).filter((c) => c.ok).length);

  const replay = () => { setElapsed(0); setRun((r) => r + 1); };

  return <div ref={ref} className="rl" aria-label="AI Reliability Lab demo, playing automatically">
    <ol className="rl-steps" aria-label="Evaluation steps">
      {STEPS.map((s, i) => <li key={s} className={i < step ? 'done' : i === step ? 'on' : ''} aria-current={i === step ? 'step' : undefined}>
        <span className="rl-step-n">{i + 1}</span>{s}
      </li>)}
      <span className="rl-steps-bar" aria-hidden="true"><i style={{ transform: `scaleX(${progress})` }}/></span>
    </ol>

    <div className="rl-grid">
      <section className={`rl-card ${step === 0 ? 'active' : ''}`}>
        <small className="rl-kicker">Question</small>
        <p className="rl-q">{QUESTION}</p>
        <small className="rl-kicker">AI answer</small>
        <p className="rl-a">{ANSWER.slice(0, typed)}{typed < ANSWER.length && <span className="rl-caret" aria-hidden="true"/>}</p>
      </section>

      <section className={`rl-card ${step === 1 ? 'active' : ''}`}>
        <small className="rl-kicker">Six checks</small>
        <ul className="rl-checks">{CHECKS.map((c, i) => {
          const done = i < checksDone;
          return <li key={c.name} className={done ? (c.ok ? 'pass' : 'warn') : ''}>
            <span className="rl-check-icon" aria-hidden="true">{done ? (c.ok ? <CheckCircle2 size={15}/> : <AlertTriangle size={15}/>) : <i className="rl-spin"/>}</span>
            <span><b>{c.name}</b>{done && <small>{c.note}</small>}</span>
            <em>{done ? (c.ok ? 'Pass' : 'Gap') : 'Checking'}</em>
          </li>;
        })}</ul>
      </section>

      <section className={`rl-card ${step >= 2 ? 'active' : ''}`}>
        <small className="rl-kicker">Evidence</small>
        <ul className="rl-evidence">{EVIDENCE.map((e, i) => {
          const Icon = e.icon; const lit = i < evidenceDone;
          return <li key={e.name} className={lit ? (e.ok ? 'lit' : 'lit warn') : ''}><span className="rl-ev-icon"><Icon size={14}/></span><span><b>{e.name}</b><small>{e.detail}</small></span></li>;
        })}</ul>
        <div className="rl-score">
          <div className="rl-ring" style={{ '--p': score / CHECKS.length } as React.CSSProperties}><b>{score}</b><small>of {CHECKS.length}</small></div>
          <AnimatePresence mode="wait" initial={false}>
            {scored
              ? <motion.p key="verdict" className="rl-verdict" initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}><b>Reliable, with one gap.</b> Cite the current CPI inflation figure before relying on it.</motion.p>
              : <motion.p key="wait" className="rl-verdict muted" initial={false} animate={{ opacity: 1 }}>Scoring after the evidence check…</motion.p>}
          </AnimatePresence>
        </div>
      </section>
    </div>

    <div className="rl-foot">
      <span>Sample evaluation · plays automatically</span>
      <button type="button" className="rl-replay" onClick={replay}><RotateCcw size={13}/> Replay</button>
    </div>
  </div>;
};
