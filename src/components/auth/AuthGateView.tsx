import React from 'react';
import { ArrowLeft, ArrowRight, Languages, LineChart, LockKeyhole, PieChart, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ArthaBenchLogo } from '../branding/ArthaBenchLogo';
import { destinationForPath } from '../../appRoutes';
import './authModal.css';

type Props = {
  returnTo: string;
  onCancel: () => void;
  onEmail: () => void;
};

const PAGE_NAMES: Record<string, string> = {
  income: 'Income & tax', expenses: 'Expenses', budgeting: 'Budget', 'emi-manager': 'EMI & loans', 'finance-reports': 'Reports',
  'financial-health': 'Health score', 'decision-replay': 'What-if', 'financial-twin': 'Ripple Twin',
};

/** Shown when a private page is opened without an account: premium, clear, two choices. */
export const AuthGateView: React.FC<Props> = ({ returnTo, onCancel, onEmail }) => {
  const auth = useAuth();
  const dest = destinationForPath(returnTo);
  const page = (dest && PAGE_NAMES[dest]) || 'this page';
  return <div className="am-gate">
    <button type="button" onClick={onCancel} className="am-back"><ArrowLeft size={15}/> Back</button>
    <div className="am-card am-gate-card">
      <aside className="am-brand">
        <div className="am-glow" aria-hidden="true"/>
        <div className="am-brand-top"><ArthaBenchLogo compact onDark /><span className="am-pill"><ShieldCheck size={13}/> Private workspace</span></div>
        <div className="am-brand-mid">
          <h2>Your records stay private.<br/><em>Everything else stays open.</em></h2>
          <ul className="am-points">
            <li><span><PieChart size={16}/></span><div><b>Free without an account</b><small>Dashboard, portfolio, planner, markets, mutual funds, AI tutor and voice.</small></div></li>
            <li><span><LineChart size={16}/></span><div><b>With an account</b><small>Save income, expenses, budgets, EMIs and reports across devices.</small></div></li>
            <li><span><Languages size={16}/></span><div><b>Same AI CFO, your language</b><small>Ask about your own records by text or voice.</small></div></li>
          </ul>
        </div>
        <p className="am-brand-foot">Education only, not investment advice.</p>
      </aside>
      <section className="am-form">
        <div className="am-form-body am-gate-body">
          <span className="am-lock"><LockKeyhole size={22}/></span>
          <div className="am-heading">
            <h1>Sign in to open {page}</h1>
            <p>{page === 'this page' ? 'This page' : page} keeps your personal records, so it needs a free account. It takes under a minute.</p>
          </div>
          <div className="am-gate-actions">
            <button type="button" className="am-cta" onClick={onEmail} disabled={!auth.configured}><ArrowRight size={16}/> Sign in</button>
            <button type="button" className="am-ghost" onClick={() => auth.openAuth('signup')} disabled={!auth.configured}><UserPlus size={16}/> Create a free account</button>
            <button type="button" className="am-text" onClick={onCancel}>Not now, keep exploring</button>
          </div>
          {!auth.configured && <p className="am-note">Accounts are not available on this deployment right now. Public features still work.</p>}
          <p className="am-secure"><LockKeyhole size={13}/> Secure sign-in by Supabase Auth. Personal rows are visible only to your account.</p>
        </div>
      </section>
    </div>
  </div>;
};
