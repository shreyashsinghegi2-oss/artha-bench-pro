import React from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

export const EmiPrivacyPanel: React.FC = () => (
  <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
    <details>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-interactive">
        <div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-interactive" /><div><div className="text-[10px] font-black uppercase tracking-wider text-interactive">Data, consent and privacy</div><h2 className="mt-1 text-lg font-black text-ink">How EMI Intelligence handles finance data</h2></div></div>
        <span className="rounded-full border border-line bg-canvas px-3 py-1 text-[9px] font-black text-secondary">Expand</span>
      </summary>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Info title="What is used" text="Recorded income context, expense records, budgets, user-entered or user-confirmed EMI records, explicit payment confirmations, reviewed imports, and temporary scenario assumptions when you choose to run them." />
        <Info title="Why it is used" text="To calculate descriptive commitment ratios, schedules, cash-flow context, planning indicators, calendar views, evidence quality, and counterfactual scenarios inside your private workspace." />
        <Info title="How sources are labelled" text="Manual, imported, detected, calculated/estimated, or externally reported when a real supported provider supplies that state. Detected transactions stay unconfirmed until you review them." />
        <Info title="Connected data and consent" text="Financial-account data requires an actual supported integration plus explicit consent. A future consent flow must be granular, time-bound where applicable, display its state/expiry, and allow revocation or disconnect." />
        <Info title="What you can control" text="Review or reject detected commitments, disconnect future integrations, change reminder preferences, edit/delete workspace records through the existing product controls, and verify uncertain fields before saving." />
        <Info title="Final authority" text="Your lender or official financial institution remains the final authority for contracted EMI amount, balance, due date, fees, repayment status, foreclosure terms and settlement status." />
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning-fill/20 bg-warning-soft p-3 text-[10px] leading-5 text-secondary"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><span>Never share net-banking passwords, OTPs, UPI PINs, ATM PINs, CVVs or full card numbers in Artha Bench. Artha Bench does not execute loan payments or auto-pay EMIs and does not claim RBI/Account-Aggregator compliance unless an actual production integration has completed the relevant requirements.</span></div>
    </details>
  </section>
);

const Info: React.FC<{ title: string; text: string }> = ({ title, text }) => <article className="rounded-2xl border border-line bg-canvas p-4"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">{title}</div><p className="mt-2 text-[10px] leading-5 text-secondary">{text}</p></article>;
