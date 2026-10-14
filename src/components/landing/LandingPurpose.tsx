import React, { useEffect, useRef } from 'react';
import { ShieldCheck, Sprout, Target } from 'lucide-react';
import './landingPurpose.css';

const GOALS = [
  { icon: Sprout, title: 'Grow your money', text: 'See what your SIPs and investments really earn (XIRR), where a lump sum should go, and how markets and funds are moving today.' },
  { icon: ShieldCheck, title: 'Secure your future', text: 'Know your emergency-fund gap, the insurance cover you need and the freedom number that lets you retire on your terms.' },
  { icon: Target, title: 'Decide with confidence', text: 'Before a loan, a car or a tax choice, get a clear answer with the working and the sources shown, in your own language.' },
];

/** "Why ArthaMind": the objective of the platform in three goals. */
export const LandingPurpose: React.FC<{ onSample?: () => void; onExplore?: () => void }> = () => {
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

    </div>
  </section>;
};
