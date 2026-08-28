import React from 'react';
import { NavigationDestination } from '../../types';
import { FinancialResearchWorkspace } from './FinancialResearchWorkspace';

type Props = {
  onEnter: (destination?: NavigationDestination) => void;
};

export const IntelligenceFlow: React.FC<Props> = ({ onEnter }) => (
  <section className="border-y border-slate-200 bg-[#F7F8F6] py-20 text-slate-900 sm:py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700">ARTHAMIND INTELLIGENCE LAYER</div>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">From market signals to an answer you can inspect.</h2>
        <p className="mt-4 text-sm leading-7 text-slate-600">ArthaMind keeps public information, optional personal context and AI reasoning visibly separate before an answer reaches your workspace.</p>
      </div>

      <div className="mx-auto mt-10 max-w-[1080px]">
        <FinancialResearchWorkspace onEnter={onEnter} />
      </div>
    </div>
  </section>
);
