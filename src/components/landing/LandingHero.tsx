import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';
import { HeroTicker, Tick, QUOTE_NAMES, formatPrice, useHeroMarket } from './HeroTicker';
import './landingHero.css';
import './heroCity.css';

// Start fetching the animated phone (and its animation library) as soon as this module runs, in
// parallel with the town picture, so the whole phone appears at once instead of in pieces.
const phoneModule = typeof window !== 'undefined' ? import('./HeroPhone') : undefined;
const HeroPhone = lazy(() => (phoneModule ?? import('./HeroPhone')).then((r) => ({ default: r.HeroPhone })));

/** Town picture size (px). Every overlay below is placed in % of it, so it scales with the picture. */
const TOWN_W = 1376;
/** Width (px of the picture) the phone takes on top of the market building, and HeroPhone's own width (px). */
const PLAZA_PHONE_W = 116;
const PHONE_W = 300;

/** What the billboard says, one message at a time. */
const BOARD = [
  ['Save tax', 'Old vs new regime, picked for you'],
  ['Money health', 'Your score in 2 minutes'],
  ['Plan every goal', 'Retirement, kids, home'],
  ['Experts check', 'CA-reviewed, not just AI'],
  ['Your language', '13 Indian languages by voice'],
] as const;

/** Today's NIFTY 50 path as an SVG line for the screen on the media building. */
const Spark: React.FC<{ points: number[]; up: boolean }> = ({ points, up }) => {
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const d = points.map((p, i) => `${(i / (points.length - 1)) * 100},${36 - ((p - min) / span) * 32}`).join(' ');
  return (
    <svg viewBox="0 0 100 38" preserveAspectRatio="none" className="hc-spark" aria-hidden="true">
      <polyline points={`0,38 ${d} 100,38`} className={up ? 'hc-spark-fill up' : 'hc-spark-fill down'} />
      <polyline points={d} className={up ? 'hc-spark-line up' : 'hc-spark-line down'} />
    </svg>
  );
};

/**
 * Landing hero: live index ticker, one line, then ArthaMind City. The town is on screen as the page opens.
 * Overlays sit on the picture's blank surfaces: the live phone tour on top of the market building, the
 * hovering ArthaMind coin in the plaza (it covers the drawn phone), today's NIFTY 50
 * on the media building, a live ticker band and price screen on the market building, the billboard
 * messages, and parked cars.
 */
export const LandingHero: React.FC = () => {
  const { quotes, nifty } = useHeroMarket();
  const sceneRef = useRef<HTMLDivElement>(null);
  const townRef = useRef<HTMLImageElement>(null);
  // Overlays wait for the town picture so nothing shows half-built on an empty page.
  const [townReady, setTownReady] = useState(false);
  useEffect(() => { if (townRef.current?.complete) setTownReady(true); }, []);
  const lineRef = useRef<HTMLDivElement>(null);
  const [phoneScale, setPhoneScale] = useState(0.3);
  const [slide, setSlide] = useState(0);
  const [tick, setTick] = useState(0);

  // Fit HeroPhone to the drawn phone at every screen size.
  useEffect(() => {
    const el = sceneRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setPhoneScale((entry.contentRect.width * PLAZA_PHONE_W) / TOWN_W / PHONE_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Billboard and price screen cycle; both stop for reduced motion.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const a = window.setInterval(() => setSlide((s) => (s + 1) % BOARD.length), 3400);
    const b = window.setInterval(() => setTick((t) => t + 1), 2600);
    return () => { window.clearInterval(a); window.clearInterval(b); };
  }, []);

  // The line fades and lifts away as the visitor scrolls.
  useEffect(() => {
    const el = lineRef.current;
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const t = Math.min(1, window.scrollY / 420);
      el.style.opacity = String(1 - t * t * (3 - 2 * t));
      el.style.transform = `translateY(${-t * 40}px) scale(${1 - t * 0.06})`;
    };
    const on = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', on, { passive: true });
    return () => { window.removeEventListener('scroll', on); if (frame) cancelAnimationFrame(frame); };
  }, []);

  const nf = quotes.find((q) => q.symbol === '^NSEI');
  const niftyUp = nf ? Number(nf.changePercent ?? 0) >= 0 : nifty.length > 1 ? nifty[nifty.length - 1] >= nifty[0] : true;
  const shown = quotes.length ? quotes[tick % quotes.length] : undefined;

  return (
    <section className="hc" aria-labelledby="hx-title">
      <HeroTicker quotes={quotes} />
      <div className="hc-line" ref={lineRef}>
        <h1 id="hx-title" className="hc-title">Financial intelligence <span>for the global Indian.</span></h1>
      </div>

      <div className="hc-stage">
        <div ref={sceneRef} className={'hc-scene' + (townReady ? ' is-ready' : '')}>
          <img ref={townRef} onLoad={() => setTownReady(true)} className="hc-town" src="/hero/city2/town.webp" width={1376} height={768} fetchPriority="high" decoding="async"
            alt="ArthaMind City: offices for tax, money health, investments, goals, insurance and experts around a central plaza where the ArthaMind phone stands" />

          {/* Parked cars */}
          <img className="hc-car hc-car1" src="/hero/city2/car1.png" alt="" aria-hidden="true" />
          <img className="hc-car hc-car2" src="/hero/city2/car2.png" alt="" aria-hidden="true" />
          <img className="hc-car hc-auto" src="/hero/city2/auto.png" alt="" aria-hidden="true" />

          {/* Media building screen: today's NIFTY 50 */}
          <div className="hc-dark" aria-hidden="true">
            <div className="hc-dark-in">
              {nf || nifty.length > 1 ? (
                <>
                  <span className="hc-dark-head"><b>NIFTY 50</b>{nf && <em className={niftyUp ? 'hc-up' : 'hc-down'}>{niftyUp ? '▲' : '▼'} {Math.abs(Number(nf.changePercent ?? 0)).toFixed(2)}%</em>}</span>
                  {nf && <span className="hc-dark-price">{formatPrice(nf)}</span>}
                  {nifty.length > 1 && <Spark points={nifty} up={niftyUp} />}
                </>
              ) : <ArthaMindLogoMark size={28} tone="light" cut="transparent" />}
            </div>
          </div>

          {/* Market building: live ticker band and a price screen */}
          <div className="hc-band" aria-hidden="true">
            {quotes.length > 0 && (['a', 'b'] as const).map((face) => (
              <div key={face} className={`hc-band-face hc-band-${face}`}>
                <div className="hc-band-track">{[...quotes, ...quotes].map((q, i) => <Tick key={`${q.symbol}-${i}`} q={q} />)}</div>
              </div>
            ))}
          </div>
          <div className="hc-screen" aria-hidden="true">
            <div className="hc-screen-in" key={shown?.symbol ?? 'none'}>
              {shown ? (
                <>
                  <b>{QUOTE_NAMES[shown.symbol] ?? shown.symbol}</b>
                  <span>{formatPrice(shown)}</span>
                  <em className={Number(shown.changePercent ?? 0) >= 0 ? 'hc-up' : 'hc-down'}>{Number(shown.changePercent ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(Number(shown.changePercent ?? 0)).toFixed(2)}%</em>
                </>
              ) : <ArthaMindLogoMark size={22} />}
            </div>
          </div>

          {/* Billboard */}
          <div className="hc-board" aria-hidden="true">
            <div className="hc-board-in">
              <span className="hc-board-brand"><ArthaMindLogoMark size={14} /> ArthaMind <em>AI</em></span>
              <b key={slide}>{BOARD[slide][0]}</b>
              <small key={`s${slide}`}>{BOARD[slide][1]}</small>
            </div>
          </div>

          {/* Plaza centrepiece: a glowing platform, a beam of light and the ArthaMind coin hovering above it */}
          <div className="hc-monument" aria-hidden="true">
            <span className="hc-mon-glow" />
            <span className="hc-mon-beam" />
            <svg className="hc-mon-base" viewBox="0 0 124 58">
              <defs>
                <linearGradient id="hcSide" x1="0" x2="1"><stop offset="0" stopColor="#0b4a3b" /><stop offset=".5" stopColor="#1f8f4e" /><stop offset="1" stopColor="#0b4a3b" /></linearGradient>
                <radialGradient id="hcTop" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#f4fff9" /><stop offset=".55" stopColor="#bff5d9" /><stop offset="1" stopColor="#5fd39a" /></radialGradient>
              </defs>
              <path d="M1 22 V36 A61 21 0 0 0 123 36 V22 Z" fill="url(#hcSide)" stroke="#123b30" strokeWidth="1.4" />
              <ellipse cx="62" cy="22" rx="61" ry="21" fill="url(#hcTop)" stroke="#123b30" strokeWidth="1.4" />
              <ellipse cx="62" cy="22" rx="44" ry="14" fill="none" stroke="#34c46f" strokeWidth="2" opacity=".8" />
            </svg>
            <span className="hc-mon-coin"><span className="hc-mon-face"><ArthaMindLogoMark size={64} tone="light" cut="transparent" /></span></span>
          </div>

          {/* The phone on top of the market building: the live ArthaMind tour */}
          <div className="hc-phone" style={{ '--s': phoneScale } as React.CSSProperties}>
            {townReady && <Suspense fallback={null}><HeroPhone /></Suspense>}
          </div>
        </div>
      </div>
    </section>
  );
};
