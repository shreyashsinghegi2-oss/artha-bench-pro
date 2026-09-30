/**
 * Layer E — profile matcher (deterministic, no AI). Checks the question against the user's own finances.
 *
 * Every check shows the numbers it used and a benchmark. Benchmarks are common Indian planning guidelines,
 * labelled as guidelines (not rules or regulation). When the profile lacks a field, the check is left out
 * and the field is listed in `missing`, so the answer can say what would make it more personal.
 */
import type { UserProfile } from './context';
import type { Entity, ParsedQuery } from './types';
import { inr, pctStr } from './math-engine';

export type CheckStatus = 'good' | 'attention' | 'gap';

export interface ProfileCheck {
  id: string;
  title: string;
  status: CheckStatus;
  /** Plain sentence with the user's numbers. */
  detail: string;
  value: number;
  benchmark: number;
  unit: '₹' | '%' | 'months' | 'x';
  benchmark_note: string;
  /** True when the check relates to what was asked. */
  relevant: boolean;
}

export interface ProfileMatch {
  available: boolean;
  checks: ProfileCheck[];
  suitability: 'fits' | 'caution' | 'mismatch' | 'unknown';
  suitability_reason: string;
  missing: string[];
}

export const GUIDELINES = {
  emergency_months: 6,
  emi_share_max: 40,
  savings_rate_min: 20,
  term_cover_multiple: 10,
  health_cover_min: 1_000_000,
  limit_80c: 150_000,
  limit_nps_extra: 50_000,
} as const;

const EQUITY: Entity[] = ['NIFTY', 'SENSEX', 'BANKNIFTY', 'STOCK', 'MUTUAL_FUND', 'INDEX_FUND', 'ELSS', 'SIP', 'SP500', 'NASDAQ'];
const HIGH_RISK: Entity[] = ['CRYPTO', 'BTC', 'ETH', 'STOCK'];
const LOAN: Entity[] = ['HOME_LOAN', 'CAR_LOAN', 'PERSONAL_LOAN', 'EDUCATION_LOAN', 'EMI', 'CREDIT_CARD'];
const TAX: Entity[] = ['INCOME_TAX', '80C', '80D', 'ELSS', 'PPF', 'NPS', 'HRA', 'LTCG', 'STCG'];
const INSURANCE: Entity[] = ['TERM_INSURANCE', 'HEALTH_INSURANCE', 'INSURANCE', '80D'];

const PROFILE_FIELDS: Array<[keyof UserProfile, string]> = [
  ['age', 'age'],
  ['annual_income', 'annual income'],
  ['monthly_expenses', 'monthly expenses'],
  ['liquid_savings', 'savings in bank / liquid funds'],
  ['risk_tolerance', 'risk comfort (low / medium / high)'],
];

export function matchProfile(parsed: ParsedQuery, profile: UserProfile | null): ProfileMatch {
  const any = (list: Entity[]) => parsed.entities.some((e) => list.includes(e));
  const investing = any(EQUITY) || any(HIGH_RISK) || (!any(LOAN) && parsed.amounts.some((a) => a.type === 'lump_sum' || a.type === 'monthly'));
  if (!profile) {
    return {
      available: false,
      checks: [],
      suitability: 'unknown',
      suitability_reason: 'No profile shared, so the answer is general, not personal.',
      missing: PROFILE_FIELDS.map(([, label]) => label),
    };
  }

  const checks: ProfileCheck[] = [];
  const monthlyIncome = profile.annual_income !== undefined ? profile.annual_income / 12 : undefined;

  if (profile.monthly_expenses && profile.liquid_savings !== undefined) {
    const months = profile.liquid_savings / profile.monthly_expenses;
    checks.push({
      id: 'emergency_fund',
      title: 'Emergency fund',
      status: months >= GUIDELINES.emergency_months ? 'good' : months >= 3 ? 'attention' : 'gap',
      detail: `${inr(profile.liquid_savings)} covers ${months.toFixed(1)} months of your ${inr(profile.monthly_expenses)} monthly expenses.`,
      value: Number(months.toFixed(1)),
      benchmark: GUIDELINES.emergency_months,
      unit: 'months',
      benchmark_note: `Guideline: ${GUIDELINES.emergency_months} months of expenses in safe, liquid savings.`,
      relevant: investing || parsed.entities.includes('EMERGENCY_FUND'),
    });
  }

  if (monthlyIncome && profile.monthly_emi !== undefined) {
    const share = (profile.monthly_emi / monthlyIncome) * 100;
    checks.push({
      id: 'emi_share',
      title: 'EMIs vs income',
      status: share <= 30 ? 'good' : share <= GUIDELINES.emi_share_max ? 'attention' : 'gap',
      detail: `Your EMIs of ${inr(profile.monthly_emi)} are ${pctStr(share, 1)} of your monthly income of ${inr(Math.round(monthlyIncome))}.`,
      value: Number(share.toFixed(1)),
      benchmark: GUIDELINES.emi_share_max,
      unit: '%',
      benchmark_note: `Guideline: keep all EMIs under ${GUIDELINES.emi_share_max}% of take-home income.`,
      relevant: any(LOAN),
    });
  }

  if (monthlyIncome && profile.monthly_expenses !== undefined) {
    const rate = ((monthlyIncome - profile.monthly_expenses - (profile.monthly_emi ?? 0)) / monthlyIncome) * 100;
    checks.push({
      id: 'savings_rate',
      title: 'Savings rate',
      status: rate >= GUIDELINES.savings_rate_min ? 'good' : rate >= 10 ? 'attention' : 'gap',
      detail: `You keep ${pctStr(rate, 1)} of income after expenses${profile.monthly_emi ? ' and EMIs' : ''}.`,
      value: Number(rate.toFixed(1)),
      benchmark: GUIDELINES.savings_rate_min,
      unit: '%',
      benchmark_note: `Guideline: save at least ${GUIDELINES.savings_rate_min}% of income.`,
      relevant: investing || parsed.intent === 'PLAN',
    });
  }

  if (profile.annual_income) {
    const need = profile.annual_income * GUIDELINES.term_cover_multiple;
    const have = profile.term_cover ?? 0;
    const hasDependants = (profile.dependants ?? 0) > 0;
    checks.push({
      id: 'term_cover',
      title: 'Life (term) cover',
      status: have >= need ? 'good' : !hasDependants && have === 0 ? 'attention' : 'gap',
      detail: `Cover of ${inr(have)} vs about ${inr(need)} (${GUIDELINES.term_cover_multiple}× income)${hasDependants ? `, with ${profile.dependants} dependant(s)` : ''}.`,
      value: have,
      benchmark: need,
      unit: '₹',
      benchmark_note: `Guideline: term cover of at least ${GUIDELINES.term_cover_multiple}× annual income if anyone depends on you.`,
      relevant: any(INSURANCE) || parsed.intent === 'PLAN',
    });
  }

  if (profile.health_cover !== undefined) {
    checks.push({
      id: 'health_cover',
      title: 'Health cover',
      status: profile.health_cover >= GUIDELINES.health_cover_min ? 'good' : profile.health_cover > 0 ? 'attention' : 'gap',
      detail: `Health cover of ${inr(profile.health_cover)}.`,
      value: profile.health_cover,
      benchmark: GUIDELINES.health_cover_min,
      unit: '₹',
      benchmark_note: `Guideline: at least ${inr(GUIDELINES.health_cover_min)} for a family in a city.`,
      relevant: any(INSURANCE),
    });
  }

  if (profile.section_80c_used !== undefined) {
    const room = Math.max(0, GUIDELINES.limit_80c - profile.section_80c_used);
    checks.push({
      id: '80c_room',
      title: 'Section 80C room (old regime)',
      status: room === 0 ? 'good' : 'attention',
      detail: room === 0 ? 'You have used the full ₹1,50,000 limit.' : `${inr(room)} of the ${inr(GUIDELINES.limit_80c)} limit is unused.`,
      value: room,
      benchmark: 0,
      unit: '₹',
      benchmark_note: 'Section 80C allows up to ₹1,50,000 a year, only under the old tax regime.',
      relevant: any(TAX),
    });
  }

  if (profile.nps_extra_used !== undefined) {
    const room = Math.max(0, GUIDELINES.limit_nps_extra - profile.nps_extra_used);
    checks.push({
      id: 'nps_room',
      title: 'NPS extra deduction, 80CCD(1B) (old regime)',
      status: room === 0 ? 'good' : 'attention',
      detail: room === 0 ? 'You have used the full ₹50,000.' : `${inr(room)} of the ₹50,000 extra NPS deduction is unused.`,
      value: room,
      benchmark: 0,
      unit: '₹',
      benchmark_note: 'Section 80CCD(1B) allows an extra ₹50,000 for NPS, only under the old tax regime.',
      relevant: any(TAX) || parsed.entities.includes('RETIREMENT'),
    });
  }

  if (profile.age !== undefined && profile.equity_share !== undefined) {
    const guide = Math.max(20, Math.min(80, 100 - profile.age));
    const diff = profile.equity_share - guide;
    checks.push({
      id: 'equity_mix',
      title: 'Equity share of investments',
      status: Math.abs(diff) <= 15 ? 'good' : 'attention',
      detail: `${pctStr(profile.equity_share, 0)} of your investments are in equity; a common starting point at age ${profile.age} is about ${guide}%.`,
      value: profile.equity_share,
      benchmark: guide,
      unit: '%',
      benchmark_note: 'Rule of thumb: equity % ≈ 100 − age (between 20% and 80%). Adjust for your risk comfort.',
      relevant: any(EQUITY),
    });
  }

  // Suitability of what was asked, against the stated risk comfort and the safety basics.
  let suitability: ProfileMatch['suitability'] = 'fits';
  const reasons: string[] = [];
  if (investing) {
    if (profile.risk_tolerance === 'low' && any(HIGH_RISK)) {
      suitability = 'mismatch';
      reasons.push('you said your risk comfort is low, and this is a high-risk asset');
    } else if (profile.risk_tolerance === 'low' && any(EQUITY)) {
      suitability = 'caution';
      reasons.push('equity can fall 30% or more in a bad year, which is hard with low risk comfort');
    }
    const ef = checks.find((c) => c.id === 'emergency_fund');
    if (ef?.status === 'gap') {
      if (suitability === 'fits') suitability = 'caution';
      reasons.push('your emergency fund is below 3 months');
    }
    if (profile.income_stability === 'variable' && any(HIGH_RISK)) {
      if (suitability === 'fits') suitability = 'caution';
      reasons.push('your income varies, so keep high-risk bets small');
    }
  } else if (!checks.length) {
    suitability = 'unknown';
  }
  const suitability_reason =
    suitability === 'fits'
      ? investing
        ? 'Nothing in your profile argues against this.'
        : 'Your profile was used to personalise the checks below.'
      : suitability === 'unknown'
        ? 'Not enough profile detail to judge fit.'
        : `Be careful: ${reasons.join('; ')}.`;

  const missing = PROFILE_FIELDS.filter(([k]) => profile[k] === undefined).map(([, label]) => label);
  checks.sort((a, b) => Number(b.relevant) - Number(a.relevant));
  return { available: true, checks, suitability, suitability_reason, missing };
}
