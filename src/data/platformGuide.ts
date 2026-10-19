/**
 * What ArthaMind is and does, in short spoken answers, drawn from the landing page. The voice
 * assistant answers platform questions from here (instantly, no AI call) when the reply language is
 * English, and passes PLATFORM_FACTS as context to the AI for other languages.
 */
export const PLATFORM_FACTS =
  'ArthaMind (by Artha Bench Pro) is your personal CFO for Indian families and Indians abroad. ' +
  'Money Check: enter six numbers and get a money health score, the better tax regime (old vs new), freedom number, ' +
  'insurance gaps, emergency fund and net worth, calculated on the device. ' +
  'ArthaMind CFO: ask any money question by voice or text in 13 Indian languages and get a clear plan in rupees; numbers come from tested formulas, not a language model. ' +
  'Planners: retirement, child education in India or abroad, home, job switch, EMI prepayment, goals tested across 1,000 market paths. ' +
  'Portfolio: import a mutual fund statement (CAS) and see true returns (XIRR). Markets: NIFTY, SENSEX, US stocks, gold, forex and crypto. ' +
  'Learning hub and tutor. Privacy: uploaded documents are read on the device; data is protected by row-level security and never sold. ' +
  'Pricing: Free plan; Pro ₹1,999 a year (₹249 monthly); Global planner $199 a year; Business custom. ' +
  'ArthaMind gives financial information and planning tools; it is not a SEBI-registered investment adviser and never places trades.';

type Topic = { match: RegExp; answer: string };

const TOPICS: Topic[] = [
  { match: /\b(price|pricing|cost|subscription|pro plan|free plan|paid|pay|fees?)\b/i,
    answer: 'ArthaMind has a free plan with the money health score, Money Check, all calculators and three ArthaMind CFO questions a month. Pro is 1,999 rupees a year, or 249 rupees a month, and adds the full tax engine, EMI prepayment plans, portfolio import with true returns, goal plans and unlimited ArthaMind CFO in 13 Indian languages. Global planner, for Indians abroad, is 199 dollars a year. Business plans are custom.' },
  { match: /\b(safe|secure|security|privacy|private|data|store|stored)\b/i,
    answer: 'Your data stays yours. Documents you upload are read on your own device and are not sent to us. Your records are protected by row-level security, so only you can see them, and ArthaMind never sells your data.' },
  { match: /\b(language|languages|hindi|tamil|telugu|bengali|marathi|gujarati|kannada|malayalam|punjabi|odia|hinglish)\b/i,
    answer: 'You can talk to ArthaMind in 13 Indian languages, including Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi and Hinglish, by voice or by typing. The app itself is available in 20 languages.' },
  { match: /\b(money check|health (check|score)|score)\b/i,
    answer: 'The Money Check takes six numbers: your age, salary, spending, EMIs, savings and investments. In about two minutes it gives your money health score, the better tax regime, your freedom number, insurance gaps, emergency fund and net worth, with what to fix first. It is free.' },
  { match: /\b(tax|regime|80c|deduction)\b/i,
    answer: 'ArthaMind compares the old and new tax regimes on your real numbers and shows which saves more, with every deduction such as 80C, 80D, NPS and HRA. The tax is worked out by our tested tax engine, not guessed by ArthaMind.' },
  { match: /\b(emi|loan|prepay|home loan)\b/i,
    answer: 'For loans, ArthaMind shows your EMI load and whether prepaying or investing is better. For example, on a 50 lakh home loan at 8 percent for 20 years, paying 5,000 rupees extra a month saves about 12.7 lakh rupees of interest and ends the loan 52 months early.' },
  { match: /\b(goal|retire|retirement|education|child|plan for|planner)\b/i,
    answer: 'ArthaMind plans every goal: retirement, your child’s education in India or abroad, a home or a job switch. It shows the monthly SIP you need, with inflation year by year, and tests the plan across a thousand market paths.' },
  { match: /\b(portfolio|mutual fund|cas|xirr|invest|investment|stock|market)\b/i,
    answer: 'You can import your mutual fund statement and see your true return, called XIRR. ArthaMind also follows NIFTY, SENSEX, US stocks, gold, forex and crypto live. It explains markets for learning; it does not give stock tips or place trades.' },
  { match: /\b(sign ?up|start|register|account|use it|how (do|can) i (use|start))\b/i,
    answer: 'Tap Sign up at the top of the page and verify your email with a one-time code. Then start with the free Money Check, and ask the ArthaMind CFO anything about your money.' },
];

const GENERAL =
  'ArthaMind is your personal CFO. It checks your money health, picks the better tax regime, plans goals like retirement and your child’s education, ' +
  'tracks your investments and answers any money question in 13 Indian languages, by voice. Every number comes from tested formulas, and your data stays private. You can start free.';

/** True when the question is about ArthaMind itself rather than the user’s own money. */
export function isPlatformQuestion(q: string): boolean {
  return /\b(artha ?mind|artha ?bench|this (app|platform|website|site)|your (app|platform)|what (can|do) you do|who are you|what is this|features?)\b/i.test(q)
    || (/\b(price|pricing|subscription|pro plan|free plan)\b/i.test(q) && /\b(your|artha|this|pro|free)\b/i.test(q));
}

/** A short spoken answer about the platform, picked by topic. */
export function platformAnswer(q: string): string {
  const hit = TOPICS.find((t) => t.match.test(q));
  return hit ? hit.answer : GENERAL;
}
