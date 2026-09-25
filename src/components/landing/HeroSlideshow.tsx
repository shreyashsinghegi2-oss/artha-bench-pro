import React, { useEffect, useRef, useState } from 'react';
import './heroSlideshow.css';

const SLIDES = [
  { src: '/hero/mountain-1', alt: 'Snow peaks above a sea of clouds at sunset', pos: '30% 40%' },
  { src: '/hero/mountain-2', alt: 'Pink alpenglow over snowy mountains and a forest', pos: '50% 45%' },
  { src: '/hero/mountain-3', alt: 'Rocky snow-capped peaks under a clear blue sky', pos: '45% 35%' },
];
const HOLD_MS = 7000;

/**
 * Hero background: three mountain photos crossfading in a loop, each slowly zooming (Ken Burns).
 * The first loads with high priority; the others only after the page is idle. Phones get smaller
 * files. Pauses off-screen and in background tabs; people who prefer reduced motion see one still.
 */
export const HeroSlideshow: React.FC = () => {
  const [active, setActive] = useState(0);
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
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') setActive((i) => (i + 1) % SLIDES.length); }, HOLD_MS);
    return () => window.clearInterval(t);
  }, [reduced, loadRest, visible]);

  return <div ref={ref} className={`hs ${visible ? '' : 'hs-paused'}`} aria-hidden="true">
    {SLIDES.map((s, i) => (i === 0 || loadRest) && <picture key={s.src} className={`hs-slide ${i === active ? 'on' : ''}`}>
      <source media="(max-width: 900px)" srcSet={`${s.src}-m.webp`} type="image/webp"/>
      <img src={`${s.src}.webp`} alt="" style={{ objectPosition: s.pos }} decoding="async" {...(i === 0 ? { fetchPriority: 'high' as const } : { loading: 'lazy' as const })}/>
    </picture>)}
    <div className="hs-shade"/>
  </div>;
};
