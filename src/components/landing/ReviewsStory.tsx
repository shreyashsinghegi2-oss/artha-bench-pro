import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { LANDING_REVIEWS, type LandingReview } from '../../data/landingReviews';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';
import './reviewsStory.css';

/** Where each floating card sits (percent of the stage), how big it is, and how fast it drifts.
 *  The centre band (roughly x 24–74%, y 36–62%) stays clear for the headline. */
const SLOTS: { x: number; y: number; size: 'sm' | 'md' | 'lg'; depth: number }[] = [
  { x: -3, y: 4, size: 'lg', depth: 1.2 },
  { x: 19, y: 0, size: 'sm', depth: 0.6 },
  { x: 25, y: 13, size: 'md', depth: 0.9 },
  { x: 45, y: 1, size: 'sm', depth: 0.5 },
  { x: 49, y: 12, size: 'lg', depth: 1.1 },
  { x: 74, y: 2, size: 'md', depth: 0.8 },
  { x: 87, y: 19, size: 'sm', depth: 0.7 },
  { x: -5, y: 35, size: 'md', depth: 0.9 },
  { x: 4, y: 50, size: 'sm', depth: 0.6 },
  { x: 77, y: 37, size: 'lg', depth: 1.2 },
  { x: 90, y: 54, size: 'sm', depth: 0.7 },
  { x: -1, y: 66, size: 'sm', depth: 0.6 },
  { x: 13, y: 77, size: 'md', depth: 1.0 },
  { x: 29, y: 64, size: 'sm', depth: 0.55 },
  { x: 35, y: 80, size: 'lg', depth: 1.25 },
  { x: 57, y: 65, size: 'md', depth: 0.8 },
  { x: 63, y: 87, size: 'sm', depth: 0.6 },
  { x: 75, y: 72, size: 'lg', depth: 1.1 },
  { x: 2, y: 92, size: 'md', depth: 0.9 },
  { x: 90, y: 90, size: 'sm', depth: 0.7 },
];

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 before `a`, 1 after `b`, eased in between. */
const ease = (p: number, a: number, b: number) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };

const Card: React.FC<{ review: LandingReview; size?: string; style?: React.CSSProperties }> = ({ review, size = 'md', style }) => (
  <figure className={`rs-card rs-${size}`} style={style}>
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
      s.setProperty('--drift', p.toFixed(4));
      s.setProperty('--out', ease(p, 0.3, 0.52).toFixed(4));
      s.setProperty('--dark', ease(p, 0.3, 0.46).toFixed(4));
      s.setProperty('--split', ease(p, 0.38, 0.58).toFixed(4));
      s.setProperty('--head', (1 - ease(p, 0.52, 0.64)).toFixed(4));
      s.setProperty('--orb', ease(p, 0.42, 0.74).toFixed(4));
      s.setProperty('--final', ease(p, 0.74, 0.9).toFixed(4));
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => { window.removeEventListener('scroll', request); window.removeEventListener('resize', request); if (frame) cancelAnimationFrame(frame); };
  }, [reduced]);

  const reviews = LANDING_REVIEWS;
  const floating = reviews.slice(0, SLOTS.length);
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
          {floating.map((review, i) => {
            const slot = SLOTS[i];
            const style = { '--x': `${slot.x}%`, '--y': `${slot.y}%`, '--d': slot.depth, '--ox': (slot.x + 10 - 50) / 50, '--oy': (slot.y - 50) / 50 } as React.CSSProperties;
            return <Card key={review.name} review={review} size={slot.size} style={style} />;
          })}
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
