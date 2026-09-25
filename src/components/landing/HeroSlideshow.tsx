import React, { useEffect, useRef, useState } from 'react';
import './heroSlideshow.css';

// Two photos only: a warm sunrise peak and a bright blue-sky summit, crossfading with a slow drift.
const SLIDES = [
  { src: '/hero/mountain-6', alt: 'A knife-edge snow peak glowing at sunrise', pos: '55% 40%', move: 'hs-m1' },
  { src: '/hero/mountain-7', alt: 'A pyramid-shaped peak under white clouds and blue sky', pos: '55% 45%', move: 'hs-m2' },
];
const HOLD_MS = 6500;

/**
 * Hero background: two mountain photos crossfading in a loop, each slowly zooming (Ken Burns).
 * The first loads with high priority; the others only after the page is idle. Phones get smaller
 * files. Pauses off-screen and in background tabs; people who prefer reduced motion see one still.
 */
export const HeroSlideshow: React.FC = () => {
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [loadRest, setLoadRest] = useState(false);
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const start = () => setLoadRest(true);
    if (document.readyState === 'complete') { if (idle) idle(start, { timeout: 2500 }); else window.setTimeout(start, 1200); }
    else window.addEventListener('load', () => (idle ? idle(start, { timeout: 2500 }) : window.setTimeout(start, 1200)), { once: true });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (reduced || !loadRest || !visible) return;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') setActive((i) => { setPrev(i); return (i + 1) % SLIDES.length; }); }, HOLD_MS);
    return () => window.clearInterval(t);
  }, [reduced, loadRest, visible]);

  return <div ref={ref} className={`hs ${visible ? '' : 'hs-paused'}`} aria-hidden="true">
    {SLIDES.map((s, i) => (i === 0 || loadRest) && <picture key={s.src} className={`hs-slide ${s.move} ${i === active ? 'on' : i === prev ? 'out' : ''}`}>
      <source media="(max-width: 900px)" srcSet={`${s.src}-m.webp`} type="image/webp"/>
      <img src={`${s.src}.webp`} alt="" style={{ objectPosition: s.pos }} decoding="async" {...(i === 0 ? { fetchPriority: 'high' as const } : { loading: 'lazy' as const })}/>
    </picture>)}
    <div className="hs-shade"/>
  </div>;
};
