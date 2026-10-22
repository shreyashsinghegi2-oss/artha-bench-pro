import type { CompleteDashboard } from './completeDashboard';
import { emi } from './calculators';
import { sipFutureValue } from './moneyCheck';
import { freedomAnswerText, freedomFromDashboard, isFreedomQuestion, verifiedDashboardFromStorage } from './verifiedFreedom';

/** Rupees in Indian grouping, e.g. ₹7,50,000. */
export const formatRupees = (value: number) => `${value < 0 ? '−' : ''}₹${Math.abs(Math.round(value)).toLocaleString('en-IN')}`;

const runwayText = (months: number) => (!Number.isFinite(months) ? 'no outgoings' : months >= 24 ? `${(months / 12).toFixed(1)} years` : `${months.toFixed(1)} months`);

/**
 * A question the dashboard already answers, answered from the same figures the Snapshot shows.
 * Returns null for anything else, so the model handles it.
 */
export function dashboardAnswer(question: string, d: CompleteDashboard): string | null {
  const q = question.toLowerCase();
  const r = d.report;
  if (isFreedomQuestion(q)) return freedomAnswerText(freedomFromDashboard(d));
  if (/money health|health score|financial health|how healthy/.test(q)) return `Your money health score is ${r.health.score}/100 (${r.health.status}). ${r.health.summary}`;
  if (/surplus|left over|leftover|savings rate|save each month|save every month/.test(q)) {
    return `Your monthly surplus is ${formatRupees(d.monthlySurplus.value)}, which is ${Math.round(r.cashflow.savingsRate * 100)}% of take-home. It is income after expenses and EMIs.`;
  }
  if (/income stops|runway|lose (my )?job|if i lose|no income/.test(q)) {
    return `If your income stopped, your savings and investments would cover about ${runwayText(r.runwayMonths)} of spending and EMIs.`;
  }
  if (/net worth/.test(q)) {
    return `Your net worth is ${formatRupees(d.netWorth.value)}: cash and investments minus loans. Property and gold are not counted here, so it can be lower than what you own.`;
  }
  return null;
}

interface Figures { amounts: number[]; rate: number | null; years: number | null }

/** Reads amounts (₹10 lakh, 50k, 1.2 cr), a rate (8.5%) and a period (20 years or 240 months) from a question. */
export function parseFigures(question: string): Figures {
  const out: Figures = { amounts: [], rate: null, years: null };
  for (const m of question.toLowerCase().matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|k|thousand|%|percent|years?|yrs?|months?|mos?)?(?![a-z])/g)) {
    const n = Number(m[1].replace(/,/g, ''));
    const unit = m[2] ?? '';
    if (!Number.isFinite(n)) continue;
    if (unit === '%' || unit === 'percent') out.rate = n;
    else if (/^(years?|yrs?)$/.test(unit)) out.years = n;
    else if (/^(months?|mos?)$/.test(unit)) out.years = n / 12;
    else if (/^(lakhs?|lacs?)$/.test(unit)) out.amounts.push(n * 1e5);
    else if (/^(crores?|cr)$/.test(unit)) out.amounts.push(n * 1e7);
    else if (unit === 'k' || unit === 'thousand') out.amounts.push(n * 1e3);
    else out.amounts.push(n);
  }
  return out;
}

/** EMI, SIP and lump-sum growth with the working in plain words. Null unless every figure is present. */
export function mathAnswer(question: string): string | null {
  const q = question.toLowerCase();
  if (/\b(should|better|versus|vs|compare)\b|\bor\b/.test(q)) return null; // decisions go to the model
  const f = parseFigures(q);
  if (!f.amounts.length || f.rate === null || f.years === null) return null;
  const months = Math.round(f.years * 12);
  if (months <= 0) return null;
  const monthlyRate = f.rate / 12;
  if (/\bemi\b|monthly installment|loan payment/.test(q)) {
    const principal = Math.max(...f.amounts);
    const monthly = emi(principal, f.rate / 100, months);
    const total = monthly * months;
    return `The EMI on ${formatRupees(principal)} at ${f.rate}% a year for ${f.years} years is ${formatRupees(monthly)} a month. Working: monthly rate r = ${f.rate}% ÷ 12 = ${monthlyRate.toFixed(4)}%; months n = ${months}; EMI = P × r × (1 + r)^n ÷ ((1 + r)^n − 1). You pay ${formatRupees(total)} in total, of which interest is ${formatRupees(total - principal)}.`;
  }
  if (/\bsip\b|invest .*a month|monthly invest|every month/.test(q)) {
    const monthly = f.amounts[0];
    const value = sipFutureValue(monthly, f.rate / 100, months);
    const invested = monthly * months;
    return `Investing ${formatRupees(monthly)} a month at ${f.rate}% a year for ${f.years} years grows to about ${formatRupees(value)}. You put in ${formatRupees(invested)}, and the rest is growth. Working: each month's amount earns ((1 + ${f.rate}%)^(1/12) − 1) and the amounts add up over ${months} months.`;
  }
  if (/compound|future value|grow to|worth in|grow into/.test(q)) {
    const principal = f.amounts[0];
    const value = principal * (1 + f.rate / 100) ** f.years;
    return `${formatRupees(principal)} growing at ${f.rate}% a year for ${f.years} years becomes about ${formatRupees(value)}. Working: future value = P × (1 + r)^n = ${formatRupees(principal)} × (1 + ${f.rate / 100})^${f.years} = ${formatRupees(value)}.`;
  }
  return null;
}

/**
 * The answer from the platform's own figures, or null when the model should answer. Works offline: the
 * dashboard reads the saved profile on this device and the maths needs nothing from the network.
 */
export function localAnswer(question: string): string | null {
  const d = verifiedDashboardFromStorage();
  return (d && dashboardAnswer(question, d)) || mathAnswer(question);
}
