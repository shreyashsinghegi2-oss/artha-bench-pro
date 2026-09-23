import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { ArrowRight, BadgeIndianRupee, Gauge, ShieldCheck, Sparkles, Target, TrendingUp } from 'lucide-react';
import './modulePipeline.css';

/** [code, name, description, category, target] — same shape as the landing `modules` list. */
export type PipelineModule = readonly [string, string, string, string, string];

interface Stage {
  id: string;
  step: string;
  title: string;
  verb: string;
  summary: string;
  detail: string;
  icon: React.ComponentType<{ size?: number }>;
  codes: string[];
}

const STAGES: Stage[] = [
  { id: 'understand', step: '01', title: 'Understand', verb: 'See where you stand', icon: Gauge, codes: ['SD', 'NW', 'HS', 'MD'],
    summary: 'Income, spending, EMIs and assets are organised into one live picture.',
    detail: 'Your savings rate, EMI load, emergency runway and net worth are calculated with exact decimal maths, next to market context for NIFTY, SENSEX, USD/INR and gold.' },
  { id: 'optimise', step: '02', title: 'Optimise', verb: 'Keep more of every rupee', icon: BadgeIndianRupee, codes: ['TX', 'EM', 'PT'],
    summary: 'Tax, loans and investments are compared on the same after-tax terms.',
    detail: 'Old versus new regime, unused 80C/80D/NPS room, prepay-or-invest on loans, and real (inflation-adjusted) returns across SIPs, FDs, PPF and NPS.' },
  { id: 'protect', step: '03', title: 'Protect', verb: 'Close the gaps', icon: ShieldCheck, codes: ['IN', 'FA', 'RR'],
    summary: 'Cover, dependants and risk are checked before anything is invested.',
    detail: 'Human Life Value and term-cover gap, stress per earner in the family, and a five-dimension risk radar with the three actions that reduce risk most.' },
  { id: 'plan', step: '04', title: 'Plan', verb: 'Fund every goal', icon: Target, codes: ['GP', 'RP', 'EC', 'CI'],
    summary: 'Each goal gets a monthly amount, a timeline and a scenario range.',
    detail: 'Retirement corpus, education costs with education inflation, career income paths and goal SIPs, each shown with the assumptions you can change.' },
];

const INPUTS = ['Income', 'Expenses', 'EMIs', 'Savings', 'Goals'];
const CYCLE_MS = 4200;

export const LandingModulePipeline: React.FC<{
  modules: readonly PipelineModule[];
  onOpen: (target: string) => void;
  onAsk: (prompt: string) => void;
}> = ({ modules, onOpen, onAsk }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);
  const byCode = new Map<string, PipelineModule>(modules.map((m) => [m[0], m] as const));
  const advisor = byCode.get('AI');

  useEffect(() => {
    if (!inView || pinned || reduced) return;
    const id = window.setInterval(() => setActive((value) => (value + 1) % STAGES.length), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [inView, pinned, reduced]);

  const launch = (module: PipelineModule) => {
    const target = module[4];
    if (target.startsWith('ask:')) onAsk(target.slice(4));
    else onOpen(target);
  };
  const stage = STAGES[active];

  return <div ref={ref} className={`mp ${inView ? 'is-in' : ''}`} style={{ '--active': active } as React.CSSProperties} onMouseLeave={() => setPinned(false)}>
    {/* Inputs → pipe → output */}
    <div className="mp-rail">
      <div className="mp-inputs" aria-label="What you bring">
        <small>You bring</small>
        {INPUTS.map((input, i) => <span key={input} style={{ '--i': i } as React.CSSProperties}>{input}</span>)}
      </div>
      <div className="mp-track" role="tablist" aria-label="How ArthaMind works, stage by stage">
        <div className="mp-pipe" aria-hidden="true"><i className="mp-flow"/><i className="mp-fill" style={{ transform: `scaleX(${(active + 0.5) / STAGES.length})` }}/></div>
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          return <button key={s.id} type="button" role="tab" aria-selected={i === active} aria-controls="mp-panel"
            className={`mp-station s-${s.id} ${i === active ? 'on' : ''} ${i < active ? 'done' : ''}`}
            onMouseEnter={() => { setActive(i); setPinned(true); }} onFocus={() => { setActive(i); setPinned(true); }} onClick={() => { setActive(i); setPinned(true); }}>
            <span className="mp-node"><Icon size={18}/><em>{s.step}</em></span>
            <b>{s.title}</b><small>{s.verb}</small>
          </button>;
        })}
      </div>
      <div className="mp-output">
        <span className="mp-output-glow" aria-hidden="true"/>
        <Sparkles size={18}/>
        <b>Your CFO plan</b>
        <small>Explained, sourced, yours to act on</small>
      </div>
    </div>

    {/* Stage explanation + its modules */}
    <div className="mp-stage">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={stage.id} id="mp-panel" role="tabpanel" className={`mp-panel s-${stage.id}`}
          initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: 0.38, ease: [0.2, 0.7, 0.2, 1] }}>
          <div className="mp-copy">
            <span className="mp-kicker">Stage {stage.step} · {stage.title}</span>
            <h3>{stage.summary}</h3>
            <p>{stage.detail}</p>
            {!pinned && !reduced && <span className="mp-timer" aria-hidden="true"><i key={active}/></span>}
          </div>
          <ul className="mp-modules">
            {stage.codes.map((code, i) => {
              const module = byCode.get(code);
              if (!module) return null;
              const asks = module[4].startsWith('ask:');
              return <motion.li key={code} initial={reduced ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduced ? 0 : 0.08 + i * 0.07, duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}>
                <button type="button" className="mp-module" onClick={() => launch(module)}>
                  <span className="mp-module-code">{module[0]}</span>
                  <span className="mp-module-text"><b>{module[1]}</b><small>{module[2]}</small></span>
                  <span className="mp-module-go">{asks ? 'Ask' : 'Open'} <ArrowRight size={13}/></span>
                </button>
              </motion.li>;
            })}
          </ul>
        </motion.div>
      </AnimatePresence>
    </div>

    {advisor && <div className="mp-advisor">
      <span className="mp-advisor-icon"><TrendingUp size={18}/></span>
      <div><b>{advisor[1]} runs across every stage</b><small>Ask anything in English, Hindi or Hinglish. Answers reuse the verified numbers above and show their sources.</small></div>
      <button type="button" onClick={() => launch(advisor)}>Ask the AI CFO <ArrowRight size={14}/></button>
    </div>}
  </div>;
};
