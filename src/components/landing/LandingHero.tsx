import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, BadgeIndianRupee, BarChart3, Bot, Calculator, Check, GraduationCap, Languages, ShieldCheck } from 'lucide-react';
import { HeroPhone, HERO_REPORT, useLanguageCycle } from './HeroPhone';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';
import './landingHero.css';
import { HeroSlideshow } from './HeroSlideshow';

/** The ecosystem at a glance: every chip is a real part of the product. */
const ECOSYSTEM: Array<[string, React.ComponentType<{ size?: number }>]> = [
  ['Money plan & health score', ShieldCheck],
  ['Tax: old vs new regime', BadgeIndianRupee],
  ['14 calculators & goals', Calculator],
  ['India, US & forex markets', BarChart3],
  ['AI CFO & tutor', Bot],
  ['Learn with lessons', GraduationCap],
];

const OFFER = [
  { kicker: 'For your money', name: 'ArthaMind AI', line: 'Plan, check and understand your own finances.', items: [
    'Money health score and a step-by-step plan',
    'Old vs new tax regime, with the working shown',
    'Freedom number, goal SIPs and 14 calculators',
    'Insurance and emergency-fund gaps',
    'AI CFO in English, Hindi and Hinglish',
  ] },
  { kicker: 'For research', name: 'Artha Bench Pro', line: 'Look at markets and test AI answers before you trust them.', items: [
    'India, US, forex and crypto market pages',
    'Business news explained in plain language',
    'AI answer reliability lab and model comparison',
    'Financial tutor and short lessons',
    'Sources and data freshness on every page',
  ] },
];

const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

/** Live language badge: the count and the language name keep changing. */
const LanguageBadge: React.FC = () => {
  const reduced = Boolean(useReducedMotion());
  const lang = useLanguageCycle(!reduced, 1100);
  return <div className="hx-lang" aria-label={`Available in ${lang.total} languages`}>
    <span className="hx-lang-icon" aria-hidden="true"><Languages size={12}/></span>
    <span className="hx-lang-num" aria-hidden="true">{String(lang.index + 1).padStart(2, '0')}<small>/{lang.total}</small></span>
    <span className="hx-lang-name" aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={lang.code} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -10 }} transition={{ duration: 0.22 }}>{lang.name}</motion.span>
      </AnimatePresence>
    </span>
  </div>;
};

/**
 * Landing hero: what the product is in one line, the ecosystem at a glance, and a live phone tour.
 */
export const LandingHero: React.FC<{ onSample: () => void; onExplore: () => void }> = ({ onSample, onExplore }) => {
  const reduced = useReducedMotion();
  const item = (i: number) => (reduced ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.08 + i * 0.1, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number] } });

  return <section className="hx hx-nature hx-photo" aria-labelledby="hx-title">
    <div className="hx-scene">
    <HeroSlideshow/>
    <div className="hx-wrap">
      <div className="hx-copy">
        <motion.h1 id="hx-title" className="hx-one" {...item(0)}>ArthaMind is your AI money manager: it reads your income, spending, loans and investments, <span>does the maths, and tells you what to do next, in your own language.</span></motion.h1>
        <motion.div className="hx-ctas" {...item(1)}>
          <button type="button" className="hx-btn hx-btn-primary" onClick={onSample}>Try a sample analysis <ArrowRight size={16} aria-hidden="true"/></button>
          <button type="button" className="hx-btn hx-btn-secondary" onClick={onExplore}>Explore the workspace</button>
        </motion.div>
      </div>

      <motion.div className="hx-stage" {...item(2)}>
        <span className="hx-glow" aria-hidden="true"/>
        <span className="hx-ring r1" aria-hidden="true"/><span className="hx-ring r2" aria-hidden="true"/>
        <HeroPhone/>
        <div className="hx-float hx-float-a"><LanguageBadge/></div>
        <div className="hx-float hx-float-b" aria-hidden="true">
          <span className="hx-float-icon"><Check size={14}/></span>
          <span><small>Example tax saved</small><b>{inr(HERO_REPORT.tax.saving)}</b></span>
        </div>
      </motion.div>
    </div>

    </div>

    <div className="hx-offer" aria-labelledby="hx-offer-title">
      <h2 id="hx-offer-title" className="hx-offer-title">What you get</h2>
      <div className="hx-offer-grid">
        {OFFER.map((o, i) => <motion.article key={o.name} className="hx-offer-card" {...(reduced ? {} : { initial: { opacity: 0, y: 12 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.4 }, transition: { delay: i * 0.1, duration: 0.45 } })}>
          <header><small>{o.kicker}</small><b>{o.name}</b><span>{o.line}</span></header>
          <ul>{o.items.map((it) => <li key={it}><Check size={14} aria-hidden="true"/>{it}</li>)}</ul>
        </motion.article>)}
      </div>
    </div>
  </section>;
};
