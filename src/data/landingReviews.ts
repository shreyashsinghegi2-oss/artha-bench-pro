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
  { name: 'r01', role: 'Product designer', city: 'Bengaluru', rating: 5, feature: 'AI CFO', illustrative: true, quote: 'The health check showed my EMIs were fine but my emergency fund was thin, with an exact rupee gap.' },
  { name: 'r02', role: 'Chartered accountant', city: 'Pune', rating: 5, feature: 'Reliability Lab', illustrative: true, quote: 'Answers show the formula and sources, so I can check the working instead of trusting a paragraph.' },
  { name: 'r03', role: 'First-time investor', city: 'Hyderabad', rating: 4, feature: 'Tutor', illustrative: true, quote: 'Explained SIPs and the tax regimes in Hinglish without making me feel silly for asking.' },
  { name: 'r04', role: 'Shop owner', city: 'Ahmedabad', rating: 5, feature: 'Cash flow', illustrative: true, quote: 'Monthly surplus next to EMIs and GST outflows changed how I plan purchases.' },
  { name: 'r05', role: 'Doctor', city: 'Chennai', rating: 4, feature: 'Markets', illustrative: true, quote: 'Clean market dashboard with honest labels on what is delayed. No tips, just context.' },
  { name: 'r06', role: 'Software engineer', city: 'Gurugram', rating: 4, feature: 'EMI manager', illustrative: true, quote: 'The prepay vs invest comparison finally made the home-loan trade-off concrete.' },
  { name: 'r07', role: 'Teacher', city: 'Kochi', rating: 5, feature: 'Budgeting', illustrative: true, quote: 'Simple enough for my parents. The Hindi answers were a big help for them.' },
  { name: 'r08', role: 'Freelance consultant', city: 'Mumbai', rating: 3, feature: 'Tax', illustrative: true, quote: 'Advance-tax view is useful. I would like more help with irregular income months.' },
  { name: 'r09', role: 'MBA student', city: 'Indore', rating: 5, feature: 'Money Check', illustrative: true, quote: 'Ran the free check in two minutes. The freedom number was a wake-up call.' },
  { name: 'r10', role: 'Bank officer', city: 'Lucknow', rating: 4, feature: 'Retirement', illustrative: true, quote: 'Retirement plan with inflation shown year by year. Easy to explain to my wife.' },
  { name: 'r11', role: 'NRI engineer', city: 'Dubai', rating: 4, feature: 'Global planner', illustrative: true, quote: 'Comparing retiring in India vs abroad side by side is exactly what I needed.' },
  { name: 'r12', role: 'HR manager', city: 'Noida', rating: 3, feature: 'Portfolio', illustrative: true, quote: 'CAS import worked well. Took a moment to understand XIRR, the tutor helped.' },
  { name: 'r13', role: 'Pharmacist', city: 'Jaipur', rating: 5, feature: 'Insurance', illustrative: true, quote: 'It showed my term cover was half of what my family would need. Fixed it.' },
  { name: 'r14', role: 'Startup founder', city: 'Bengaluru', rating: 4, feature: 'AI CFO', illustrative: true, quote: 'Fast answers with assumptions listed. I can see what it did not know.' },
  { name: 'r15', role: 'Homemaker', city: 'Nagpur', rating: 5, feature: 'Goals', illustrative: true, quote: 'Child education goal broken into a monthly SIP I can actually afford.' },
  { name: 'r16', role: 'Data analyst', city: 'Kolkata', rating: 4, feature: 'Crypto', illustrative: true, quote: 'Live BTC chart and plain explanations, without pushing me to trade.' },
  { name: 'r17', role: 'Retired professor', city: 'Mysuru', rating: 3, feature: 'Tutor', illustrative: true, quote: 'Good explanations. Font could be larger on my tablet, but very clear.' },
  { name: 'r18', role: 'Sales executive', city: 'Surat', rating: 5, feature: 'Old vs new tax', illustrative: true, quote: 'Saw in rupees why the new regime saves me more this year.' },
];
