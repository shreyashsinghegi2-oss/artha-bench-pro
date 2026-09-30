import React from 'react';
import { lazy, Suspense } from 'react';
import { useReducedMotion } from './useReducedMotion';

// The animated phone (and the animation library it uses) loads after the headline and buttons are on screen.
const HeroPhone = lazy(() => import('./HeroPhone').then((r) => ({ default: r.HeroPhone })));
import { ArrowRight, BadgeIndianRupee, BarChart3, Bot, Calculator, Check, GraduationCap, Languages, ShieldCheck } from 'lucide-react';
import { HERO_REPORT } from './heroSample';
import { useLanguageCycle } from './heroLanguage';
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
      <span key={lang.code} className={reduced ? undefined : 'hx-lang-swap'}>{lang.name}</span>
    </span>
  </div>;
};

/**
 * Landing hero: what the product is in one line, the ecosystem at a glance, and a live phone tour.
 */
export const LandingHero: React.FC<{ onSample: () => void; onExplore: () => void }> = ({ onSample, onExplore }) => {
  const reduced = useReducedMotion();
  // CSS entrance (no animation library): fade up with a small stagger; skipped for reduced motion.
  const item = (i: number) => (reduced ? {} : { className: 'hx-in', style: { animationDelay: `${0.08 + i * 0.1}s` } as React.CSSProperties });
  const cls = (base: string, i: number) => { const it = item(i); return { className: it.className ? `${base} ${it.className}` : base, style: it.style }; };

  return <section className="hx hx-nature hx-photo" aria-labelledby="hx-title">
    <div className="hx-scene">
    <HeroSlideshow/>
    <div className="hx-wrap">
      <div className="hx-copy">
        <h1 id="hx-title" {...cls("hx-one hx-short", 0)}>Financial intelligence <span>that grows your money and secures your future.</span></h1>
        <div {...cls("hx-ctas", 1)}>
          <button type="button" className="hx-btn hx-btn-primary" onClick={onSample}>Try a sample analysis <ArrowRight size={16} aria-hidden="true"/></button>
          <button type="button" className="hx-btn hx-btn-secondary" onClick={onExplore}>Explore the workspace</button>
        </div>
        <a {...cls("hx-why", 1.5)} href="#purpose">What is ArthaMind for? See how it works <ArrowRight size={14} aria-hidden="true"/></a>
      </div>

      <div {...cls("hx-stage", 2)}>
        <span className="hx-glow" aria-hidden="true"/>
        <span className="hx-ring r1" aria-hidden="true"/><span className="hx-ring r2" aria-hidden="true"/>
        <Suspense fallback={<div className="hp" aria-hidden="true"><div className="hp-device"/></div>}><HeroPhone/></Suspense>
        <div className="hx-float hx-float-a"><LanguageBadge/></div>
        <div className="hx-float hx-float-b" aria-hidden="true">
          <span className="hx-float-icon"><Check size={14}/></span>
          <span><small>Example tax saved</small><b>{inr(HERO_REPORT.tax.saving)}</b></span>
        </div>
      </div>
    </div>

    </div>

    <div className="hx-offer" aria-labelledby="hx-offer-title">
      <h2 id="hx-offer-title" className="hx-offer-title">What you get</h2>
      <div className="hx-offer-grid">
        {OFFER.map((o, i) => <article key={o.name} {...cls('hx-offer-card', i + 3)}>
          <header><small>{o.kicker}</small><b>{o.name}</b><span>{o.line}</span></header>
          <ul>{o.items.map((it) => <li key={it}><Check size={14} aria-hidden="true"/>{it}</li>)}</ul>
        </article>)}
      </div>
    </div>
  </section>;
};
