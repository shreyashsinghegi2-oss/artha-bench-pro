/**
 * Money Check: one set of inputs → a complete, deterministic money report.
 *
 * Every number here is calculated, never generated. Tax reuses the FY rules engine (slabs, 87A rebate,
 * standard deduction, cess, deduction caps); the planning maths uses standard time-value formulas with
 * the assumptions listed in MONEY_CHECK_ASSUMPTIONS so a user can see exactly what drives each figure.
 */
import { compareTaxRegimes } from './indiaTaxEngine';
import { createDefaultTaxProfile } from './taxWorkspaceStorage';
import { buildCfoHealthReport, type CfoHealthReport } from './cfoAnalysis';
import type { IncomeSource } from './incomeStorage';
import type { TaxDeductionEntry } from '../types/taxTypes';

export interface MoneyCheckInputs {
  age: number;
  /** Gross annual salary (CTC minus employer-only components), in ₹. */
  annualSalary: number;
  /** Monthly living expenses excluding EMIs, in ₹. */
  monthlyExpenses: number;
  monthlyEmi: number;
  /** Cash, savings account, FDs and liquid funds, in ₹. */
  liquidSavings: number;
  /** Long-term investments: mutual funds, stocks, PPF, EPF, NPS, in ₹. */
  investments: number;
  dependants: number;
  // Optional details (0 when unknown).
  loanOutstanding?: number;
  termCover?: number;
  healthCover?: number;
  /** Old-regime deductions actually used this year. */
  section80C?: number;
  section80D?: number;
  npsExtra?: number;
  retireAge?: number;
  goalAmountToday?: number;
  goalYears?: number;
}

export const MONEY_CHECK_ASSUMPTIONS = {
  inflation: 0.06,
  preRetirementReturn: 0.1,
  postRetirementReturn: 0.07,
  lifeExpectancy: 85,
  emergencyMonths: 6,
  /** Discount rate used to value future household expenses for term cover. */
  protectionDiscountRate: 0.07,
} as const;

export interface MoneyCheckReport {
  tax: {
    oldRegimeTax: number;
    newRegimeTax: number;
    better: 'old' | 'new' | 'same';
    saving: number;
    monthlyTakeHome: number;
    warnings: string[];
  };
  health: CfoHealthReport;
  cashflow: { surplus: number; savingsRate: number; emiLoad: number };
  netWorth: number;
  /** Months that savings and investments would cover spending and EMIs if income stopped today. */
  runwayMonths: number;
  emergency: { target: number; gap: number; months: number };
  freedom: {
    yearsToRetire: number;
    annualExpenseAtRetirement: number;
    corpusNeeded: number;
    projectedFromInvestments: number;
    monthlySipNeeded: number;
    /** Earliest age at which investing today's surplus funds retirement, or null if not within 45 years. */
    freedomAge: number | null;
  };
  protection: {
    termCoverNeeded: number;
    termGap: number;
    healthCoverSuggested: number;
    healthGap: number;
  };
  goal: { futureCost: number; monthlySip: number } | null;
  actions: Array<{ title: string; detail: string; priority: number }>;
}

const round = (value: number) => Math.round(value);
const nn = (value: number | undefined) => (Number.isFinite(value) && (value as number) > 0 ? (value as number) : 0);

/** Present value of a stream that starts at `first`, grows at g and is discounted at r, paid at the start of each of n years. */
export function pvGrowingAnnuityDue(first: number, r: number, g: number, n: number): number {
  if (n <= 0 || first <= 0) return 0;
  if (Math.abs(r - g) < 1e-12) return first * n;
  return first * (1 - ((1 + g) / (1 + r)) ** n) / (r - g) * (1 + r);
}

/** Monthly SIP (invested at the start of each month) that grows to `target` in `months` at annual return `annual`. */
export function sipForTarget(target: number, annual: number, months: number): number {
  if (target <= 0) return 0;
  if (months <= 0) return target;
  const m = (1 + annual) ** (1 / 12) - 1;
  if (m === 0) return target / months;
  return target * m / (((1 + m) ** months - 1) * (1 + m));
}

/** Future value of a monthly SIP invested at the start of each month. */
export function sipFutureValue(monthly: number, annual: number, months: number): number {
  if (monthly <= 0 || months <= 0) return 0;
  const m = (1 + annual) ** (1 / 12) - 1;
  if (m === 0) return monthly * months;
  return monthly * ((1 + m) ** months - 1) / m * (1 + m);
}

export function validateMoneyCheck(inputs: MoneyCheckInputs): string | null {
  if (!Number.isFinite(inputs.age) || inputs.age < 18 || inputs.age > 75) return 'Enter an age between 18 and 75.';
  if (!(inputs.annualSalary > 0)) return 'Enter your annual salary before tax.';
  if (!(inputs.monthlyExpenses >= 0) || !(inputs.monthlyEmi >= 0)) return 'Expenses and EMIs cannot be negative.';
  const retireAge = inputs.retireAge ?? 60;
  if (retireAge <= inputs.age) return 'Retirement age must be later than your current age.';
  return null;
}

function corpusNeededAt(annualExpenseToday: number, age: number, retireAge: number): { expense: number; corpus: number } {
  const { inflation, postRetirementReturn, lifeExpectancy } = MONEY_CHECK_ASSUMPTIONS;
  const expense = annualExpenseToday * (1 + inflation) ** (retireAge - age);
  const corpus = pvGrowingAnnuityDue(expense, postRetirementReturn, inflation, Math.max(1, lifeExpectancy - retireAge));
  return { expense, corpus };
}

export function buildMoneyCheck(inputs: MoneyCheckInputs): MoneyCheckReport {
  const error = validateMoneyCheck(inputs);
  if (error) throw new Error(error);
  const A = MONEY_CHECK_ASSUMPTIONS;
  const retireAge = inputs.retireAge ?? 60;
  const loan = nn(inputs.loanOutstanding);
  const liquid = nn(inputs.liquidSavings);
  const invested = nn(inputs.investments);

  // Tax: both regimes through the rules engine. Old-regime deductions are marked as added so they count.
  const now = new Date().toISOString();
  const salary: IncomeSource = {
    id: 'money-check-salary', type: 'Salary', amount: inputs.annualSalary / 12, currency: 'INR', frequency: 'Monthly',
    description: 'Salary', taxStatus: 'Pre-tax', startDate: now.slice(0, 10), tags: [], createdAt: now, updatedAt: now,
  };
  const deductions: TaxDeductionEntry[] = ([['80c', inputs.section80C], ['health-insurance', inputs.section80D], ['nps', inputs.npsExtra]] as const)
    .filter(([, amount]) => nn(amount) > 0)
    .map(([type, amount]) => ({ id: `mc-${type}`, type, amount: nn(amount), description: type, status: 'added' as const, createdAt: now }));
  const comparison = compareTaxRegimes([salary], { ...createDefaultTaxProfile(), taxRegime: 'compare' }, deductions, []);
  const oldTax = Number(comparison.old.totalTaxLiability);
  const newTax = Number(comparison.new.totalTaxLiability);
  const bestTax = Math.min(oldTax, newTax);
  const monthlyTakeHome = (inputs.annualSalary - bestTax) / 12;

  // Cash flow and health score on take-home.
  const health = buildCfoHealthReport({ monthlyIncome: monthlyTakeHome, monthlyExpenses: inputs.monthlyExpenses, monthlyEmi: inputs.monthlyEmi, emergencySavings: liquid });
  const surplus = monthlyTakeHome - inputs.monthlyExpenses - inputs.monthlyEmi;
  const monthlyOutflow = inputs.monthlyExpenses + inputs.monthlyEmi;

  // Emergency fund.
  const emergencyTarget = A.emergencyMonths * monthlyOutflow;

  // Freedom number: corpus that funds inflation-rising expenses from retirement to life expectancy.
  const yearsToRetire = retireAge - inputs.age;
  const annualExpenseToday = inputs.monthlyExpenses * 12;
  const { expense: expenseAtRetirement, corpus: corpusNeeded } = corpusNeededAt(annualExpenseToday, inputs.age, retireAge);
  const projectedFromInvestments = invested * (1 + A.preRetirementReturn) ** yearsToRetire;
  const monthlySipNeeded = sipForTarget(Math.max(0, corpusNeeded - projectedFromInvestments), A.preRetirementReturn, yearsToRetire * 12);

  let freedomAge: number | null = null;
  const sip = Math.max(0, surplus);
  for (let years = 1; years <= 45 && inputs.age + years <= A.lifeExpectancy - 1; years += 1) {
    const need = corpusNeededAt(annualExpenseToday, inputs.age, inputs.age + years).corpus;
    const have = invested * (1 + A.preRetirementReturn) ** years + sipFutureValue(sip, A.preRetirementReturn, years * 12);
    if (have >= need) { freedomAge = inputs.age + years; break; }
  }

  // Protection: replace household expenses until retirement, clear loans, net of what is already saved.
  const householdYears = inputs.dependants > 0 ? yearsToRetire : 0;
  const expenseReplacement = pvGrowingAnnuityDue(annualExpenseToday, A.protectionDiscountRate, A.inflation, householdYears);
  const termCoverNeeded = Math.max(0, expenseReplacement + loan - liquid - invested);
  const people = 1 + Math.max(0, inputs.dependants);
  const healthCoverSuggested = people <= 2 ? 1_000_000 : people <= 4 ? 1_500_000 : 2_000_000;

  // Optional goal.
  const goal = nn(inputs.goalAmountToday) > 0 && nn(inputs.goalYears) > 0
    ? (() => {
        const futureCost = nn(inputs.goalAmountToday) * (1 + A.inflation) ** nn(inputs.goalYears);
        return { futureCost: round(futureCost), monthlySip: round(sipForTarget(futureCost, A.preRetirementReturn, nn(inputs.goalYears) * 12)) };
      })()
    : null;

  const report: MoneyCheckReport = {
    tax: {
      oldRegimeTax: round(oldTax), newRegimeTax: round(newTax), better: comparison.lowerEstimatedRegime,
      saving: round(Math.abs(oldTax - newTax)), monthlyTakeHome: round(monthlyTakeHome),
      warnings: Array.from(new Set([...comparison.old.warnings, ...comparison.new.warnings])),
    },
    health,
    cashflow: { surplus: round(surplus), savingsRate: surplus / monthlyTakeHome, emiLoad: inputs.monthlyEmi / monthlyTakeHome },
    netWorth: round(liquid + invested - loan),
    runwayMonths: monthlyOutflow > 0 ? (liquid + invested) / monthlyOutflow : Infinity,
    emergency: { target: round(emergencyTarget), gap: round(Math.max(0, emergencyTarget - liquid)), months: monthlyOutflow > 0 ? liquid / monthlyOutflow : Infinity },
    freedom: {
      yearsToRetire,
      annualExpenseAtRetirement: round(expenseAtRetirement),
      corpusNeeded: round(corpusNeeded),
      projectedFromInvestments: round(projectedFromInvestments),
      monthlySipNeeded: round(monthlySipNeeded),
      freedomAge,
    },
    protection: {
      termCoverNeeded: round(termCoverNeeded),
      termGap: round(Math.max(0, termCoverNeeded - nn(inputs.termCover))),
      healthCoverSuggested,
      healthGap: Math.max(0, healthCoverSuggested - nn(inputs.healthCover)),
    },
    goal,
    actions: [],
  };
  report.actions = buildActions(report);
  return report;
}

const inr = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

function buildActions(r: MoneyCheckReport): MoneyCheckReport['actions'] {
  const actions: MoneyCheckReport['actions'] = [];
  if (r.cashflow.surplus < 0) actions.push({ priority: 1, title: 'Close the monthly deficit', detail: `You spend ${inr(-r.cashflow.surplus)} more than you take home each month. Fix this before anything else.` });
  if (r.protection.termGap > 0 && r.protection.termCoverNeeded > 0) actions.push({ priority: 2, title: 'Buy or top up term insurance', detail: `Your family would need about ${inr(r.protection.termCoverNeeded)}; the gap is ${inr(r.protection.termGap)}. Pure term cover is the cheapest way to close it.` });
  if (r.protection.healthGap > 0) actions.push({ priority: 3, title: 'Raise health cover', detail: `Aim for at least ${inr(r.protection.healthCoverSuggested)} of family health cover; you are ${inr(r.protection.healthGap)} short. A super top-up is a low-cost way to add it.` });
  if (r.emergency.gap > 0) actions.push({ priority: 4, title: 'Build your emergency fund', detail: `Keep ${inr(r.emergency.target)} (6 months of spending and EMIs) in a liquid fund or sweep FD. Gap: ${inr(r.emergency.gap)}.` });
  if (r.tax.better !== 'same' && r.tax.saving > 0) actions.push({ priority: 5, title: `Choose the ${r.tax.better} tax regime`, detail: `On these numbers the ${r.tax.better} regime saves ${inr(r.tax.saving)} a year. Tell your employer at the start of the year so TDS matches.` });
  if (r.cashflow.emiLoad > 0.4) actions.push({ priority: 6, title: 'Bring EMIs under 40% of take-home', detail: `EMIs use ${(r.cashflow.emiLoad * 100).toFixed(0)}% of take-home. Prepay the costliest loan first.` });
  if (r.freedom.monthlySipNeeded > 0) actions.push({ priority: 7, title: 'Start your retirement SIP', detail: `Invest ${inr(r.freedom.monthlySipNeeded)} a month to reach your freedom number of ${inr(r.freedom.corpusNeeded)} by retirement.` });
  return actions.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

/** A worked example used for the landing-page phone preview (clearly labelled as a sample). */
export const SAMPLE_MONEY_CHECK: MoneyCheckInputs = {
  age: 29, annualSalary: 1_800_000, monthlyExpenses: 55_000, monthlyEmi: 18_000, liquidSavings: 250_000,
  investments: 600_000, dependants: 1, loanOutstanding: 900_000, termCover: 5_000_000, healthCover: 500_000,
  section80C: 150_000, section80D: 25_000, retireAge: 60,
};
