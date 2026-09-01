import React from 'react';
import { ArrowRight, BrainCircuit, ShieldCheck, Sparkles } from 'lucide-react';
import { AppNavigationDestination } from '../../navigationTypes';
import { openFinanceAdvisor } from '../../services/financeAdvisorEvents';

type Props = {
  module: AppNavigationDestination;
  title: string;
  description: string;
  questions: string[];
  evidenceNote?: string;
};

export const EmbeddedFinanceAdvisor: React.FC<Props> = ({ module, title, description, questions, evidenceNote }) => (
  <section className="rounded-3xl border border-interactive/20 bg-surface p-5 shadow-sm sm:p-6" aria-labelledby={`${module}-advisor-title`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-interactive"><BrainCircuit className="h-4 w-4" /> ArthaMind AI Financial Advisor</div>
        <h2 id={`${module}-advisor-title`} className="mt-2 text-xl font-black text-ink">{title}</h2>
        <p className="mt-2 text-xs leading-5 text-secondary">{description}</p>
      </div>
      <button type="button" onClick={() => openFinanceAdvisor({ module })} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive">
        <Sparkles className="h-4 w-4" /> Open advisor
      </button>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      {questions.map((question) => <button key={question} type="button" onClick={() => openFinanceAdvisor({ module, question })} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-2 text-left text-[10px] font-bold text-secondary transition hover:border-interactive/35 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-interactive">{question}<ArrowRight className="h-3 w-3" /></button>)}
    </div>
    <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-canvas p-3 text-[9px] leading-4 text-secondary"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /><span>{evidenceNote ?? 'Advisor answers are grounded in the finance categories you explicitly enabled. Recorded facts and deterministic calculations remain the numerical source of truth; AI interpretation cannot edit your records.'}</span></div>
  </section>
);
