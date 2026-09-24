/**
 * Money Planner: "I have ₹X — what should I do with it?"
 *
 * A deterministic, rules-first allocation that follows the order most financial planners use:
 *   1. top up the emergency fund,
 *   2. clear expensive debt (a guaranteed, tax-free return equal to its interest rate),
 *   3. use tax-saving room that actually saves tax for this person,
 *   4. invest the rest by time horizon and risk comfort.
 * Every rupee is assigned exactly once and every step says why. Returns are stated assumptions,
 * not predictions; this is education, not personalised investment advice.
 */

export type RiskComfort = 'low' | 'medium' | 'high';

export interface PlannerInputs {
  /** Lump sum available now, in ₹. */
  amount: number;
  /** Years until this money may be needed. */
  horizonYears: number;
  risk: RiskComfort;
  monthlyExpenses?: number;
  monthlyEmi?: number;
  liquidSavings?: number;
  /** Annual interest rate (%) of the costliest loan, e.g. 36 for a credit card, 14 for a personal loan. */
  costliestLoanRate?: number;
  costliestLoanOutstanding?: number;
  /** Which regime the person is better off in; tax-saving products only help under the old regime. */
  taxRegime?: 'old' | 'new' | 'same';
  section80CUsed?: number;
  npsExtraUsed?: number;
  /** Remaining term-cover gap, in ₹ (insurance is bought with premiums, so it is flagged, not funded). */
  termGap?: number;
}

export type BucketKey = 'emergency' | 'debt-prepay' | 'tax-80c' | 'tax-nps' | 'equity' | 'debt' | 'gold' | 'liquid';

export interface PlannerBucket {
  key: BucketKey;
  label: string;
  amount: number;
  share: number;
  instrument: string;
  why: string;
  /** Assumed annual return (%) used for the projection; for loan prepayment, the interest rate avoided. */
  assumedReturn: number;
  lockIn?: string;
}

export interface PlannerResult {
  buckets: PlannerBucket[];
  allocated: number;
  projectedValue: number;
  /** Yearly interest avoided by prepaying debt. */
  interestSavedPerYear: number;
  taxSaved: number;
  mix: { equity: number; debt: number; gold: number };
  notes: string[];
}

export const PLANNER_ASSUMPTIONS = {
  emergencyMonths: 6,
  prepayAboveRate: 9,
  returns: { liquid: 6.5, debt: 7, equity: 11, gold: 8, ppf: 7.1, elss: 11, nps: 9.5 },
  limits: { section80C: 150_000, nps80CCD1B: 50_000 },
  /** Marginal tax rate assumed for old-regime savings (30% slab + 4% cess). */
  marginalTaxRate: 0.312,
} as const;

/** Equity / debt / gold split of the investable remainder by horizon and risk comfort. */
export function targetMix(horizonYears: number, risk: RiskComfort): { equity: number; debt: number; gold: number } {
  if (horizonYears < 1) return { equity: 0, debt: 100, gold: 0 };
  if (horizonYears < 3) return risk === 'high' ? { equity: 20, debt: 70, gold: 10 } : risk === 'medium' ? { equity: 10, debt: 80, gold: 10 } : { equity: 0, debt: 90, gold: 10 };
  if (horizonYears <= 5) return risk === 'high' ? { equity: 55, debt: 35, gold: 10 } : risk === 'medium' ? { equity: 40, debt: 50, gold: 10 } : { equity: 20, debt: 70, gold: 10 };
  return risk === 'high' ? { equity: 75, debt: 15, gold: 10 } : risk === 'medium' ? { equity: 60, debt: 30, gold: 10 } : { equity: 35, debt: 55, gold: 10 };
}

const r0 = (v: number) => Math.round(v);
const pos = (v: number | undefined) => (Number.isFinite(v) && (v as number) > 0 ? (v as number) : 0);
const fv = (amount: number, ratePct: number, years: number) => amount * (1 + ratePct / 100) ** years;

export function planLumpSum(input: PlannerInputs): PlannerResult {
  const A = PLANNER_ASSUMPTIONS;
  const amount = r0(pos(input.amount));
  const years = Math.max(0, Number.isFinite(input.horizonYears) ? input.horizonYears : 0);
  let left = amount;
  const buckets: PlannerBucket[] = [];
  const notes: string[] = [];
  const take = (want: number) => { const v = r0(Math.min(left, Math.max(0, want))); left -= v; return v; };

  // 1. Emergency fund: six months of expenses and EMIs in something you can withdraw the same day.
  const monthlyNeed = pos(input.monthlyExpenses) + pos(input.monthlyEmi);
  if (monthlyNeed > 0) {
    const target = monthlyNeed * A.emergencyMonths;
    const gap = Math.max(0, target - pos(input.liquidSavings));
    const v = take(gap);
    if (v > 0) buckets.push({ key: 'emergency', label: 'Emergency fund top-up', amount: v, share: 0, instrument: 'Liquid fund or sweep-in FD', why: `Brings your safety buffer towards ${A.emergencyMonths} months of expenses and EMIs (₹${r0(target).toLocaleString('en-IN')}).`, assumedReturn: A.returns.liquid });
  }

  // 2. Expensive debt: prepaying earns the loan's interest rate, guaranteed and tax-free.
  const rate = pos(input.costliestLoanRate);
  if (rate >= A.prepayAboveRate && pos(input.costliestLoanOutstanding) > 0) {
    const v = take(pos(input.costliestLoanOutstanding));
    if (v > 0) buckets.push({ key: 'debt-prepay', label: 'Prepay costly loan', amount: v, share: 0, instrument: `Loan at ${rate}% a year`, why: `No safe investment reliably beats a ${rate}% loan; prepaying saves that interest with no risk.`, assumedReturn: rate });
  }

  // 3. Tax-saving room, only when the old regime is the better one for this person.
  let taxSaved = 0;
  if (input.taxRegime === 'old') {
    const room80C = Math.max(0, A.limits.section80C - pos(input.section80CUsed));
    const useElss = years >= 3 && input.risk !== 'low';
    const v = take(room80C);
    if (v > 0) {
      taxSaved += v * A.marginalTaxRate;
      buckets.push(useElss
        ? { key: 'tax-80c', label: 'Section 80C (ELSS)', amount: v, share: 0, instrument: 'ELSS tax-saving fund', why: 'Uses unclaimed 80C room: saves tax now and invests in equity.', assumedReturn: A.returns.elss, lockIn: '3 years' }
        : { key: 'tax-80c', label: 'Section 80C (PPF)', amount: v, share: 0, instrument: 'Public Provident Fund', why: 'Uses unclaimed 80C room with a government-backed, tax-free return.', assumedReturn: A.returns.ppf, lockIn: '15 years (partial withdrawal from year 7)' });
    }
    if (years >= 10) {
      const nps = take(Math.max(0, A.limits.nps80CCD1B - pos(input.npsExtraUsed)));
      if (nps > 0) {
        taxSaved += nps * A.marginalTaxRate;
        buckets.push({ key: 'tax-nps', label: 'NPS (80CCD(1B))', amount: nps, share: 0, instrument: 'National Pension System, Tier I', why: 'Extra ₹50,000 deduction beyond 80C, for retirement money.', assumedReturn: A.returns.nps, lockIn: 'Until age 60' });
      }
    }
  } else if (input.taxRegime === 'new') {
    notes.push('You are better off in the new regime, so tax-saving products (80C, NPS 80CCD(1B)) would not reduce your tax.');
  }

  // 4. Invest the remainder by horizon and risk comfort.
  const mix = targetMix(years, input.risk);
  const rest = left;
  if (rest > 0) {
    if (years < 1) {
      buckets.push({ key: 'liquid', label: 'Park safely', amount: take(rest), share: 0, instrument: 'Liquid fund, FD or arbitrage fund', why: 'Needed within a year, so capital safety matters more than return.', assumedReturn: A.returns.liquid });
    } else {
      const eq = r0((rest * mix.equity) / 100), gd = r0((rest * mix.gold) / 100);
      const db = rest - eq - gd; // remainder keeps the total exact
      if (eq > 0) buckets.push({ key: 'equity', label: 'Equity', amount: take(eq), share: 0, instrument: 'Nifty 50 index fund or flexi-cap fund', why: `Growth for a ${years}-year horizon; expect ups and downs along the way.`, assumedReturn: A.returns.equity });
      if (db > 0) buckets.push({ key: 'debt', label: 'Debt', amount: take(db), share: 0, instrument: years < 3 ? 'FD or short-duration debt fund' : 'Short-duration debt fund, FD or RBI bonds', why: 'Stability and predictable returns; cushions equity swings.', assumedReturn: A.returns.debt });
      if (gd > 0) buckets.push({ key: 'gold', label: 'Gold', amount: take(gd), share: 0, instrument: 'Gold ETF or gold fund', why: 'A small hedge that often holds up when equities fall.', assumedReturn: A.returns.gold });
    }
  }

  if (pos(input.termGap) > 0) notes.push(`Your family needs about ₹${r0(pos(input.termGap)).toLocaleString('en-IN')} more term cover. Buy it with an annual premium before investing for growth.`);
  if (amount === 0) notes.push('Enter an amount to see a plan.');

  const allocated = buckets.reduce((s, b) => s + b.amount, 0);
  for (const b of buckets) b.share = allocated ? Math.round((b.amount / allocated) * 1000) / 10 : 0;
  const interestSavedPerYear = r0(buckets.filter((b) => b.key === 'debt-prepay').reduce((s, b) => s + (b.amount * b.assumedReturn) / 100, 0));
  const projectedValue = r0(buckets.reduce((s, b) => s + (b.key === 'debt-prepay' ? b.amount : fv(b.amount, b.assumedReturn, years)), 0));

  return { buckets, allocated, projectedValue, interestSavedPerYear, taxSaved: r0(taxSaved), mix, notes };
}
