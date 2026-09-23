import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { BadgeCheck, Newspaper, ReceiptIndianRupee } from 'lucide-react';
import './marketIntelligenceFlow.css';

/**
 * "Market Intelligence Flow": public signals travel into the ArthaMind reasoning core,
 * which verifies, compares and explains them, and ArthaBench shows an inspectable answer.
 * All figures are illustrative demo values and are labelled as such.
 */

type Phase = 'idle' | 'enter' | 'flow' | 'verify' | 'compare' | 'risk' | 'explain' | 'answer' | 'exit';
const ORDER: Phase[] = ['idle', 'enter', 'flow', 'verify', 'compare', 'risk', 'explain', 'answer', 'exit'];
// Seconds at which each phase starts; the full loop is 10.8s.
const SCHEDULE: Array<[Phase, number]> = [['enter', 0.1], ['flow', 1.5], ['verify', 2.4], ['compare', 4.0], ['risk', 5.4], ['explain', 6.6], ['answer', 7.6], ['exit', 10.2]];
const LOOP_SECONDS = 10.8;
const at = (phase: Phase, from: Phase) => ORDER.indexOf(phase) >= ORDER.indexOf(from);

const STATUS: Partial<Record<Phase, { text: string; tone: 'blue' | 'emerald' | 'amber' }>> = {
  flow: { text: 'Receiving public market data', tone: 'blue' },
  verify: { text: 'Verifying sources', tone: 'emerald' },
  compare: { text: 'Comparing market signals', tone: 'emerald' },
  risk: { text: 'Detecting risk', tone: 'amber' },
  explain: { text: 'Generating explanation', tone: 'emerald' },
  answer: { text: 'Answer ready · inspectable', tone: 'emerald' },
};
const CORE_STEPS: Array<{ label: string; phase: Phase }> = [
  { label: 'Verify', phase: 'verify' }, { label: 'Compare', phase: 'compare' }, { label: 'Reason', phase: 'risk' }, { label: 'Explain', phase: 'explain' },
];

// Positions in a 1000×540 design space; HTML cards and SVG paths share it so they stay aligned.
interface Signal { id: string; x: number; y: number; from: { x: number; y: number }; kind: 'market' | 'finance' | 'news' }
const SIGNALS: Signal[] = [
  { id: 'nifty', x: 20, y: 34, from: { x: -60, y: 0 }, kind: 'market' },
  { id: 'btc', x: 20, y: 146, from: { x: -60, y: 0 }, kind: 'market' },
  { id: 'gold', x: 20, y: 258, from: { x: -60, y: 0 }, kind: 'market' },
  { id: 'fx', x: 20, y: 370, from: { x: -60, y: 0 }, kind: 'market' },
  { id: 'txn', x: 262, y: 8, from: { x: 0, y: -50 }, kind: 'finance' },
  { id: 'news', x: 262, y: 440, from: { x: 0, y: 50 }, kind: 'news' },
];
const CARD_W = 200, CARD_H = 84, CORE = { x: 560, y: 270 };
const anchor = (s: Signal) => s.kind === 'market' ? { x: s.x + CARD_W, y: s.y + CARD_H / 2 } : { x: s.x + CARD_W / 2 + 40, y: s.id === 'txn' ? s.y + CARD_H : s.y };
const pathFor = (s: Signal) => {
  const a = anchor(s);
  if (s.kind === 'market') return `M${a.x},${a.y} C${a.x + 150},${a.y} ${CORE.x - 170},${CORE.y + (a.y - CORE.y) * 0.25} ${CORE.x - 78},${CORE.y}`;
  const dir = s.id === 'txn' ? 1 : -1;
  return `M${a.x},${a.y} C${a.x},${a.y + 90 * dir} ${CORE.x - 60},${CORE.y - 120 * dir} ${CORE.x - 40},${CORE.y - 62 * dir}`;
};

const Spark: React.FC<{ points: number[]; tone: 'up' | 'down'; play: boolean }> = ({ points, tone, play }) => {
  const min = Math.min(...points), max = Math.max(...points);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${(i / (points.length - 1)) * 60},${16 - ((p - min) / (max - min || 1)) * 14}`).join(' ');
  return <svg className={`mif-spark ${tone}`} viewBox="0 0 60 18" aria-hidden="true">
    <motion.path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" initial={{ pathLength: 0 }} animate={{ pathLength: play ? 1 : 0 }} transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }}/>
  </svg>;
};

const SignalCard: React.FC<{ id: string; play: boolean }> = ({ id, play }) => {
  switch (id) {
    case 'nifty': return <><small>NIFTY 50 · Index</small><div className="mif-row"><b>23,329</b><span className="up">▲ 0.42%</span></div><Spark points={[3, 4, 3.6, 5, 4.6, 6, 5.8, 7]} tone="up" play={play}/></>;
    case 'btc': return <><small>BTC/USDT · Crypto</small><div className="mif-row"><b>86,292</b><span className="up">▲ 1.14%</span></div><Spark points={[5, 4, 6, 5.5, 7, 6.2, 8, 7.6]} tone="up" play={play}/></>;
    case 'gold': return <><small>Gold · COMEX</small><div className="mif-row"><b>$4,399.9</b><span className="up">▲ 0.54%</span></div><Spark points={[4, 4.5, 4.2, 5, 5.4, 5.1, 5.8, 6]} tone="up" play={play}/></>;
    case 'fx': return <><small>USD/INR · FX</small><div className="mif-row"><b>₹95.58</b><span className="down">▼ 0.23%</span></div><Spark points={[7, 6.6, 6.8, 6, 5.6, 5.9, 5.2, 5]} tone="down" play={play}/></>;
    case 'txn': return <><small><ReceiptIndianRupee size={11} aria-hidden="true"/> Transactions</small><div className="mif-txn"><span>Salary credit</span><b className="up">+₹85,000</b></div><div className="mif-txn"><span>Home-loan EMI</span><b className="down">−₹28,000</b></div></>;
    default: return <><small><Newspaper size={11} aria-hidden="true"/> Market news</small><p className="mif-news">RBI holds repo rate; bond yields ease</p><span className="mif-src">Business wire · 12 min ago</span></>;
  }
};

export const MarketIntelligenceFlow: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduce ? 'answer' : 'idle');
  const [cycle, setCycle] = useState(0);

  // Phase clock: runs only while visible; reduced motion shows the finished state without looping.
  useEffect(() => {
    if (reduce) { setPhase('answer'); return; }
    if (!inView) return;
    const timers = SCHEDULE.map(([next, seconds]) => window.setTimeout(() => setPhase(next), seconds * 1000));
    timers.push(window.setTimeout(() => { setPhase('idle'); setCycle((c) => c + 1); }, LOOP_SECONDS * 1000));
    return () => timers.forEach(window.clearTimeout);
  }, [inView, reduce, cycle]);

  const visible = at(phase, 'enter') && phase !== 'exit';
  const flowing = at(phase, 'flow') && phase !== 'exit';
  const answered = phase === 'answer';
  const status = STATUS[phase];
  const spring = { type: 'spring' as const, stiffness: 140, damping: 20, mass: 0.9 };

  return <div ref={ref} className="mif" role="img" aria-label="Illustration: market and personal-finance signals flow into the ArthaMind Intelligence core, which verifies sources, compares signals, detects risk and generates an explanation that ArthaBench presents with a confidence score and verified sources.">
    <div className="mif-bar">
      <span className="mif-demo">Illustrative demo · sample values, not live data</span>
      <span className={`mif-status tone-${status?.tone ?? 'blue'}`} aria-hidden="true">
        <i/>{status?.text ?? 'Waiting for signals'}
      </span>
    </div>

    <div className="mif-stage" aria-hidden="true">
      <svg className="mif-paths" viewBox="0 0 1000 540" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="mif-blue" x1="0" x2="1"><stop offset="0" stopColor="#7aa2d6" stopOpacity=".15"/><stop offset="1" stopColor="#34d399" stopOpacity=".55"/></linearGradient>
        </defs>
        {SIGNALS.map((s, i) => <g key={s.id}>
          <path d={pathFor(s)} className="mif-track"/>
          <motion.path d={pathFor(s)} stroke="url(#mif-blue)" strokeWidth="1.4" fill="none" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: visible ? 1 : 0, opacity: visible ? 1 : 0 }} transition={{ duration: 0.9, delay: visible ? 0.35 + i * 0.12 : 0, ease: [0.2, 0.7, 0.2, 1] }}/>
          {flowing && <motion.path key={`${s.id}-${cycle}`} d={pathFor(s)} className="mif-packet" fill="none" strokeWidth="2.4" strokeLinecap="round"
            initial={{ pathLength: 0.07, pathOffset: 0, opacity: 0 }} animate={{ pathOffset: [0, 0.93], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.5, delay: i * 0.22, ease: [0.45, 0, 0.2, 1], repeat: 1, repeatDelay: 1.6 }}/>}
        </g>)}
        <motion.path d={`M${CORE.x + 78},${CORE.y} C${CORE.x + 130},${CORE.y} ${CORE.x + 110},${CORE.y} 700,${CORE.y}`} stroke="#34d399" strokeWidth="1.4" fill="none" strokeOpacity=".6"
          initial={{ pathLength: 0 }} animate={{ pathLength: answered ? 1 : 0 }} transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}/>
      </svg>

      {SIGNALS.map((s, i) => <motion.div key={s.id} className={`mif-card kind-${s.kind}`}
        style={{ left: `${(s.x / 1000) * 100}%`, top: `${(s.y / 540) * 100}%`, width: `${(CARD_W / 1000) * 100}%` }}
        initial={{ opacity: 0, x: s.from.x, y: s.from.y }}
        animate={visible ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: s.from.x * 0.4, y: s.from.y * 0.4 }}
        transition={{ ...spring, delay: visible ? i * 0.14 : 0 }}>
        <SignalCard id={s.id} play={visible}/>
      </motion.div>)}

      <div className="mif-core-wrap" style={{ left: `${(CORE.x / 1000) * 100}%`, top: `${(CORE.y / 540) * 100}%` }}>
        <motion.div className="mif-core" animate={{ scale: at(phase, 'verify') && !answered && phase !== 'exit' ? [1, 1.05, 1] : 1 }} transition={{ duration: 1.4, repeat: at(phase, 'verify') && !answered ? Infinity : 0, ease: 'easeInOut' }}>
          <span className={`mif-ring r1 ${flowing ? 'spin' : ''}`}/><span className={`mif-ring r2 ${flowing ? 'spin' : ''}`}/>
          <motion.span className="mif-pulse" animate={{ opacity: at(phase, 'verify') && phase !== 'exit' ? [0, 0.55, 0] : 0, scale: [0.9, 1.25] }} transition={{ duration: 1.4, repeat: at(phase, 'verify') && !answered ? Infinity : 0 }}/>
          <div className="mif-hex"><b>ArthaMind</b><small>Intelligence</small></div>
        </motion.div>
        <ul className="mif-steps">{CORE_STEPS.map((step) => <li key={step.label} className={phase === step.phase ? 'on' : at(phase, step.phase) && phase !== 'exit' ? 'done' : ''}>{at(phase, step.phase) && phase !== step.phase && phase !== 'exit' ? '✓ ' : ''}{step.label}</li>)}</ul>
      </div>

      <motion.div className="mif-output mif-ghost" style={{ left: '70%', top: `${(160 / 540) * 100}%` }} animate={{ opacity: answered ? 0 : 0.5 }} transition={{ duration: 0.4 }}>
        <header><span>ArthaBench answer</span></header>
        <p>{flowing ? 'Awaiting verified reasoning…' : 'Waiting for signals…'}</p>
        <i/><i/><i/>
      </motion.div>
      <motion.div className="mif-output" style={{ left: '70%', top: `${(160 / 540) * 100}%` }}
        initial={{ opacity: 0, x: 24 }} animate={answered ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }} transition={spring}>
        <header><span>ArthaBench answer</span><em><BadgeCheck size={12}/> Inspectable</em></header>
        <p>Market momentum is positive, but volatility remains elevated.</p>
        <div className="mif-conf"><span>Confidence</span><b>87%</b></div>
        <div className="mif-meter"><motion.i initial={{ scaleX: 0 }} animate={{ scaleX: answered ? 0.87 : 0 }} transition={{ duration: 1, delay: 0.25, ease: [0.2, 0.7, 0.2, 1] }}/></div>
        <footer><span>6 verified sources</span><span className="amber">1 risk flag: FX weakness</span></footer>
      </motion.div>
    </div>

    <ol className="mif-legend">
      <li><i className="dot blue"/>Public market data enters</li>
      <li><i className="dot emerald"/>ArthaMind verifies and reasons over it</li>
      <li><i className="dot white"/>ArthaBench presents an inspectable answer</li>
    </ol>
  </div>;
};

export default MarketIntelligenceFlow;
