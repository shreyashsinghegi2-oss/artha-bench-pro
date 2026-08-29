import React from 'react';
import {
  ArrowRight,
  CalendarClock,
  FileBarChart2,
  GraduationCap,
  Landmark,
  LineChart,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { AppNavigationDestination } from '../../navigationTypes';

type Props = {
  onSignIn: () => void;
  onNavigate: (destination: AppNavigationDestination) => void;
};

const capabilities = [
  {
    icon: WalletCards,
    title: 'Track income',
    text: 'Record the income sources you choose to add to your private workspace.',
  },
  {
    icon: ReceiptText,
    title: 'Understand spending',
    text: 'Organize your own expense records by category, date, merchant and payment method.',
  },
  {
    icon: Landmark,
    title: 'Plan budgets',
    text: 'Create monthly plans and compare them only with expenses you have actually recorded.',
  },
  {
    icon: CalendarClock,
    title: 'Track EMI commitments',
    text: 'Keep your own instalment schedule and payment status together with the rest of your workspace.',
  },
  {
    icon: FileBarChart2,
    title: 'Generate private reports',
    text: 'Build reports from your authenticated records without substituting fictional transactions.',
  },
];

export const PublicFinanceOverview: React.FC<Props> = ({ onSignIn, onNavigate }) => (
  <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-7 sm:px-6 sm:py-9">
    <section className="relative overflow-hidden rounded-[30px] border border-line bg-surface p-6 shadow-sm sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-interactive/5 blur-3xl" aria-hidden="true" />
      <div className="relative grid gap-8 lg:grid-cols-[1.25fr_.75fr] lg:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-success-fill/25 bg-success-soft px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-success">
            <ShieldCheck className="h-3.5 w-3.5" /> Private when you sign in
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-ink sm:text-4xl">Financial Workspace</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary sm:text-base">
            Understand income, spending, budgets and EMI commitments in one private workspace.
          </p>
          <p className="mt-4 max-w-3xl text-xs leading-6 text-secondary">
            Your personal records appear here after you sign in and add them. Artha Bench does not create or infer financial records for you.
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive"
            >
              <LockKeyhole className="h-4 w-4" /> Sign in to create your workspace
            </button>
            <button
              type="button"
              onClick={() => onNavigate('markets')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-canvas px-5 py-3 text-sm font-bold text-ink transition hover:border-interactive/40 hover:bg-subtle"
            >
              <LineChart className="h-4 w-4 text-interactive" /> Explore market intelligence
            </button>
            <button
              type="button"
              onClick={() => onNavigate('learning')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-bold text-secondary transition hover:text-ink"
            >
              <GraduationCap className="h-4 w-4" /> Learn financial basics
            </button>
          </div>
        </div>

        <aside className="rounded-2xl border border-line bg-canvas p-5">
          <div className="flex items-center gap-2 text-xs font-black text-ink">
            <ShieldCheck className="h-4 w-4 text-success" /> Public vs private
          </div>
          <div className="mt-4 space-y-3 text-[11px] leading-5 text-secondary">
            <p><strong className="text-ink">Open without an account:</strong> market research, crypto, learning and AI reliability tools.</p>
            <p><strong className="text-ink">Sign-in required:</strong> income, expenses, budgets, EMIs, personal reports and private AI context.</p>
            <p className="rounded-xl border border-success-fill/20 bg-success-soft p-3 text-success">Personal records are isolated to your authenticated account and are not mixed with public market data.</p>
          </div>
        </aside>
      </div>
    </section>

    <section aria-labelledby="finance-capabilities-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-interactive">What the workspace helps you do</div>
          <h2 id="finance-capabilities-title" className="mt-1 text-2xl font-black tracking-tight text-ink">Start with your records, not sample data.</h2>
        </div>
        <button type="button" onClick={onSignIn} className="inline-flex items-center gap-1.5 text-xs font-black text-interactive hover:underline">
          Create a private workspace <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {capabilities.map(({ icon: Icon, title, text }) => (
          <article key={title} className="min-h-44 rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-subtle text-interactive">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-black text-ink">{title}</h3>
            <p className="mt-2 text-[11px] leading-5 text-secondary">{text}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-black text-ink">Ready when you are.</div>
        <p className="mt-1 text-xs leading-5 text-secondary">Sign in only when you want to save or view private financial records. Public research stays available without an account.</p>
      </div>
      <button type="button" onClick={onSignIn} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-white hover:bg-brand-hover">
        Sign in securely <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </section>
  </div>
);
