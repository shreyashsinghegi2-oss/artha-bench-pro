/**
 * Required sign-up questions: what we ask every new user before the workspace opens, why we ask it (in
 * plain words), which answers can be skipped, the number checks that catch answers that cannot be true,
 * and the money-mindset result from the short scenarios at the end.
 *
 * Every check here is ordinary arithmetic on the answers (no AI). Two kinds:
 * - "error": the answers contradict each other (for example 10 years in a job at age 20). Must be fixed.
 * - "confirm": unusual but possible (spending more than you earn). The user fixes it or confirms it.
 */
import { ROUGH_INR_PER_UNIT, type Level } from './userPrefs';
import type { MoneyProfile } from './moneyProfile';

export type Work = 'salaried' | 'government' | 'business' | 'self-employed' | 'freelancer' | 'student' | 'homemaker' | 'retired' | 'looking';
export type Steadiness = 'fixed' | 'varies' | 'irregular';
export type Goal = 'emergency' | 'home' | 'education' | 'retirement' | 'vehicle' | 'travel' | 'debt-free' | 'wealth';

export interface OnboardingAnswers {
  /** Language for the questions and every answer (BCP-47, e.g. hi-IN). */
  language?: string;
  name?: string;
  /** What the user does, in their words (e.g. "Software engineer", "Kirana shop"). */
  jobTitle?: string;
  industry?: string;
  level?: Level;
  country?: string;
  currency?: string;
  age?: number;
  work?: Work;
  /** Years in the current job or business. */
  jobYears?: number;
  /** Years of earning in total. */
  totalYears?: number;
  /** Money coming in each month before tax, in the home currency. */
  monthlyIncome?: number;
  steadiness?: Steadiness;
  /** Where the money comes from (salary, rent, interest…). */
  incomeSources?: string[];
  /** Lowest monthly income in the last 2 years (only when income changes). */
  worstMonthIncome?: number;
  /** Rent, EMIs excluded: bills, school fees, subscriptions, insurance premiums. */
  fixedExpenses?: number;
  /** Food, travel, shopping, fun. */
  variableExpenses?: number;
  /** Total monthly spending (fixed + variable); kept for older saved answers. */
  monthlyExpenses?: number;
  budget?: 'strict' | 'rough' | 'none';
  overspend?: string;
  monthlyEmi?: number;
  loanTypes?: string[];
  /** Highest yearly interest rate among the loans, in %. */
  highestRate?: number;
  /** Credit card bill not yet paid off. */
  creditCardDue?: number;
  propertyValue?: number;
  gold?: number;
  businessValue?: number;
  yearlyRevenue?: number;
  /** Profit as % of revenue. */
  profitMargin?: number;
  separateAccounts?: 'yes' | 'no';
  criticalCover?: 'yes' | 'no' | 'unsure';
  goals?: Goal[];
  retireAge?: number;
  /** Monthly income (today's money) that would let the user stop working. */
  freedomIncome?: number;
  taxRegime?: 'old' | 'new' | 'unsure';
  section80C?: number;
  hasAdviser?: 'yes' | 'no';
  taxNotice?: 'yes' | 'no';
  will?: 'yes' | 'no';
  nominees?: 'all' | 'some' | 'none' | 'unsure';
  guardian?: 'yes' | 'no' | 'na';
  decisionStyle?: 'numbers' | 'feeling' | 'mix' | 'others';
  lostMoney?: 'yes' | 'no';
  knowledgeGaps?: string[];
  loanOutstanding?: number;
  liquidSavings?: number;
  investments?: number;
  dependants?: number;
  healthCover?: number;
  termCover?: number;
  goal?: Goal;
  goalAmount?: number;
  goalYears?: number;
  /** Scenario answers: question id → chosen option index. */
  scenarios?: Record<string, number>;
}

export const EARNING_WORK: Work[] = ['salaried', 'government', 'business', 'self-employed', 'freelancer'];
export const isEarning = (w?: Work) => !!w && EARNING_WORK.includes(w);

export const WORK_OPTIONS: Array<{ value: Work; label: string }> = [
  { value: 'salaried', label: 'Job in a private company' },
  { value: 'government', label: 'Government job' },
  { value: 'business', label: 'I run a business' },
  { value: 'self-employed', label: 'Self-employed (doctor, CA, shop…)' },
  { value: 'freelancer', label: 'Freelance or gig work' },
  { value: 'student', label: 'Student' },
  { value: 'homemaker', label: 'Homemaker' },
  { value: 'retired', label: 'Retired' },
  { value: 'looking', label: 'Looking for work' },
];

export const GOAL_OPTIONS: Array<{ value: Goal; label: string }> = [
  { value: 'emergency', label: 'Build an emergency fund' },
  { value: 'debt-free', label: 'Get out of debt' },
  { value: 'home', label: 'Buy a home' },
  { value: 'education', label: 'Education (mine or my child’s)' },
  { value: 'vehicle', label: 'Buy a car or bike' },
  { value: 'travel', label: 'Travel' },
  { value: 'retirement', label: 'Retire comfortably' },
  { value: 'wealth', label: 'Grow my money' },
];

// ---------------- Money-mindset scenarios (skippable) ----------------

export interface Scenario { id: string; question: string; why: string; options: Array<{ label: string; risk?: number; habit?: number }> }

export const SCENARIOS: Scenario[] = [
  {
    id: 'crash', question: 'You invested some money. Next month it is worth 20% less. What do you do?',
    why: 'Prices go up and down. This shows how you feel when they go down.',
    options: [{ label: 'Sell everything so I don’t lose more', risk: 0 }, { label: 'Sell some of it', risk: 1 }, { label: 'Wait. It may come back', risk: 2 }, { label: 'Put in more while it is cheap', risk: 3 }],
  },
  {
    id: 'choice', question: 'Pick one for the next year:',
    why: 'Some people like a sure thing, some like a chance at more.',
    options: [{ label: 'A sure 7% gain', risk: 0 }, { label: 'Most likely 9%, small chance of 0%', risk: 1 }, { label: 'Either 0% or 20%, 50–50 chance', risk: 3 }],
  },
  {
    id: 'bonus', question: 'You get an extra month’s income as a bonus. What happens to it?',
    why: 'This shows your saving habit.',
    options: [{ label: 'I spend all of it', habit: 0 }, { label: 'Half spend, half save', habit: 2 }, { label: 'I save or invest most of it', habit: 3 }, { label: 'I pay off a loan with it', habit: 3 }],
  },
  {
    id: 'tip', question: 'A friend says a share will double in one month. What do you do?',
    why: 'Quick tips are the most common way people lose money.',
    options: [{ label: 'Put in a lot, fast', habit: 0, risk: 3 }, { label: 'Put in a small amount', habit: 1, risk: 2 }, { label: 'Check it carefully first', habit: 3, risk: 1 }, { label: 'Ignore it', habit: 3, risk: 0 }],
  },
  {
    id: 'surprise', question: 'Your phone breaks and you must pay for a new one today. How do you pay?',
    why: 'This shows if you have a safety net for surprises.',
    options: [{ label: 'From my savings', habit: 3 }, { label: 'Credit card, paid in full next month', habit: 2 }, { label: 'EMI or loan', habit: 0 }, { label: 'Borrow from family or friends', habit: 1 }],
  },
  {
    id: 'shock', question: 'You lose your job, and your investments fall to half, both tomorrow. What do you do this week?',
    why: 'This is the big test of a money plan. A calm answer means your safety net is working.',
    options: [{ label: 'Live on my safety fund and look for work', habit: 3, risk: 2 }, { label: 'Sell my investments to pay bills', habit: 1, risk: 0 }, { label: 'Borrow or use credit cards', habit: 0, risk: 1 }, { label: 'I honestly don’t know', habit: 1, risk: 1 }],
  },
  {
    id: 'check', question: 'How often do you look at your investments?',
    why: 'Looking too often can make you worry; never looking means surprises.',
    options: [{ label: 'Every day', habit: 1, risk: 1 }, { label: 'Every week or month', habit: 3, risk: 2 }, { label: 'A few times a year', habit: 2, risk: 2 }, { label: 'I don’t have investments yet', habit: 1, risk: 1 }],
  },
];

export interface MindsetResult {
  risk: 'careful' | 'balanced' | 'bold';
  habit: 'planner' | 'balancer' | 'spender';
  riskLabel: string;
  habitLabel: string;
  answered: number;
}

/** Plain scoring: average risk and habit points from the answered scenarios, nudged by age for risk. */
export function scoreMindset(a: OnboardingAnswers): MindsetResult {
  const picked = Object.entries(a.scenarios ?? {}).map(([id, i]) => SCENARIOS.find((s) => s.id === id)?.options[i]).filter(Boolean) as Scenario['options'];
  const avg = (key: 'risk' | 'habit') => {
    const vals = picked.map((o) => o[key]).filter((v): v is number => typeof v === 'number');
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 1.5;
  };
  // Older users have less time to recover from a fall, so the same answers point a little more careful.
  const age = a.age ?? 30;
  const risk = avg('risk') - (age >= 55 ? 0.5 : age >= 45 ? 0.25 : 0);
  const habit = avg('habit');
  const r: MindsetResult['risk'] = risk < 1.1 ? 'careful' : risk < 2.1 ? 'balanced' : 'bold';
  const h: MindsetResult['habit'] = habit >= 2.3 ? 'planner' : habit >= 1.4 ? 'balancer' : 'spender';
  const riskLabel = { careful: 'Careful: you prefer safety over big gains', balanced: 'Balanced: some ups and downs are fine for you', bold: 'Bold: you accept big ups and downs for more growth' }[r];
  const habitLabel = { planner: 'Planner: you save first and think before you spend', balancer: 'Balancer: you enjoy today and save for tomorrow', spender: 'Spender: money tends to go as it comes; small habits will help' }[h];
  return { risk: r, habit: h, riskLabel, habitLabel, answered: picked.length };
}

// ---------------- Number checks ----------------

export interface Issue { field: keyof OnboardingAnswers; kind: 'error' | 'confirm'; message: string }

/** 11111, 99999, 123456, 987654: numbers people type when they are guessing. */
export function looksMadeUp(n: number | undefined): boolean {
  if (!n || n < 10_000) return false;
  const s = String(Math.round(n));
  if (/^(\d)\1+$/.test(s)) return true;
  return '01234567890'.includes(s) || '98765432109'.includes(s);
}

const toInr = (n: number, currency: string) => n * (ROUGH_INR_PER_UNIT[currency] ?? 1);

/** All arithmetic checks on the answers so far. Each issue names the question it belongs to. */
export function checkAnswers(a: OnboardingAnswers): Issue[] {
  const out: Issue[] = [];
  const cur = a.currency ?? 'INR';
  const inr = (n: number | undefined) => toInr(n ?? 0, cur);
  const age = a.age;

  if (age !== undefined && (!Number.isInteger(age) || age < 16 || age > 100)) out.push({ field: 'age', kind: 'error', message: 'Please enter your age in whole years, between 16 and 100.' });

  if (age !== undefined && isEarning(a.work)) {
    const maxYears = Math.max(0, age - 14);
    if (a.jobYears !== undefined) {
      if (a.jobYears < 0 || a.jobYears > 60) out.push({ field: 'jobYears', kind: 'error', message: 'Years in your job should be between 0 and 60.' });
      else if (a.jobYears > maxYears) out.push({ field: 'jobYears', kind: 'error', message: `At age ${age}, ${a.jobYears} years in one job is not possible (that would mean starting before age 14). Please check the years.` });
    }
    if (a.totalYears !== undefined) {
      if (a.totalYears > maxYears) out.push({ field: 'totalYears', kind: 'error', message: `At age ${age}, you can have at most about ${maxYears} years of work. Please check.` });
      else if (a.jobYears !== undefined && a.totalYears < a.jobYears) out.push({ field: 'totalYears', kind: 'error', message: `Total years of work (${a.totalYears}) can’t be less than years in your current job (${a.jobYears}).` });
    }
  }

  const income = a.monthlyIncome;
  if (income !== undefined) {
    if (income < 0) out.push({ field: 'monthlyIncome', kind: 'error', message: 'Income can’t be negative.' });
    else if (income === 0 && isEarning(a.work)) out.push({ field: 'monthlyIncome', kind: 'confirm', message: 'You said you work, but your income is 0. Is that right (for example, a new business with no profit yet)?' });
    else if (inr(income) > 1e7) out.push({ field: 'monthlyIncome', kind: 'confirm', message: 'That is more than 1 crore rupees a month. Please check the number of zeros.' });
    else if (a.work === 'student' && inr(income) > 1e5) out.push({ field: 'monthlyIncome', kind: 'confirm', message: 'That is a high monthly income for a student. Please check it.' });
    else if (age !== undefined && age < 18 && inr(income) > 5e4) out.push({ field: 'monthlyIncome', kind: 'confirm', message: `That is a high income at age ${age}. Please check it.` });
    if (looksMadeUp(income)) out.push({ field: 'monthlyIncome', kind: 'confirm', message: 'This looks like a typed-in guess (repeated or running digits). Please enter your real income, roughly.' });
  }

  if (a.worstMonthIncome !== undefined && income !== undefined) {
    if (a.worstMonthIncome < 0) out.push({ field: 'worstMonthIncome', kind: 'error', message: 'Income can’t be negative.' });
    else if (a.worstMonthIncome > income) out.push({ field: 'worstMonthIncome', kind: 'error', message: 'Your worst month can’t be more than a normal month. Please check both numbers.' });
  }

  if ((a.fixedExpenses ?? 0) < 0) out.push({ field: 'fixedExpenses', kind: 'error', message: 'Spending can’t be negative.' });
  if (looksMadeUp(a.fixedExpenses)) out.push({ field: 'fixedExpenses', kind: 'confirm', message: 'This looks like a typed-in guess. Please enter your real fixed costs, roughly.' });
  // Spending is checked once the full monthly amount is known (fixed + day-to-day).
  const spendField: keyof OnboardingAnswers = a.variableExpenses !== undefined ? 'variableExpenses' : 'monthlyExpenses';
  const spend = totalSpend(a);
  if (spend !== undefined && (a.variableExpenses !== undefined || a.fixedExpenses === undefined)) {
    if ((a.variableExpenses ?? 0) < 0 || spend < 0) out.push({ field: spendField, kind: 'error', message: 'Spending can’t be negative.' });
    else {
      if (income && income > 0 && spend + (a.monthlyEmi ?? 0) > income * 1.5) out.push({ field: spendField, kind: 'confirm', message: `You spend ${Math.round(((spend + (a.monthlyEmi ?? 0)) / income) * 100)}% of what you earn. Is the gap paid from savings or family? If not, please check the numbers.` });
      if (income && income > 0 && age !== undefined && age >= 18 && spend > 0 && inr(spend) < 1500) out.push({ field: spendField, kind: 'confirm', message: 'That is very low for a whole month. Did you mean a week or a day? Please enter monthly amounts.' });
      if (looksMadeUp(a.variableExpenses)) out.push({ field: spendField, kind: 'confirm', message: 'This looks like a typed-in guess. Please enter your real spending, roughly.' });
    }
  }

  const emi = a.monthlyEmi;
  if (emi !== undefined) {
    if (emi < 0) out.push({ field: 'monthlyEmi', kind: 'error', message: 'EMI can’t be negative.' });
    else if (income && income > 0 && emi > income * 0.8) out.push({ field: 'monthlyEmi', kind: 'confirm', message: `Your EMIs are ${Math.round((emi / income) * 100)}% of your income. Banks usually stop at about 50%. Please check.` });
    else if ((income ?? 0) === 0 && emi > 0) out.push({ field: 'monthlyEmi', kind: 'confirm', message: 'You pay EMIs but have no income. Is someone else paying them? Please check.' });
  }

  const loan = a.loanOutstanding;
  if (loan !== undefined && emi && emi > 0 && loan > 0) {
    if (loan < emi) out.push({ field: 'loanOutstanding', kind: 'confirm', message: 'The loan left is less than one EMI. Is this the last payment? Please check.' });
    // Even at 0% interest, 400 EMIs is more than 33 years.
    else if (loan > emi * 400) out.push({ field: 'loanOutstanding', kind: 'confirm', message: `At ${emi.toLocaleString()} a month, this loan would take more than 33 years even with no interest. Please check the amount or the EMI.` });
  }

  const savings = (a.liquidSavings ?? 0) + (a.investments ?? 0);
  if (a.investments !== undefined && income !== undefined && age !== undefined) {
    // Most people's savings come from what they earned. Far more than that usually means a typo (or a gift).
    const yearsEarning = a.totalYears ?? Math.max(0, age - 22);
    const plausible = income * 12 * (yearsEarning + 2) * 1.5 + 25e5 / (ROUGH_INR_PER_UNIT[cur] ?? 1);
    if (savings > plausible) out.push({ field: 'investments', kind: 'confirm', message: 'Your savings and investments are much more than your earnings so far. That is fine if it came from family or a sale, otherwise please check the zeros.' });
    if (looksMadeUp(a.investments) || looksMadeUp(a.liquidSavings)) out.push({ field: 'investments', kind: 'confirm', message: 'One of these looks like a typed-in guess. A rough real number is better.' });
  }
  if (a.liquidSavings !== undefined && a.liquidSavings < 0) out.push({ field: 'liquidSavings', kind: 'error', message: 'Savings can’t be negative. Enter 0 if you have none.' });
  if (a.investments !== undefined && a.investments < 0) out.push({ field: 'investments', kind: 'error', message: 'Investments can’t be negative. Enter 0 if you have none.' });

  if (a.highestRate !== undefined) {
    if (a.highestRate < 0 || a.highestRate > 60) out.push({ field: 'highestRate', kind: 'error', message: 'Please enter a yearly interest rate between 0% and 60%.' });
    else if (a.highestRate > 30) out.push({ field: 'highestRate', kind: 'confirm', message: `${a.highestRate}% a year is very high (credit cards and app loans charge this much). Please check it.` });
  }
  if (a.creditCardDue !== undefined) {
    if (a.creditCardDue < 0) out.push({ field: 'creditCardDue', kind: 'error', message: 'Enter 0 if there is no unpaid card bill.' });
    else if (income && income > 0 && a.creditCardDue > income * 6) out.push({ field: 'creditCardDue', kind: 'confirm', message: 'Your unpaid card bill is more than 6 months of income. Please check the amount.' });
  }
  if (a.propertyValue !== undefined && looksMadeUp(a.propertyValue)) out.push({ field: 'propertyValue', kind: 'confirm', message: 'This looks like a typed-in guess. A rough market value is fine.' });
  if (a.profitMargin !== undefined && (a.profitMargin < -100 || a.profitMargin > 100)) out.push({ field: 'profitMargin', kind: 'error', message: 'Profit margin is a percentage between -100% and 100%.' });
  if (a.retireAge !== undefined && age !== undefined && (a.retireAge <= age || a.retireAge > 85)) out.push({ field: 'retireAge', kind: 'error', message: `Please pick an age after your current age (${age}) and up to 85.` });
  // Section 80C deductions stop at ₹1,50,000 a year; anything above saves no extra tax.
  if (a.section80C !== undefined && a.currency === 'INR' && a.section80C > 150_000) out.push({ field: 'section80C', kind: 'confirm', message: 'The 80C limit is ₹1,50,000 a year. Anything above it does not cut your tax. Keep it, or enter the amount up to the limit.' });
  if (a.freedomIncome !== undefined && income && income > 0 && a.freedomIncome > income * 10) out.push({ field: 'freedomIncome', kind: 'confirm', message: 'That is more than 10 times your income today. Please check the zeros.' });

  if (a.dependants !== undefined && (!Number.isInteger(a.dependants) || a.dependants < 0 || a.dependants > 15)) out.push({ field: 'dependants', kind: 'error', message: 'Please enter a number of people between 0 and 15.' });

  if (a.termCover && income && income > 0 && a.termCover > income * 12 * 60) out.push({ field: 'termCover', kind: 'confirm', message: 'That life cover is more than 60 times your yearly income. Please check the zeros.' });

  if (a.goalYears !== undefined && (a.goalYears < 1 || a.goalYears > 50)) out.push({ field: 'goalYears', kind: 'error', message: 'Please pick between 1 and 50 years.' });
  if (a.goalAmount !== undefined && a.goalAmount < 0) out.push({ field: 'goalAmount', kind: 'error', message: 'The goal amount can’t be negative.' });
  return out;
}

/** Monthly spending: fixed + day-to-day when both are known, else the older single total. */
export function totalSpend(a: OnboardingAnswers): number | undefined {
  if (a.fixedExpenses !== undefined || a.variableExpenses !== undefined) return (a.fixedExpenses ?? 0) + (a.variableExpenses ?? 0);
  return a.monthlyExpenses;
}

// ---------------- The first plan (plain arithmetic) ----------------

export interface PathStep { title: string; text: string; tone: 'urgent' | 'next' | 'good' }

/** Monthly saving needed to reach `target` in `months` at `annualReturn` (saving at the start of each month). */
export function monthlySaving(target: number, months: number, annualReturn: number): number {
  if (target <= 0 || months <= 0) return 0;
  const r = annualReturn / 12;
  if (r === 0) return target / months;
  return (target * r) / ((Math.pow(1 + r, months) - 1) * (1 + r));
}

export const PATH_ASSUMPTIONS = { inflation: 0.06, longReturn: 0.1, shortReturn: 0.07, emergencyMonths: 6 } as const;

/**
 * A short, ordered to-do list from the answers, the way a careful adviser would order it: stop any monthly
 * gap, clear costly debt, build a safety fund, protect the family, then grow money for goals.
 */
export function buildPath(a: OnboardingAnswers, fmt: (n: number) => string): { steps: PathStep[]; runwayMonths: number; surplus: number; emiShare: number } {
  const income = a.monthlyIncome ?? 0;
  const spend = totalSpend(a) ?? 0;
  const emi = a.monthlyEmi ?? 0;
  const out = spend + emi;
  const surplus = income - out;
  const runwayMonths = out > 0 ? (a.liquidSavings ?? 0) / out : Infinity;
  const emiShare = income > 0 ? emi / income : 0;
  const steps: PathStep[] = [];
  const india = (a.currency ?? 'INR') === 'INR';

  if (surplus < 0) steps.push({ tone: 'urgent', title: 'Stop spending more than you earn', text: `Each month ${fmt(-surplus)} more goes out than comes in. Find this much to cut${a.overspend ? `, starting with ${a.overspend.toLowerCase()}` : ''}, or add income, before anything else.` });
  if ((a.creditCardDue ?? 0) > 0) steps.push({ tone: 'urgent', title: 'Clear your credit card bill first', text: `Pay off ${fmt(a.creditCardDue!)}. Card interest is about 36–42% a year, the most costly loan there is. Pay the full bill every month from now on.` });
  const target = out * PATH_ASSUMPTIONS.emergencyMonths;
  if (runwayMonths < 3) {
    const gap = Math.max(0, target - (a.liquidSavings ?? 0));
    const perMonth = surplus > 0 ? Math.min(surplus * 0.5, gap) : 0;
    steps.push({ tone: 'urgent', title: 'Build a safety fund', text: `If your income stopped today, your savings would last ${runwayMonths < 1 ? 'less than a month' : `about ${Math.floor(runwayMonths)} month${Math.floor(runwayMonths) === 1 ? '' : 's'}`}. Aim for 6 months of costs: ${fmt(target)}.${perMonth > 0 ? ` Put ${fmt(perMonth)} a month in a savings account or FD until you get there.` : ''}` });
  } else if (runwayMonths < 6) {
    steps.push({ tone: 'next', title: 'Top up your safety fund', text: `Your savings cover about ${Math.floor(runwayMonths)} months of costs. Grow them to 6 months: ${fmt(target)}.` });
  }
  if (!a.healthCover) steps.push({ tone: 'urgent', title: 'Get health insurance', text: `One hospital stay can wipe out years of savings.${india ? ' Start with at least ₹5,00,000 cover for your family, more in a big city.' : ' Get a plan that covers your whole family.'}` });
  const yearly = income * 12;
  if ((a.dependants ?? 0) > 0 && yearly > 0 && (a.termCover ?? 0) < yearly * 10) steps.push({ tone: 'next', title: 'Protect your family with a term plan', text: `${a.dependants} ${a.dependants === 1 ? 'person depends' : 'people depend'} on you. A term plan of about 10–15 times your yearly income (${fmt(yearly * 10)} to ${fmt(yearly * 15)}) keeps them safe if something happens to you.` });
  if (emiShare > 0.4) steps.push({ tone: 'next', title: 'Bring your EMIs down', text: `EMIs take ${Math.round(emiShare * 100)}% of your income. Keep it under 40%: take no new loans and pay extra on the loan with the highest interest${a.highestRate ? ` (${a.highestRate}%)` : ''}.` });
  if (a.goalAmount && a.goalAmount > 0 && a.goalYears) {
    const future = a.goalAmount * Math.pow(1 + PATH_ASSUMPTIONS.inflation, a.goalYears);
    const ret = a.goalYears <= 3 ? PATH_ASSUMPTIONS.shortReturn : PATH_ASSUMPTIONS.longReturn;
    const sip = monthlySaving(future, a.goalYears * 12, ret);
    steps.push({ tone: 'next', title: 'Save for your goal every month', text: `With prices rising about 6% a year, your goal will cost about ${fmt(future)} in ${a.goalYears} years. Saving ${fmt(sip)} a month (growing at about ${Math.round(ret * 100)}% a year) gets you there.${sip > Math.max(0, surplus) ? ' That is more than you save today, so you may need more time or a smaller goal.' : ''}` });
  }
  if (a.nominees && a.nominees !== 'all') steps.push({ tone: 'next', title: 'Add nominees everywhere', text: 'Add a nominee to every bank account, investment and insurance policy, so your family gets the money easily.' });
  if (a.will === 'no' && ((a.dependants ?? 0) > 0 || (a.propertyValue ?? 0) > 0)) steps.push({ tone: 'next', title: 'Write a simple will', text: 'A will says who gets what. It saves your family from long legal trouble.' });
  if (surplus > 0 && steps.filter((s) => s.tone === 'urgent').length === 0) steps.push({ tone: 'good', title: 'Grow what is left', text: `You have ${fmt(surplus)} left each month. Invest a fixed part of it every month (for example in an index fund SIP) for goals more than 5 years away.` });
  if (!steps.length) steps.push({ tone: 'good', title: 'You are on track', text: 'Keep saving every month and check your plan again in 6 months.' });
  return { steps: steps.slice(0, 6), runwayMonths, surplus, emiShare };
}

// ---------------- Saving ----------------

export const ONBOARDING_KEY = 'arthamind.onboarding.v2';
export const ONBOARDING_VERSION = 2;

export interface OnboardingRecord { userId: string; version: number; answers: OnboardingAnswers; result: MindsetResult; completedAt: string }

export function loadOnboardingRecord(): OnboardingRecord | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    const r = raw ? (JSON.parse(raw) as OnboardingRecord) : null;
    return r && typeof r.userId === 'string' && r.version >= ONBOARDING_VERSION ? r : null;
  } catch {
    return null;
  }
}

export function storeOnboardingRecord(r: OnboardingRecord): void {
  try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(r)); } catch { /* storage blocked */ }
}

/** The answers as a money profile, so Money Home, the dashboard and every planner fill in at once. */
export function toMoneyProfile(a: OnboardingAnswers, now = new Date()): MoneyProfile {
  const goalMoney = a.goalAmount && a.goalAmount > 0 && a.goalYears ? { goalAmountToday: a.goalAmount, goalYears: a.goalYears } : {};
  return {
    name: a.name?.trim() || undefined,
    age: a.age ?? 30,
    annualSalary: Math.max(0, Math.round((a.monthlyIncome ?? 0) * 12)),
    monthlyExpenses: Math.max(0, Math.round(totalSpend(a) ?? 0)),
    monthlyEmi: Math.max(0, Math.round(a.monthlyEmi ?? 0)),
    loanOutstanding: (a.loanOutstanding ?? 0) + (a.creditCardDue ?? 0) > 0 ? Math.round((a.loanOutstanding ?? 0) + (a.creditCardDue ?? 0)) : undefined,
    liquidSavings: Math.max(0, Math.round(a.liquidSavings ?? 0)),
    investments: Math.max(0, Math.round((a.investments ?? 0) + (a.gold ?? 0))),
    dependants: a.dependants ?? 0,
    termCover: a.termCover ?? 0,
    healthCover: a.healthCover ?? 0,
    retireAge: a.retireAge ?? Math.max((a.age ?? 30) + 1, 60),
    section80C: a.section80C,
    ...goalMoney,
    source: 'questions',
    updatedAt: now.toISOString(),
  };
}

/** Income band text kept on the account profile (for example "₹50,000 – ₹1,00,000 a month"). */
export function incomeBand(monthly: number, currency: string): string {
  const inr = toInr(monthly, currency);
  const bands: Array<[number, string]> = [[0, 'No income'], [25_000, 'Under ₹25,000'], [50_000, '₹25,000 – ₹50,000'], [1e5, '₹50,000 – ₹1,00,000'], [2.5e5, '₹1,00,000 – ₹2,50,000'], [5e5, '₹2,50,000 – ₹5,00,000'], [Infinity, 'Above ₹5,00,000']];
  if (monthly <= 0) return 'No income';
  const label = bands.find(([max]) => inr < max)?.[1] ?? 'Above ₹5,00,000';
  return `${label} a month${currency === 'INR' ? '' : ` (about, from ${currency})`}`;
}

/**
 * The sign-up answers that are not already in the money profile, as short plain lines, so every
 * assistant, the dashboard analysis and the report know the person (job, goals, habits, mindset).
 */
export function answersSummary(record: OnboardingRecord | null = loadOnboardingRecord()): string {
  if (!record) return '';
  const a = record.answers;
  const cur = a.currency ?? 'INR';
  const m = (n?: number) => (n === undefined ? undefined : `${cur} ${Math.round(n).toLocaleString(cur === 'INR' ? 'en-IN' : 'en-US')}`);
  const work = WORK_OPTIONS.find((w) => w.value === a.work)?.label;
  const goals = (a.goals ?? (a.goal ? [a.goal] : [])).map((g) => GOAL_OPTIONS.find((o) => o.value === g)?.label ?? g);
  const lines = [
    `About the person: ${[a.name, a.age ? `age ${a.age}` : '', a.country, work, a.jobTitle, a.jobYears !== undefined ? `${a.jobYears} years in current work` : '', a.totalYears !== undefined ? `${a.totalYears} years earning in total` : ''].filter(Boolean).join(', ')}.`,
    `Reading level: ${a.level ?? 'beginner'}; language ${a.language ?? 'en-IN'}; home currency ${cur}.`,
    a.incomeSources?.length || a.steadiness ? `Income: ${[a.incomeSources?.join(', '), a.steadiness ? `${a.steadiness === 'fixed' ? 'same every month' : a.steadiness === 'varies' ? 'changes a little' : 'changes a lot'}` : '', a.worstMonthIncome !== undefined ? `worst month ${m(a.worstMonthIncome)}` : ''].filter(Boolean).join('; ')}.` : '',
    a.fixedExpenses !== undefined ? `Spending split: fixed ${m(a.fixedExpenses)}, day-to-day ${m(a.variableExpenses)}${a.budget ? `; budget: ${a.budget}` : ''}${a.overspend ? `; extra money goes to ${a.overspend}` : ''}.` : '',
    [a.gold ? `gold ${m(a.gold)}` : '', a.propertyValue ? `property ${m(a.propertyValue)}` : '', a.businessValue ? `business stake ${m(a.businessValue)}` : ''].filter(Boolean).length ? `Other assets: ${[a.gold ? `gold ${m(a.gold)}` : '', a.propertyValue ? `property ${m(a.propertyValue)}` : '', a.businessValue ? `business stake ${m(a.businessValue)}` : ''].filter(Boolean).join(', ')}.` : '',
    a.loanTypes?.length || a.highestRate || a.creditCardDue ? `Debt detail: ${[a.loanTypes?.join(', '), a.highestRate ? `highest rate ${a.highestRate}%` : '', a.creditCardDue ? `unpaid credit card ${m(a.creditCardDue)}` : 'no unpaid card bill'].filter(Boolean).join('; ')}.` : '',
    a.yearlyRevenue || a.profitMargin !== undefined ? `Business: revenue ${m(a.yearlyRevenue) ?? 'unknown'} a year, profit margin ${a.profitMargin ?? '?'}%, separate accounts ${a.separateAccounts ?? 'unknown'}.` : '',
    `Protection: health cover ${m(a.healthCover) ?? 'unknown'}, term cover ${m(a.termCover) ?? 'unknown'}, critical illness ${a.criticalCover ?? 'unknown'}, nominees ${a.nominees ?? 'unknown'}, will ${a.will ?? 'unknown'}.`,
    goals.length ? `Goals in order: ${goals.join(' > ')}${a.goalAmount ? `; top goal costs ${m(a.goalAmount)} today, needed in ${a.goalYears} years` : ''}${a.retireAge ? `; wants to stop working at ${a.retireAge}` : ''}${a.freedomIncome ? `; freedom income ${m(a.freedomIncome)} a month` : ''}.` : '',
    a.taxRegime || a.section80C !== undefined ? `Tax: regime ${a.taxRegime ?? 'unknown'}, 80C ${m(a.section80C) ?? 'unknown'}, has CA ${a.hasAdviser ?? 'unknown'}, open tax notice ${a.taxNotice ?? 'unknown'}.` : '',
    `Mindset: ${record.result.riskLabel}; ${record.result.habitLabel}${a.decisionStyle ? `; decides by ${a.decisionStyle}` : ''}${a.lostMoney ? `; lost money before: ${a.lostMoney}` : ''}${a.knowledgeGaps?.length ? `; wants to learn ${a.knowledgeGaps.join(', ')}` : ''}.`,
  ];
  return lines.filter(Boolean).join('\n');
}
