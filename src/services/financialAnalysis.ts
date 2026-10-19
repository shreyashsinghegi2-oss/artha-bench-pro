/**
 * The analyst's view of one person, from their answers and the calculated dashboard: what is strong, what is
 * weak (ranked), the limits of this analysis, the sources behind the numbers, and the terms used. Shared by
 * the dashboard and the PDF report so both say the same thing. Plain rules on calculated numbers, no model.
 */
import type { CompleteDashboard } from './completeDashboard';
import type { MoneyProfile } from './moneyProfile';
import { MONEY_CHECK_ASSUMPTIONS } from './moneyCheck';
import { totalSpend, type OnboardingAnswers } from './onboarding';

export interface Finding { title: string; detail: string; severity?: 'high' | 'medium' | 'low' }
export interface Slice { label: string; value: number }

export interface FinancialAnalysis {
  strengths: Finding[];
  weaknesses: Finding[];
  /** Where each rupee of monthly income goes (before tax). */
  monthlyFlow: Slice[];
  /** What the person owns. */
  assets: Slice[];
  /** What the person owes. */
  liabilities: Slice[];
  /** Cover held vs cover needed. */
  protection: Array<{ label: string; have: number; need: number }>;
  /** Investments projected to retirement vs the money needed. */
  retirementPath: Array<{ age: number; projected: number; needed: number }>;
  limitations: string[];
  sources: Array<{ name: string; use: string }>;
  glossary: Array<{ term: string; meaning: string }>;
  verdict: string;
}

const inr = (v: number) => `₹${Math.round(Math.abs(v)).toLocaleString('en-IN')}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function analyseFinances(profile: MoneyProfile, d: CompleteDashboard, a: OnboardingAnswers = {}): FinancialAnalysis {
  const r = d.report;
  const takeHome = d.monthlyTakeHome.value;
  const grossMonthly = d.annualIncome.value / 12;
  const spend = d.monthlyExpenses.value;
  const emi = d.monthlyEmi.value;
  const surplus = d.monthlySurplus.value;
  const savingsRate = r.cashflow.savingsRate;
  const emiShare = takeHome > 0 ? emi / takeHome : emi > 0 ? 1 : 0;
  const months = r.emergency.months;
  const strengths: Finding[] = [];
  const weaknesses: Finding[] = [];

  // Cash flow
  if (surplus < 0) weaknesses.push({ severity: 'high', title: 'Spending more than you earn', detail: `${inr(-surplus)} a month more goes out than comes in after tax. This uses up savings or adds debt every month.` });
  else if (savingsRate >= 0.2) strengths.push({ title: 'Strong saving habit', detail: `You keep ${pct(savingsRate)} of take-home pay (${inr(surplus)} a month). 20% or more is the healthy mark.` });
  else if (takeHome > 0) weaknesses.push({ severity: 'medium', title: 'Saving less than 20%', detail: `You save ${pct(Math.max(0, savingsRate))} of take-home pay. Raising it to 20% means ${inr(Math.max(0, takeHome * 0.2 - surplus))} more a month.` });

  // Safety fund
  if (Number.isFinite(months) && months >= 6) strengths.push({ title: 'Emergency fund in place', detail: `Your bank savings cover ${months.toFixed(1)} months of costs (target 6).` });
  else if (Number.isFinite(months)) weaknesses.push({ severity: months < 3 ? 'high' : 'medium', title: 'Emergency fund is short', detail: `Savings cover ${months.toFixed(1)} months of costs. Six months is ${inr(r.emergency.target)}; the gap is ${inr(r.emergency.gap)}.` });

  // Debt
  if (emi === 0 && d.totalDebt.value === 0) strengths.push({ title: 'Debt-free', detail: 'No loans and no EMIs: every rupee you earn is yours to plan.' });
  else if (emiShare <= 0.3) strengths.push({ title: 'Loans under control', detail: `EMIs take ${pct(emiShare)} of take-home pay (comfortable is under 30–40%).` });
  else weaknesses.push({ severity: emiShare > 0.5 ? 'high' : 'medium', title: 'High EMI load', detail: `EMIs take ${pct(emiShare)} of take-home pay. Above 40% leaves little room for saving or surprises.` });
  if ((a.creditCardDue ?? 0) > 0) weaknesses.push({ severity: 'high', title: 'Unpaid credit card balance', detail: `${inr(a.creditCardDue!)} is being charged about 36–42% interest a year. Clear it before investing.` });
  if ((a.highestRate ?? 0) >= 14) weaknesses.push({ severity: 'medium', title: 'Costly loan', detail: `Your costliest loan charges ${a.highestRate}% a year. Paying it early is a guaranteed ${a.highestRate}% return.` });

  // Protection
  if (r.protection.healthGap <= 0) strengths.push({ title: 'Health cover is enough', detail: `Your health insurance meets the suggested ${inr(r.protection.healthCoverSuggested)} for your family size.` });
  else weaknesses.push({ severity: (profile.healthCover ?? 0) === 0 ? 'high' : 'medium', title: (profile.healthCover ?? 0) === 0 ? 'No health insurance' : 'Health cover too low', detail: `Suggested cover is ${inr(r.protection.healthCoverSuggested)}; you are ${inr(r.protection.healthGap)} short.` });
  if (profile.dependants > 0) {
    if (r.protection.termGap <= 0) strengths.push({ title: 'Family protected', detail: 'Your life cover is enough for the people who depend on you.' });
    else weaknesses.push({ severity: 'high', title: 'Family not fully protected', detail: `${profile.dependants} ${profile.dependants === 1 ? 'person depends' : 'people depend'} on you. Life cover needed ${inr(r.protection.termCoverNeeded)}; gap ${inr(r.protection.termGap)}.` });
  }

  // Wealth and retirement
  if (d.netWorth.value > 0) strengths.push({ title: 'Positive net worth', detail: `You own ${inr(d.netWorth.value)} more than you owe (cash and investments minus loans).` });
  else if (d.netWorth.value < 0) weaknesses.push({ severity: 'medium', title: 'You owe more than you own', detail: `Net worth is -${inr(d.netWorth.value)}. Focus on paying down loans and building savings.` });
  if (d.freedomProgress >= 0.5) strengths.push({ title: 'Retirement well under way', detail: `Current investments already reach ${pct(d.freedomProgress)} of your retirement need.` });
  else if (r.freedom.yearsToRetire > 0) weaknesses.push({ severity: d.freedomProgress < 0.15 ? 'medium' : 'low', title: 'Retirement savings behind', detail: `You are at ${pct(d.freedomProgress)} of the ${inr(r.freedom.corpusNeeded)} needed. Investing ${inr(r.freedom.monthlySipNeeded)} a month closes the gap.` });

  // Tax and paperwork
  if (a.taxRegime && a.taxRegime !== 'unsure' && r.tax.better !== 'same' && a.taxRegime !== r.tax.better && r.tax.saving > 0) weaknesses.push({ severity: 'medium', title: 'Paying more tax than needed', detail: `The ${r.tax.better} regime would save ${inr(r.tax.saving)} this year.` });
  else if (r.tax.better !== 'same' && a.taxRegime === r.tax.better) strengths.push({ title: 'Right tax regime', detail: `You already use the ${r.tax.better} regime, which costs less on your numbers.` });
  if (a.nominees === 'all') strengths.push({ title: 'Nominees added', detail: 'Every account has a nominee, so your family can claim easily.' });
  else if (a.nominees) weaknesses.push({ severity: 'low', title: 'Nominees missing', detail: 'Add a nominee to every bank account, investment and insurance policy.' });
  if (a.will === 'no' && profile.dependants > 0) weaknesses.push({ severity: 'low', title: 'No will', detail: 'A simple will avoids long legal trouble for your family.' });
  if ((a.incomeSources?.length ?? 0) >= 2) strengths.push({ title: 'More than one income', detail: `Money comes from ${a.incomeSources!.join(', ')}, which is safer than one source.` });
  if (a.steadiness === 'irregular') weaknesses.push({ severity: 'medium', title: 'Income changes a lot', detail: 'Keep a bigger safety fund (9–12 months) and budget on your worst month, not your best.' });

  const order = { high: 0, medium: 1, low: 2 } as const;
  weaknesses.sort((x, y) => order[x.severity ?? 'low'] - order[y.severity ?? 'low']);

  const spendSplit = totalSpend(a);
  const fixed = a.fixedExpenses !== undefined && spendSplit ? (a.fixedExpenses / spendSplit) * spend : spend;
  const variable = a.fixedExpenses !== undefined && spendSplit ? spend - fixed : 0;
  const taxMonthly = Math.max(0, grossMonthly - takeHome);
  const monthlyFlow: Slice[] = [
    { label: 'Fixed costs', value: fixed },
    { label: 'Day-to-day spending', value: variable },
    { label: 'Loan EMIs', value: emi },
    { label: 'Income tax', value: taxMonthly },
    { label: 'Left to save', value: Math.max(0, surplus) },
  ].filter((s) => s.value > 0.5);
  const gold = Math.min(a.gold ?? 0, d.totalInvestments.value);
  const assets: Slice[] = [
    { label: 'Cash & bank', value: d.totalSavings.value },
    { label: 'Investments', value: d.totalInvestments.value - gold },
    { label: 'Gold', value: gold },
    { label: 'Property', value: a.propertyValue ?? 0 },
    { label: 'Business', value: a.businessValue ?? 0 },
  ].filter((s) => s.value > 0.5);
  const card = Math.min(a.creditCardDue ?? 0, d.totalDebt.value);
  const liabilities: Slice[] = d.loans.length
    ? d.loans.map((l) => ({ label: l.name, value: l.outstanding })).filter((s) => s.value > 0)
    : [{ label: a.loanTypes?.length ? a.loanTypes.join(', ') : 'Loans', value: d.totalDebt.value - card }, { label: 'Credit card', value: card }].filter((s) => s.value > 0.5);
  const protection = [
    { label: 'Emergency fund', have: d.totalSavings.value, need: r.emergency.target },
    { label: 'Health cover', have: profile.healthCover ?? 0, need: r.protection.healthCoverSuggested },
    ...(profile.dependants > 0 || r.protection.termCoverNeeded > 0 ? [{ label: 'Life cover', have: profile.termCover ?? 0, need: r.protection.termCoverNeeded }] : []),
  ];

  // Investments growing at the assumed return with today's monthly surplus invested, vs the money needed.
  const A = MONEY_CHECK_ASSUMPTIONS;
  const retireAge = Math.max(profile.retireAge ?? 60, profile.age);
  const retirementPath: FinancialAnalysis['retirementPath'] = [];
  const m = (1 + A.preRetirementReturn) ** (1 / 12) - 1;
  let pot = d.totalInvestments.value;
  for (let age = profile.age; age <= retireAge; age += 1) {
    if (age === profile.age || (age - profile.age) % Math.max(1, Math.round((retireAge - profile.age) / 8)) === 0 || age === retireAge) {
      retirementPath.push({ age, projected: Math.round(pot), needed: r.freedom.corpusNeeded });
    }
    for (let k = 0; k < 12; k++) pot = (pot + Math.max(0, surplus)) * (1 + m);
  }

  const limitations = [
    'Built from the numbers you entered. Rounded or guessed answers make the results rough; update them any time with "Edit my answers".',
    `Tax is estimated for Indian salaried income under this year's slabs (FY 2025-26 rules), with the deductions you entered. Business income, capital gains and surcharge rules are not fully modelled.`,
    `Projections assume prices rise ${Math.round(A.inflation * 100)}% a year, investments grow ${Math.round(A.preRetirementReturn * 100)}% a year before retirement and ${Math.round(A.postRetirementReturn * 100)}% after, and life to age ${A.lifeExpectancy}. Real returns go up and down and are not guaranteed.`,
    'Net worth counts cash and investments minus loans. Property and business stakes are listed but not added, because they are slow to sell.',
    'Market prices are delayed quotes. News and web sources used by the advisor are as of the day the report was made.',
    'The written advisor analysis is produced by computer language models from your calculated numbers and live sources. It is education, not personal advice; confirm big decisions with a SEBI-registered adviser or a CA.',
  ];
  const sources = [
    { name: 'Income Tax Department of India (Finance Act slabs, 87A rebate, standard deduction, 80C/80D limits)', use: 'Old vs new regime tax' },
    { name: 'Standard time-value-of-money formulas (future value, SIP, growing annuity)', use: 'Goals, retirement and SIP amounts' },
    { name: 'ArthaMind health score (savings rate, EMI load, emergency runway)', use: 'Health score and status' },
    { name: 'AMFI mutual fund NAVs (via mfapi.in)', use: 'Fund values in your portfolio' },
    { name: 'Exchange quotes (NSE/BSE indices, USD/INR, gold) from market data providers', use: 'Markets on the report date' },
    { name: 'Business news feeds and web sources fetched on the report date', use: 'Context for the advisor analysis' },
    { name: 'Your answers to the ArthaMind setup questions and your workspace records', use: 'Every personal figure' },
  ];
  const glossary = [
    { term: 'Take-home pay', meaning: 'Income left after income tax.' },
    { term: 'Savings rate', meaning: 'Share of take-home pay you keep each month. 20% or more is healthy.' },
    { term: 'EMI', meaning: 'Equated monthly instalment: the fixed amount paid to a lender every month.' },
    { term: 'EMI load', meaning: 'EMIs as a share of take-home pay. Under 30–40% is comfortable.' },
    { term: 'Emergency fund', meaning: 'Money kept in the bank or FDs for surprises; 6 months of costs is the usual target.' },
    { term: 'Net worth', meaning: 'What you own (cash and investments) minus what you owe (loans).' },
    { term: 'Term insurance', meaning: 'Pure life cover that pays your family if you die during the term; no maturity value.' },
    { term: 'Health cover', meaning: 'Insurance that pays hospital bills for you and your family.' },
    { term: 'SIP', meaning: 'Systematic investment plan: investing a fixed amount every month.' },
    { term: 'Freedom number', meaning: 'Money you need at retirement for investments to pay your costs for life.' },
    { term: 'Old / new tax regime', meaning: 'Two ways to work out income tax in India; the old one allows more deductions, the new one has lower rates.' },
    { term: 'Inflation', meaning: 'Prices rising over time, so the same money buys less later.' },
  ];

  const highs = weaknesses.filter((w) => w.severity === 'high').length;
  const verdict = highs
    ? `${highs} urgent ${highs === 1 ? 'issue needs' : 'issues need'} attention first: ${weaknesses.filter((w) => w.severity === 'high').map((w) => w.title.toLowerCase()).join(', ')}. ${strengths.length ? `Strengths to build on: ${strengths.slice(0, 2).map((s) => s.title.toLowerCase()).join(' and ')}.` : ''}`
    : weaknesses.length
      ? `A sound base with ${weaknesses.length} ${weaknesses.length === 1 ? 'area' : 'areas'} to improve, starting with ${weaknesses[0].title.toLowerCase()}.`
      : 'Your finances are in good shape. Keep saving every month and review once a year.';

  return { strengths, weaknesses, monthlyFlow, assets, liabilities, protection, retirementPath, limitations, sources, glossary, verdict };
}
