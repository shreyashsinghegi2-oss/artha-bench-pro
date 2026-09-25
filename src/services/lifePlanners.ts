/**
 * Life planners: retirement, child education and job switch. Pure functions, monthly compounding,
 * all amounts in rupees. Every assumption is an input so the user can change it.
 */
import { compareTaxRegimes } from './indiaTaxEngine';
import { createDefaultTaxProfile } from './taxWorkspaceStorage';
import type { IncomeSource } from './incomeStorage';

const monthlyRate = (annual: number) => (1 + annual) ** (1 / 12) - 1;
const round = (v: number) => Math.round(v);

/** Future value of a monthly SIP (paid at the start of each month) that steps up once a year. */
export function steppedSipFutureValue(monthly: number, annualReturn: number, years: number, stepUp = 0): number {
  const r = monthlyRate(annualReturn);
  let balance = 0;
  for (let m = 0; m < Math.round(years * 12); m += 1) {
    const sip = monthly * (1 + stepUp) ** Math.floor(m / 12);
    balance = (balance + sip) * (1 + r);
  }
  return balance;
}

/** Monthly SIP (with the same yearly step-up) that grows to `target` in `years`. */
export function sipNeededFor(target: number, annualReturn: number, years: number, stepUp = 0): number {
  if (target <= 0) return 0;
  if (years <= 0) return target;
  const perRupee = steppedSipFutureValue(1, annualReturn, years, stepUp);
  return perRupee > 0 ? target / perRupee : target;
}

/**
 * Corpus needed at the start of retirement to pay an inflation-rising yearly amount for `years`
 * (withdrawn at the start of each year) while the rest earns `postReturn`.
 */
export function corpusForIncome(firstYear: number, years: number, postReturn: number, inflation: number): number {
  if (firstYear <= 0 || years <= 0) return 0;
  if (Math.abs(postReturn - inflation) < 1e-9) return firstYear * years;
  const q = (1 + inflation) / (1 + postReturn);
  return firstYear * (1 - q ** years) / (1 - q) ;
}

// ---------------- Retirement ----------------

export interface RetirementInputs {
  age: number; retireAge: number; lifeExpectancy: number;
  monthlyExpensesToday: number; inflation: number;
  preReturn: number; postReturn: number;
  currentSavings: number; monthlySip: number; stepUp: number;
  /** Pension, rent or other income at retirement, in today's rupees a month (grows with inflation). */
  otherIncomeToday: number;
}
export const RETIREMENT_DEFAULTS: RetirementInputs = {
  age: 30, retireAge: 60, lifeExpectancy: 85, monthlyExpensesToday: 50_000, inflation: 0.06,
  preReturn: 0.11, postReturn: 0.07, currentSavings: 5_00_000, monthlySip: 10_000, stepUp: 0.1, otherIncomeToday: 0,
};
export interface RetirementPlan {
  yearsToRetire: number; yearsInRetirement: number;
  monthlyExpenseAtRetirement: number; corpusNeeded: number;
  projectedCorpus: number; gap: number; onTrackPct: number;
  extraSipNeeded: number; totalSipNeeded: number; lumpSumTodayForGap: number;
  moneyLastsToAge: number | null;
  series: Array<{ age: number; balance: number; phase: 'save' | 'spend' }>;
}

export function planRetirement(i: RetirementInputs): RetirementPlan {
  const yearsToRetire = Math.max(0, i.retireAge - i.age);
  const yearsInRetirement = Math.max(0, i.lifeExpectancy - i.retireAge);
  const grow = (1 + i.inflation) ** yearsToRetire;
  const netMonthlyToday = Math.max(0, i.monthlyExpensesToday - i.otherIncomeToday);
  const monthlyExpenseAtRetirement = i.monthlyExpensesToday * grow;
  const corpusNeeded = corpusForIncome(netMonthlyToday * grow * 12, yearsInRetirement, i.postReturn, i.inflation);
  const projectedCorpus = i.currentSavings * (1 + i.preReturn) ** yearsToRetire + steppedSipFutureValue(i.monthlySip, i.preReturn, yearsToRetire, i.stepUp);
  const gap = Math.max(0, corpusNeeded - projectedCorpus);
  const extraSipNeeded = sipNeededFor(gap, i.preReturn, yearsToRetire, i.stepUp);

  // Year-by-year: saving until retirement, then withdrawing inflation-rising expenses.
  const series: RetirementPlan['series'] = [];
  let balance = i.currentSavings;
  let moneyLastsToAge: number | null = null;
  for (let y = 0; y <= yearsToRetire + yearsInRetirement; y += 1) {
    const age = i.age + y;
    series.push({ age, balance: Math.max(0, round(balance)), phase: y < yearsToRetire ? 'save' : 'spend' });
    if (y < yearsToRetire) {
      balance = balance * (1 + i.preReturn) + steppedSipFutureValue(i.monthlySip * (1 + i.stepUp) ** y, i.preReturn, 1, 0);
    } else {
      const withdrawal = netMonthlyToday * 12 * (1 + i.inflation) ** y;
      balance = (balance - withdrawal) * (1 + i.postReturn);
      if (balance < 0 && moneyLastsToAge === null) { moneyLastsToAge = age; balance = 0; }
    }
  }
  return {
    yearsToRetire, yearsInRetirement,
    monthlyExpenseAtRetirement: round(monthlyExpenseAtRetirement),
    corpusNeeded: round(corpusNeeded), projectedCorpus: round(projectedCorpus), gap: round(gap),
    onTrackPct: corpusNeeded > 0 ? Math.min(1, projectedCorpus / corpusNeeded) : 1,
    extraSipNeeded: round(extraSipNeeded), totalSipNeeded: round(i.monthlySip + extraSipNeeded),
    lumpSumTodayForGap: round(gap / (1 + i.preReturn) ** yearsToRetire),
    moneyLastsToAge, series,
  };
}

// ---------------- Child education ----------------

export interface CoursePreset { id: string; label: string; level: 'Bachelors' | 'Masters' | 'Professional'; where: 'India' | 'Abroad'; costToday: number; years: number; startAge: number; inflation: number; note: string }

/**
 * Indicative total cost today (tuition + living for the whole course), for planning only. Fees vary
 * widely by institution; users should replace these with the actual figure for their target college.
 */
export const COURSE_PRESETS: CoursePreset[] = [
  { id: 'btech-india', label: 'Engineering (B.Tech), India', level: 'Bachelors', where: 'India', costToday: 15_00_000, years: 4, startAge: 18, inflation: 0.1, note: 'Private or top public college, 4 years with hostel' },
  { id: 'mbbs-india', label: 'Medicine (MBBS), private college, India', level: 'Professional', where: 'India', costToday: 75_00_000, years: 5.5, startAge: 18, inflation: 0.1, note: 'Private medical college fees vary a lot by state' },
  { id: 'ba-bcom-india', label: 'B.Com / BA / BSc, India', level: 'Bachelors', where: 'India', costToday: 5_00_000, years: 3, startAge: 18, inflation: 0.1, note: 'Good city college with living costs' },
  { id: 'ug-us', label: 'Bachelors in the USA', level: 'Bachelors', where: 'Abroad', costToday: 1_80_00_000, years: 4, startAge: 18, inflation: 0.08, note: 'Tuition plus living; includes rupee depreciation in the inflation rate' },
  { id: 'mba-india', label: 'MBA, top Indian B-school', level: 'Masters', where: 'India', costToday: 25_00_000, years: 2, startAge: 22, inflation: 0.1, note: 'Top-tier institute, 2 years' },
  { id: 'ms-us', label: 'Masters (MS) in the USA', level: 'Masters', where: 'Abroad', costToday: 75_00_000, years: 2, startAge: 22, inflation: 0.08, note: 'Tuition plus living for 2 years' },
  { id: 'masters-uk', label: 'Masters in the UK', level: 'Masters', where: 'Abroad', costToday: 45_00_000, years: 1, startAge: 22, inflation: 0.08, note: 'One-year taught masters with living costs' },
  { id: 'masters-ca-au', label: 'Masters in Canada or Australia', level: 'Masters', where: 'Abroad', costToday: 50_00_000, years: 2, startAge: 22, inflation: 0.08, note: 'Tuition plus living for 2 years' },
];

export interface EducationGoal { id: string; label: string; costToday: number; startAge: number; inflation: number; savedSoFar: number }
export interface EducationGoalPlan extends EducationGoal { years: number; futureCost: number; savingsGrowTo: number; gap: number; monthlySip: number; lumpSumToday: number; sipIfDelayed3y: number | null }

export function planEducationGoal(goal: EducationGoal, childAge: number, annualReturn: number, stepUp = 0): EducationGoalPlan {
  const years = Math.max(0, goal.startAge - childAge);
  const futureCost = goal.costToday * (1 + goal.inflation) ** years;
  const savingsGrowTo = goal.savedSoFar * (1 + annualReturn) ** years;
  const gap = Math.max(0, futureCost - savingsGrowTo);
  return {
    ...goal, years,
    futureCost: round(futureCost), savingsGrowTo: round(savingsGrowTo), gap: round(gap),
    monthlySip: round(sipNeededFor(gap, annualReturn, years, stepUp)),
    lumpSumToday: round(gap / (1 + annualReturn) ** years),
    sipIfDelayed3y: years > 3 ? round(sipNeededFor(Math.max(0, futureCost - goal.savedSoFar * (1 + annualReturn) ** years), annualReturn, years - 3, stepUp)) : null,
  };
}

// ---------------- Job switch ----------------

export interface JobSwitchInputs {
  currentCtc: number; offeredCtc: number;
  /** Basic pay as a share of CTC (drives PF and gratuity). */
  basicShare: number;
  currentVariableShare: number; offeredVariableShare: number;
  joiningBonus: number; relocationCost: number; noticeBuyout: number;
  gapMonths: number;
  currentMonthlyExpenses: number; newCityMonthlyExpenses: number;
  yearsAtCurrentJob: number;
}
export const JOB_SWITCH_DEFAULTS: JobSwitchInputs = {
  currentCtc: 12_00_000, offeredCtc: 16_00_000, basicShare: 0.4, currentVariableShare: 0.1, offeredVariableShare: 0.1,
  joiningBonus: 0, relocationCost: 50_000, noticeBuyout: 0, gapMonths: 0,
  currentMonthlyExpenses: 45_000, newCityMonthlyExpenses: 45_000, yearsAtCurrentJob: 2,
};

function annualTax(taxableSalary: number): number {
  if (taxableSalary <= 0) return 0;
  const now = new Date().toISOString();
  const salary: IncomeSource = { id: 'js', type: 'Salary', amount: taxableSalary / 12, currency: 'INR', frequency: 'Monthly', description: 'Salary', taxStatus: 'Pre-tax', startDate: now.slice(0, 10), tags: [], createdAt: now, updatedAt: now } as IncomeSource;
  const c = compareTaxRegimes([salary], { ...createDefaultTaxProfile(), taxRegime: 'compare' }, [], []);
  return Math.min(Number(c.old.totalTaxLiability), Number(c.new.totalTaxLiability));
}

export interface SalaryBreakup { ctc: number; employerPf: number; employeePf: number; tax: number; professionalTax: number; annualTakeHome: number; monthlyTakeHome: number; monthlyFixedTakeHome: number }
/** CTC to take-home: PF on basic (12% each side), professional tax ₹2,400, income tax (lower regime). */
export function salaryBreakup(ctc: number, basicShare: number, variableShare: number): SalaryBreakup {
  const basic = ctc * basicShare;
  const employerPf = basic * 0.12, employeePf = basic * 0.12;
  const gross = ctc - employerPf;
  const tax = annualTax(gross);
  const professionalTax = ctc > 0 ? 2_400 : 0;
  const annualTakeHome = gross - employeePf - tax - professionalTax;
  const variableNet = gross > 0 ? ctc * variableShare * (annualTakeHome / gross) : 0;
  return { ctc, employerPf: round(employerPf), employeePf: round(employeePf), tax: round(tax), professionalTax, annualTakeHome: round(annualTakeHome), monthlyTakeHome: round(annualTakeHome / 12), monthlyFixedTakeHome: round((annualTakeHome - variableNet) / 12) };
}

export interface JobSwitchPlan {
  current: SalaryBreakup; offered: SalaryBreakup;
  hikePct: number; takeHomeGainMonthly: number; costOfLivingChangeMonthly: number; netMonthlyGain: number;
  switchingCosts: number; gratuityForgone: number; firstYearNetGain: number; breakEvenMonths: number | null;
  verdict: 'strong' | 'fair' | 'weak' | 'loss';
}

export function planJobSwitch(i: JobSwitchInputs): JobSwitchPlan {
  const current = salaryBreakup(i.currentCtc, i.basicShare, i.currentVariableShare);
  const offered = salaryBreakup(i.offeredCtc, i.basicShare, i.offeredVariableShare);
  const takeHomeGainMonthly = offered.monthlyTakeHome - current.monthlyTakeHome;
  const costOfLivingChangeMonthly = i.newCityMonthlyExpenses - i.currentMonthlyExpenses;
  const netMonthlyGain = takeHomeGainMonthly - costOfLivingChangeMonthly;
  // Gratuity needs 5 years of service: 15/26 × monthly basic × years. Leaving just before 5 years forfeits it.
  const monthlyBasic = (i.currentCtc * i.basicShare) / 12;
  const gratuityForgone = i.yearsAtCurrentJob >= 4 && i.yearsAtCurrentJob < 5 ? round((15 / 26) * monthlyBasic * 5) : 0;
  const lostPay = i.gapMonths * current.monthlyTakeHome;
  const switchingCosts = round(i.relocationCost + i.noticeBuyout + lostPay + gratuityForgone);
  const firstYearNetGain = round(netMonthlyGain * (12 - i.gapMonths) + i.joiningBonus - switchingCosts);
  const breakEvenMonths = netMonthlyGain > 0 ? Math.max(0, Math.ceil((switchingCosts - i.joiningBonus) / netMonthlyGain)) : null;
  const hikePct = i.currentCtc > 0 ? i.offeredCtc / i.currentCtc - 1 : 0;
  const realHike = current.monthlyTakeHome > 0 ? netMonthlyGain / current.monthlyTakeHome : 0;
  const verdict = netMonthlyGain <= 0 ? 'loss' : realHike >= 0.2 ? 'strong' : realHike >= 0.08 ? 'fair' : 'weak';
  return { current, offered, hikePct, takeHomeGainMonthly: round(takeHomeGainMonthly), costOfLivingChangeMonthly: round(costOfLivingChangeMonthly), netMonthlyGain: round(netMonthlyGain), switchingCosts, gratuityForgone, firstYearNetGain, breakEvenMonths, verdict };
}
