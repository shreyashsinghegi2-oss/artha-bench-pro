import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Info, Lock, ShieldAlert } from 'lucide-react';
import { buildMoneyCheck } from '../../services/moneyCheck';
import { loadMoneyProfile, onMoneyProfileChange, type MoneyProfile } from '../../services/moneyProfile';
import { loadEmiRecords } from '../../services/emiStorage';
import { planLumpSum, PLANNER_ASSUMPTIONS, type BucketKey, type RiskComfort } from '../../services/moneyPlanner';
import type { AppNavigationDestination } from '../../navigationTypes';
import { inr, shortInr } from './CompleteDashboardView';
import './workspaceDash.css';

const HORIZONS: Array<[string, number]> = [['Within a year', 0.5], ['1–3 years', 2], ['3–5 years', 4], ['5–10 years', 7], ['10+ years', 12]];
const RISKS: Array<[RiskComfort, string, string]> = [
  ['low', 'Careful', 'I can’t watch the value drop much'],
  ['medium', 'Balanced', 'Some ups and downs are fine'],
  ['high', 'Growth', 'I can sit through big falls for growth'],
];
const QUICK = [100_000, 500_000, 1_000_000, 2_500_000];
const BUCKET_CLS: Record<BucketKey, string> = { emergency: 'c-teal', 'debt-prepay': 'c-red', 'tax-80c': 'c-indigo', 'tax-nps': 'c-violet', equity: 'c-green', debt: 'c-ink', gold: 'c-gold', liquid: 'c-teal' };

export const MoneyPlannerView: React.FC<{ onNavigate: (d: AppNavigationDestination) => void }> = ({ onNavigate }) => {
  const [profile, setProfile] = useState<MoneyProfile | null>(() => loadMoneyProfile());
  useEffect(() => onMoneyProfileChange(setProfile), []);
  const report = useMemo(() => { try { return profile ? buildMoneyCheck(profile) : null; } catch { return null; } }, [profile]);

  // Costliest recorded loan, used as the default for the debt question.
  const activeLoans = useMemo(() => loadEmiRecords().filter((l) => l.status === 'active'), []);
  const costliest = useMemo(() => activeLoans.filter((l) => l.annualInterestRate != null).sort((a, b) => (b.annualInterestRate ?? 0) - (a.annualInterestRate ?? 0))[0], [activeLoans]);
  // Recorded loans win over the setup estimate, matching the dashboard.
  const recordedEmi = activeLoans.reduce((s, l) => s + (l.emiAmount ?? 0), 0);
  const monthlyEmi = recordedEmi > 0 ? recordedEmi : profile?.monthlyEmi;

  const [amount, setAmount] = useState(500_000);
  const [horizon, setHorizon] = useState(7);
  const [risk, setRisk] = useState<RiskComfort>('medium');
  const [loanRate, setLoanRate] = useState<number | ''>(costliest?.annualInterestRate ?? '');
  const [loanLeft, setLoanLeft] = useState<number | ''>(costliest?.outstandingBalance ?? '');

  const plan = useMemo(() => planLumpSum({
    amount, horizonYears: horizon, risk,
    monthlyExpenses: profile?.monthlyExpenses, monthlyEmi, liquidSavings: profile?.liquidSavings,
    costliestLoanRate: loanRate === '' ? undefined : loanRate, costliestLoanOutstanding: loanLeft === '' ? undefined : loanLeft,
    taxRegime: report?.tax.better, section80CUsed: profile?.section80C, npsExtraUsed: profile?.npsExtra, termGap: report?.protection.termGap,
  }), [amount, horizon, risk, loanRate, loanLeft, profile, report, monthlyEmi]);

  const years = horizon < 1 ? 'a year' : `${horizon} years`;
  const num = (v: string) => (v.trim() === '' ? '' : Math.max(0, Number(v.replace(/[^\d.]/g, '')) || 0));

  return <div className="wd">
    <header className="wd-head">
      <div>
        <small className="wd-kicker">Planner</small>
        <h1>Have a lump sum? See where each rupee should go.</h1>
        <p>Bonus, maturity, sale proceeds or savings: the planner follows the order planners use (safety, costly debt, tax, then growth) and explains every step.</p>
      </div>
      <div className="wd-head-actions"><button type="button" className="wd-btn" onClick={() => onNavigate('my-dashboard')}>Back to dashboard</button></div>
    </header>

    <div className="wd-planner">
      <section className="wd-card wd-form" aria-label="Your situation">
        <label className="wd-field"><span>Amount you have</span>
          <div className="wd-money"><em>₹</em><input inputMode="numeric" value={amount ? amount.toLocaleString('en-IN') : ''} onChange={(e) => setAmount(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} aria-label="Amount in rupees"/></div>
          <div className="wd-chips">{QUICK.map((q) => <button key={q} type="button" className={amount === q ? 'on' : ''} onClick={() => setAmount(q)}>{shortInr(q)}</button>)}</div>
        </label>
        <fieldset className="wd-field"><legend>When might you need it?</legend>
          <div className="wd-seg">{HORIZONS.map(([label, v]) => <button key={label} type="button" className={horizon === v ? 'on' : ''} onClick={() => setHorizon(v)}>{label}</button>)}</div>
        </fieldset>
        <fieldset className="wd-field"><legend>How do you feel about ups and downs?</legend>
          <div className="wd-risk">{RISKS.map(([id, label, line]) => <button key={id} type="button" className={risk === id ? 'on' : ''} onClick={() => setRisk(id)}><b>{label}</b><small>{line}</small></button>)}</div>
        </fieldset>
        <fieldset className="wd-field"><legend>Costliest loan (optional)</legend>
          <div className="wd-two">
            <label><small>Interest % a year</small><input inputMode="decimal" value={loanRate} placeholder="e.g. 14" onChange={(e) => setLoanRate(num(e.target.value))}/></label>
            <label><small>Amount left (₹)</small><input inputMode="numeric" value={loanLeft === '' ? '' : loanLeft.toLocaleString('en-IN')} placeholder="e.g. 1,50,000" onChange={(e) => setLoanLeft(num(e.target.value))}/></label>
          </div>
          {costliest && <small className="wd-hint">Filled from your EMI records: {costliest.name || costliest.loanType}.</small>}
        </fieldset>
        <p className="wd-hint"><Info size={13}/> {profile ? `Using your setup: expenses ${inr(profile.monthlyExpenses)}/mo, EMI ${inr(monthlyEmi ?? 0)}/mo, cash ${shortInr(profile.liquidSavings)}, ${report?.tax.better === 'old' ? 'old' : report?.tax.better === 'new' ? 'new' : 'either'} tax regime.` : 'Set up your money profile to include your emergency fund and tax situation.'}</p>
        {!profile && <button type="button" className="wd-link" onClick={() => onNavigate('overview')}>Set up in two minutes <ArrowRight size={13}/></button>}
      </section>

      <section className="wd-plan" aria-live="polite" aria-label="Your plan">
        <div className="wd-tiles four">
          <article className="wd-tile"><header><small>Planned</small></header><b>{shortInr(plan.allocated)}</b><span className="wd-tile-sub">{plan.buckets.length} steps</span></article>
          <article className="wd-tile good"><header><small>Could grow to</small></header><b>{shortInr(plan.projectedValue)}</b><span className="wd-tile-sub">in {years}, at the assumed returns</span></article>
          <article className="wd-tile"><header><small>Tax saved</small></header><b>{shortInr(plan.taxSaved)}</b><span className="wd-tile-sub">{plan.taxSaved ? 'this year, old regime' : 'no extra tax benefit'}</span></article>
          <article className="wd-tile"><header><small>Interest avoided</small></header><b>{shortInr(plan.interestSavedPerYear)}</b><span className="wd-tile-sub">per year by prepaying</span></article>
        </div>

        <article className="wd-card">
          <header><h2>Your split</h2><small>{risk === 'low' ? 'Careful' : risk === 'medium' ? 'Balanced' : 'Growth'} · money needed in {years}</small></header>
          <div className="wd-bar big" role="img" aria-label={plan.buckets.map((b) => `${b.label} ${inr(b.amount)}`).join(', ')}>{plan.buckets.map((b) => <i key={b.key} className={BUCKET_CLS[b.key]} style={{ width: `${b.share}%` }} title={`${b.label} ${b.share}%`}/>)}</div>
          <ol className="wd-steps">{plan.buckets.map((b, i) => <li key={b.key}>
            <span className={`wd-step-n ${BUCKET_CLS[b.key]}`}>{i + 1}</span>
            <div className="wd-step-body">
              <header><b>{b.label}</b><em>{inr(b.amount)} · {b.share}%</em></header>
              <p className="wd-step-inst">{b.instrument}{b.lockIn && <span className="wd-lock"><Lock size={11}/> {b.lockIn}</span>}</p>
              <p>{b.why}</p>
              <small>{b.key === 'debt-prepay' ? `Saves ${b.assumedReturn}% a year` : `Assumed return ${b.assumedReturn}% a year`}</small>
            </div>
          </li>)}</ol>
          {!plan.buckets.length && <p className="wd-note">Enter an amount to see a plan.</p>}
          {plan.notes.map((n) => <p key={n} className="wd-alert"><ShieldAlert size={14}/> {n}</p>)}
        </article>
        <p className="wd-foot">Assumed yearly returns: equity {PLANNER_ASSUMPTIONS.returns.equity}%, debt {PLANNER_ASSUMPTIONS.returns.debt}%, gold {PLANNER_ASSUMPTIONS.returns.gold}%, liquid {PLANNER_ASSUMPTIONS.returns.liquid}%, PPF {PLANNER_ASSUMPTIONS.returns.ppf}%. Markets do not move in straight lines; this is education, not personalised investment advice.</p>
      </section>
    </div>
  </div>;
};
