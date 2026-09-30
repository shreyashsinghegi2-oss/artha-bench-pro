/**
 * Layer D — deterministic math engine. Every number the advisor shows is computed here, with the formula,
 * the inputs (and where each came from) and the arithmetic steps. The AI (Layer F) only explains these
 * numbers; it never calculates.
 *
 * Inputs come from three places, always labelled:
 *   - "your question": amounts and horizons Layer A read from the user's words
 *   - "your profile":  the saved profile (Layer B)
 *   - "assumption":    planning assumptions listed in ASSUMPTIONS below, shown to the user as assumptions
 *
 * Guardrails flag risky situations (concentration, short horizon in equity, EMI burden, no emergency fund).
 * They never block the answer; they are shown alongside it.
 */
import type { ContextBundle, UserProfile } from './context';
import type { Entity, ParsedAmount, ParsedQuery, TimeHorizon } from './types';
import { indiaEngine } from '../tax-engines/india';

export type InputSource = 'your question' | 'your profile' | 'assumption' | 'live data';

export interface CalcInput {
  name: string;
  value: number;
  unit: '₹' | '%' | 'years' | 'months';
  source: InputSource;
}

export interface Calculation {
  id: string;
  title: string;
  formula: string;
  inputs: CalcInput[];
  steps: string[];
  result: { value: number; unit: '₹' | '%'; label: string };
  /** Extra numbers derived in the steps (e.g. total invested, gain), also traceable. */
  extras: Array<{ label: string; value: number; unit: '₹' | '%' }>;
}

export type GuardrailLevel = 'info' | 'caution' | 'warning';

export interface Guardrail {
  id: string;
  level: GuardrailLevel;
  message: string;
}

export interface MathResult {
  calculations: Calculation[];
  guardrails: Guardrail[];
  assumptions: string[];
}

/** Planning assumptions: shown to the user verbatim whenever used. Rates are annual, in percent. */
export const ASSUMPTIONS = {
  equity_scenarios: [8, 10, 12] as const,
  debt_return: 7,
  fd_rate: 7,
  inflation: 6,
  loan_rate: { HOME_LOAN: 8.5, CAR_LOAN: 9.5, PERSONAL_LOAN: 13, EDUCATION_LOAN: 10 } as Record<string, number>,
  loan_years: { HOME_LOAN: 20, CAR_LOAN: 5, PERSONAL_LOAN: 5, EDUCATION_LOAN: 7 } as Record<string, number>,
  default_years: 10,
  emergency_months: 6,
} as const;

export const MAX_AMOUNT = 1e11;

// ---------------------------------------------------------------------------------------------------------
// Formatting (Indian digit grouping) — the same strings the explainer must reproduce.

export function inr(value: number, decimals = 0): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function pctStr(value: number, decimals = 2): string {
  return `${Number(value.toFixed(decimals))}%`;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function horizonYears(h: TimeHorizon | null): number | null {
  if (!h) return null;
  const n = Number(h.slice(0, -1));
  return h.endsWith('m') ? n / 12 : n;
}

// ---------------------------------------------------------------------------------------------------------
// Pure formulas

export function sipFutureValue(monthly: number, annualPct: number, years: number): number {
  const r = annualPct / 100 / 12;
  const n = Math.round(years * 12);
  if (r === 0) return monthly * n;
  return monthly * (((1 + r) ** n - 1) / r) * (1 + r);
}

export function lumpSumFutureValue(principal: number, annualPct: number, years: number): number {
  return principal * (1 + annualPct / 100) ** years;
}

export function emi(principal: number, annualPct: number, years: number): number {
  const r = annualPct / 100 / 12;
  const n = Math.round(years * 12);
  if (r === 0) return principal / n;
  return (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
}

export function fdMaturity(principal: number, annualPct: number, years: number): number {
  return principal * (1 + annualPct / 100 / 4) ** (4 * years);
}

export function inflate(amount: number, inflationPct: number, years: number): number {
  return amount * (1 + inflationPct / 100) ** years;
}

// ---------------------------------------------------------------------------------------------------------
// Calculation builders (each returns a fully traced Calculation)

function yearsInput(years: number, fromQuestion: boolean): CalcInput {
  return { name: 'Time', value: years, unit: 'years', source: fromQuestion ? 'your question' : 'assumption' };
}

export function sipCalc(monthly: number, years: number, yearsFromQuestion: boolean, id = 'sip'): Calculation {
  const [lo, mid, hi] = ASSUMPTIONS.equity_scenarios;
  const n = Math.round(years * 12);
  const invested = monthly * n;
  const fv = (p: number) => round2(sipFutureValue(monthly, p, years));
  const midFv = fv(mid);
  return {
    id,
    title: `SIP of ${inr(monthly)} a month for ${years} years`,
    formula: 'FV = P × [((1 + r)^n − 1) ÷ r] × (1 + r), r = annual return ÷ 12, n = months',
    inputs: [
      { name: 'Monthly SIP', value: monthly, unit: '₹', source: 'your question' },
      yearsInput(years, yearsFromQuestion),
      { name: 'Annual return (scenarios)', value: mid, unit: '%', source: 'assumption' },
    ],
    steps: [
      `n = ${years} × 12 = ${n} months; total invested = ${inr(monthly)} × ${n} = ${inr(invested)}`,
      `At ${lo}% a year: r = ${lo}% ÷ 12 → FV = ${inr(fv(lo))}`,
      `At ${mid}% a year: r = ${mid}% ÷ 12 → FV = ${inr(midFv)}`,
      `At ${hi}% a year: r = ${hi}% ÷ 12 → FV = ${inr(fv(hi))}`,
    ],
    result: { value: midFv, unit: '₹', label: `Value after ${years} years at ${mid}% a year (middle scenario)` },
    extras: [
      { label: 'Total invested', value: invested, unit: '₹' },
      { label: `Value at ${lo}%`, value: fv(lo), unit: '₹' },
      { label: `Value at ${hi}%`, value: fv(hi), unit: '₹' },
      { label: `Gain at ${mid}%`, value: round2(midFv - invested), unit: '₹' },
    ],
  };
}

export function lumpSumCalc(principal: number, years: number, yearsFromQuestion: boolean, equity: boolean): Calculation {
  const rates = equity ? [...ASSUMPTIONS.equity_scenarios] : [ASSUMPTIONS.debt_return];
  const mid = rates[Math.floor(rates.length / 2)] ?? ASSUMPTIONS.debt_return;
  const fv = (p: number) => round2(lumpSumFutureValue(principal, p, years));
  return {
    id: 'lump_sum',
    title: `${inr(principal)} invested once for ${years} years`,
    formula: 'FV = P × (1 + r)^t',
    inputs: [
      { name: 'Amount invested', value: principal, unit: '₹', source: 'your question' },
      yearsInput(years, yearsFromQuestion),
      { name: equity ? 'Annual return (scenarios)' : 'Annual return (debt)', value: mid, unit: '%', source: 'assumption' },
    ],
    steps: rates.map((p) => `At ${p}% a year: ${inr(principal)} × (1 + ${p / 100})^${years} = ${inr(fv(p))}`),
    result: { value: fv(mid), unit: '₹', label: `Value after ${years} years at ${mid}% a year` },
    extras: rates.filter((p) => p !== mid).map((p) => ({ label: `Value at ${p}%`, value: fv(p), unit: '₹' as const })),
  };
}

export function emiCalc(principal: number, loan: string, years: number, yearsFromQuestion: boolean, ratePct?: number): Calculation {
  const rate = ratePct ?? ASSUMPTIONS.loan_rate[loan] ?? 10;
  const n = Math.round(years * 12);
  const monthly = round2(emi(principal, rate, years));
  const total = round2(monthly * n);
  return {
    id: 'emi',
    title: `EMI on a ${inr(principal)} loan over ${years} years`,
    formula: 'EMI = P × r × (1 + r)^n ÷ ((1 + r)^n − 1), r = annual rate ÷ 12, n = months',
    inputs: [
      { name: 'Loan amount', value: principal, unit: '₹', source: 'your question' },
      { name: 'Interest rate', value: rate, unit: '%', source: ratePct === undefined ? 'assumption' : 'your question' },
      yearsInput(years, yearsFromQuestion),
    ],
    steps: [
      `r = ${rate}% ÷ 12 = ${(rate / 12).toFixed(4)}% a month; n = ${years} × 12 = ${n}`,
      `EMI = ${inr(monthly, 2)} a month`,
      `Total paid = ${inr(monthly, 2)} × ${n} = ${inr(total)}; interest = ${inr(round2(total - principal))}`,
    ],
    result: { value: monthly, unit: '₹', label: 'Monthly EMI' },
    extras: [
      { label: 'Total paid', value: total, unit: '₹' },
      { label: 'Total interest', value: round2(total - principal), unit: '₹' },
    ],
  };
}

export function fdCalc(principal: number, years: number, yearsFromQuestion: boolean): Calculation {
  const rate = ASSUMPTIONS.fd_rate;
  const value = round2(fdMaturity(principal, rate, years));
  return {
    id: 'fd',
    title: `Fixed deposit of ${inr(principal)} for ${years} years`,
    formula: 'Maturity = P × (1 + r ÷ 4)^(4t)  (quarterly compounding)',
    inputs: [
      { name: 'Deposit', value: principal, unit: '₹', source: 'your question' },
      { name: 'FD rate', value: rate, unit: '%', source: 'assumption' },
      yearsInput(years, yearsFromQuestion),
    ],
    steps: [`${inr(principal)} × (1 + ${rate / 100} ÷ 4)^(${4 * years}) = ${inr(value)}`, 'Interest is taxed at your slab rate every year.'],
    result: { value, unit: '₹', label: `Maturity value before tax at ${rate}%` },
    extras: [{ label: 'Interest earned', value: round2(value - principal), unit: '₹' }],
  };
}

export function inflationCalc(target: number, years: number): Calculation {
  const value = round2(inflate(target, ASSUMPTIONS.inflation, years));
  return {
    id: 'inflation',
    title: `What ${inr(target)} of today costs in ${years} years`,
    formula: 'Future cost = today’s cost × (1 + inflation)^t',
    inputs: [
      { name: 'Cost today', value: target, unit: '₹', source: 'your question' },
      { name: 'Inflation', value: ASSUMPTIONS.inflation, unit: '%', source: 'assumption' },
      yearsInput(years, true),
    ],
    steps: [`${inr(target)} × (1 + ${ASSUMPTIONS.inflation / 100})^${years} = ${inr(value)}`],
    result: { value, unit: '₹', label: `Cost in ${years} years at ${ASSUMPTIONS.inflation}% inflation` },
    extras: [],
  };
}

export function requiredSipCalc(target: number, years: number): Calculation {
  const [, mid] = ASSUMPTIONS.equity_scenarios;
  const future = inflate(target, ASSUMPTIONS.inflation, years);
  const perRupee = sipFutureValue(1, mid, years);
  const monthly = round2(future / perRupee);
  return {
    id: 'required_sip',
    title: `Monthly SIP needed to reach ${inr(target)} (today’s value) in ${years} years`,
    formula: 'SIP = future target ÷ [((1 + r)^n − 1) ÷ r × (1 + r)]',
    inputs: [
      { name: 'Goal in today’s money', value: target, unit: '₹', source: 'your question' },
      { name: 'Inflation', value: ASSUMPTIONS.inflation, unit: '%', source: 'assumption' },
      { name: 'Annual return', value: mid, unit: '%', source: 'assumption' },
      yearsInput(years, true),
    ],
    steps: [
      `Future target = ${inr(target)} × (1.06)^${years} = ${inr(round2(future))}`,
      `₹1 a month grows to ${inr(round2(perRupee), 2)} at ${mid}% over ${Math.round(years * 12)} months`,
      `SIP = ${inr(round2(future))} ÷ ${round2(perRupee)} = ${inr(monthly)} a month`,
    ],
    result: { value: monthly, unit: '₹', label: 'Monthly SIP needed' },
    extras: [{ label: 'Goal in future money', value: round2(future), unit: '₹' }],
  };
}

export function taxCalc(income: number, age?: number): Calculation {
  const newR = indiaEngine.calculate(income, '2026', { regime: 'new', age });
  const oldR = indiaEngine.calculate(income, '2026', { regime: 'old', age });
  return {
    id: 'income_tax',
    title: `Income tax on ${inr(income)} (${newR.year_label})`,
    formula: 'Tax = Σ slab rate × income in slab − rebate + 4% cess (standard deduction for salary)',
    inputs: [{ name: 'Annual income', value: income, unit: '₹', source: 'your question' }],
    steps: [
      ...newR.slab_breakdown.filter((s) => s.tax > 0).map((s) => `New regime: ${pctStr(s.rate * 100, 1)} on ${inr(s.taxable_amount)} = ${inr(s.tax)}`),
      `New regime total (with cess) = ${inr(newR.tax)}; effective rate ${pctStr(newR.effective_rate * 100)}`,
      `Old regime total (no deductions entered) = ${inr(oldR.tax)}`,
    ],
    result: { value: newR.tax, unit: '₹', label: 'Tax under the new regime' },
    extras: [
      { label: 'Tax under the old regime (no deductions)', value: oldR.tax, unit: '₹' },
      { label: 'Effective rate (new)', value: round2(newR.effective_rate * 100), unit: '%' },
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Guardrails

export function guardrails(parsed: ParsedQuery, profile: UserProfile | null, calcs: Calculation[]): Guardrail[] {
  const out: Guardrail[] = [];
  const has = (e: Entity) => parsed.entities.includes(e);
  const years = horizonYears(parsed.time_horizon);
  const equity = has('NIFTY') || has('SENSEX') || has('STOCK') || has('MUTUAL_FUND') || has('INDEX_FUND') || has('ELSS') || has('SIP');
  const isLoan = LOANS.some((l) => has(l)) || has('EMI');
  const lump = isLoan ? undefined : parsed.amounts.find((a) => a.type === 'lump_sum');
  const volatile = equity || has('CRYPTO') || has('BTC') || has('ETH');

  if (volatile && years !== null && years < 3) {
    out.push({
      id: 'short_horizon',
      level: 'warning',
      message: `Equity over ${years < 1 ? `${Math.round(years * 12)} months` : `${years} years`} can easily be down when you need the money. For under 3 years, debt funds or FDs are usually safer.`,
    });
  }
  if (has('CRYPTO') || has('BTC') || has('ETH')) {
    const inv = profile?.investments;
    const share = lump && inv ? lump.value / (inv + lump.value) : null;
    out.push({
      id: 'crypto',
      level: share !== null && share > 0.05 ? 'warning' : 'caution',
      message:
        share !== null && share > 0.05
          ? `This would make crypto ${pctStr(share * 100, 1)} of your investments; most planners cap it at 5%.`
          : 'Crypto is highly volatile and lightly regulated in India (30% tax on gains, 1% TDS). Keep it a small slice.',
    });
  }
  if (lump && profile?.investments && (has('STOCK') || has('CRYPTO') || has('BTC'))) {
    const share = lump.value / (profile.investments + lump.value);
    if (share > 0.2)
      out.push({
        id: 'concentration',
        level: 'warning',
        message: `${inr(lump.value)} would be ${pctStr(share * 100, 1)} of your investments in a single asset. Spreading it lowers the risk.`,
      });
  }
  const emiCalcResult = calcs.find((c) => c.id === 'emi');
  if (emiCalcResult && profile?.annual_income) {
    const monthlyIncome = profile.annual_income / 12;
    const burden = (emiCalcResult.result.value + (profile.monthly_emi ?? 0)) / monthlyIncome;
    if (burden > 0.4)
      out.push({
        id: 'emi_burden',
        level: 'warning',
        message: `Total EMIs would take ${pctStr(burden * 100, 1)} of your monthly income; lenders and planners treat above 40% as risky.`,
      });
  }
  if (profile?.monthly_expenses !== undefined && profile.liquid_savings !== undefined && (lump || has('SIP'))) {
    const need = profile.monthly_expenses * ASSUMPTIONS.emergency_months;
    if (profile.liquid_savings < need)
      out.push({
        id: 'emergency_first',
        level: 'caution',
        message: `Your savings (${inr(profile.liquid_savings)}) are below ${ASSUMPTIONS.emergency_months} months of expenses (${inr(need)}). Build the emergency fund before investing more.`,
      });
  }
  if (parsed.amounts.some((a) => a.value > MAX_AMOUNT))
    out.push({ id: 'amount_check', level: 'caution', message: 'One of the amounts looks unusually large; please check it.' });
  if (calcs.some((c) => c.inputs.some((i) => i.source === 'assumption'))) {
    out.push({ id: 'assumptions', level: 'info', message: 'Some inputs are planning assumptions, not guarantees. Actual returns and rates will differ.' });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Entry point

const LOANS = ['HOME_LOAN', 'CAR_LOAN', 'PERSONAL_LOAN', 'EDUCATION_LOAN'] as const;
const NO_PROJECTION: Entity[] = ['STOCK', 'CRYPTO', 'BTC', 'ETH', 'GOLD', 'SGB', 'REAL_ESTATE'];

function pick(amounts: ParsedAmount[], ...types: ParsedAmount['type'][]): ParsedAmount | undefined {
  return amounts.find((a) => types.includes(a.type) && a.currency === 'INR' && a.value > 0 && a.value <= MAX_AMOUNT);
}

export function runMath(parsed: ParsedQuery, context: Pick<ContextBundle, 'profile'> | null): MathResult {
  const profile = context?.profile.status === 'ok' ? context.profile.data : null;
  const has = (e: Entity) => parsed.entities.includes(e);
  const qYears = horizonYears(parsed.time_horizon);
  const calcs: Calculation[] = [];
  const assumptions = new Set<string>();
  const years = (fallback: number) => ({ y: qYears ?? fallback, fromQ: qYears !== null });

  const monthly = pick(parsed.amounts, 'monthly');
  const lump = pick(parsed.amounts, 'lump_sum', 'unknown');
  const target = pick(parsed.amounts, 'target');
  const income = pick(parsed.amounts, 'income') ?? (has('INCOME_TAX') ? pick(parsed.amounts, 'yearly', 'unknown') : undefined);
  const loan = LOANS.find((l) => has(l)) ?? (has('EMI') ? 'PERSONAL_LOAN' : undefined);

  if (monthly && (has('SIP') || has('MUTUAL_FUND') || has('INDEX_FUND') || !loan)) {
    const { y, fromQ } = years(ASSUMPTIONS.default_years);
    calcs.push(sipCalc(monthly.value, y, fromQ));
  }
  if (loan && (lump ?? target)) {
    const principal = (lump ?? target)?.value ?? 0;
    const { y, fromQ } = years(ASSUMPTIONS.loan_years[loan] ?? 10);
    calcs.push(emiCalc(principal, loan, y, fromQ));
  } else if (lump && (has('FD') || has('RD'))) {
    const { y, fromQ } = years(5);
    calcs.push(fdCalc(lump.value, y, fromQ));
  } else if (lump && NO_PROJECTION.some((e) => has(e))) {
    assumptions.add('No return projection for single stocks, crypto or gold: there is no reliable long-run rate to assume for them.');
  } else if (lump && !has('INCOME_TAX')) {
    const equity = !has('DEBT_FUND') && !has('PPF') && !has('EPF');
    const { y, fromQ } = years(ASSUMPTIONS.default_years);
    calcs.push(lumpSumCalc(lump.value, y, fromQ, equity));
  }
  if (target && !loan && qYears !== null) {
    calcs.push(inflationCalc(target.value, qYears));
    calcs.push(requiredSipCalc(target.value, qYears));
  }
  if (income && has('INCOME_TAX')) calcs.push(taxCalc(income.value, profile?.age));

  for (const c of calcs)
    for (const i of c.inputs) if (i.source === 'assumption') assumptions.add(`${i.name}: ${i.unit === '%' ? pctStr(i.value) : `${i.value} ${i.unit}`}`);
  if (calcs.some((c) => c.inputs.some((i) => i.name.includes('scenarios'))))
    assumptions.add(`Equity return scenarios: ${ASSUMPTIONS.equity_scenarios.join('%, ')}% a year (long-run planning ranges, not forecasts)`);

  return { calculations: calcs, guardrails: guardrails(parsed, profile, calcs), assumptions: [...assumptions] };
}

/** Every number the math engine produced or used, for the explainer's post-check (Layer F). */
export function traceableNumbers(result: MathResult): number[] {
  const out: number[] = [];
  for (const c of result.calculations) {
    out.push(c.result.value, ...c.extras.map((e) => e.value), ...c.inputs.map((i) => i.value));
  }
  return out;
}
