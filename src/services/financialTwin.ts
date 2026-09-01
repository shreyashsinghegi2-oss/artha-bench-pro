import Decimal from 'decimal.js';
import { loadEmiRecords } from './emiStorage';
import { loadIncomeSources } from './incomeStorage';
import { currentMonthKey, expensesForMonth, loadBudgets, loadExpenses, monthlyIncomeEstimate, totalExpenses } from './personalFinanceStorage';

export type FinancialTwinInputs = {
  incomeDeltaPercent: number;
  expenseDeltaPercent: number;
  additionalMonthlyEmi: number;
  savingsTargetDelta: number;
};

export type FinancialTwinMetric = {
  key: 'cash-flow' | 'commitment-load' | 'budget-headroom' | 'savings-coverage' | 'data-readiness';
  label: string;
  baseline: number | null;
  scenario: number | null;
  delta: number | null;
  unit: 'INR' | 'percent' | 'score';
  direction: 'improves' | 'worsens' | 'unchanged' | 'unknown';
  evidence: string[];
  limitation: string;
};

export type FinancialTwinResult = {
  generatedAt: string;
  month: string;
  inputs: FinancialTwinInputs;
  baseline: {
    income: number;
    expenses: number;
    monthlyEmi: number;
    budgetPlanned: number | null;
    savingsTarget: number | null;
  };
  scenario: {
    income: number;
    expenses: number;
    monthlyEmi: number;
    savingsTarget: number | null;
  };
  metrics: FinancialTwinMetric[];
  rippleSummary: string[];
  dataLimitations: string[];
};

const round = (value: number) => Math.round(value * 100) / 100;
const safePercent = (numerator: number, denominator: number) => denominator > 0 ? round(new Decimal(numerator).div(denominator).times(100).toNumber()) : null;
const deltaOf = (baseline: number | null, scenario: number | null) => baseline == null || scenario == null ? null : round(new Decimal(scenario).minus(baseline).toNumber());

function direction(delta: number | null, positiveIsGood: boolean): FinancialTwinMetric['direction'] {
  if (delta == null) return 'unknown';
  if (Math.abs(delta) < 0.01) return 'unchanged';
  return (delta > 0) === positiveIsGood ? 'improves' : 'worsens';
}

export function buildFinancialTwin(inputs: FinancialTwinInputs): FinancialTwinResult {
  const month = currentMonthKey();
  const incomeSources = loadIncomeSources().filter((source) => source.currency.toUpperCase() === 'INR');
  const income = monthlyIncomeEstimate(month, incomeSources);
  const expenseRows = expensesForMonth(loadExpenses(), month);
  const expenses = totalExpenses(expenseRows);
  const activeEmis = loadEmiRecords().filter((record) => record.status === 'active');
  const monthlyEmi = activeEmis.reduce((sum, record) => new Decimal(sum).plus(record.emiAmount ?? 0).toNumber(), 0);
  const budget = loadBudgets().find((row) => row.month === month) ?? null;
  const budgetPlanned = budget ? budget.categories.reduce((sum, item) => new Decimal(sum).plus(item.plannedAmount).toNumber(), 0) : null;
  const savingsTarget = budget?.savingsTarget ?? null;

  const scenarioIncome = round(new Decimal(income).times(new Decimal(100 + inputs.incomeDeltaPercent).div(100)).toNumber());
  const scenarioExpenses = round(new Decimal(expenses).times(new Decimal(100 + inputs.expenseDeltaPercent).div(100)).toNumber());
  const scenarioEmi = round(new Decimal(monthlyEmi).plus(Math.max(0, inputs.additionalMonthlyEmi)).toNumber());
  const scenarioSavingsTarget = savingsTarget == null ? null : Math.max(0, round(new Decimal(savingsTarget).plus(inputs.savingsTargetDelta).toNumber()));

  const baselineCashFlow = round(new Decimal(income).minus(expenses).minus(monthlyEmi).toNumber());
  const scenarioCashFlow = round(new Decimal(scenarioIncome).minus(scenarioExpenses).minus(scenarioEmi).toNumber());
  const baselineCommitment = safePercent(monthlyEmi, income);
  const scenarioCommitment = safePercent(scenarioEmi, scenarioIncome);
  const baselineBudgetHeadroom = budgetPlanned == null ? null : round(new Decimal(budgetPlanned).minus(expenses).minus(monthlyEmi).toNumber());
  const scenarioBudgetHeadroom = budgetPlanned == null ? null : round(new Decimal(budgetPlanned).minus(scenarioExpenses).minus(scenarioEmi).toNumber());
  const baselineSavingsCoverage = savingsTarget && savingsTarget > 0 ? safePercent(Math.max(0, baselineCashFlow), savingsTarget) : null;
  const scenarioSavingsCoverage = scenarioSavingsTarget && scenarioSavingsTarget > 0 ? safePercent(Math.max(0, scenarioCashFlow), scenarioSavingsTarget) : null;

  const historySignals = [incomeSources.length > 0, expenseRows.length > 0, budget != null, activeEmis.length > 0];
  const readiness = round(historySignals.filter(Boolean).length / historySignals.length * 100);

  const metrics: FinancialTwinMetric[] = [
    {
      key: 'cash-flow', label: 'Monthly cash-flow ripple', baseline: baselineCashFlow, scenario: scenarioCashFlow,
      delta: deltaOf(baselineCashFlow, scenarioCashFlow), unit: 'INR', direction: direction(deltaOf(baselineCashFlow, scenarioCashFlow), true),
      evidence: [`Recorded monthly income: ₹${Math.round(income).toLocaleString('en-IN')}`, `Recorded current-month expenses: ₹${Math.round(expenses).toLocaleString('en-IN')}`, `Active EMI amounts: ₹${Math.round(monthlyEmi).toLocaleString('en-IN')}`],
      limitation: 'This is a counterfactual monthly calculation, not a forecast of future income or expenses.',
    },
    {
      key: 'commitment-load', label: 'Commitment-to-income ripple', baseline: baselineCommitment, scenario: scenarioCommitment,
      delta: deltaOf(baselineCommitment, scenarioCommitment), unit: 'percent', direction: direction(deltaOf(baselineCommitment, scenarioCommitment), false),
      evidence: [`Active recorded commitments: ${activeEmis.length}`, `Temporary added EMI: ₹${Math.round(Math.max(0, inputs.additionalMonthlyEmi)).toLocaleString('en-IN')}`],
      limitation: 'Internal descriptive ratio only; not lender affordability, eligibility or approval.',
    },
    {
      key: 'budget-headroom', label: 'Configured budget headroom ripple', baseline: baselineBudgetHeadroom, scenario: scenarioBudgetHeadroom,
      delta: deltaOf(baselineBudgetHeadroom, scenarioBudgetHeadroom), unit: 'INR', direction: direction(deltaOf(baselineBudgetHeadroom, scenarioBudgetHeadroom), true),
      evidence: [budget ? `Configured budget: ${budget.name}` : 'No current monthly budget is configured.'],
      limitation: 'Shown only when a current monthly budget exists; a user-configured budget is not an affordability decision.',
    },
    {
      key: 'savings-coverage', label: 'Savings-target coverage ripple', baseline: baselineSavingsCoverage, scenario: scenarioSavingsCoverage,
      delta: deltaOf(baselineSavingsCoverage, scenarioSavingsCoverage), unit: 'percent', direction: direction(deltaOf(baselineSavingsCoverage, scenarioSavingsCoverage), true),
      evidence: [savingsTarget == null ? 'No current savings target is configured.' : `Configured savings target: ₹${Math.round(savingsTarget).toLocaleString('en-IN')}`],
      limitation: 'Target coverage uses calculated cash-flow surplus; it does not prove money was actually saved.',
    },
    {
      key: 'data-readiness', label: 'Evidence readiness', baseline: readiness, scenario: readiness,
      delta: 0, unit: 'score', direction: 'unchanged',
      evidence: [`Income records: ${incomeSources.length}`, `Current-month expenses: ${expenseRows.length}`, `Budget configured: ${budget ? 'yes' : 'no'}`, `Active EMI records: ${activeEmis.length}`],
      limitation: 'Measures workspace coverage only, not financial health, creditworthiness or data accuracy.',
    },
  ];

  const rippleSummary = metrics.filter((metric) => metric.key !== 'data-readiness').map((metric) => {
    if (metric.delta == null) return `${metric.label}: Data needed`;
    if (metric.direction === 'unchanged') return `${metric.label}: no calculated change`;
    const sign = metric.delta > 0 ? '+' : '';
    const suffix = metric.unit === 'INR' ? ' INR' : metric.unit === 'percent' ? ' percentage points' : ' points';
    return `${metric.label}: ${sign}${metric.delta}${suffix} (${metric.direction})`;
  });

  const dataLimitations = [
    income <= 0 ? 'Recorded monthly income is missing or zero; income-relative metrics may be unavailable.' : '',
    expenseRows.length === 0 ? 'No current-month expense records are available; expense-based ripples are partial.' : '',
    !budget ? 'No current monthly budget is configured; budget headroom is unavailable.' : '',
    savingsTarget == null ? 'No current savings target is configured; savings-target coverage is unavailable.' : '',
  ].filter(Boolean);

  return {
    generatedAt: new Date().toISOString(), month, inputs,
    baseline: { income, expenses, monthlyEmi, budgetPlanned, savingsTarget },
    scenario: { income: scenarioIncome, expenses: scenarioExpenses, monthlyEmi: scenarioEmi, savingsTarget: scenarioSavingsTarget },
    metrics, rippleSummary, dataLimitations,
  };
}
