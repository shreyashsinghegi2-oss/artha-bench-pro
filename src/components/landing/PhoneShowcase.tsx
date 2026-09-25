import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { buildMoneyCheck, SAMPLE_MONEY_CHECK } from '../../services/moneyCheck';
import './phoneShowcase.css';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';

const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const short = inr;

/**
 * Scroll-driven phone: the page scrolls, the phone stays pinned and its screen scrolls through
 * four app views. Every number on the screens is computed by the Money Check engine for a
 * clearly labelled sample profile.
 */
export const PhoneShowcase: React.FC<{ onTry: () => void }> = ({ onTry }) => {
  const r = useMemo(() => buildMoneyCheck(SAMPLE_MONEY_CHECK), []);
  const section = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });
  const SCREENS = 4;
  const phoneRotate = useTransform(smooth, [0, 0.5, 1], [-6, 0, 6]);
  useMotionValueEvent(scrollYProgress, 'change', (v) => setActive(Math.min(SCREENS - 1, Math.max(0, Math.floor(v * SCREENS * 0.999)))));

  // Scroll picks the step and the screen snaps to it (one screen is 100 / SCREENS % of the strip).
  // On phones (no pinned scroll) the screens advance on a timer instead.
  useEffect(() => {
    if (desktop || reduced) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % SCREENS), 3200);
    return () => window.clearInterval(id);
  }, [desktop, reduced]);

  const steps = [
    { k: 'Money health', t: 'One score for your whole financial life.', d: `Savings rate, EMI load and emergency runway roll up into a 0–100 score, recalculated the moment your numbers change.` },
    { k: 'Tax', t: 'Old or new regime, settled in seconds.', d: `Both regimes run on FY 2025-26 slabs with the 87A rebate, standard deduction, cess and your 80C / 80D. You see the exact rupee difference.` },
    { k: 'Freedom number', t: 'The corpus that lets you stop working.', d: `Your spending, grown with inflation and funded to age 85, becomes one number, with the monthly SIP and the age you can reach it.` },
    { k: 'Protection', t: 'Gaps in cover, before they cost you.', d: `Term cover sized to your family's future expenses and loans, and a health-cover check for everyone who depends on you.` },
  ];

  const scoreDeg = Math.round(r.health.score * 3.6);
  const oldW = Math.max(8, Math.round((r.tax.oldRegimeTax / Math.max(r.tax.oldRegimeTax, r.tax.newRegimeTax, 1)) * 100));
  const newW = Math.max(8, Math.round((r.tax.newRegimeTax / Math.max(r.tax.oldRegimeTax, r.tax.newRegimeTax, 1)) * 100));
  const freedomPct = Math.min(100, Math.round((r.freedom.projectedFromInvestments / r.freedom.corpusNeeded) * 100));
  const termPct = Math.min(100, Math.round(((r.protection.termCoverNeeded - r.protection.termGap) / Math.max(1, r.protection.termCoverNeeded)) * 100));

  const screens = [
    <div className="ps-screen t-health" key="health">
      <small className="ps-app-kicker">Money health</small>
      <div className="ps-ring" style={{ '--deg': `${scoreDeg}deg` } as React.CSSProperties}><b>{r.health.score}</b><span>/100 · {r.health.status}</span></div>
      <ul className="ps-rows">{r.health.metrics.map((m) => <li key={m.key}><span>{m.label}</span><b>{m.display}</b></li>)}</ul>
      <div className="ps-chip">Surplus {inr(r.cashflow.surplus)}/mo</div>
    </div>,
    <div className="ps-screen t-tax" key="tax">
      <small className="ps-app-kicker">Tax · FY 2025-26</small>
      <h4>{r.tax.better === 'same' ? 'Both regimes cost the same' : `${r.tax.better === 'new' ? 'New' : 'Old'} regime saves ${short(r.tax.saving)}`}</h4>
      <div className="ps-bars">
        <div><span>Old regime</span><i style={{ width: `${oldW}%` }}/><b>{inr(r.tax.oldRegimeTax)}</b></div>
        <div className="win"><span>New regime</span><i style={{ width: `${newW}%` }}/><b>{inr(r.tax.newRegimeTax)}</b></div>
      </div>
      <ul className="ps-rows"><li><span>Take-home</span><b>{inr(r.tax.monthlyTakeHome)}/mo</b></li><li><span>Salary</span><b>{short(SAMPLE_MONEY_CHECK.annualSalary)}/yr</b></li></ul>
    </div>,
    <div className="ps-screen t-freedom" key="freedom">
      <small className="ps-app-kicker">Freedom number</small>
      <h4 className="ps-big">{short(r.freedom.corpusNeeded)}</h4>
      <p className="ps-note">at 60, funds spending to age 85</p>
      <div className="ps-progress"><i style={{ width: `${freedomPct}%` }}/></div>
      <ul className="ps-rows"><li><span>SIP needed</span><b>{inr(r.freedom.monthlySipNeeded)}/mo</b></li><li><span>Free by age</span><b>{r.freedom.freedomAge ?? '—'}</b></li><li><span>Spend at 60</span><b>{short(r.freedom.annualExpenseAtRetirement)}/yr</b></li></ul>
    </div>,
    <div className="ps-screen t-protect" key="protect">
      <small className="ps-app-kicker">Protection</small>
      <h4>Term cover needed</h4>
      <p className="ps-big">{short(r.protection.termCoverNeeded)}</p>
      <div className="ps-progress"><i style={{ width: `${termPct}%` }}/></div>
      <ul className="ps-rows"><li><span>Term gap</span><b className="neg">{short(r.protection.termGap)}</b></li><li><span>Health cover</span><b>{short(SAMPLE_MONEY_CHECK.healthCover ?? 0)} of {short(r.protection.healthCoverSuggested)}</b></li><li><span>Emergency gap</span><b className="neg">{short(r.emergency.gap)}</b></li></ul>
    </div>,
  ];

  const pinned = desktop && !reduced;

  return <section id="phone-tour" ref={section} className={`ps-section ${pinned ? 'is-pinned' : ''}`} aria-labelledby="ps-title">
    <div className="ps-sticky">
      <div className="cl-wrap ps-grid">
        <div className="ps-copy">
          <div className="cl-eyebrow ps-eyebrow">Inside the app</div>
          <h2 id="ps-title">Your money, <span>worked out.</span></h2>
          <ol className="ps-steps">
            {steps.map((s, i) => <li key={s.k} className={i === active ? 'on' : ''} aria-current={i === active ? 'step' : undefined}>
              <span className="ps-step-n">{String(i + 1).padStart(2, '0')}</span>
              <div><small>{s.k}</small><b>{s.t}</b><p>{s.d}</p></div>
            </li>)}
          </ol>
          <button type="button" className="ps-try" onClick={onTry}>Run it with your numbers →</button>
        </div>
        <div className="ps-stage">
          <motion.div className="ps-phone" style={pinned ? { rotateY: phoneRotate } : undefined} aria-label="App preview with sample data">
            <div className="ps-notch" aria-hidden="true"/>
            <div className="ps-status" aria-hidden="true"><span>9:41</span><span className="ps-signal"><i/><i/><i/><i/></span></div>
            <div className="ps-viewport">
              <div className="ps-appbar" aria-hidden="true"><ArthaMindLogoMark size={20} tone="app"/><b>ArthaMind <em>AI</em></b></div>
              <motion.div className="ps-strip" animate={{ y: `-${(active * 100) / SCREENS}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }}>
                {screens}
              </motion.div>
            </div>
            <div className="ps-tabs" aria-hidden="true">{['Health', 'Tax', 'Freedom', 'Cover'].map((t, i) => <span key={t} className={i === active ? 'on' : ''}>{t}</span>)}</div>
          </motion.div>
          <p className="ps-sample">Sample profile: age 29, ₹18,00,000 salary, one dependant. Figures are calculated, not illustrative guesses.</p>
        </div>
      </div>
    </div>
  </section>;
};
