import React from 'react';
import { lazy, Suspense } from 'react';
import { useReducedMotion } from './useReducedMotion';

// The animated phone (and the animation library it uses) loads after the headline and buttons are on screen.
const HeroPhone = lazy(() => import('./HeroPhone').then((r) => ({ default: r.HeroPhone })));
import { ArrowRight, BadgeIndianRupee, BarChart3, Bot, Calculator, GraduationCap, ShieldCheck } from 'lucide-react';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';
import './landingHero.css';
import { HeroVideo } from './HeroVideo';

/** The ecosystem at a glance: every chip is a real part of the product. */
const ECOSYSTEM: Array<[string, React.ComponentType<{ size?: number }>]> = [
  ['Money plan & health score', ShieldCheck],
  ['Tax: old vs new regime', BadgeIndianRupee],
  ['14 calculators & goals', Calculator],
  ['India, US & forex markets', BarChart3],
  ['AI CFO & tutor', Bot],
  ['Learn with lessons', GraduationCap],
];



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
    <HeroVideo/>
    <div className="hx-wrap">
      <div className="hx-copy">
        <h1 id="hx-title" {...cls("hx-one hx-short", 0)}>Financial intelligence <span>that grows your money and secures your future.</span></h1>
        <div {...cls("hx-ctas", 1)}>
          <button type="button" className="hx-btn hx-btn-primary" onClick={onSample}>Try a sample analysis <ArrowRight size={16} aria-hidden="true"/></button>
          <button type="button" className="hx-btn hx-btn-secondary" onClick={onExplore}>Explore the workspace</button>
        </div>
        <a {...cls("hx-why", 1.5)} href="#purpose">See how ArthaMind works <ArrowRight size={14} aria-hidden="true"/></a>
      </div>

      <div {...cls("hx-stage", 2)}>
        <span className="hx-glow" aria-hidden="true"/>
        <span className="hx-ring r1" aria-hidden="true"/><span className="hx-ring r2" aria-hidden="true"/>
        <Suspense fallback={<div className="hp" aria-hidden="true"><div className="hp-device"/></div>}><HeroPhone/></Suspense>
      </div>
    </div>

    </div>

  </section>;
};
