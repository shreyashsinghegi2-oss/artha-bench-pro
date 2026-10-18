import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { LANDING_REVIEWS, type LandingReview } from '../../data/landingReviews';
import { WAITLIST_AS_OF, WAITLIST_COUNT } from '../../data/waitlist';
import './reviewsStory.css';

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** How many cards fly out, and the share of the scroll each one takes to cross the screen. */
const COUNT = 18;
const LIFE = 0.34;
/** Golden-angle spread so neighbouring cards leave the centre in different directions. */
const ANGLES = Array.from({ length: COUNT }, (_, i) => (i * 137.508 * Math.PI) / 180);

const Card = React.forwardRef<HTMLElement, { review: LandingReview; className?: string }>(({ review, className = '' }, ref) => (
  <figure ref={ref} className={`rs-card ${className}`.trim()}>
    <blockquote>{review.quote}</blockquote>
    <figcaption>
      <span className="rs-place" aria-hidden="true"><MapPin size={14} /></span>
      <span><b>{review.role}</b><small>{review.city}</small></span>
    </figcaption>
  </figure>
));
Card.displayName = 'ReviewCard';

/**
 * Reviews (Groww style): the waitlist number sits in the middle of a pinned stage and, as the visitor
 * scrolls, review cards grow out of the centre one after another and fly past the edges, as if the
 * visitor were moving through them. Reduced-motion visitors get the same cards as a grid.
 */
export const ReviewsStory: React.FC<{ onCta?: () => void; ctaLabel?: string }> = ({ onCta, ctaLabel = 'Sign up free' }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const reviews = LANDING_REVIEWS;

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
    if (!section) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const range = section.offsetHeight - window.innerHeight;
      const p = range > 0 ? clamp(-rect.top / range) : 0;
      // Far enough that a card leaves the screen at the end of its trip.
      const rx = window.innerWidth * 0.62;
      const ry = window.innerHeight * 0.6;
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const start = (i / COUNT) * (1 - LIFE);
        const t = clamp((p - start) / LIFE);
        if (t <= 0 || t >= 1) { el.style.opacity = '0'; el.style.visibility = 'hidden'; return; }
        const r = t * t * 0.55 + t * 0.45; // speeds up as it nears the visitor
        const x = Math.cos(ANGLES[i]) * rx * r;
        const y = Math.sin(ANGLES[i]) * ry * r;
        const scale = 0.18 + t * 1.15;
        const fadeIn = clamp((t - 0.06) / 0.2);
        const fadeOut = clamp((1 - t) / 0.18);
        el.style.visibility = 'visible';
        el.style.opacity = (fadeIn * fadeOut).toFixed(3);
        el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
        el.style.zIndex = String(Math.round(t * 100));
      });
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => { window.removeEventListener('scroll', request); window.removeEventListener('resize', request); if (frame) cancelAnimationFrame(frame); };
  }, [reduced]);

  const note = reviews.some((review) => review.illustrative) && <p className="rs-note">Illustrative quotes</p>;
  const headline = (
    <div className="rs-center">
      <h2 id="rs-title"><b>{WAITLIST_COUNT.toLocaleString('en-IN')}+</b> Indians on the waitlist</h2>
      <p>Joined our early-access waitlist, as of {WAITLIST_AS_OF}.</p>
      {onCta && <button type="button" className="rs-cta" onClick={onCta}>{ctaLabel}</button>}
    </div>
  );

  if (reduced) {
    return (
      <section id="reviews" className="rs-static" aria-labelledby="rs-title">
        {headline}
        <div className="rs-static-grid">{reviews.slice(0, 9).map((review) => <Card key={review.name} review={review} />)}</div>
        {note}
      </section>
    );
  }

  return (
    <section id="reviews" ref={sectionRef} className="rs-section" aria-labelledby="rs-title">
      <div className="rs-stage">
        <div className="rs-cards">
          {Array.from({ length: COUNT }, (_, i) => (
            <Card key={i} review={reviews[i % reviews.length]} ref={(el) => { cardRefs.current[i] = el; }} />
          ))}
        </div>
        {headline}
        {note}
      </div>
    </section>
  );
};
