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
  rating: 4.5 | 5;
  quote: string;
  feature: string;
  illustrative: boolean;
}

export const LANDING_REVIEWS: LandingReview[] = [
  { name: 'r01', role: 'Product designer', city: 'Bengaluru', rating: 5, feature: 'AI CFO', illustrative: true, quote: 'The health check showed my EMIs were fine but my emergency fund was thin, with an exact rupee gap.' },
  { name: 'r02', role: 'Chartered accountant', city: 'Pune', rating: 5, feature: 'Reliability Lab', illustrative: true, quote: 'Answers show the formula and sources, so I can check the working instead of trusting a paragraph.' },
  { name: 'r03', role: 'First-time investor', city: 'Hyderabad', rating: 4.5, feature: 'Tutor', illustrative: true, quote: 'Explained SIPs and the tax regimes in Hinglish without making me feel silly for asking.' },
  { name: 'r04', role: 'Shop owner', city: 'Ahmedabad', rating: 5, feature: 'Cash flow', illustrative: true, quote: 'Monthly surplus next to EMIs and GST outflows changed how I plan purchases.' },
  { name: 'r05', role: 'Doctor', city: 'Chennai', rating: 4.5, feature: 'Markets', illustrative: true, quote: 'Clean market dashboard with honest labels on what is delayed. No tips, just context.' },
  { name: 'r06', role: 'Software engineer', city: 'Gurugram', rating: 4.5, feature: 'EMI manager', illustrative: true, quote: 'The prepay vs invest comparison finally made the home-loan trade-off concrete.' },
  { name: 'r07', role: 'Teacher', city: 'Kochi', rating: 5, feature: 'Budgeting', illustrative: true, quote: 'Simple enough for my parents. The Hindi answers were a big help for them.' },
  { name: 'r08', role: 'Freelance consultant', city: 'Mumbai', rating: 4.5, feature: 'Tax', illustrative: true, quote: 'Advance-tax view is useful. I would like more help with irregular income months.' },
  { name: 'r09', role: 'MBA student', city: 'Indore', rating: 5, feature: 'Money Check', illustrative: true, quote: 'Ran the free check in two minutes. The freedom number was a wake-up call.' },
  { name: 'r10', role: 'Bank officer', city: 'Lucknow', rating: 4.5, feature: 'Retirement', illustrative: true, quote: 'Retirement plan with inflation shown year by year. Easy to explain to my wife.' },
  { name: 'r11', role: 'NRI engineer', city: 'Dubai', rating: 4.5, feature: 'Global planner', illustrative: true, quote: 'Comparing retiring in India vs abroad side by side is exactly what I needed.' },
  { name: 'r12', role: 'HR manager', city: 'Noida', rating: 4.5, feature: 'Portfolio', illustrative: true, quote: 'CAS import worked well. Took a moment to understand XIRR, the tutor helped.' },
  { name: 'r13', role: 'Pharmacist', city: 'Jaipur', rating: 5, feature: 'Insurance', illustrative: true, quote: 'It showed my term cover was half of what my family would need. Fixed it.' },
  { name: 'r14', role: 'Startup founder', city: 'Bengaluru', rating: 4.5, feature: 'AI CFO', illustrative: true, quote: 'Fast answers with assumptions listed. I can see what it did not know.' },
  { name: 'r15', role: 'Homemaker', city: 'Nagpur', rating: 5, feature: 'Goals', illustrative: true, quote: 'Child education goal broken into a monthly SIP I can actually afford.' },
  { name: 'r16', role: 'Data analyst', city: 'Kolkata', rating: 4.5, feature: 'Crypto', illustrative: true, quote: 'Live BTC chart and plain explanations, without pushing me to trade.' },
  { name: 'r17', role: 'Retired professor', city: 'Mysuru', rating: 4.5, feature: 'Tutor', illustrative: true, quote: 'Good explanations. Font could be larger on my tablet, but very clear.' },
  { name: 'r18', role: 'Sales executive', city: 'Surat', rating: 5, feature: 'Old vs new tax', illustrative: true, quote: 'Saw in rupees why the new regime saves me more this year.' },
  { name: 'r19', role: 'Civil engineer', city: 'Bhopal', rating: 5, feature: 'Home loan', illustrative: true, quote: 'Saw how two extra EMIs a year cut almost five years off my loan.' },
  { name: 'r20', role: 'Nurse', city: 'Thiruvananthapuram', rating: 4.5, feature: 'Emergency fund', illustrative: true, quote: 'Clear target for my emergency fund and a monthly amount to reach it.' },
  { name: 'r21', role: 'Restaurant owner', city: 'Amritsar', rating: 5, feature: 'Cash flow', illustrative: true, quote: 'Punjabi answers made it easy for my father to follow the plan too.' },
  { name: 'r22', role: 'IT consultant', city: 'Singapore', rating: 4.5, feature: 'Global planner', illustrative: true, quote: 'Planning my child’s university abroad in two currencies, finally in one place.' },
  { name: 'r23', role: 'Government officer', city: 'Patna', rating: 5, feature: 'Retirement', illustrative: true, quote: 'NPS and PPF in one retirement view. Very easy to understand.' },
  { name: 'r24', role: 'Young professional', city: 'Pune', rating: 5, feature: 'Budgeting', illustrative: true, quote: 'First salary, first budget. It told me exactly how much to save.' },
  { name: 'r25', role: 'Chartered accountant', city: 'Delhi', rating: 4.5, feature: 'Tax', illustrative: true, quote: 'The regime comparison matches my own working. I share it with clients.' },
  { name: 'r26', role: 'Designer', city: 'Goa', rating: 5, feature: 'AI CFO', illustrative: true, quote: 'Asked by voice in Konkani-English mix and still got a clear answer.' },
  { name: 'r27', role: 'Professor', city: 'Varanasi', rating: 4.5, feature: 'Tutor', illustrative: true, quote: 'Good lessons on mutual funds. My students use it before class.' },
  { name: 'r28', role: 'Logistics manager', city: 'Visakhapatnam', rating: 5, feature: 'Insurance', illustrative: true, quote: 'Showed the cover gap for my family in rupees, not jargon.' },
  { name: 'r29', role: 'Architect', city: 'Chandigarh', rating: 5, feature: 'Goals', illustrative: true, quote: 'House, car and travel goals all planned without stretching too thin.' },
  { name: 'r30', role: 'NRI doctor', city: 'London', rating: 4.5, feature: 'Global planner', illustrative: true, quote: 'Retire in India or the UK? The side-by-side numbers settled it.' },
];
