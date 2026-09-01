import Decimal from 'decimal.js';
import { buildEmiSchedule, EmiRecord } from './emiStorage';
import { loadIncomeSources } from './incomeStorage';
import {
  currentMonthKey,
  expensesForMonth,
  loadBudgets,
  loadExpenses,
  monthlyIncomeEstimate,
  totalExpenses,
} from './personalFinanceStorage';

export type EmiHealthStatus = 'Stable' | 'Watch' | 'Review' | 'Data needed';
export type EmiHealthDimensionKey =
  | 'commitment-load'
  | 'cash-flow-coverage'
  | 'calendar-readiness'
  | 'concentration-risk'
  | 'tenure-exposure'
  | 'budget-alignment'
  | 'data-completeness';

export interface EmiHealthDimension {
  key: EmiHealthDimensionKey;
  name: string;
  score: number | null;
  status: EmiHealthStatus;
  calculation: string;
  interpretation: string;
  evidence: string[];
  limitations: string[];
}

export interface EmiTimelineItem {
  recordId: string;
  name: string;
  lender: string;
  loanType: string;
  dueDate: string;
  amount: number | null;
  paymentStatus: 'Paid' | 'Payment status not recorded';
  isPastDate: boolean;
}

export interface EmiMonthlyCommitmentPoint {
  month: string;
  amount: number;
  count: number;
}

export interface EmiMixPoint {
  name: string;
  amount: number;
}

export interface EmiIntelligenceSnapshot {
  calculatedAt: string;
  activeCount: number;
  activeMonthlyCommitment: number;
  nextRecordedDueDate: string | null;
  upcoming30: number;
  upcoming60: number;
  upcoming90: number;
  commitmentToIncomePercent: number | null;
  commitmentToNetCashFlowPercent: number | null;
  monthlyIncome: number;
  recordedNetCashFlow: number;
  averageRemainingTenureMonths: number | null;
  maturityDates: Array<{ name: string; date: string; basis: string }>;
  scheduleCompletenessPercent: number | null;
  dimensions: EmiHealthDimension[];
  composite: number | null;
  compositeStatus: EmiHealthStatus;
  monthlyTimeline: EmiMonthlyCommitmentPoint[];
  upcomingTimeline: EmiTimelineItem[];
  mixByLender: EmiMixPoint[];
  mixByCategory: EmiMixPoint[];
  budgetPlannedForEmi: number | null;
}

const round = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const statusFor = (score: number | null): EmiHealthStatus => score == null ? 'Data needed' : score >= 75 ? 'Stable' : score >= 50 ? 'Watch' : 'Review';

function healthDimension(
  key: EmiHealthDimensionKey,
  name: string,
  score: number | null,
  calculation: string,
  interpretation: string,
  evidence: string[],
  limitations: string[] = [],
): EmiHealthDimension {
  const normalized = score == null ? null : round(clamp(score));
  return { key, name, score: normalized, status: statusFor(normalized), calculation, interpretation, evidence, limitations };
}

function addMonths(month: string, count: number): string {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthIndex - 1 + count, 1)).toISOString().slice(0, 7);
}

function dateWithinDays(date: string, days: number): boolean {
  if (!date) return false;
  const target = new Date(`${date}T00:00:00Z`).getTime();
  if (Number.isNaN(target)) return false;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return target >= today && target <= today + days * 86400000;
}

export function buildEmiIntelligenceSnapshot(records: EmiRecord[]): EmiIntelligenceSnapshot {
  const active = records.filter((record) => record.status === 'active');
  const activeMonthlyCommitment = active.reduce((sum, record) => new Decimal(sum).plus(record.emiAmount ?? 0).toNumber(), 0);
  const currentMonth = currentMonthKey();
  const incomeSources = loadIncomeSources().filter((source) => source.currency.toUpperCase() === 'INR');
  const monthlyIncome = monthlyIncomeEstimate(currentMonth, incomeSources);
  const currentExpenses = expensesForMonth(loadExpenses(), currentMonth);
  const recordedExpenseTotal = totalExpenses(currentExpenses);
  const recordedNetCashFlow = new Decimal(monthlyIncome).minus(recordedExpenseTotal).toNumber();
  const commitmentToIncomePercent = monthlyIncome > 0 ? round(new Decimal(activeMonthlyCommitment).div(monthlyIncome).times(100).toNumber()) : null;
  const commitmentToNetCashFlowPercent = recordedNetCashFlow > 0 ? round(new Decimal(activeMonthlyCommitment).div(recordedNetCashFlow).times(100).toNumber()) : null;

  const twelveMonthRows = active.flatMap((record) => buildEmiSchedule(record, Math.min(record.remainingInstallments ?? 12, 12)).map((row) => ({ record, row })));
  const upcoming30 = twelveMonthRows.filter(({ row }) => dateWithinDays(row.dueDate, 30)).reduce((sum, { row }) => new Decimal(sum).plus(row.amount ?? 0).toNumber(), 0);
  const upcoming60 = twelveMonthRows.filter(({ row }) => dateWithinDays(row.dueDate, 60)).reduce((sum, { row }) => new Decimal(sum).plus(row.amount ?? 0).toNumber(), 0);
  const upcoming90 = twelveMonthRows.filter(({ row }) => dateWithinDays(row.dueDate, 90)).reduce((sum, { row }) => new Decimal(sum).plus(row.amount ?? 0).toNumber(), 0);
  const nextRecordedDueDate = active.filter((record) => record.nextDueDate).map((record) => record.nextDueDate).sort()[0] ?? null;

  const remainingTenures = active.map((record) => record.remainingInstallments).filter((value): value is number => value != null && value >= 0);
  const averageRemainingTenureMonths = remainingTenures.length ? round(mean(remainingTenures)) : null;
  const maturityDates = active.flatMap((record) => {
    if (!record.nextDueDate || record.remainingInstallments == null || record.remainingInstallments <= 0) return [];
    const schedule = buildEmiSchedule(record, Math.min(record.remainingInstallments, 240));
    const final = schedule.at(-1);
    return final ? [{ name: record.name, date: final.dueDate, basis: 'Estimated from recorded next due date and remaining monthly instalments' }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));

  const scheduleFields = active.map((record) => [record.emiAmount, record.nextDueDate, record.remainingInstallments].filter((value) => value !== null && value !== '').length / 3);
  const scheduleCompletenessPercent = active.length ? round(mean(scheduleFields) * 100) : null;

  const commitmentLoadScore = commitmentToIncomePercent == null ? null : clamp(100 - Math.min(commitmentToIncomePercent / 50, 1) * 100);
  const cashFlowCoverage = activeMonthlyCommitment > 0 && recordedNetCashFlow > 0 ? recordedNetCashFlow / activeMonthlyCommitment : activeMonthlyCommitment === 0 && monthlyIncome > 0 ? 2 : null;
  const cashFlowCoverageScore = cashFlowCoverage == null ? null : clamp(Math.min(cashFlowCoverage / 2, 1) * 100);
  const calendarScore = scheduleCompletenessPercent;

  const lenderAmounts = new Map<string, number>();
  active.forEach((record) => {
    if (!record.lender.trim() || record.emiAmount == null) return;
    lenderAmounts.set(record.lender.trim(), new Decimal(lenderAmounts.get(record.lender.trim()) ?? 0).plus(record.emiAmount).toNumber());
  });
  const lenderTotal = [...lenderAmounts.values()].reduce((sum, value) => sum + value, 0);
  const topLenderShare = lenderTotal > 0 ? Math.max(...lenderAmounts.values()) / lenderTotal : null;
  const concentrationScore = topLenderShare == null ? null : clamp(100 - Math.max(0, topLenderShare - 0.5) * 200);

  const tenureScore = averageRemainingTenureMonths == null ? null : clamp(100 - Math.min(averageRemainingTenureMonths / 120, 1) * 100);

  const currentBudget = loadBudgets().find((budget) => budget.month === currentMonth) ?? null;
  const emiBudget = currentBudget?.categories.find((category) => category.category === 'EMI/Debt') ?? null;
  const budgetPlannedForEmi = emiBudget?.plannedAmount ?? null;
  const budgetAlignmentScore = budgetPlannedForEmi == null || budgetPlannedForEmi <= 0
    ? null
    : activeMonthlyCommitment <= budgetPlannedForEmi
      ? 100
      : clamp(100 - Math.min((activeMonthlyCommitment - budgetPlannedForEmi) / budgetPlannedForEmi, 1) * 100);

  const allRecordFields = records.map((record) => [record.emiAmount, record.nextDueDate, record.lender, record.status, record.remainingInstallments, record.loanType].filter((value) => value !== null && value !== '').length / 6);
  const dataCompletenessScore = records.length ? round(mean(allRecordFields) * 100) : null;

  const dimensions: EmiHealthDimension[] = [
    healthDimension('commitment-load', 'Commitment Load', commitmentLoadScore, '100 minus the active recorded commitment-to-income ratio scaled across a 0–50% descriptive range.', commitmentToIncomePercent == null ? 'Recorded income is needed for this ratio.' : `Active recorded commitments represent ${commitmentToIncomePercent}% of current recorded monthly income.`, [`Active commitments: ${active.length}`, `Monthly commitment: ₹${Math.round(activeMonthlyCommitment).toLocaleString('en-IN')}`], ['Internal descriptive ratio only; not lender affordability or eligibility.']),
    healthDimension('cash-flow-coverage', 'Cash-Flow Coverage', cashFlowCoverageScore, 'Recorded monthly net cash flow divided by active monthly recorded commitments; full reference score at 2× coverage.', cashFlowCoverage == null ? 'Positive recorded net cash flow and commitment amounts are needed.' : `Recorded net cash flow covers active recorded commitments by ${round(cashFlowCoverage)}×.`, [`Recorded income: ₹${Math.round(monthlyIncome).toLocaleString('en-IN')}`, `Recorded current-month expenses: ₹${Math.round(recordedExpenseTotal).toLocaleString('en-IN')}`], ['If EMI payments are also recorded as expenses, this comparison can overlap those outflows; review the expense records for interpretation.']),
    healthDimension('calendar-readiness', 'Payment Calendar Readiness', calendarScore, 'Average completeness of EMI amount, next due date and remaining instalment fields across active commitments.', calendarScore == null ? 'Add an active EMI to evaluate schedule readiness.' : `${calendarScore}% of the core active schedule fields are recorded.`, [`Active commitments: ${active.length}`], ['A recorded due date does not prove payment status.']),
    healthDimension('concentration-risk', 'Concentration Risk', concentrationScore, 'Measures the share of active recorded monthly commitment assigned to the largest recorded lender; no score without lender labels.', topLenderShare == null ? 'Lender information is needed to assess concentration.' : `${round(topLenderShare * 100)}% of lender-labeled active monthly commitment is associated with the largest recorded lender.`, [`Lenders represented: ${lenderAmounts.size}`], ['This is portfolio concentration only; it is not a lender-quality or credit-risk assessment.']),
    healthDimension('tenure-exposure', 'Tenure Exposure', tenureScore, 'Descriptive score declines as average remaining recorded monthly instalments approach 120 months.', averageRemainingTenureMonths == null ? 'Remaining instalments or end-date data is needed.' : `Average remaining recorded tenure is ${averageRemainingTenureMonths} months.`, [`Commitments with remaining tenure: ${remainingTenures.length}/${active.length}`], ['Longer tenure is not automatically bad; this dimension only describes duration exposure.']),
    healthDimension('budget-alignment', 'Budget Alignment', budgetAlignmentScore, 'Compares active recorded monthly commitment with the current EMI/Debt budget category when configured.', budgetAlignmentScore == null ? 'No current EMI/Debt budget is configured.' : `Current EMI/Debt budget is ₹${Math.round(budgetPlannedForEmi ?? 0).toLocaleString('en-IN')} versus ₹${Math.round(activeMonthlyCommitment).toLocaleString('en-IN')} active recorded commitments.`, [currentBudget ? `Budget: ${currentBudget.name}` : 'Budget not configured'], ['A budget is user-configured and is not an affordability decision.']),
    healthDimension('data-completeness', 'Data Completeness', dataCompletenessScore, 'Average field coverage across amount, due date, lender, status, remaining instalments and category/type.', dataCompletenessScore == null ? 'No EMI records are available.' : `${dataCompletenessScore}% average field coverage across recorded EMI entries.`, [`Total EMI records: ${records.length}`], ['This measures record quality, not repayment behavior or creditworthiness.']),
  ];

  const composite = dimensions.every((item) => item.score != null) ? round(mean(dimensions.map((item) => item.score ?? 0))) : null;
  const compositeStatus = statusFor(composite);

  const monthlyTimeline = Array.from({ length: 12 }, (_, index) => ({ month: addMonths(currentMonth, index), amount: 0, count: 0 }));
  twelveMonthRows.forEach(({ row }) => {
    const month = row.dueDate.slice(0, 7);
    const target = monthlyTimeline.find((item) => item.month === month);
    if (!target) return;
    target.amount = new Decimal(target.amount).plus(row.amount ?? 0).toNumber();
    target.count += 1;
  });

  const paymentByDueDate = new Set(records.flatMap((record) => record.payments.map((payment) => `${record.id}:${payment.dueDate}`)));
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const upcomingTimeline: EmiTimelineItem[] = twelveMonthRows.map(({ record, row }) => {
    const dueTime = new Date(`${row.dueDate}T00:00:00Z`).getTime();
    const paid = paymentByDueDate.has(`${record.id}:${row.dueDate}`);
    return {
      recordId: record.id,
      name: record.name,
      lender: record.lender,
      loanType: record.loanType,
      dueDate: row.dueDate,
      amount: row.amount,
      paymentStatus: paid ? 'Paid' : 'Payment status not recorded',
      isPastDate: Number.isFinite(dueTime) && dueTime < today,
    };
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const mixByLender = [...lenderAmounts.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const categoryAmounts = new Map<string, number>();
  active.forEach((record) => categoryAmounts.set(record.loanType, new Decimal(categoryAmounts.get(record.loanType) ?? 0).plus(record.emiAmount ?? 0).toNumber()));
  const mixByCategory = [...categoryAmounts.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);

  return {
    calculatedAt: new Date().toISOString(),
    activeCount: active.length,
    activeMonthlyCommitment,
    nextRecordedDueDate,
    upcoming30,
    upcoming60,
    upcoming90,
    commitmentToIncomePercent,
    commitmentToNetCashFlowPercent,
    monthlyIncome,
    recordedNetCashFlow,
    averageRemainingTenureMonths,
    maturityDates,
    scheduleCompletenessPercent,
    dimensions,
    composite,
    compositeStatus,
    monthlyTimeline,
    upcomingTimeline,
    mixByLender,
    mixByCategory,
    budgetPlannedForEmi,
  };
}

export const EMI_REPLAY_INTENT_KEY = 'arthabench_emi_replay_intent_v1';

export type EmiReplayIntent = {
  label: string;
  horizonMonths: 1 | 3 | 6 | 12;
  changes: {
    monthlyIncomeDelta: number;
    expenseReductionPercent: number;
    additionalMonthlyExpense: number;
    newMonthlyEmi: number;
    savingsTargetDelta: number;
  };
  createdAt: string;
};

export function saveEmiReplayIntent(intent: EmiReplayIntent): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(EMI_REPLAY_INTENT_KEY, JSON.stringify(intent));
}

export function consumeEmiReplayIntent(): EmiReplayIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(EMI_REPLAY_INTENT_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(EMI_REPLAY_INTENT_KEY);
    const parsed = JSON.parse(raw) as EmiReplayIntent;
    if (!parsed || !parsed.changes || ![1, 3, 6, 12].includes(parsed.horizonMonths)) return null;
    return parsed;
  } catch {
    window.sessionStorage.removeItem(EMI_REPLAY_INTENT_KEY);
    return null;
  }
}
