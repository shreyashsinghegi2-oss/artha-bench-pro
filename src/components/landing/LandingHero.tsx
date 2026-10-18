import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';
import { HeroTicker } from './HeroTicker';
import './landingHero.css';
import './heroCity.css';

// The animated phone (and the animation library it uses) loads after the headline and buttons are on screen.
const HeroPhone = lazy(() => import('./HeroPhone').then((r) => ({ default: r.HeroPhone })));

/** Natural height of the phone in HeroPhone (px); the scene scales it to stand on the pedestal. */
const PHONE_H = 620;

/**
 * Landing hero: live index ticker, one-line promise, then "ArthaMind City", an isometric town where each
 * building is a part of the product (tax office, money health centre, growth tower, goals, insurance,
 * expert hub, voice tower, family homes). The live phone tour stands on the central pedestal, lit from below.
 */
export const LandingHero: React.FC<{ onSample: () => void; onExplore: () => void }> = ({ onSample, onExplore }) => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  // The phone stands on the central pedestal; its height is a fixed share of the town's height so it
  // keeps the same place in the scene at every screen size.
  useEffect(() => {
    const el = sceneRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const h = (entry.contentRect.width * 919) / 1621;
      const share = window.innerWidth <= 700 ? 0.66 : 0.5;
      setScale(Math.max(0.28, Math.min(0.72, (h * share) / PHONE_H)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section className="hc" aria-labelledby="hx-title">
      <HeroTicker />
      <div className="hc-copy">
        <h1 id="hx-title" className="hc-title">
          Financial intelligence <span>that grows your money and secures your future.</span>
        </h1>
        <p className="hc-sub">Tax, savings, insurance and investments in one place. AI does the work, registered experts check it, in your language.</p>
        <div className="hc-ctas">
          <button type="button" className="hc-btn" onClick={onSample}>Try a sample analysis <ArrowRight size={16} aria-hidden="true" /></button>
          <button type="button" className="hc-link" onClick={onExplore}>Explore the workspace <ArrowRight size={14} aria-hidden="true" /></button>
        </div>
      </div>

      <div className="hc-scene-wrap">
        <div ref={sceneRef} className="hc-scene">
          <img
            className="hc-town"
            src="/hero/city.webp"
            width={1621}
            height={919}
            alt="ArthaMind City: a tax office, money health centre, growth tower, goals building, insurance dome, expert hub, voice tower and family homes around a central plaza"
            fetchPriority="high"
            decoding="async"
          />

          <div className="hc-glow" aria-hidden="true" />

          <div className="hc-board" aria-hidden="true">
            <span className="hc-board-in"><ArthaMindLogoMark size={18} /><b>ArthaMind <em>AI</em></b></span>
          </div>

          <div className="hc-phone" style={{ '--s': scale } as React.CSSProperties}>
            <span className="hc-phone-shadow" aria-hidden="true" />
            <div className="hc-phone-in">
              <Suspense fallback={<div className="hp" aria-hidden="true"><div className="hp-device" /></div>}><HeroPhone /></Suspense>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
