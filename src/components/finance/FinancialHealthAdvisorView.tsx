import React, { useMemo } from 'react';
import { AppNavigationDestination } from '../../navigationTypes';
import { buildFinancialHealthSnapshot } from '../../services/financialHealth';
import { EmbeddedFinanceAdvisor } from './EmbeddedFinanceAdvisor';
import { FinancialHealthView } from './FinancialHealthView';

type Props = { onNavigate: (destination: AppNavigationDestination) => void };

export const FinancialHealthAdvisorView: React.FC<Props> = ({ onNavigate }) => {
  const snapshot = useMemo(() => buildFinancialHealthSnapshot(6), []);
  const evidence = useMemo<Record<string, unknown>>(() => ({
    calculatedAt: snapshot.calculatedAt,
    period: snapshot.periodLabel,
    composite: snapshot.composite,
    compositeStatus: snapshot.compositeStatus,
    compositeReason: snapshot.compositeReason,
    dataCompleteness: snapshot.dataCompleteness,
    dimensions: snapshot.dimensions.map((item) => ({
      name: item.name,
      score: item.score,
      status: item.status,
      weight: item.weight,
      interpretation: item.interpretation,
      calculation: item.calculation,
      evidence: item.evidence,
      limitations: item.limitations,
    })),
    monthlyRecordedPoints: snapshot.monthPoints,
    budgetPressure: snapshot.budgetPressure,
    boundary: 'Artha Financial Health Indicator is a deterministic workspace indicator. It is not a credit score, CIBIL score, lender assessment, approval, eligibility decision or prediction.',
  }), [snapshot]);

  return <>
    <FinancialHealthView onNavigate={onNavigate} />
    <div className="mx-auto max-w-[1500px] px-4 pb-7 sm:px-6">
      <EmbeddedFinanceAdvisor
        module="financial-health"
        title="Financial Health Advisor"
        description="Ask ArthaMind to explain your calculated health dimensions, identify the recorded evidence behind a weak or strong signal, highlight missing data, and suggest safe review actions inside your workspace. It cannot change the score or turn it into a credit/lending assessment."
        questions={[
          'Explain my Financial Health Profile in simple language.',
          'Which dimensions are driving my current health result?',
          'What recorded data is missing or weakening this analysis?',
          'What can I review inside Artha Bench to understand this score better?',
        ]}
        responseSections={['Overall signal', 'What is driving it', 'Recorded evidence', 'Data gaps', 'Useful review actions', 'Limits of this insight']}
        evidence={evidence}
        evidenceNote="Uses the same deterministic seven-dimension Financial Health snapshot displayed by Artha Bench. The advisor explains the result; it does not calculate an alternative score or infer creditworthiness."
      />
    </div>
  </>;
};
