import { StructuredFinancialAnswer } from '../types';

export type DecisionReplayHorizon = 1 | 3 | 6 | 12;

export interface DecisionReplayChanges {
  monthlyIncomeDelta: number;
  expenseReductionPercent: number;
  additionalMonthlyExpense: number;
  newMonthlyEmi: number;
  savingsTargetDelta: number;
}

export interface DecisionReplaySnapshot {
  scenarioId: string;
  calculatedAt: string;
  month: string;
  horizonMonths: DecisionReplayHorizon;
  baseline: {
    monthlyIncome: number;
    recordedMonthlyExpenses: number;
    recordedNetCashFlow: number;
    activeMonthlyEmiCommitment: number;
    emiCommitmentRatioPercent: number | null;
    plannedBudget: number;
    budgetHeadroom: number | null;
    savingsTarget: number;
  };
  scenario: {
    monthlyIncome: number;
    monthlyExpenses: number;
    projectedMonthlyCashFlowAfterNewCommitment: number;
    activePlusNewMonthlyEmi: number;
    emiCommitmentRatioPercent: number | null;
    budgetHeadroom: number | null;
    savingsTarget: number;
  };
  impact: {
    monthlyCashFlowChange: number;
    horizonCashFlowChange: number;
  };
  dataBasis: {
    recurringIncomeSources: number;
    currentMonthExpenseRecords: number;
    budgetCategories: number;
    activeEmis: number;
    completeness: 'Low' | 'Medium' | 'High';
  };
  assumptions: string[];
  changes: DecisionReplayChanges;
}

export interface DecisionReplayResponse {
  replay: DecisionReplaySnapshot;
  structuredAnswer: StructuredFinancialAnswer | null;
  answer: string | null;
  disclaimer: string;
}

export async function runDecisionReplay(params: {
  token: string;
  horizonMonths: DecisionReplayHorizon;
  changes: DecisionReplayChanges;
  explain?: boolean;
}): Promise<DecisionReplayResponse> {
  const response = await fetch('/api/personal/decision-replay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      horizonMonths: params.horizonMonths,
      changes: params.changes,
      explain: params.explain === true,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Decision Replay failed (${response.status}).`);
  return payload as DecisionReplayResponse;
}
