/**
 * Deterministic "AI CFO" health check. Every figure here is computed, not generated,
 * so the landing-page analysis is instant, explainable and works without an AI provider.
 */

export interface CfoInputs {
  /** Monthly take-home income in INR. */
  monthlyIncome: number;
  /** Monthly living expenses in INR, excluding EMIs. */
  monthlyExpenses: number;
  /** Total monthly EMIs in INR. */
  monthlyEmi: number;
  /** Liquid savings available for emergencies in INR. */
  emergencySavings: number;
}

export type CfoStatus = 'Strong' | 'Stable' | 'Watch' | 'Critical';

export interface CfoMetric {
  key: 'savings-rate' | 'emi-load' | 'runway';
  label: string;
  value: number;
  display: string;
  target: string;
  /** 0–1 progress toward the healthy benchmark, for gauges. */
  progress: number;
  status: CfoStatus;
}

export interface CfoAction {
  title: string;
  detail: string;
  amount: number | null;
  horizon: 'This week' | 'This month' | 'This quarter';
}

export interface CfoHealthReport {
  score: number;
  status: CfoStatus;
  surplus: number;
  metrics: CfoMetric[];
  actions: CfoAction[];
  summary: string;
}

export const CFO_BENCHMARKS = { savingsRate: 0.2, emiCeiling: 0.4, emiComfort: 0.3, runwayMonths: 6 } as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const rupees = (value: number) => Math.round(value);

export function formatInr(value: number): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}₹${Math.abs(Math.round(value)).toLocaleString('en-IN')}`;
}

/** ₹12,50,000 → "₹12.5 lakh", ₹2,40,00,000 → "₹2.4 crore". */
export function formatInrShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const trim = (n: number) => n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, '');
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)} crore`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)} lakh`;
  return formatInr(value);
}

function statusFromScore(score: number): CfoStatus {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Stable';
  if (score >= 40) return 'Watch';
  return 'Critical';
}

export function validateCfoInputs(inputs: CfoInputs): string | null {
  const values = [inputs.monthlyIncome, inputs.monthlyExpenses, inputs.monthlyEmi, inputs.emergencySavings];
  if (!values.every(Number.isFinite)) return 'Enter valid numbers for every field.';
  if (values.some((value) => value < 0)) return 'Amounts cannot be negative.';
  if (inputs.monthlyIncome <= 0) return 'Monthly take-home income must be greater than zero.';
  return null;
}

export function buildCfoHealthReport(inputs: CfoInputs): CfoHealthReport {
  const error = validateCfoInputs(inputs);
  if (error) throw new Error(error);
  const { monthlyIncome: income, monthlyExpenses: expenses, monthlyEmi: emi, emergencySavings: savings } = inputs;

  const outflow = expenses + emi;
  const surplus = income - outflow;
  const savingsRate = surplus / income;
  const emiLoad = emi / income;
  const runway = outflow > 0 ? savings / outflow : Number.POSITIVE_INFINITY;

  // Scores: savings rate reaches full marks at 20%; EMI load is full marks up to 30% and zero at 50%+;
  // runway reaches full marks at six months of total outflow.
  const savingsProgress = clamp01(savingsRate / CFO_BENCHMARKS.savingsRate);
  const emiProgress = clamp01((0.5 - emiLoad) / (0.5 - CFO_BENCHMARKS.emiComfort));
  const runwayProgress = Number.isFinite(runway) ? clamp01(runway / CFO_BENCHMARKS.runwayMonths) : 1;
  const score = Math.round(savingsProgress * 35 + emiProgress * 30 + runwayProgress * 35);

  const metrics: CfoMetric[] = [
    {
      key: 'savings-rate',
      label: 'Savings rate',
      value: savingsRate,
      display: `${(savingsRate * 100).toFixed(1)}%`,
      target: '20% or more of take-home',
      progress: savingsProgress,
      status: savingsRate >= 0.2 ? 'Strong' : savingsRate >= 0.1 ? 'Stable' : savingsRate >= 0 ? 'Watch' : 'Critical',
    },
    {
      key: 'emi-load',
      label: 'EMI load',
      value: emiLoad,
      display: `${(emiLoad * 100).toFixed(1)}%`,
      target: 'Under 30–40% of take-home',
      progress: emiProgress,
      status: emiLoad <= 0.3 ? 'Strong' : emiLoad <= 0.4 ? 'Stable' : emiLoad <= 0.5 ? 'Watch' : 'Critical',
    },
    {
      key: 'runway',
      label: 'Emergency runway',
      value: Number.isFinite(runway) ? runway : 999,
      display: Number.isFinite(runway) ? `${runway.toFixed(1)} months` : 'No outflow',
      target: '6 months of expenses + EMIs',
      progress: runwayProgress,
      status: !Number.isFinite(runway) || runway >= 6 ? 'Strong' : runway >= 3 ? 'Stable' : runway >= 1 ? 'Watch' : 'Critical',
    },
  ];

  const actions: CfoAction[] = [];
  if (surplus < 0) {
    actions.push({
      title: 'Close the monthly deficit',
      detail: `You spend ${formatInr(-surplus)} more than you earn each month. Cut discretionary spending or restructure EMIs before adding any new commitment.`,
      amount: rupees(-surplus),
      horizon: 'This week',
    });
  }
  const emergencyGap = CFO_BENCHMARKS.runwayMonths * outflow - savings;
  if (emergencyGap > 0) {
    const monthly = surplus > 0 ? Math.min(surplus, emergencyGap / 12) : 0;
    actions.push({
      title: 'Build a 6-month emergency fund',
      detail: monthly > 0
        ? `Gap of ${formatInr(emergencyGap)}. Setting aside ${formatInr(monthly)} a month in a liquid fund or sweep FD closes it in about ${Math.ceil(emergencyGap / monthly)} months.`
        : `Gap of ${formatInr(emergencyGap)}. Free up monthly surplus first, then park it in a liquid fund or sweep FD.`,
      amount: rupees(emergencyGap),
      horizon: 'This month',
    });
  }
  if (emiLoad > CFO_BENCHMARKS.emiCeiling) {
    const excess = emi - CFO_BENCHMARKS.emiCeiling * income;
    actions.push({
      title: 'Bring EMIs under 40% of income',
      detail: `EMIs are ${formatInr(excess)} a month above the 40% ceiling. Prepay the highest-rate loan first or ask your lender about a longer tenure or balance transfer.`,
      amount: rupees(excess),
      horizon: 'This quarter',
    });
  }
  if (savingsRate < CFO_BENCHMARKS.savingsRate) {
    const needed = CFO_BENCHMARKS.savingsRate * income - surplus;
    actions.push({
      title: 'Lift your savings rate to 20%',
      detail: `Free up ${formatInr(needed)} a month, for example by trimming the top two spending categories, and automate it as a SIP on salary day.`,
      amount: rupees(needed),
      horizon: 'This month',
    });
  }
  if (actions.length === 0) {
    actions.push({
      title: 'Put your surplus to work',
      detail: `You have ${formatInr(surplus)} a month free after expenses and EMIs. Map it to goals: retirement, children's education and tax-saving investments (80C, NPS) before discretionary upgrades.`,
      amount: rupees(surplus),
      horizon: 'This month',
    });
  }

  const status = statusFromScore(score);
  const summary = surplus >= 0
    ? `You keep ${formatInr(surplus)} a month (${(savingsRate * 100).toFixed(1)}% of take-home). EMIs use ${(emiLoad * 100).toFixed(1)}% of income and your savings cover ${Number.isFinite(runway) ? `${runway.toFixed(1)} months` : 'all'} of outgoings.`
    : `You are running a monthly deficit of ${formatInr(-surplus)}. EMIs use ${(emiLoad * 100).toFixed(1)}% of income and savings cover ${Number.isFinite(runway) ? `${runway.toFixed(1)} months` : 'all'} of outgoings.`;

  return { score, status, surplus, metrics, actions: actions.slice(0, 4), summary };
}

/** Turns the deterministic report into a prompt so the AI CFO comments on verified numbers. */
export function cfoReviewPrompt(inputs: CfoInputs, report: CfoHealthReport): string {
  return [
    'Review my monthly finances as my CFO and give me a prioritised plan.',
    `Take-home income: ${formatInr(inputs.monthlyIncome)} a month.`,
    `Living expenses (excluding EMIs): ${formatInr(inputs.monthlyExpenses)} a month.`,
    `Total EMIs: ${formatInr(inputs.monthlyEmi)} a month.`,
    `Liquid emergency savings: ${formatInr(inputs.emergencySavings)}.`,
    `Verified calculations: surplus ${formatInr(report.surplus)}/month, ${report.metrics.map((metric) => `${metric.label.toLowerCase()} ${metric.display}`).join(', ')}, health score ${report.score}/100.`,
  ].join(' ');
}

export interface CfoPlanProfile {
  name: string; age: string; work: string; monthlyIncome: number; monthlyExpenses: number; monthlyEmi: number;
  savings: number; dependents: string; insurance: string; goal: string; goalYears: string;
}

/** Prompt for a complete personal CFO plan, grounded in the intake answers and verified calculations. */
export function cfoPlanPrompt(profile: CfoPlanProfile, report: CfoHealthReport): string {
  return [
    'Draft my complete PERSONAL CFO PLAN from these answers. Use my numbers, keep it simple and practical.',
    `About me: ${profile.name ? `name ${profile.name}, ` : ''}age ${profile.age}, ${profile.work.toLowerCase()}, dependants: ${profile.dependents}, insurance: ${profile.insurance.toLowerCase()}.`,
    `Monthly take-home ${formatInr(profile.monthlyIncome)}; expenses excluding EMIs ${formatInr(profile.monthlyExpenses)}; EMIs ${formatInr(profile.monthlyEmi)}; savings and investments ${formatInr(profile.savings)}.`,
    `Main goal: ${profile.goal.toLowerCase()} in ${profile.goalYears.toLowerCase()}.`,
    `Verified calculations (use exactly): surplus ${formatInr(report.surplus)}/month, ${report.metrics.map((metric) => `${metric.label.toLowerCase()} ${metric.display}`).join(', ')}, health score ${report.score}/100 (${report.status}).`,
    'Structure: title "Your personal CFO plan"; bottom line in 3 sentences; analysis steps titled Cash flow, Debt & EMIs, Safety net (emergency fund + insurance), Tax, Goal & investing, each with specific ₹ amounts; action plan as a 30-60-90 day list; the main risks; state any assumption you make.',
  ].join(' ');
}
