import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { LANDING_REVIEWS, type LandingReview } from '../../data/landingReviews';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';
import './reviewsStory.css';

type Slot = { x: number; y: number; size: 'sm' | 'md' | 'lg'; depth: number };

/**
 * Lays cards out in staggered columns over a tall strip (y in vh, from the top of the stage). Cards
 * that would cover the headline at the start are pushed below it, so the first frame shows the
 * headline clear; as the visitor scrolls, every column rises past it at its own speed.
 */
function layout(columns: number[], starts: number[], heights: Record<Slot['size'], number>, clearCols: number[], count: number): Slot[] {
  const order: Slot['size'][] = ['lg', 'sm', 'md', 'md', 'sm', 'lg', 'sm', 'md'];
  const perCol = columns.map((x, c) => {
    const out: Slot[] = [];
    let y = starts[c];
    let k = c * 3;
    while (y < 240) {
      const size = order[k++ % order.length];
      const h = heights[size];
      if (clearCols.includes(c) && y < 64 && y + h > 34) y = 66;
      out.push({ x, y, size, depth: 1 + (c % 2) * 0.22 + (c === 2 ? 0.1 : 0) });
      y += h + 3;
    }
    return out;
  });
  // Interleave columns so the first reviews spread across the whole width.
  const slots: Slot[] = [];
  for (let i = 0; slots.length < count && i < 40; i += 1) for (const col of perCol) if (col[i] && slots.length < count) slots.push(col[i]);
  return slots.sort((p, q) => p.y - q.y);
}
const DESKTOP = layout([-4, 15, 36, 57, 77], [6, 0, 12, 3, 9], { sm: 20, md: 25, lg: 31 }, [1, 2, 3], 30);
const MOBILE = layout([2, 52], [3, 10], { sm: 19, md: 22, lg: 25 }, [0, 1], 20);

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 before `a`, 1 after `b`, eased in between. */
const ease = (p: number, a: number, b: number) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };

const Card: React.FC<{ review: LandingReview; size?: string; style?: React.CSSProperties; className?: string }> = ({ review, size = 'md', style, className = '' }) => (
  <figure className={`rs-card rs-${size} ${className}`.trim()} style={style}>
    <blockquote>{review.quote}</blockquote>
    <figcaption>
      <span className="rs-place" aria-hidden="true"><MapPin size={14} /></span>
      <span><b>{review.role}</b><small>{review.city}</small></span>
    </figcaption>
  </figure>
);

/**
 * Reviews as a scroll story: cards drift past a headline at different speeds, then fly apart while the
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
      // Step 1: columns of reviews rise past the headline. Step 2: the stage turns dark and the
      // headline opens. Step 3: the glowing mark grows. Step 4: the short pitch.
      s.setProperty('--t', clamp(p / 0.5).toFixed(4));
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
            const style = { left: `${slot.x}%`, top: `${slot.y}vh`, '--travel': (slot.y + 45) * slot.depth } as React.CSSProperties;
            return <Card key={`${cls}-${i}`} review={review} size={slot.size} style={style} className={cls} />;
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
