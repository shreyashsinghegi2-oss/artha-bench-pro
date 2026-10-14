import React from 'react';
import { Star } from 'lucide-react';
import { LANDING_REVIEWS, type LandingReview } from '../../data/landingReviews';

const ReviewCard: React.FC<{ review: LandingReview; hidden?: boolean }> = ({ review, hidden }) => (
  <figure className="rv-card" aria-hidden={hidden || undefined}>
    <div className="rv-top">
      <span className="rv-stars" aria-label={`${review.rating} out of 5`}>
        {Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} className={i < review.rating ? 'on' : ''} aria-hidden="true" />)}
        <b>{review.rating}.0</b>
      </span>
      <span className="rv-feature">{review.feature}</span>
    </div>
    <blockquote>{review.quote}</blockquote>
    <figcaption>
      <span className="rv-avatar" aria-hidden="true">{review.role[0]}</span>
      <span><b>{review.role}</b><small>{review.city}{review.illustrative && <em className="rv-tag" title="Sample review that shows the layout. Replace with a real, consented review.">Sample</em>}</small></span>
    </figcaption>
  </figure>
);

/** Reviews: three compact rows drifting in alternating directions; a static grid for reduced motion. */
export const LandingReviews: React.FC = () => {
  const reviews = LANDING_REVIEWS;
  if (!reviews.length) return null;
  const size = Math.ceil(reviews.length / 3);
  const rows = [0, 1, 2].map((r) => reviews.slice(r * size, r * size + size)).filter((row) => row.length);
  const anyIllustrative = reviews.some((review) => review.illustrative);
  return (
    <section id="reviews" className="cl-section rv-section cl-reveal-section" aria-labelledby="reviews-title">
      <div className="cl-wrap">
        <div className="cl-eyebrow">Reviews</div>
        <h2 id="reviews-title">What people say about ArthaMind.</h2>
        <p className="cl-sub">From first-time investors to chartered accountants: clear numbers they can check, in their own language.</p>
      </div>
      <div className="rv-rows">
        {rows.map((row, index) => (
          <div key={index} className={`rv-row rv-row-${index} ${index % 2 ? 'reverse' : ''}`}>
            <div className="rv-track">
              {row.map((review) => <ReviewCard key={review.name} review={review} />)}
              {row.map((review) => <ReviewCard key={`${review.name}-copy`} review={review} hidden />)}
            </div>
          </div>
        ))}
      </div>
      <div className="rv-static cl-wrap">{reviews.map((review) => <ReviewCard key={review.name} review={review} />)}</div>
      {anyIllustrative && <p className="rv-note cl-wrap">Reviews tagged “Sample” show this layout and are not statements from real users. They will be replaced by real, consented reviews.</p>}
    </section>
  );
};
