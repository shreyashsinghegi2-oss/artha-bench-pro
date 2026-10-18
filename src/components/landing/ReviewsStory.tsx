import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { LANDING_REVIEWS, type LandingReview } from '../../data/landingReviews';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';
import { WAITLIST_AS_OF, WAITLIST_COUNT } from '../../data/waitlist';
import './reviewsStory.css';

type Slot = { x: number; y: number; size: 'sm' | 'md' | 'lg' };

/**
 * Groww-style field of reviews around the headline, on a grid so no two cards touch. x and y are the
 * card centre in % of the stage; the middle band stays clear for the headline. On scroll the whole
 * field zooms out from the centre at one rate, so the cards never overlap while they grow.
 */
const ROWS = [18.5, 36.5, 68, 86.5];
const COLS = [8.5, 25, 41.5, 58.5, 75, 91.5];
const SKIP = new Set(['1-2', '1-3', '2-2', '2-3']); // keep the area just above and below the headline airy
const DESKTOP: Slot[] = [
  ...ROWS.flatMap((y, r) => COLS.flatMap((x, c) => (SKIP.has(`${r}-${c}`) ? [] : [{ x, y: y + (c % 2 ? 0.6 : -0.6), size: 'sm' as const }]))),
  { x: 8.5, y: 53, size: 'sm' }, { x: 91.5, y: 53, size: 'sm' },
];
const MOBILE: Slot[] = ROWS.flatMap((y) => [{ x: 26, y, size: 'sm' as const }, { x: 74, y: y + 2, size: 'sm' as const }]);

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 before `a`, 1 after `b`, eased in between. */
const ease = (p: number, a: number, b: number) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };

const Card: React.FC<{ review: LandingReview; size?: string; style?: React.CSSProperties; className?: string; data?: { x: number; y: number } }> = ({ review, size = 'md', style, className = '', data }) => (
  <figure className={`rs-card rs-${size} ${className}`.trim()} style={style} data-x={data?.x} data-y={data?.y}>
    <blockquote>{review.quote}</blockquote>
    <figcaption>
      <span className="rs-place" aria-hidden="true"><MapPin size={14} /></span>
      <span><b>{review.role}</b><small>{review.city}</small></span>
    </figcaption>
  </figure>
);

/**
 * Reviews as a scroll story: cards around the headline zoom out from the centre, then fly apart while the
 * stage turns dark, the headline splits, a glowing ArthaMind mark grows in the gap, and a short line on
 * what ArthaMind does takes over. Reduced-motion users get the same content as a static layout.
 */
export const ReviewsStory: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  // The waitlist number counts up once as the section comes into view.
  useEffect(() => {
    const el = countRef.current, section = sectionRef.current;
    if (!el || !section || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const show = (n: number) => { el.textContent = `${n.toLocaleString('en-IN')}+`; };
    let frame = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / 2200);
        show(Math.round(WAITLIST_COUNT * (1 - (1 - k) ** 3)));
        if (k < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.05 });
    io.observe(section);
    return () => { io.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, []);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const range = section.offsetHeight - window.innerHeight;
      const p = range > 0 ? clamp(-rect.top / range) : 0;
      const s = stage.style;
      // Step 1: the field of reviews zooms out from the centre. Step 2: the stage turns dark and the
      // headline opens. Step 3: the glowing mark grows. Step 4: the short pitch.
      const t = clamp(p / 0.5);
      const dark = ease(p, 0.44, 0.56);
      s.setProperty('--t', t.toFixed(4));
      const w = stage.clientWidth, h = stage.clientHeight;
      stage.querySelectorAll<HTMLElement>('.rs-card').forEach((el) => {
        if (el.offsetParent === null) return; // the other layout (desktop or phone) is hidden
        const x = Number(el.dataset.x), y = Number(el.dataset.y);
        const z = 0.92 + t * t * 2.4 + t * 0.5;
        const dx = (x / 100 - 0.5) * w * (z - 1), dy = (y / 100 - 0.5) * h * (z - 1);
        el.style.transform = `translate(-50%,-50%) translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0) scale(${z.toFixed(3)})`;
        el.style.opacity = Math.min(clamp((2.5 - z) / 0.9), 1 - dark * 2).toFixed(3);
      });
      s.setProperty('--dark', ease(p, 0.44, 0.56).toFixed(4));
      s.setProperty('--split', ease(p, 0.5, 0.66).toFixed(4));
      s.setProperty('--head', (1 - ease(p, 0.62, 0.72)).toFixed(4));
      s.setProperty('--orb', ease(p, 0.52, 0.8).toFixed(4));
      s.setProperty('--final', ease(p, 0.8, 0.93).toFixed(4));
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => { window.removeEventListener('scroll', request); window.removeEventListener('resize', request); if (frame) cancelAnimationFrame(frame); };
  }, [reduced]);

  const reviews = LANDING_REVIEWS;
  const note = reviews.some((review) => review.illustrative) && <p className="rs-note">Illustrative quotes · waitlist count as of {WAITLIST_AS_OF}</p>;
  const finale = (
    <div className="rs-final-copy">
      <h2 id="rs-final-title">Taxes, loans, investments and goals. <span>Sorted in one place.</span></h2>
      <p>A free health check, a personal CFO you can talk to, and every number checked by our own engine before you see it.</p>
      <span className="rs-next" aria-hidden="true">In your language <ChevronDown size={16} /></span>
    </div>
  );

  if (reduced) {
    return (
      <section id="reviews" className="rs-static" aria-labelledby="rs-title">
        <h2 id="rs-title" className="rs-static-title">{WAITLIST_COUNT.toLocaleString('en-IN')}+ Indians on the waitlist.</h2>
        <div className="rs-static-grid">{reviews.slice(0, 9).map((review) => <Card key={review.name} review={review} />)}</div>
        {note}
        <div className="rs-static-final"><span className="rs-orb is-static" aria-hidden="true"><ArthaMindLogoMark size={88} tone="light" cut="transparent" /></span>{finale}</div>
      </section>
    );
  }

  return (
    <section id="reviews" ref={sectionRef} className="rs-section" aria-labelledby="rs-title">
      <div ref={stageRef} className="rs-stage">
        <div className="rs-dark" aria-hidden="true" />
        <div className="rs-cards">
          {([['rs-desk', DESKTOP], ['rs-mob', MOBILE]] as const).map(([cls, slots]) => slots.map((slot, i) => {
            const review = reviews[i % reviews.length];
            const style = { left: `${slot.x}%`, top: `${slot.y}%`, } as React.CSSProperties;
            return <Card key={`${cls}-${i}`} review={review} size={slot.size} style={style} className={cls} data={{ x: slot.x, y: slot.y }} />;
          }))}
        </div>
        <h2 id="rs-title" className="rs-headline">
          <span className="rs-half-l"><span ref={countRef} className="rs-count">{WAITLIST_COUNT.toLocaleString('en-IN')}+</span> Indians</span>{' '}
          <span className="rs-half-r">on the waitlist.</span>
        </h2>
        <div className="rs-orb-wrap" aria-hidden="true">
          <span className="rs-orb"><ArthaMindLogoMark size={120} tone="light" cut="transparent" /></span>
        </div>
        <div className="rs-final">{finale}</div>
        {note}
      </div>
    </section>
  );
};
