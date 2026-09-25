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
  overview: { title: 'Home & report', intro: 'I can walk you through your money report.', task: 'cfo',
    questions: [goal(['Explain my report', 'Improve my health score', 'Reach my freedom number sooner', 'Choose a tax regime']), income, detail],
    starters: ['Explain my freedom number simply', 'How can I raise my health score?'] },
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
 * The prompt sent to the AI: page snapshot, the user's guided answers and their question.
 * Kept within the 4,000-character API limit, with the question last so retrieval uses it.
 */
export function buildPagePrompt(page: string, snapshot: string, answers: Array<[string, string]>, question: string): string {
  const q = question.trim().slice(0, 600);
  const ans = answers.map(([a, b]) => `- ${a} ${b}`).join('\n').slice(0, 600);
  const budget = 4000 - q.length - ans.length - 520;
  const snap = snapshot.replace(/\s+/g, ' ').trim().slice(0, Math.max(400, budget));
  return `The user is on the "${page}" page of ArthaMind AI. Answer using what this page shows first, then general knowledge and live data. Quote numbers from the page exactly. If something needed is not on the page, say what is missing and ask for it.
PAGE SNAPSHOT (what the user sees now): ${snap}
${ans ? `USER'S ANSWERS:\n${ans}\n` : ''}
User question: ${q}`;
}
