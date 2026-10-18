import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { LANDING_REVIEWS, type LandingReview } from '../../data/landingReviews';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';
import './reviewsStory.css';

type Slot = { x: number; y: number; size: 'sm' | 'md' | 'lg' };

/**
 * Groww-style field of reviews around the headline. x and y are the card centre in % of the stage;
 * the middle band stays clear for the headline. On scroll the whole field zooms out from the centre.
 */
const DESKTOP: Slot[] = [
  { x: 25, y: 9, size: 'sm' }, { x: 46, y: 6, size: 'sm' }, { x: 88, y: 11, size: 'md' },
  { x: 12, y: 27, size: 'lg' }, { x: 37, y: 25, size: 'sm' }, { x: 63, y: 21, size: 'lg' },
  { x: 90, y: 31, size: 'sm' }, { x: 17, y: 42, size: 'md' }, { x: 87, y: 45, size: 'lg' },
  { x: 7, y: 56, size: 'md' }, { x: 90, y: 60, size: 'sm' },
  { x: 24, y: 72, size: 'sm' }, { x: 47, y: 75, size: 'sm' }, { x: 73, y: 71, size: 'sm' },
  { x: 14, y: 87, size: 'sm' }, { x: 40, y: 89, size: 'md' }, { x: 66, y: 86, size: 'lg' }, { x: 92, y: 84, size: 'md' },
];
const MOBILE: Slot[] = [
  { x: 26, y: 10, size: 'md' }, { x: 76, y: 14, size: 'sm' }, { x: 24, y: 28, size: 'sm' }, { x: 77, y: 31, size: 'md' },
  { x: 25, y: 70, size: 'sm' }, { x: 75, y: 68, size: 'md' }, { x: 27, y: 87, size: 'md' }, { x: 76, y: 88, size: 'sm' },
];
/** Bigger cards sit nearer the visitor, so they grow a little faster. */
const DEPTH: Record<Slot['size'], number> = { sm: 0.85, md: 1, lg: 1.15 };

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 before `a`, 1 after `b`, eased in between. */
const ease = (p: number, a: number, b: number) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };

const Card: React.FC<{ review: LandingReview; size?: string; style?: React.CSSProperties; className?: string; data?: { x: number; y: number; depth: number } }> = ({ review, size = 'md', style, className = '', data }) => (
  <figure className={`rs-card rs-${size} ${className}`.trim()} style={style} data-x={data?.x} data-y={data?.y} data-depth={data?.depth}>
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
        const x = Number(el.dataset.x), y = Number(el.dataset.y), depth = Number(el.dataset.depth);
        const z = 0.92 + t * t * 2.4 * depth + t * 0.5 * depth;
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
  const note = reviews.some((review) => review.illustrative) && <p className="rs-note">Illustrative quotes</p>;
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
        <h2 id="rs-title" className="rs-static-title">One personal CFO for every Indian family.</h2>
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
            const style = { left: `${slot.x}%`, top: `${slot.y}%`, zIndex: slot.size === 'lg' ? 3 : slot.size === 'md' ? 2 : 1 } as React.CSSProperties;
            return <Card key={`${cls}-${i}`} review={review} size={slot.size} style={style} className={cls} data={{ x: slot.x, y: slot.y, depth: DEPTH[slot.size] }} />;
          }))}
        </div>
        <h2 id="rs-title" className="rs-headline">
          <span className="rs-half-l">One personal CFO</span>{' '}
          <span className="rs-half-r">for every Indian family.</span>
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
