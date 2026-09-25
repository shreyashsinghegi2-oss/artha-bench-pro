import React, { useEffect, useRef } from 'react';
import { ArrowRight, Bot, Calculator, CheckCircle2, Globe2, LineChart, ShieldCheck, Sprout, Target, Upload, XCircle } from 'lucide-react';
import './landingPurpose.css';

const GOALS = [
  { icon: Sprout, title: 'Grow your money', text: 'See what your SIPs and investments really earn (XIRR), where a lump sum should go, and how markets and funds are moving today.' },
  { icon: ShieldCheck, title: 'Secure your future', text: 'Know your emergency-fund gap, the insurance cover you need and the freedom number that lets you retire on your terms.' },
  { icon: Target, title: 'Decide with confidence', text: 'Before a loan, a car or a tax choice, get a clear answer with the working and the sources shown, in your own language.' },
];

/** The pipeline behind every answer, in the order it runs. */
const FLOW = [
  { icon: Upload, title: 'You tell it about your money', text: 'Answer a few taps, scan a payslip or import your mutual fund statement (CAS). Portfolio and profile stay on your device unless you choose to save them.' },
  { icon: Globe2, title: 'It fetches live facts', text: 'Market prices, official mutual fund NAVs, business news and web sources are pulled in at the moment you ask.' },
  { icon: Calculator, title: 'The maths engine calculates', text: 'Tax (old vs new regime), EMI, SIP, XIRR, emergency runway and a money health score, worked out with tested formulas, not guessed.' },
  { icon: Bot, title: 'The AI explains', text: 'An AI CFO turns the numbers into a plan in simple words, in your own language. You can speak your question and listen to the answer.' },
  { icon: LineChart, title: 'You act and track', text: 'Next steps in priority order, and a dashboard that updates as your income, spending and investments change.' },
];

const FOR = ['First-time investors and salaried professionals', 'Families planning goals, insurance and retirement', 'Small business owners managing cash flow and GST outflows', 'Students learning how money works'];
const NOT = ['Not a broker: it never places trades or holds your money', 'Never asks for bank passwords, card PINs or OTPs', 'Education, not a replacement for a SEBI-registered adviser'];

/** "Why ArthaMind": the objective of the platform, how it works step by step, and who it is for. */
export const LandingPurpose: React.FC<{ onSample: () => void; onExplore: () => void }> = ({ onSample, onExplore }) => {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { el?.classList.add('lp-on'); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('lp-on'); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <section ref={ref} id="purpose" className="cl-section lp" aria-labelledby="lp-title">
    <div className="cl-wrap">
      <div className="cl-eyebrow">Why ArthaMind</div>
      <h2 id="lp-title">Financial intelligence for every Indian household.</h2>
      <p className="lp-lead">Companies have a CFO who checks every number before a big decision. Most families do not. ArthaMind gives you that intelligence: it reads your money, does the maths, watches the markets and tells you what to do next, so your money grows and your future stays safe.</p>

      <div className="lp-goals">{GOALS.map((g, i) => { const Icon = g.icon; return <article key={g.title} className="lp-goal" style={{ '--i': i } as React.CSSProperties}>
        <span className="lp-goal-icon"><Icon size={22}/></span><h3>{g.title}</h3><p>{g.text}</p>
      </article>; })}</div>

      <h3 className="lp-sub">How it works</h3>
      <ol className="lp-flow">{FLOW.map((s, i) => { const Icon = s.icon; return <li key={s.title} style={{ '--i': i } as React.CSSProperties}>
        <span className="lp-step"><Icon size={18}/><em>{i + 1}</em></span>
        <div><b>{s.title}</b><p>{s.text}</p></div>
      </li>; })}</ol>

      <div className="lp-lists">
        <div className="lp-list yes"><h3><CheckCircle2 size={18}/> Built for</h3><ul>{FOR.map((t) => <li key={t}>{t}</li>)}</ul></div>
        <div className="lp-list no"><h3><XCircle size={18}/> What it is not</h3><ul>{NOT.map((t) => <li key={t}>{t}</li>)}</ul></div>
      </div>

      <div className="lp-ctas">
        <button type="button" className="lp-btn primary" onClick={onSample}>Try a sample analysis <ArrowRight size={16}/></button>
        <button type="button" className="lp-btn" onClick={onExplore}>Open the workspace</button>
      </div>
    </div>
  </section>;
};
