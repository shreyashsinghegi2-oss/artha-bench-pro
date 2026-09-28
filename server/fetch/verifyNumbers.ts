/**
 * Numbers the app can compute itself are computed before the model runs, then enforced after it answers.
 *
 * - Intents: EMI, SIP, CAGR and income tax, with inputs read from the user's own words ("₹50 lakh",
 *   "8.5%", "20 years"). Nothing is assumed: an intent without all of its inputs is skipped.
 * - Computed by the precision engine when PRECISION_ENGINE_URL is set (certified), otherwise by the app's
 *   TypeScript calculators (not certified). SIP always uses the app's calculator, because the app's SIP
 *   convention (effective monthly rate) differs from the engine's (annual % / 12).
 * - Only engine results with certification.verification.all_agree === true get a badge.
 * - After generation: if the answer shows a different figure close to a verified one, it is replaced;
 *   if the verified figure is missing entirely, it is stated at the top of the answer.
 */
import Decimal from 'decimal.js';
import type { StructuredFinancialAnswer } from '../../src/types';
import { cagr as tsCagr, emi as tsEmi, sipFutureValue } from '../../src/services/calculators';
import { compareTaxRegimes } from '../../src/services/indiaTaxEngine';
import { createDefaultTaxProfile } from '../../src/services/taxWorkspaceStorage';
import { readAmount } from '../offlineSnapshot';
import { precisionEngineUrl } from '../precisionRoutes';

export interface VerifiedNumber {
  id: 'emi' | 'sip' | 'cagr' | 'tax-new' | 'tax-old';
  label: string;
  display: string;
  /** Full-precision value as a decimal string. */
  value: string;
  certified: boolean;
  method: 'precision-engine' | 'app-calculator';
  badge?: string;
  assumptions: string[];
}

export interface CalcIntent {
  kind: 'emi' | 'sip' | 'cagr' | 'tax';
  amount?: string;
  endAmount?: string;
  ratePct?: string;
  months?: number;
  years?: string;
  regime?: 'new' | 'old' | 'both';
  salaried?: boolean;
}

// ---- parsing ---------------------------------------------------------------------------------------
const AMOUNT_RE = String.raw`(?:₹|rs\.?|inr)?\s?(\d[\d,]*(?:\.\d+)?)\s?(k|l|lakhs?|lacs?|lac|cr|crores?)?\b`;
const amountsIn = (text: string) =>
  [...text.matchAll(new RegExp(AMOUNT_RE, 'gi'))]
    .map((m) => ({ raw: m[0], value: readAmount(`${m[1]}${m[2] ?? ''}`), index: m.index ?? 0, hasUnit: Boolean(m[2]) || /₹|rs|inr/i.test(m[0]) }))
    .filter((a) => a.value !== null && a.value > 0) as Array<{ raw: string; value: number; index: number; hasUnit: boolean }>;

const rateIn = (text: string) => text.match(/(\d{1,2}(?:\.\d{1,4})?)\s?%/)?.[1];
function tenureIn(text: string): { months: number; years: string } | null {
  const y = text.match(/(\d{1,2}(?:\.\d+)?)\s?(?:years?|yrs?|y\b)/i);
  const m = text.match(/(\d{1,3})\s?(?:months?|mos?)\b/i);
  if (m) return { months: Number(m[1]), years: new Decimal(m[1]).div(12).toString() };
  if (y) return { months: Math.round(Number(y[1]) * 12), years: y[1] };
  return null;
}
/** Money amounts that are not the rate or the tenure. */
const moneyIn = (text: string) =>
  amountsIn(text).filter((a) => {
    const after = text.slice(a.index + a.raw.length, a.index + a.raw.length + 8);
    return !/^\s?(%|years?|yrs?|months?|mos?|y\b)/i.test(after) && (a.hasUnit || a.value >= 1000);
  });
const asDecimalString = (v: number) => new Decimal(v).toFixed();

export function parseIntents(question: string): CalcIntent[] {
  const q = question.replace(/\s+/g, ' ');
  const out: CalcIntent[] = [];
  const rate = rateIn(q);
  const tenure = tenureIn(q);
  const money = moneyIn(q);

  if (/\bemi\b|\bloan\b/i.test(q) && money[0] && rate && tenure)
    out.push({ kind: 'emi', amount: asDecimalString(money[0].value), ratePct: rate, months: tenure.months });
  if (/\bsip\b/i.test(q) && money[0] && rate && tenure)
    out.push({ kind: 'sip', amount: asDecimalString(money[0].value), ratePct: rate, months: tenure.months });
  const cg = q.match(new RegExp(`\\bfrom\\s+${AMOUNT_RE}\\s+to\\s+${AMOUNT_RE}`, 'i'));
  if (/\bcagr\b|\bgrew\b|\bgrown\b|\bgrowth rate\b/i.test(q) && cg && tenure) {
    const a = readAmount(`${cg[1]}${cg[2] ?? ''}`);
    const b = readAmount(`${cg[3]}${cg[4] ?? ''}`);
    if (a && b) out.push({ kind: 'cagr', amount: asDecimalString(a), endAmount: asDecimalString(b), years: tenure.years });
  }
  if (/\b(income )?tax\b/i.test(q) && !/\bgst\b|\btds\b|\bcapital gains?\b/i.test(q) && money[0] && /\b(salary|income|ctc|earn|package|lpa)\b/i.test(q)) {
    const saysOld = /\bold\b/i.test(q) && /\bregime\b/i.test(q);
    const saysNew = /\bnew\b/i.test(q) && /\bregime\b/i.test(q);
    const regime = saysOld && !saysNew ? 'old' : saysNew && !saysOld ? 'new' : 'both';
    out.push({ kind: 'tax', amount: asDecimalString(money[0].value), regime, salaried: /\b(salary|salaried|ctc|package|lpa|job)\b/i.test(q) });
  }
  return out;
}

// ---- formatting ------------------------------------------------------------------------------------
export const inrDisplay = (v: string | number) =>
  `₹${new Decimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const inrWhole = (v: string | number) => `₹${new Decimal(v).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber().toLocaleString('en-IN')}`;
const pctDisplay = (fraction: string | number) => `${new Decimal(fraction).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)}%`;

// ---- computing -------------------------------------------------------------------------------------
type EngineCert = {
  output: { value: string; display: string };
  certification: { verification: { all_agree?: boolean }; certified_relative_error: string | null; interval_width: string };
};

async function engine(kind: string, body: unknown, fetchImpl: typeof fetch): Promise<EngineCert | null> {
  const base = precisionEngineUrl();
  if (!base) return null;
  try {
    const res = await fetchImpl(`${base}/api/${kind}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2_500),
    });
    if (!res.ok) return null;
    const cert = (await res.json()) as EngineCert;
    return cert?.certification?.verification?.all_agree === true ? cert : null;
  } catch {
    return null;
  }
}
const badgeFor = (c: EngineCert) => `Verified to 0.000001% (certified relative error ${c.certification.certified_relative_error ?? '0'})`;

export async function computeVerified(intents: CalcIntent[], fetchImpl: typeof fetch = fetch): Promise<VerifiedNumber[]> {
  const out: VerifiedNumber[] = [];
  for (const it of intents) {
    if (it.kind === 'emi' && it.amount && it.ratePct && it.months) {
      const label = `EMI for ${inrWhole(it.amount)} at ${it.ratePct}% a year for ${it.months} months`;
      const c = await engine('emi', { principal: it.amount, annual_rate_pct: it.ratePct, months: it.months }, fetchImpl);
      const value = c ? c.output.value : String(tsEmi(Number(it.amount), Number(it.ratePct) / 100, it.months));
      out.push({
        id: 'emi',
        label,
        display: inrDisplay(value),
        value,
        certified: Boolean(c),
        method: c ? 'precision-engine' : 'app-calculator',
        badge: c ? badgeFor(c) : undefined,
        assumptions: ['Rate compounded monthly (annual % ÷ 12).'],
      });
    } else if (it.kind === 'sip' && it.amount && it.ratePct && it.months) {
      const v = sipFutureValue(Number(it.amount), Number(it.ratePct) / 100, it.months);
      out.push({
        id: 'sip',
        label: `Value of a ${inrWhole(it.amount)} monthly SIP for ${it.months} months at ${it.ratePct}% a year`,
        display: inrDisplay(v),
        value: String(v),
        certified: false,
        method: 'app-calculator',
        assumptions: [
          'Constant annual return, compounded monthly at the equivalent monthly rate; payments at the start of each month.',
          'Market returns are not fixed; this is arithmetic for an assumed rate.',
        ],
      });
    } else if (it.kind === 'cagr' && it.amount && it.endAmount && it.years) {
      const c = await engine('cagr', { begin_value: it.amount, end_value: it.endAmount, years: it.years }, fetchImpl);
      const value = c ? c.output.value : String(tsCagr(Number(it.amount), Number(it.endAmount), Number(it.years)));
      out.push({
        id: 'cagr',
        label: `CAGR from ${inrWhole(it.amount)} to ${inrWhole(it.endAmount)} over ${it.years} years`,
        display: pctDisplay(value),
        value,
        certified: Boolean(c),
        method: c ? 'precision-engine' : 'app-calculator',
        badge: c ? badgeFor(c) : undefined,
        assumptions: [],
      });
    } else if (it.kind === 'tax' && it.amount) {
      const regimes: Array<'new' | 'old'> = it.regime === 'both' ? ['new', 'old'] : [it.regime ?? 'new'];
      const assumptions = [
        it.salaried ? 'Salaried: standard deduction applied.' : 'Treated as non-salary income (no standard deduction).',
        'No other deductions; resident individual below 60; FY 2026-27 rules.',
      ];
      for (const regime of regimes) {
        const c = await engine('tax', { gross_income: it.amount, regime, salaried: Boolean(it.salaried) }, fetchImpl);
        let value = c?.output.value;
        if (!value) {
          const profile = { ...createDefaultTaxProfile(), financialYear: 'FY2026-27' as const };
          const src = {
            id: 's',
            type: (it.salaried ? 'Salary' : 'Freelance') as never,
            amount: Number(it.amount),
            currency: 'INR',
            frequency: 'Annually' as const,
            description: 'Income',
            taxStatus: 'Pre-tax' as const,
            startDate: '2026-04-01',
            tags: [],
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          };
          value = compareTaxRegimes([src], profile, [], [])[regime].totalTaxLiability;
        }
        out.push({
          id: regime === 'new' ? 'tax-new' : 'tax-old',
          label: `Income tax on ${inrWhole(it.amount)} (${regime} regime, incl. 4% cess)`,
          display: inrDisplay(value),
          value,
          certified: Boolean(c),
          method: c ? 'precision-engine' : 'app-calculator',
          badge: c ? badgeFor(c) : undefined,
          assumptions,
        });
      }
    }
  }
  return out;
}

export function verifiedBlock(nums: VerifiedNumber[]): string {
  if (!nums.length) return '';
  return [
    "VERIFIED NUMBERS (computed by the app from the user's own inputs; copy these exact figures, do not recompute them):",
    ...nums.map((v) => `- ${v.label}: ${v.display}${v.assumptions.length ? ` (${v.assumptions.join(' ')})` : ''}`),
  ].join('\n');
}

// ---- enforcing -------------------------------------------------------------------------------------
const RUPEE = /(?:₹|Rs\.?\s?|INR\s?)\s?(\d[\d,]*(?:\.\d+)?)/g;
const PCT = /(\d{1,3}(?:\.\d+)?)\s?%/g;

function replaceNear(text: string, v: VerifiedNumber): { text: string; replaced: number } {
  const target = Number(v.value) * (v.id === 'cagr' ? 100 : 1);
  if (!Number.isFinite(target) || target === 0) return { text, replaced: 0 };
  let replaced = 0;
  const re = v.id === 'cagr' ? PCT : RUPEE;
  const out = text.replace(re, (m, num: string) => {
    const n = Number(num.replace(/,/g, ''));
    const close = Math.abs(n - target) / Math.abs(target) <= 0.1;
    if (close && m.trim() !== v.display) {
      replaced++;
      return v.display;
    }
    return m;
  });
  return { text: out, replaced };
}

/** Makes sure every verified number appears unchanged. Returns the corrected answer and what changed. */
export function enforceVerified(answer: StructuredFinancialAnswer, nums: VerifiedNumber[]): { answer: StructuredFinancialAnswer; corrections: string[] } {
  if (!nums.length) return { answer, corrections: [] };
  const corrections: string[] = [];
  let a: StructuredFinancialAnswer = { ...answer, steps: [...answer.steps], example: { ...answer.example } };
  for (const v of nums) {
    const fields = (fn: (s: string) => string) => {
      a = {
        ...a,
        directAnswer: fn(a.directAnswer),
        steps: a.steps.map((s) => ({ ...s, explanation: fn(s.explanation) })),
        example: { ...a.example, result: fn(a.example.result), calculation: a.example.calculation.map(fn) },
        keyTakeaways: a.keyTakeaways.map(fn),
        interpretation: a.interpretation.map(fn),
      };
    };
    const all = () => [a.directAnswer, a.example.result, ...a.example.calculation, ...a.steps.map((s) => s.explanation), ...a.keyTakeaways].join('\n');
    if (all().includes(v.display)) continue;
    let count = 0;
    fields((s) => {
      const r = replaceNear(s, v);
      count += r.replaced;
      return r.text;
    });
    if (count) corrections.push(`${v.id}: replaced ${count} altered figure(s) with ${v.display}`);
    if (!all().includes(v.display)) {
      a = { ...a, directAnswer: `${v.label}: ${v.display}. ${a.directAnswer}`.slice(0, 2400) };
      corrections.push(`${v.id}: stated the verified figure ${v.display} that the answer left out`);
    }
  }
  return { answer: a, corrections };
}
