import React from 'react';
import { LockKeyhole } from 'lucide-react';
import { ArthaMindLogo } from './ArthaMindLogo';

export const IntelligenceFlow: React.FC = () => (
  <section className="border-y border-white/10 bg-[#07101C] py-20 sm:py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">ArthaMind intelligence layer</div>
        <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">From market signals to an answer you can inspect.</h2>
        <p className="mt-4 text-sm leading-7 text-slate-400">ArthaMind keeps public information, optional personal context and AI reasoning visibly separate before an answer reaches your workspace.</p>
      </div>

      <div className="artha-flow-grid relative mt-10 grid gap-4 lg:grid-cols-[1fr_.9fr_1fr] lg:items-center">
        <FlowCard title="Public Market Context" subtitle="Shared market and economic signals">
          <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-400">
            {['India', 'US', 'Gold', 'Crypto', 'Economy'].map((item) => <div key={item} className="rounded-lg border border-white/10 bg-black/10 px-2.5 py-2">{item}</div>)}
          </div>
          <svg viewBox="0 0 170 32" className="mt-4 h-8 w-full text-sky-300" aria-hidden="true"><path className="artha-flow-spark" d="M2 25 C28 18, 39 27, 57 14 S86 21, 110 10 S140 15, 168 5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
        </FlowCard>

        <div className="relative">
          <div className="artha-reasoning-card rounded-[26px] border border-emerald-300/20 bg-emerald-300/[0.05] p-6 text-center">
            <ArthaMindLogo className="mx-auto h-24 w-24" />
            <div className="mt-3 text-sm font-black">ArthaMind Reasoning</div>
            <div className="mt-4 space-y-2 text-left text-[10px] text-slate-400">
              {['Collect context', 'Show assumptions', 'Explain answer'].map((step, index) => <div key={step} className={`artha-reason-step step-${index + 1} rounded-lg border border-white/10 bg-black/10 px-3 py-2`}>{index + 1}. {step}</div>)}
            </div>
          </div>
          <div className="artha-flow-signal hidden lg:block" />
        </div>

        <FlowCard title="Inspectable Output" subtitle="AI output with visible boundaries">
          <div className="space-y-2 text-[10px]">
            {['Evidence', 'Sources', 'Verification needed'].map((item, index) => <div key={item} className={`artha-output-row output-${index + 1} flex items-center justify-between rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-slate-400`}><span>{item}</span><span className="text-slate-600">Visible</span></div>)}
          </div>
        </FlowCard>

        <div className="lg:col-start-2">
          <div className="artha-optin-flow rounded-2xl border border-dashed border-white/15 bg-[#050B14] p-4">
            <div className="flex items-center justify-between gap-4">
              <div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Optional Personal Context</div><div className="mt-1 text-[9px] text-slate-600">Income • Expenses • Budget • Goals</div></div>
              <LockKeyhole className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-3 flex items-center justify-between text-[9px]"><span className="text-slate-600">Only categories you turn on</span><span className="artha-optin-switch rounded-full border border-white/10 px-2.5 py-1 font-black uppercase tracking-[0.12em] text-slate-500">Opt-in off</span></div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const FlowCard: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5">
    <div className="text-xs font-black text-slate-100">{title}</div>
    <div className="mt-1 text-[9px] text-slate-600">{subtitle}</div>
    <div className="mt-4">{children}</div>
  </div>
);
