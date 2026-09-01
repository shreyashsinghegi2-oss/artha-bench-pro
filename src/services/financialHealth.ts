import Decimal from 'decimal.js';
import { loadEmiRecords } from './emiStorage';
import { loadIncomeSources } from './incomeStorage';
import {
  currentMonthKey,
  expensesForMonth,
  loadBudgets,
  loadExpenses,
  monthlyIncomeEstimate,
  priorMonth,
  spendingByCategory,
  totalExpenses,
} from './personalFinanceStorage';

export type FinancialHealthPeriod = 3 | 6 | 12;
export type FinancialHealthStatus = 'Stable' | 'Watch' | 'Review' | 'Data needed';
export type FinancialHealthDimensionKey =
  | 'cash-flow-stability'
  | 'savings-resilience'
  | 'budget-discipline'
  | 'debt-emi-pressure'
  | 'expense-stability'
  | 'income-consistency'
  | 'data-completeness';

export interface FinancialHealthDimension {
  key: FinancialHealthDimensionKey;
  name: string;
  weight: number;
  score: number | null;
  status: FinancialHealthStatus;
  interpretation: string;
  whyItMatters: string;
  calculation: string;
  evidence: string[];
  limitations: string[];
}

export interface FinancialHealthMonthPoint {
  month: string;
  income: number;
  expenses: number;
  netCashFlow: number;
  plannedBudget: number | null;
  savingsTarget: number | null;
  activeMonthlyEmi: number;
  commitmentToIncomePercent: number | null;
}

export interface BudgetPressurePoint {
  category: string;
  planned: number;
  spent: number;
  utilizationPercent: number | null;
}

export interface FinancialHealthSnapshot {
  calculatedAt: string;
  periodMonths: FinancialHealthPeriod;
  monthKeys: string[];
  periodLabel: string;
  dimensions: FinancialHealthDimension[];
  composite: number | null;
  compositeStatus: FinancialHealthStatus;
  compositeReason: string;
  monthPoints: FinancialHealthMonthPoint[];
  budgetPressure: BudgetPressurePoint[];
  dataCompleteness: 'Low' | 'Medium' | 'High';
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round = (value: number) => Math.round(value * 10) / 10;
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const standardDeviation = (values: number[]) => {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
};
const coefficientOfVariation = (values: number[]) => {
  const average = Math.abs(mean(values));
  return average > 0 ? standardDeviation(values) / average : 1;
};
const statusForScore = (score: number | null): FinancialHealthStatus => score == null ? 'Data needed' : score >= 75 ? 'Stable' : score >= 50 ? 'Watch' : 'Review';
const monthKeysBack = (count: number) => {
  const keys = [currentMonthKey()];
  while (keys.length < count) keys.unshift(priorMonth(keys[0]));
  return keys;
};

function dimension(
  key: FinancialHealthDimensionKey,
  name: string,
  weight: number,
  score: number | null,
  interpretation: string,
  whyItMatters: string,
  calculation: string,
  evidence: string[],
  limitations: string[] = [],
): FinancialHealthDimension {
  const normalized = score == null ? null : round(clamp(score));
  return { key, name, weight, score: normalized, status: statusForScore(normalized), interpretation, whyItMatters, calculation, evidence, limitations };
}

export function buildFinancialHealthSnapshot(periodMonths: FinancialHealthPeriod = 6): FinancialHealthSnapshot {
  const monthKeys = monthKeysBack(periodMonths);
  const expenses = loadExpenses();
  const budgets = loadBudgets();
  const incomeSources = loadIncomeSources().filter((source) => source.currency.toUpperCase() === 'INR');
  const emiRecords = loadEmiRecords();
  const activeEmis = emiRecords.filter((record) => record.status === 'active');
  const activeMonthlyEmi = activeEmis.reduce((sum, record) => new Decimal(sum).plus(record.emiAmount ?? 0).toNumber(), 0);

  const monthPoints: FinancialHealthMonthPoint[] = monthKeys.map((month) => {
    const monthExpenses = expensesForMonth(expenses, month);
    const expenseTotal = totalExpenses(monthExpenses);
    const income = monthlyIncomeEstimate(month, incomeSources);
    const budget = budgets.find((item) => item.month === month) ?? null;
    const plannedBudget = budget ? budget.categories.reduce((sum, category) => new Decimal(sum).plus(category.plannedAmount).toNumber(), 0) : null;
    const savingsTarget = budget?.savingsTarget ?? null;
    return {
      month,
      income,
      expenses: expenseTotal,
      netCashFlow: new Decimal(income).minus(expenseTotal).toNumber(),
      plannedBudget,
      savingsTarget,
      activeMonthlyEmi,
      commitmentToIncomePercent: income > 0 ? round(new Decimal(activeMonthlyEmi).div(income).times(100).toNumber()) : null,
    };
  });

  const financeMonths = monthPoints.filter((point) => point.income > 0 || point.expenses > 0);
  const comparableCashFlow = monthPoints.filter((point) => point.income > 0 && point.expenses > 0);
  const cashFlowRatios = comparableCashFlow.map((point) => point.netCashFlow / point.income);
  const positiveShare = cashFlowRatios.length ? cashFlowRatios.filter((value) => value >= 0).length / cashFlowRatios.length : 0;
  const cashFlowScore = cashFlowRatios.length >= 3
    ? clamp(positiveShare * 60 + (1 - Math.min(coefficientOfVariation(cashFlowRatios), 1)) * 40)
    : null;

  const savingsMonths = monthPoints.filter((point) => point.income > 0 && point.savingsTarget != null && point.savingsTarget > 0);
  const savingsCoverage = savingsMonths.map((point) => clamp(point.netCashFlow / (point.savingsTarget || 1), 0, 1));
  const savingsScore = savingsCoverage.length >= 2 ? mean(savingsCoverage) * 100 : null;

  const budgetMonths = monthPoints.filter((point) => point.plannedBudget != null && point.plannedBudget > 0);
  const budgetScores = budgetMonths.map((point) => {
    const utilization = point.expenses / (point.plannedBudget || 1) * 100;
    if (utilization <= 80) return 100;
    if (utilization >= 140) return 0;
    return 100 - ((utilization - 80) / 60) * 100;
  });
  const budgetScore = budgetScores.length ? mean(budgetScores) : null;

  const latestIncomePoint = [...monthPoints].reverse().find((point) => point.income > 0) ?? null;
  const commitmentRatio = latestIncomePoint && latestIncomePoint.income > 0 ? activeMonthlyEmi / latestIncomePoint.income * 100 : null;
  const debtScore = commitmentRatio == null ? null : clamp(100 - Math.min(commitmentRatio / 50, 1) * 100);

  const expenseTotals = monthPoints.filter((point) => point.expenses > 0).map((point) => point.expenses);
  const expenseScore = expenseTotals.length >= 3 ? clamp((1 - Math.min(coefficientOfVariation(expenseTotals), 1)) * 100) : null;

  const incomeTotals = monthPoints.filter((point) => point.income > 0).map((point) => point.income);
  const incomeScore = incomeTotals.length >= 3 ? clamp((1 - Math.min(coefficientOfVariation(incomeTotals), 1)) * 100) : null;

  const datedExpenseCoverage = expenses.length ? expenses.filter((item) => /^\d{4}-\d{2}-\d{2}/.test(item.date) && item.category && item.amount > 0).length / expenses.length : 0;
  const historyCoverage = financeMonths.length / periodMonths;
  const incomeCoverage = incomeSources.length ? 1 : 0;
  const budgetCoverage = budgets.some((budget) => monthKeys.includes(budget.month)) ? 1 : 0.5;
  const emiFieldCoverage = activeEmis.length
    ? mean(activeEmis.map((record) => [record.emiAmount, record.nextDueDate, record.lender, record.remainingInstallments].filter((value) => value !== null && value !== '').length / 4))
    : 0.75;
  const completenessScore = clamp((historyCoverage * 35) + (datedExpenseCoverage * 20) + (incomeCoverage * 20) + (budgetCoverage * 10) + (emiFieldCoverage * 15));

  const dimensions: FinancialHealthDimension[] = [
    dimension(
      'cash-flow-stability', 'Cash Flow Stability', 20, cashFlowScore,
      cashFlowScore == null ? 'At least three months with both recorded income and expenses are needed.' : `${comparableCashFlow.length} comparable months were evaluated for surplus/deficit consistency.`,
      'Shows how consistently recorded inflows cover recorded outflows without forecasting future cash flow.',
      '60% positive-month share + 40% stability of monthly net-cash-flow-to-income ratios.',
      [`${comparableCashFlow.length} comparable months`, `Selected period: ${monthKeys[0]} to ${monthKeys.at(-1)}`],
      ['Only recorded workspace income and expenses are included.'],
    ),
    dimension(
      'savings-resilience', 'Savings Resilience', 20, savingsScore,
      savingsScore == null ? 'Configure savings targets in at least two monthly budgets to calculate this partial indicator.' : 'Compares recorded monthly surplus with configured savings targets.',
      'Helps show whether recorded cash flow is covering the savings goals you configured.',
      'Average of recorded monthly net cash flow divided by configured savings target, capped between 0% and 100%.',
      [`Savings-target months available: ${savingsMonths.length}`],
      ['No bank balance or actual savings-account balance is inferred. This is a target-coverage proxy, not proof of savings.'],
    ),
    dimension(
      'budget-discipline', 'Budget Discipline', 15, budgetScore,
      budgetScore == null ? 'Budget not configured for the selected period.' : `${budgetMonths.length} recorded monthly budget${budgetMonths.length === 1 ? '' : 's'} compared with recorded spending.`,
      'Shows recorded spending pressure against limits you chose yourself.',
      '100 at or below 80% utilization, declining linearly to 0 at 140% utilization.',
      [`Budget months available: ${budgetMonths.length}`],
      ['No score is generated when a budget is not configured.'],
    ),
    dimension(
      'debt-emi-pressure', 'Debt and EMI Pressure', 20, debtScore,
      debtScore == null ? 'Recorded income is needed before an internal commitment ratio can be calculated.' : `${round(commitmentRatio ?? 0)}% of the latest recorded monthly income is represented by active recorded EMI commitments.`,
      'Describes how large recorded recurring commitments are relative to recorded income.',
      '100 minus the recorded commitment-to-income ratio scaled across a 0–50% reference range.',
      [`Active recorded commitments: ${activeEmis.length}`, `Active monthly commitment: ₹${Math.round(activeMonthlyEmi).toLocaleString('en-IN')}`],
      ['This is an internal descriptive ratio, not lender affordability, eligibility, creditworthiness, or approval.'],
    ),
    dimension(
      'expense-stability', 'Expense Stability', 10, expenseScore,
      expenseScore == null ? 'At least three months of recorded expenses are needed.' : `${expenseTotals.length} months of recorded spending were compared for variation.`,
      'Helps identify whether total recorded spending varies materially across comparable months.',
      '100 × (1 − capped coefficient of variation of monthly recorded expense totals).',
      [`Expense-history months: ${expenseTotals.length}`],
      ['Normal spending variation is not labeled as risk without supporting evidence.'],
    ),
    dimension(
      'income-consistency', 'Income Consistency', 10, incomeScore,
      incomeScore == null ? 'At least three months of recorded INR income are needed.' : `${incomeTotals.length} months of recorded income were compared for variation.`,
      'Describes consistency of recorded income without assuming that income will continue.',
      '100 × (1 − capped coefficient of variation of monthly recorded income totals).',
      [`Recorded INR income sources: ${incomeSources.length}`, `Income-history months: ${incomeTotals.length}`],
      ['No future salary, business income, or source continuation is predicted.'],
    ),
    dimension(
      'data-completeness', 'Data Completeness', 5, completenessScore,
      `${financeMonths.length} of ${periodMonths} selected months contain recorded finance activity.`,
      'Measures record coverage and field completeness, not financial behavior or creditworthiness.',
      '35% period coverage + 20% expense fields + 20% income coverage + 10% budget coverage + 15% EMI field coverage.',
      [`Expense records: ${expenses.length}`, `Income sources: ${incomeSources.length}`, `Budgets in period: ${budgetMonths.length}`, `Active EMI records: ${activeEmis.length}`],
      ['A high completeness score means the workspace is better populated; it is not a positive financial-behavior judgment.'],
    ),
  ];

  const allDimensionsAvailable = dimensions.every((item) => item.score != null);
  const composite = allDimensionsAvailable
    ? round(dimensions.reduce((sum, item) => sum + (item.score ?? 0) * item.weight / 100, 0))
    : null;
  const compositeStatus = statusForScore(composite);
  const compositeReason = composite == null
    ? 'Profile incomplete — add more recorded data to generate a reliable indicator.'
    : 'Weighted deterministic indicator across all seven recorded-data dimensions.';

  const currentMonth = monthKeys.at(-1) ?? currentMonthKey();
  const currentBudget = budgets.find((budget) => budget.month === currentMonth) ?? null;
  const currentExpenses = expensesForMonth(expenses, currentMonth);
  const categorySpend = spendingByCategory(currentExpenses);
  const budgetPressure: BudgetPressurePoint[] = currentBudget
    ? currentBudget.categories.filter((category) => category.plannedAmount > 0).map((category) => ({
      category: category.category,
      planned: category.plannedAmount,
      spent: categorySpend[category.category] ?? 0,
      utilizationPercent: category.plannedAmount > 0 ? round(((categorySpend[category.category] ?? 0) / category.plannedAmount) * 100) : null,
    })).sort((a, b) => (b.utilizationPercent ?? 0) - (a.utilizationPercent ?? 0))
    : [];

  const dataCompleteness: FinancialHealthSnapshot['dataCompleteness'] = completenessScore >= 75 ? 'High' : completenessScore >= 45 ? 'Medium' : 'Low';

  return {
    calculatedAt: new Date().toISOString(),
    periodMonths,
    monthKeys,
    periodLabel: `${monthKeys[0]} to ${monthKeys.at(-1)}`,
    dimensions,
    composite,
    compositeStatus,
    compositeReason,
    monthPoints,
    budgetPressure,
    dataCompleteness,
  };
}
