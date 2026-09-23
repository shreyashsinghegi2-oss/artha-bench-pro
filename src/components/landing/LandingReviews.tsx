import React from 'react';
import { Quote, Star } from 'lucide-react';
import { LANDING_REVIEWS, type LandingReview } from '../../data/landingReviews';

const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

const ReviewCard: React.FC<{ review: LandingReview; hidden?: boolean }> = ({ review, hidden }) => <figure className="rv-card" aria-hidden={hidden || undefined}>
  <div className="rv-top">
    <span className="rv-stars" aria-label={`${review.rating} out of 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} className={i < review.rating ? 'on' : ''} aria-hidden="true"/>)}</span>
    <span className="rv-feature">{review.feature}</span>
  </div>
  <blockquote><Quote size={16} aria-hidden="true"/>{review.quote}</blockquote>
  <figcaption>
    <span className="rv-avatar" aria-hidden="true">{initials(review.name)}</span>
    <span><b>{review.name}</b><small>{review.role} · {review.city}</small></span>
    {review.illustrative && <span className="rv-tag" title="Placeholder review shown for layout. Replace with a real, consented review.">Illustrative</span>}
  </figcaption>
</figure>;

/** Two gently drifting rows of reviews that keep moving on hover; static grid for reduced motion. */
export const LandingReviews: React.FC = () => {
  const reviews = LANDING_REVIEWS;
  if (!reviews.length) return null;
  const half = Math.ceil(reviews.length / 2);
  const rows = [reviews.slice(0, half), reviews.slice(half)];
  const anyIllustrative = reviews.some((review) => review.illustrative);
  return <section id="reviews" className="cl-section rv-section cl-reveal-section" aria-labelledby="reviews-title">
    <div className="cl-wrap">
      <div className="cl-eyebrow">Reviews</div>
      <h2 id="reviews-title">What people use ArthaMind for.</h2>
      <p className="cl-sub">Planning, learning and checking the numbers before a money decision.</p>
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
