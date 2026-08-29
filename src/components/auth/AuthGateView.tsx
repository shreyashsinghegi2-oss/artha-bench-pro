import React from 'react';
import { ArrowLeft, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ArthaBenchLogo } from '../branding/ArthaBenchLogo';

type Props = {
  returnTo: string;
  onCancel: () => void;
  onEmail: () => void;
};

export const AuthGateView: React.FC<Props> = ({ returnTo, onCancel, onEmail }) => {
  const auth = useAuth();

  return (
    <div className="min-h-screen bg-canvas px-4 py-10 text-ink sm:px-6">
      <div className="mx-auto max-w-5xl">
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-secondary hover:bg-surface hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to public overview
        </button>

        <div className="mt-6 grid overflow-hidden rounded-[30px] border border-line bg-surface shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
          <section className="border-b border-line bg-[#07111F] p-7 text-white lg:border-b-0 lg:border-r lg:p-10">
            <ArthaBenchLogo compact />
            <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-teal-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Private workspace
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight">Your public tools stay open. Your personal records stay private.</h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">You can explore Overview, markets, learning and AI-reliability tools without an account. Sign-in is required only when you want to save or view personal finance records.</p>
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs leading-6 text-slate-300">
              <div className="flex items-center gap-2 font-black text-white"><LockKeyhole className="h-4 w-4 text-teal-300" /> Intended destination</div>
              <div className="mt-1 break-all text-slate-400">{returnTo}</div>
            </div>
          </section>

          <section className="p-7 lg:p-10">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-brand">Artha Bench Pro</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Sign in to save and view your private financial workspace.</h2>
            <p className="mt-3 text-sm leading-6 text-secondary">Your income, expenses, budgets, EMIs and personal reports are stored in your own authenticated account.</p>

            <div className="mt-7 space-y-3">
              <button type="button" onClick={onEmail} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brand-hover">
                <Mail className="h-4 w-4" /> Continue with email
              </button>
              <button type="button" onClick={onCancel} className="w-full rounded-xl border border-line px-4 py-3 text-sm font-bold text-secondary hover:bg-canvas hover:text-ink">
                Not now / Cancel
              </button>
            </div>

            <p className="mt-6 text-[10px] leading-5 text-secondary">Public tools work without an account. Personal workspace data is private and may be used as AI context only when you enable the relevant category.</p>
          </section>
        </div>
      </div>
    </div>
  );
};
