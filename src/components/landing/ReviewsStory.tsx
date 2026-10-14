import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Star, StarHalf } from 'lucide-react';
import { LANDING_REVIEWS, type LandingReview } from '../../data/landingReviews';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';
import './reviewsStory.css';

/** Where each floating card sits (percent of the stage), how big it is, and how fast it drifts. */
const SLOTS: { x: number; y: number; size: 'sm' | 'md' | 'lg'; depth: number }[] = [
  { x: 2, y: 12, size: 'lg', depth: 1.25 },
  { x: 22, y: 3, size: 'sm', depth: 0.6 },
  { x: 40, y: 8, size: 'md', depth: 0.95 },
  { x: 62, y: 3, size: 'sm', depth: 0.55 },
  { x: 77, y: 12, size: 'md', depth: 1.1 },
  { x: -2, y: 44, size: 'md', depth: 0.8 },
  { x: 82, y: 42, size: 'sm', depth: 0.7 },
  { x: 24, y: 70, size: 'lg', depth: 1.3 },
  { x: 55, y: 72, size: 'md', depth: 1.0 },
  { x: 76, y: 68, size: 'lg', depth: 1.2 },
  { x: 4, y: 74, size: 'sm', depth: 0.65 },
  { x: 42, y: 94, size: 'sm', depth: 0.5 },
  { x: 86, y: 92, size: 'sm', depth: 0.85 },
  { x: 12, y: 96, size: 'md', depth: 0.9 },
];

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 before `a`, 1 after `b`, eased in between. */
const ease = (p: number, a: number, b: number) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };

const Stars: React.FC<{ rating: number }> = ({ rating }) => (
  <span className="rs-stars" aria-label={`${rating} out of 5`}>
    {Array.from({ length: 5 }, (_, i) => (i + 1 <= rating ? <Star key={i} size={12} className="on" aria-hidden="true" /> : <span key={i} className="rs-half" aria-hidden="true"><Star size={12} /><StarHalf size={12} className="on" /></span>))}
  </span>
);

const Card: React.FC<{ review: LandingReview; size?: string; style?: React.CSSProperties }> = ({ review, size = 'md', style }) => (
  <figure className={`rs-card rs-${size}`} style={style}>
    <Stars rating={review.rating} />
    <blockquote>{review.quote}</blockquote>
    <figcaption>
      <span className="rs-avatar" aria-hidden="true">{review.role[0]}</span>
      <span><b>{review.role}</b><small>{review.city}{review.illustrative && <em className="rs-tag">Sample</em>}</small></span>
    </figcaption>
  </figure>
);

type Props = { ctaLabel: string; onCta: () => void; autoPrompt?: boolean };

/**
 * Reviews as a scroll story: cards drift past a headline at different speeds, then fly apart while the
 * stage turns dark, the headline splits, a glowing ArthaMind mark grows in the gap, and the sign-up
 * message takes over. Reduced-motion users get the same content as a static layout.
 */
export const ReviewsStory: React.FC<Props> = ({ ctaLabel, onCta, autoPrompt }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const promptRef = useRef({ onCta, autoPrompt });
  promptRef.current = { onCta, autoPrompt };

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
    let prompted = false;
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
      stage.classList.toggle('is-final', p > 0.8);
      if (p > 0.94 && !prompted && promptRef.current.autoPrompt) {
        prompted = true;
        let seen = false;
        try { seen = sessionStorage.getItem('am-signup-prompted') === '1'; sessionStorage.setItem('am-signup-prompted', '1'); } catch { /* storage blocked */ }
        if (!seen) promptRef.current.onCta();
      }
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => { window.removeEventListener('scroll', request); window.removeEventListener('resize', request); if (frame) cancelAnimationFrame(frame); };
  }, [reduced]);

  const reviews = LANDING_REVIEWS;
  const floating = reviews.slice(0, SLOTS.length);
  const anyIllustrative = reviews.some((review) => review.illustrative);
  const note = anyIllustrative && <p className="rs-note">Reviews tagged “Sample” show the layout; they are not from real users yet.</p>;
  const finale = (
    <div className="rs-final-copy">
      <h2 id="rs-final-title">Taxes, loans, investments and goals. <span>Sorted in one place.</span></h2>
      <p>A free health check, a personal CFO that speaks 13 Indian languages, and every number checked by our own engine. No card needed.</p>
      <button type="button" className="rs-cta" onClick={onCta}>{ctaLabel} <ArrowRight size={17} /></button>
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
            const style = { '--x': `${slot.x}%`, '--y': `${slot.y}%`, '--d': slot.depth, '--ox': (slot.x + 10 - 50) / 50, '--oy': (slot.y - 50) / 50, '--i': i } as React.CSSProperties;
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
        <div className="rs-final" aria-labelledby="rs-final-title">{finale}</div>
        {note}
      </div>
    </section>
  );
};
