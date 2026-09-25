import React from 'react';
import { LockKeyhole, Quote, Star } from 'lucide-react';
import { LANDING_REVIEWS, type LandingReview } from '../../data/landingReviews';

const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

/** One-way 53-bit hash (cyrb53) shown instead of the reviewer's name: it cannot be turned back into the name. */
function privateId(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
  return `${hex.slice(0, 4)} ${hex.slice(4, 8)} ${hex.slice(8, 12)}`;
}

const ReviewCard: React.FC<{ review: LandingReview; hidden?: boolean }> = ({ review, hidden }) => <figure className="rv-card" aria-hidden={hidden || undefined}>
  <div className="rv-id" title="Reviewer names are replaced by a one-way hashed ID, so the comment cannot be traced back to a person.">
    <LockKeyhole size={12} aria-hidden="true"/><span>Private ID</span><code>{privateId(`${review.name}|${review.city}`)}</code>
  </div>
  <div className="rv-top">
    <span className="rv-stars" aria-label={`${review.rating} out of 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={15} className={i < review.rating ? 'on' : ''} aria-hidden="true"/>)}<b>{review.rating}.0</b></span>
    <span className="rv-feature">{review.feature}</span>
  </div>
  <blockquote><Quote size={16} aria-hidden="true"/>{review.quote}</blockquote>
  <figcaption>
    <span className="rv-avatar" aria-hidden="true">{initials(review.name)}</span>
    <span><b>{review.role}</b><small>{review.city}</small></span>
    {review.illustrative && <span className="rv-tag" title="Placeholder review shown for layout. Replace with a real, consented review.">Illustrative</span>}
  </figcaption>
</figure>;

/**
 * Reviews, last on the page: two rows drifting in opposite directions. Hovering a row pauses it and
 * zooms the card under the pointer so it can be read; a static grid is used for reduced motion.
 */
export const LandingReviews: React.FC = () => {
  const reviews = LANDING_REVIEWS;
  if (!reviews.length) return null;
  const half = Math.ceil(reviews.length / 2);
  const rows = [reviews.slice(0, half), reviews.slice(half)];
  const anyIllustrative = reviews.some((review) => review.illustrative);
  return <section id="reviews" className="cl-section rv-section cl-reveal-section" aria-labelledby="reviews-title">
    <div className="cl-wrap">
      <div className="cl-eyebrow">Reviews</div>
      <h2 id="reviews-title">What people say about ArthaMind.</h2>
      <p className="cl-sub">Every reviewer is shown by a private ID instead of a name, so feedback stays anonymous.</p>
    </div>
    <div className="rv-rows">
      {rows.map((row, index) => <div key={index} className={`rv-row ${index ? 'reverse' : ''}`}>
        <div className="rv-track">
          {row.map((review) => <ReviewCard key={review.name} review={review}/>)}
          {row.map((review) => <ReviewCard key={`${review.name}-copy`} review={review} hidden/>)}
        </div>
      </div>)}
    </div>
    <div className="rv-static cl-wrap" data-stagger>{reviews.map((review) => <ReviewCard key={review.name} review={review}/>)}</div>
    {anyIllustrative && <p className="rv-note cl-wrap">Reviews tagged “Illustrative” are sample copy that shows this layout; they are not statements from real users.</p>}
  </section>;
};
