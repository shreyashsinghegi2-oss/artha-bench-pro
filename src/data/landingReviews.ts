/**
 * Landing-page reviews.
 *
 * Entries with `illustrative: true` are placeholder copy that shows the layout. They render with an
 * "Illustrative" tag and must be replaced with real, consented user reviews before being presented
 * as customer feedback. Set `illustrative: false` only for genuine reviews you can substantiate.
 */
export interface LandingReview {
  name: string;
  role: string;
  city: string;
  rating: 1 | 2 | 3 | 4 | 5;
  quote: string;
  feature: string;
  illustrative: boolean;
}

export const LANDING_REVIEWS: LandingReview[] = [
  { name: 'Priya S.', role: 'Product designer', city: 'Bengaluru', rating: 5, feature: 'AI CFO', illustrative: true, quote: 'The health check told me my EMIs were fine but my emergency fund was thin, with an exact rupee gap. That was the push I needed.' },
  { name: 'Rahul M.', role: 'Chartered accountant', city: 'Pune', rating: 5, feature: 'Reliability Lab', illustrative: true, quote: 'I like that answers show the formula and the sources. I can check the working instead of trusting a paragraph.' },
  { name: 'Ananya K.', role: 'First-time investor', city: 'Hyderabad', rating: 4, feature: 'Financial Tutor', illustrative: true, quote: 'Explained SIPs and the old vs new tax regime in Hinglish without making me feel silly for asking basic questions.' },
  { name: 'Vikram P.', role: 'Small business owner', city: 'Ahmedabad', rating: 5, feature: 'Cash flow', illustrative: true, quote: 'Seeing my monthly surplus next to EMIs and GST outflows in one place changed how I plan purchases for the shop.' },
  { name: 'Meera J.', role: 'Doctor', city: 'Chennai', rating: 5, feature: 'Market data', illustrative: true, quote: 'Clean market dashboard with honest labels on what is delayed. No noise, no tips, just context.' },
  { name: 'Arjun T.', role: 'Software engineer', city: 'Gurugram', rating: 4, feature: 'EMI manager', illustrative: true, quote: 'The prepayment comparison made the home-loan vs invest decision concrete. I finally understood the trade-off in numbers.' },
  { name: 'Sneha R.', role: 'Teacher', city: 'Kochi', rating: 5, feature: 'Budgeting', illustrative: true, quote: 'Simple enough for my parents to use. The Hindi answers were a big help for them.' },
  { name: 'Karan D.', role: 'Freelance consultant', city: 'Mumbai', rating: 4, feature: 'Tax', illustrative: true, quote: 'Irregular income is hard to plan. The advance-tax and emergency-runway view made quarterly planning much calmer.' },
];
