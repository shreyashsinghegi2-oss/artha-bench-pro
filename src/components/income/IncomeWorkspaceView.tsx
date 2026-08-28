import React, { useMemo, useRef, useState } from 'react';
import { Bot } from 'lucide-react';
import { IncomeView } from './IncomeView';
import { IncomeAIAssistant } from './IncomeAIAssistant';
import { loadIncomeSources, summarizeIncomeByCurrency } from '../../services/incomeStorage';
import { calculateIndiaTaxEstimate, compareTaxRegimes } from '../../services/indiaTaxEngine';
import { loadTaxWorkspace } from '../../services/taxWorkspaceStorage';

export const IncomeWorkspaceView: React.FC = () => {
  const [revision, setRevision] = useState(0);
  const assistantRef = useRef<HTMLDivElement>(null);

  const snapshot = useMemo(() => {
    const sources = loadIncomeSources();
    const taxWorkspace = loadTaxWorkspace();
    const summaries = summarizeIncomeByCurrency(sources);
    const taxComparison = compareTaxRegimes(
      sources,
      taxWorkspace.profile,
      taxWorkspace.deductions,
      taxWorkspace.credits,
    );
    const taxEstimate = calculateIndiaTaxEstimate(
      sources,
      taxWorkspace.profile,
      taxWorkspace.deductions,
      taxWorkspace.credits,
    );

    return { sources, taxWorkspace, summaries, taxComparison, taxEstimate };
  }, [revision]);

  const refreshAfterInteraction = () => {
    queueMicrotask(() => setRevision((current) => current + 1));
  };

  const openIncomeForm = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => {
      const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
        /add income source/i.test(candidate.textContent || ''),
      ) as HTMLButtonElement | undefined;
      button?.click();
    }, 350);
  };

  return (
    <div onClickCapture={refreshAfterInteraction} onChangeCapture={refreshAfterInteraction}>
      <IncomeView />

      <div ref={assistantRef} className="mx-auto max-w-[1500px] px-4 pb-10 sm:px-6">
        <IncomeAIAssistant
          sources={snapshot.sources}
          summaries={snapshot.summaries}
          taxWorkspace={snapshot.taxWorkspace}
          taxEstimate={snapshot.taxEstimate}
          taxComparison={snapshot.taxComparison}
          onAddIncomeSource={openIncomeForm}
        />
      </div>

      <button
        type="button"
        onClick={() => assistantRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="fixed bottom-5 right-5 z-40 inline-flex min-h-12 items-center gap-2 rounded-2xl border border-interactive/25 bg-interactive px-4 py-3 text-sm font-black text-white shadow-lg transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-interactive focus:ring-offset-2 focus:ring-offset-canvas"
        aria-label="Open Artha Income AI assistant"
      >
        <Bot className="h-5 w-5" />
        <span className="hidden sm:inline">Ask Artha Income AI</span>
      </button>
    </div>
  );
};
