import type { AppNavigationDestination } from '../navigationTypes';

/**
 * Guided questions the page assistant asks before answering, per workspace feature. Each question is
 * multiple choice so the user can answer in taps; the answers travel with the page snapshot to the AI.
 */
export interface GuideQuestion { id: string; ask: string; options: string[] }
export interface FeatureGuide { title: string; intro: string; questions: GuideQuestion[]; starters: string[]; task: 'cfo' | 'general' | 'education' | 'live_data' }

const goal = (options: string[]): GuideQuestion => ({ id: 'goal', ask: 'What would you like to do here?', options });
const horizon: GuideQuestion = { id: 'horizon', ask: 'When do you need this to work out?', options: ['This month', 'Within a year', '1–5 years', '5+ years'] };
const detail: GuideQuestion = { id: 'detail', ask: 'How much detail?', options: ['Quick answer', 'Step by step', 'Full analysis with numbers'] };
const income: GuideQuestion = { id: 'income', ask: 'Your monthly take-home?', options: ['Under ₹50,000', '₹50,000 – ₹1,00,000', '₹1,00,000 – ₹2,00,000', 'Above ₹2,00,000'] };
const risk: GuideQuestion = { id: 'risk', ask: 'How do you feel about ups and downs?', options: ['Careful', 'Balanced', 'Growth'] };
const market: GuideQuestion = { id: 'experience', ask: 'Your market experience?', options: ['New to markets', 'Some experience', 'Experienced'] };

const GUIDES: Partial<Record<AppNavigationDestination, FeatureGuide>> = {
  'my-dashboard': { title: 'Dashboard', intro: 'I can read your dashboard and explain what stands out.', task: 'cfo',
    questions: [goal(['Review my overall financial health', 'Find my biggest risk', 'What to do with my surplus', 'Plan for a goal']), horizon, detail],
    starters: ['What is the most important thing to fix first?', 'Am I saving enough for my age?'] },
  portfolio: { title: 'Portfolio', intro: 'I can read your portfolio and explain returns, risk and what to improve.', task: 'cfo',
    questions: [goal(['Review my whole portfolio', 'Am I diversified enough?', 'Should I switch Regular to Direct?', 'How to rebalance', 'Plan for a goal']), horizon, risk, detail],
    starters: ['What is the biggest risk in my portfolio?', 'Is my asset allocation right for my age?', 'Which funds overlap or can be cut?'] },
  overview: { title: 'Home & report', intro: 'I can walk you through your money report.', task: 'cfo',
    questions: [goal(['Explain my report', 'Improve my health score', 'Reach my freedom number sooner', 'Choose a tax regime']), income, detail],
    starters: ['Explain my freedom number simply', 'How can I raise my health score?'] },
  'retirement-planner': { title: 'Retirement planner', intro: 'I can review your retirement numbers and how to close any gap.', task: 'cfo',
    questions: [goal(['Review my retirement plan', 'Retire earlier', 'Which schemes and funds?', 'Asset mix by age']), risk, detail],
    starters: ['Am I on track to retire?', 'How much more should I invest each month?'] },
  'education-planner': { title: 'Child education planner', intro: 'I can help you plan and fund your child\'s education.', task: 'cfo',
    questions: [goal(['Review my education plan', 'Current fees for a course', 'India vs abroad', 'Loan vs saving']), horizon, detail],
    starters: ['Is my SIP enough for these courses?', 'What will an MS in the USA cost by then?'] },
  'job-switch-planner': { title: 'Job switch planner', intro: 'I can tell you whether an offer is really worth it.', task: 'cfo',
    questions: [goal(['Should I take this offer?', 'What to negotiate', 'PF and gratuity questions', 'Relocation costs']), detail],
    starters: ['Is this offer worth switching for?', 'What salary should I ask for?'] },
  'money-planner': { title: 'Planner', intro: 'I can help you decide what to do with a lump sum.', task: 'cfo',
    questions: [goal(['Check the plan on screen', 'I have a bonus to use', 'Should I prepay a loan?', 'Build an emergency fund first?']), horizon, risk, detail],
    starters: ['Is this split right for me?', 'Prepay my loan or invest?'] },
  'financial-health': { title: 'Health score', intro: 'I can explain each health indicator and how to improve it.', task: 'cfo',
    questions: [goal(['Why is my score this value?', 'Quick wins to improve', 'Build a 90-day plan']), income, detail], starters: ['Which indicator hurts my score most?'] },
  income: { title: 'Income & tax', intro: 'I can help with income, tax regime and deductions.', task: 'cfo',
    questions: [goal(['Old vs new tax regime', 'Reduce my tax legally', 'Plan for freelance income', 'Understand my payslip']), { id: 'work', ask: 'How do you earn?', options: ['Salaried', 'Self-employed / freelance', 'Business', 'Mixed'] }, income, detail],
    starters: ['Which regime is better for me?', 'What deductions am I missing?'] },
  expenses: { title: 'Expenses', intro: 'I can find patterns in your spending.', task: 'cfo',
    questions: [goal(['Where is my money going?', 'Cut spending without pain', 'Spot unusual spends']), income, detail], starters: ['What are my top three spending leaks?'] },
  budgeting: { title: 'Budget', intro: 'I can help you build and stick to a budget.', task: 'cfo',
    questions: [goal(['Create a budget', 'I keep overspending', 'Save for a goal']), { id: 'style', ask: 'Which budgeting style suits you?', options: ['50/30/20 rule', 'Zero-based', 'Just set limits'] }, income],
    starters: ['Build me a 50/30/20 budget'] },
  'emi-manager': { title: 'EMI & loans', intro: 'I can review your loans and repayment options.', task: 'cfo',
    questions: [goal(['Can I afford a new loan?', 'Prepay or invest?', 'Compare two loan offers', 'Understand my EMI schedule']), { id: 'loan', ask: 'Which loan?', options: ['Home', 'Car / two-wheeler', 'Personal', 'Education', 'Credit card'] }, { id: 'priority', ask: 'Your priority?', options: ['Lower EMI', 'Finish sooner', 'Save the most interest'] }],
    starters: ['Should I prepay my costliest loan?', 'Is my EMI load too high?'] },
  'finance-reports': { title: 'Reports', intro: 'I can summarise your reports.', task: 'cfo', questions: [goal(['Summarise this period', 'What changed vs last period?', 'Where to improve next']), detail], starters: ['What changed the most this month?'] },
  'decision-replay': { title: 'What-if', intro: 'I can test a what-if with you.', task: 'cfo', questions: [goal(['Salary change', 'New EMI', 'Cut a big expense', 'Start a SIP']), horizon], starters: ['What if my salary rises 15%?'] },
  'financial-twin': { title: 'Ripple Twin', intro: 'I can explain how one change ripples through your plan.', task: 'cfo', questions: [goal(['Explain the ripple on screen', 'Test a new change']), horizon], starters: ['What is the biggest knock-on effect?'] },
  markets: { title: 'Market data', intro: 'I can explain the market data and companies on screen.', task: 'live_data',
    questions: [goal(['Explain today’s market', 'Analyse a company', 'Compare two stocks', 'Understand a ratio']), market, detail], starters: ['Why is the market up or down today?'] },
  'india-markets': { title: 'India Explorer', intro: 'I can explain Indian stocks and sectors on screen.', task: 'live_data',
    questions: [goal(['Analyse a company', 'Compare sectors', 'Explain valuation (P/E, P/B)', 'Why did a stock move?']), market, horizon], starters: ['How does HDFC Bank compare with ICICI Bank?'] },
  'us-markets': { title: 'US Explorer', intro: 'I can explain US stocks and ETFs.', task: 'live_data',
    questions: [goal(['Analyse a company', 'Index fund or stocks?', 'How to invest from India (LRS)', 'Currency risk']), market, horizon], starters: ['How can an Indian resident invest in US stocks?'] },
  'forex-markets': { title: 'Forex', intro: 'I can explain currency moves and how they affect you.', task: 'live_data',
    questions: [goal(['Why is the rupee moving?', 'Plan an overseas payment', 'Understand currency risk', 'Learn how forex works']), { id: 'pair', ask: 'Which currency?', options: ['USD/INR', 'EUR/INR', 'GBP/INR', 'JPY/INR'] }, horizon], starters: ['What moves USD/INR?'] },
  'intraday-markets': { title: 'Intraday Lab', intro: 'I can explain intraday concepts and risks (education only).', task: 'education',
    questions: [goal(['Learn intraday basics', 'Understand the chart on screen', 'Risk and position sizing', 'Why most intraday traders lose']), market], starters: ['How should I size a position?'] },
  'market-watchlist': { title: 'Watchlist', intro: 'I can review your watchlist.', task: 'live_data', questions: [goal(['Summarise my watchlist', 'Check concentration', 'Research one stock']), market], starters: ['Is my watchlist too concentrated?'] },
  'market-alerts': { title: 'Alerts', intro: 'I can help you set sensible alerts.', task: 'general', questions: [goal(['Set useful alerts', 'Too many alerts firing']), market], starters: ['What alert levels make sense?'] },
  'markets-learn': { title: 'Markets learning', intro: 'I can teach market concepts step by step.', task: 'education', questions: [goal(['Stocks basics', 'Mutual funds', 'Derivatives', 'Technical analysis']), market, detail], starters: ['Explain options like I am new'] },
  crypto: { title: 'Crypto', intro: 'I can explain crypto prices, risks and rules in India.', task: 'live_data',
    questions: [goal(['Explain the chart', 'Tax on crypto in India', 'Risks before buying', 'Compare two coins']), market], starters: ['How is crypto taxed in India?'] },
  news: { title: 'Business news', intro: 'I can explain the headlines and what they mean for you.', task: 'live_data', questions: [goal(['Explain a headline', 'Impact on my investments', 'Today’s big stories']), detail], starters: ['What matters most in today’s news?'] },
  economy: { title: 'Economic data', intro: 'I can explain indicators like inflation, GDP and rates.', task: 'education', questions: [goal(['Explain an indicator', 'Impact on EMIs and FDs', 'Is a slowdown coming?']), detail], starters: ['How does inflation affect my savings?'] },
  learning: { title: 'Learning', intro: 'I can build a study plan for you.', task: 'education', questions: [goal(['Personal finance basics', 'Investing', 'Tax', 'Markets and trading']), { id: 'level', ask: 'Your level?', options: ['Beginner', 'Intermediate', 'Advanced'] }, { id: 'time', ask: 'Time per week?', options: ['1 hour', '3 hours', '5+ hours'] }], starters: ['Make me a 4-week plan'] },
  tutor: { title: 'Tutor', intro: 'Use the tutor chat on this page, or ask me here.', task: 'education', questions: [goal(['Explain a concept', 'Solve a calculation', 'Quiz me']), { id: 'level', ask: 'Your level?', options: ['Beginner', 'Intermediate', 'Advanced'] }], starters: ['Explain CAGR with an example'] },
};

const DEFAULT: FeatureGuide = { title: 'This page', intro: 'I can read this page and answer questions about it.', task: 'general',
  questions: [goal(['Explain this page', 'Help me take an action', 'Find a feature']), detail], starters: ['What can I do on this page?'] };

export const guideFor = (d: AppNavigationDestination): FeatureGuide => GUIDES[d] ?? DEFAULT;

/**
 * The expert each assistant becomes on its page: its name, what it is expert in, and the answer format
 * that suits the field (a tutor teaches, an EMI analyst runs numbers, a market analyst cites live data).
 */
export interface FieldExpert { name: string; expertise: string; format: string }
const E = (name: string, expertise: string, format: string): FieldExpert => ({ name, expertise, format });
const EXPERTS: Partial<Record<AppNavigationDestination, FieldExpert>> = {
  'my-dashboard': E('CFO Intelligence', 'a personal CFO reviewing the whole financial picture', 'Verdict line → 3 ranked priorities, each with the amount and the monthly step → what is going well → the one number to watch.'),
  overview: E('Money Report Intelligence', 'a personal CFO explaining a money health report', 'Plain-words summary → green (on track) / amber (watch) / red (fix) list with amounts → next 3 actions in order.'),
  portfolio: E('Portfolio Intelligence', 'a portfolio analyst (asset allocation, XIRR, overlap, costs)', 'Portfolio verdict → allocation vs a suitable target as a small table → risks (concentration, overlap, expense ratio) → rebalancing steps with amounts.'),
  'retirement-planner': E('Retirement Intelligence', 'a retirement planner (corpus, inflation, withdrawal rates, NPS/EPF/PPF)', 'On track or not → gap in rupees → monthly SIP needed → which products in what mix → a year-by-year milestone table.'),
  'education-planner': E('Education Planning Intelligence', 'a child-education planner (fee inflation, India vs abroad, loans)', 'Cost today vs cost when needed → SIP needed per course → funding mix (savings, loan, scholarships) → timeline.'),
  'job-switch-planner': E('Career Move Intelligence', 'a compensation analyst (CTC structure, tax, PF, gratuity, cost of living)', 'Take it / negotiate / decline → real monthly gain → what to negotiate with a target figure → risks.'),
  'money-planner': E('Money Planner Intelligence', 'a lump-sum allocation planner', 'Split table (bucket, amount, why) in priority order → what to do first this week → what to avoid.'),
  'financial-health': E('Health Score Intelligence', 'a financial-health analyst', 'Score drivers from weakest to strongest → a 90-day plan with one action per indicator and the expected score change.'),
  income: E('Income & Tax Intelligence', 'an Indian income-tax specialist (old vs new regime, deductions, TDS, advance tax)', 'Regime verdict with both tax amounts side by side → deductions used and missed → steps with deadlines.'),
  expenses: E('Expense Intelligence', 'a spending analyst', 'Top leaks with amounts → which are needs vs wants → savings plan with the monthly amount freed.'),
  budgeting: E('Budget Intelligence', 'a budget coach', 'Budget table by category (limit, spent, left) → categories over limit in red terms → a realistic plan for the rest of the month.'),
  'finance-reports': E('Report Intelligence', 'a financial report analyst', 'Period summary → biggest changes vs last period with amounts → drivers → actions.'),
  'emi-manager': E('EMI Manager Intelligence', 'a loan and EMI specialist (amortisation, prepayment, refinancing, credit score)', 'EMI load verdict (% of take-home) → loan-by-loan table (rate, EMI, balance, interest left) → prepay or invest maths with the interest saved → next step.'),
  'decision-replay': E('What-if Intelligence', 'a scenario analyst', 'Before vs after table → the biggest knock-on effect → whether the change is worth it.'),
  'financial-twin': E('Ripple Twin Intelligence', 'a scenario analyst for knock-on effects', 'The change → first-order effect → second-order effects across modules → what to watch.'),
  markets: E('Market Intelligence', 'a market analyst using live prices and news', 'Live figures with source and time first → what moved and why (dated news) → what it means for a long-term investor → risks.'),
  'india-markets': E('India Markets Intelligence', 'an Indian equity analyst (NSE/BSE, valuation ratios, sectors)', 'Live price and change with time → business snapshot → valuation vs peers table → risks → what to check before investing.'),
  'us-markets': E('US Markets Intelligence', 'a US equity analyst for Indian investors (LRS, TCS, currency risk)', 'Live price in US$ and ₹ → business snapshot → how to invest from India and the costs → risks.'),
  'forex-markets': E('Forex Intelligence', 'a currency analyst (USD/INR drivers, RBI, remittances)', 'Live rate with time → drivers from dated news → effect on the user\'s payments or investments → hedging options.'),
  'intraday-markets': E('Intraday Intelligence', 'a trading educator focused on risk', 'Concept → worked example with position size and stop-loss in rupees → the risk in numbers → education-only reminder.'),
  'market-watchlist': E('Watchlist Intelligence', 'a watchlist analyst', 'Watchlist table (live price, change) → concentration by sector → names to research next.'),
  'market-alerts': E('Alerts Intelligence', 'an alerts and risk-limit coach', 'Suggested alert levels table with the reason for each → how to avoid alert fatigue.'),
  'markets-learn': E('Markets Tutor', 'a markets teacher', 'Simple definition → analogy → worked Indian example with numbers → 3-question check.'),
  crypto: E('Crypto Intelligence', 'a crypto analyst for India (30% tax, 1% TDS, risk)', 'Live price with time → what moved it (dated) → Indian tax on this trade in rupees → risks.'),
  news: E('News Intelligence', 'a business news explainer', 'Headline in one line with date and publisher → why it matters → effect on the user\'s money → what to watch next.'),
  economy: E('Economy Intelligence', 'a macro-economist (inflation, GDP, repo rate)', 'Latest figure with date and source → what it means → effect on EMIs, FDs and SIPs → outlook with ranges, not certainties.'),
  learning: E('Learning Intelligence', 'a finance learning coach', 'Study plan table (week, topic, time, outcome) → first lesson to start now.'),
  tutor: E('Tutor', 'a patient finance and maths teacher', 'Simple definition → analogy → worked example with every step → common mistake → 2 practice questions.'),
  'quick-check': E('Evaluation Intelligence', 'an AI-answer reliability evaluator', 'Score summary → issues found (maths, evidence, safety) → how to fix the answer.'),
  'evaluation-lab': E('Evaluation Intelligence', 'an AI-answer reliability evaluator', 'Dimension-by-dimension findings → corrected figures → overall verdict.'),
};
const DEFAULT_EXPERT = E('AI', 'a personal finance expert for India', 'Direct answer → the numbers behind it → next steps.');
export const expertFor = (d: AppNavigationDestination): FieldExpert => EXPERTS[d] ?? DEFAULT_EXPERT;
/** Display name, e.g. "ArthaMind EMI Manager Intelligence". */
export const expertName = (d: AppNavigationDestination) => `ArthaMind ${expertFor(d).name}`;


/**
 * The prompt sent to the AI: page snapshot, the user's guided answers and their question.
 * Kept within the 4,000-character API limit, with the question last so retrieval uses it.
 */
export function buildPagePrompt(page: string, snapshot: string, answers: Array<[string, string]>, question: string, expert: FieldExpert = DEFAULT_EXPERT): string {
  const q = question.trim().slice(0, 600);
  const ans = answers.map(([a, b]) => `- ${a} ${b}`).join('\n').slice(0, 600);
  const role = `You are ArthaMind ${expert.name}, ${expert.expertise}. Answer as that expert. ANSWER FORMAT for this field: ${expert.format}`;
  const budget = 4000 - q.length - ans.length - role.length - 560;
  const snap = snapshot.replace(/\s+/g, ' ').trim().slice(0, Math.max(400, budget));
  return `${role}
The user is on the "${page}" page of ArthaMind AI. Use, in this order: what this page shows, the user's own saved data, live market data and live web results with their dates. Quote numbers exactly. If something needed is missing, say what is missing and ask for it.
PAGE SNAPSHOT (what the user sees now): ${snap}
${ans ? `USER'S ANSWERS:\n${ans}\n` : ''}
User question: ${q}`;
}
