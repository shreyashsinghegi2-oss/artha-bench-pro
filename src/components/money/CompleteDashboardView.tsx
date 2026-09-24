import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BadgeIndianRupee, CalendarClock, Coins, Gauge, Landmark, PiggyBank, ReceiptText, ShieldCheck, Sparkles, Target, TrendingUp, Wallet } from 'lucide-react';
import { SAMPLE_MONEY_CHECK } from '../../services/moneyCheck';
import { loadMoneyProfile, onMoneyProfileChange, saveMoneyProfile, type MoneyProfile } from '../../services/moneyProfile';
import { buildCompleteDashboard, type Figure, type FigureSource } from '../../services/completeDashboard';
import { EMI_RECORDS_CHANGED_EVENT, loadEmiRecords } from '../../services/emiStorage';
import { loadIncomeSources } from '../../services/incomeStorage';
import { loadExpenses } from '../../services/personalFinanceStorage';
import type { AppNavigationDestination } from '../../navigationTypes';
import './workspaceDash.css';

/** ₹ with Indian grouping, or a short lakh/crore form for tiles. */
export const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
export const shortInr = (v: number) => {
  const a = Math.abs(v), sign = v < 0 ? '−' : '';
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(a >= 1e9 ? 0 : 2)} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(a >= 1e7 ? 0 : 1)} L`;
  return `${sign}₹${Math.round(a).toLocaleString('en-IN')}`;
};
const pct = (v: number) => `${Math.round(v * 100)}%`;
const SOURCE: Record<FigureSource, string> = { profile: 'From your setup', loans: 'From your EMI records', income: 'From your income records', expenses: 'From your expenses', calculated: 'Calculated' };

const Tile: React.FC<{ icon: React.ReactNode; label: string; fig: Figure; sub?: string; tone?: 'good' | 'warn' | 'bad' }> = ({ icon, label, fig, sub, tone }) =>
  <article className={`wd-tile ${tone ?? ''}`}>
    <header><span className="wd-tile-ico">{icon}</span><small>{label}</small></header>
    <b>{shortInr(fig.value)}</b>
    <span className="wd-tile-sub">{sub ?? SOURCE[fig.source]}</span>
  </article>;

const Bar: React.FC<{ parts: Array<{ label: string; value: number; cls: string }> }> = ({ parts }) => {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  return <div className="wd-bar-wrap">
    <div className="wd-bar" role="img" aria-label={parts.map((p) => `${p.label} ${inr(p.value)}`).join(', ')}>
      {parts.map((p) => <i key={p.label} className={p.cls} style={{ width: `${(Math.max(0, p.value) / total) * 100}%` }}/>)}
    </div>
    <ul className="wd-legend">{parts.map((p) => <li key={p.label}><i className={p.cls}/>{p.label}<b>{inr(p.value)}</b></li>)}</ul>
  </div>;
};

const Meter: React.FC<{ value: number; label: string; tone?: 'good' | 'warn' | 'bad' }> = ({ value, label, tone = 'good' }) =>
  <div className={`wd-meter ${tone}`}><span><i style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}/></span><small>{label}</small></div>;

export const CompleteDashboardView: React.FC<{ onNavigate: (d: AppNavigationDestination) => void }> = ({ onNavigate }) => {
  const [profile, setProfile] = useState<MoneyProfile | null>(() => loadMoneyProfile());
  const [tick, setTick] = useState(0);
  useEffect(() => onMoneyProfileChange(setProfile), []);
  useEffect(() => { const on = () => setTick((t) => t + 1); window.addEventListener(EMI_RECORDS_CHANGED_EVENT, on); window.addEventListener('storage', on); return () => { window.removeEventListener(EMI_RECORDS_CHANGED_EVENT, on); window.removeEventListener('storage', on); }; }, []);

  const d = useMemo(() => {
    if (!profile) return null;
    try { return buildCompleteDashboard({ profile, loans: loadEmiRecords(), income: loadIncomeSources(), expenses: loadExpenses() }); } catch { return null; }
  }, [profile, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  if (!profile || !d) {
    return <div className="wd">
      <header className="wd-head"><div><small className="wd-kicker">Dashboard</small><h1>Everything about your money, on one page.</h1><p>Net worth, investments, savings, tax, loans and EMIs, health score, goals and insurance, together. Set up once and it fills in.</p></div></header>
      <section className="wd-empty">
        <button type="button" className="wd-empty-card primary" onClick={() => onNavigate('overview')}><Sparkles size={20}/><b>Set up in about two minutes</b><span>A few simple questions, or scan a payslip.</span><em>Start <ArrowRight size={14}/></em></button>
        <button type="button" className="wd-empty-card" onClick={() => saveMoneyProfile({ ...SAMPLE_MONEY_CHECK, source: 'sample', updatedAt: new Date().toISOString() })}><Gauge size={20}/><b>See it with a sample profile</b><span>Explore the full dashboard, then replace it with your numbers.</span><em>Show sample <ArrowRight size={14}/></em></button>
      </section>
    </div>;
  }

  const r = d.report;
  const emiLoad = d.monthlyTakeHome.value > 0 ? d.monthlyEmi.value / d.monthlyTakeHome.value : 0;
  const healthTone = r.health.score >= 70 ? 'good' : r.health.score >= 45 ? 'warn' : 'bad';
  const emergencyRatio = r.emergency.target > 0 ? Math.min(1, profile.liquidSavings / r.emergency.target) : 1;
  const actions = r.actions.slice(0, 4);

  return <div className="wd">
    <header className="wd-head">
      <div>
        <small className="wd-kicker">Dashboard</small>
        <h1>{profile.name ? `${profile.name}, here is everything at a glance.` : 'Everything at a glance.'}</h1>
        <p>As of {today} · {profile.source === 'sample' ? 'sample profile' : 'your numbers'} · saved on this device only</p>
      </div>
      <div className="wd-head-actions">
        <button type="button" className="wd-btn" onClick={() => onNavigate('overview')}>Update numbers</button>
        <button type="button" className="wd-btn primary" onClick={() => onNavigate('money-planner')}><Coins size={15}/> Plan a lump sum</button>
      </div>
    </header>

    <section className="wd-tiles" aria-label="Key figures">
      <Tile icon={<TrendingUp size={15}/>} label="Net worth" fig={d.netWorth} sub="Cash + investments − loans" tone={d.netWorth.value >= 0 ? 'good' : 'bad'}/>
      <Tile icon={<PiggyBank size={15}/>} label="Total investments" fig={d.totalInvestments}/>
      <Tile icon={<Wallet size={15}/>} label="Cash & savings" fig={d.totalSavings} sub={`${r.emergency.months === Infinity ? '—' : r.emergency.months.toFixed(1)} months of expenses`}/>
      <Tile icon={<Landmark size={15}/>} label="Loans outstanding" fig={d.totalDebt} tone={d.totalDebt.value > 0 ? 'warn' : 'good'}/>
      <Tile icon={<BadgeIndianRupee size={15}/>} label="Annual income" fig={d.annualIncome}/>
      <Tile icon={<ReceiptText size={15}/>} label="Tax this year" fig={d.taxThisYear} sub={`${r.tax.better === 'same' ? 'Either regime' : `${r.tax.better === 'new' ? 'New' : 'Old'} regime`} · ${(d.effectiveTaxRate * 100).toFixed(1)}% effective`}/>
      <Tile icon={<CalendarClock size={15}/>} label="Monthly EMI" fig={d.monthlyEmi} sub={`${pct(emiLoad)} of take-home`} tone={emiLoad > 0.4 ? 'bad' : emiLoad > 0.3 ? 'warn' : undefined}/>
      <article className={`wd-tile wd-health ${healthTone}`}>
        <header><span className="wd-tile-ico"><Gauge size={15}/></span><small>Health score</small></header>
        <div className="wd-ring" style={{ '--p': r.health.score / 100 } as React.CSSProperties}><b>{r.health.score}</b></div>
        <span className="wd-tile-sub">{r.health.status}</span>
      </article>
    </section>

    <section className="wd-grid three">
      <article className="wd-card">
        <header><h2>Monthly cash flow</h2><small>Take-home {inr(d.monthlyTakeHome.value)}</small></header>
        <Bar parts={[{ label: 'Living expenses', value: d.monthlyExpenses.value, cls: 'c-ink' }, { label: 'EMIs', value: d.monthlyEmi.value, cls: 'c-amber' }, { label: 'Left to save', value: Math.max(0, d.monthlySurplus.value), cls: 'c-green' }]}/>
        <p className="wd-note">Savings rate <b>{pct(Math.max(0, r.cashflow.savingsRate))}</b>{d.monthlySurplus.value < 0 ? ' · spending more than take-home' : ''}</p>
      </article>
      <article className="wd-card">
        <header><h2>Balance sheet</h2><small>Net worth {shortInr(d.netWorth.value)}</small></header>
        <Bar parts={[{ label: 'Cash & savings', value: d.totalSavings.value, cls: 'c-teal' }, { label: 'Investments', value: d.totalInvestments.value, cls: 'c-green' }, { label: 'Loans', value: d.totalDebt.value, cls: 'c-red' }]}/>
        <p className="wd-note">Runway <b>{Number.isFinite(r.runwayMonths) ? `${r.runwayMonths.toFixed(1)} months` : '—'}</b> if income stopped today</p>
      </article>
      <article className="wd-card">
        <header><h2>Tax · FY 2025-26</h2><small>Estimated from salary and deductions</small></header>
        <div className="wd-tax">
          {([['Old regime', r.tax.oldRegimeTax, r.tax.better === 'old'], ['New regime', r.tax.newRegimeTax, r.tax.better === 'new']] as const).map(([label, v, win]) =>
            <div key={label} className={win ? 'win' : ''}><span>{label}</span><i><b style={{ width: `${(v / Math.max(r.tax.oldRegimeTax, r.tax.newRegimeTax, 1)) * 100}%` }}/></i><em>{inr(v)}</em></div>)}
        </div>
        <p className="wd-note">{r.tax.better === 'same' ? 'Both regimes cost the same.' : <>The {r.tax.better} regime saves <b>{inr(r.tax.saving)}</b> a year.</>}</p>
        <button type="button" className="wd-link" onClick={() => onNavigate('income')}>Income & tax details <ArrowRight size={13}/></button>
      </article>
    </section>

    <section className="wd-grid three">
      <article className="wd-card">
        <header><h2>Loans & EMIs</h2><small>{d.loans.length ? `${d.loans.length} active` : 'From your setup'}</small></header>
        {d.loans.length
          ? <table className="wd-table"><thead><tr><th>Loan</th><th>EMI</th><th>Left</th><th>Rate</th></tr></thead><tbody>
              {d.loans.slice(0, 5).map((l) => <tr key={l.name + l.nextDue}><td>{l.name}<small>{l.nextDue ? `Next ${new Date(l.nextDue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : l.type}</small></td><td>{inr(l.emi)}</td><td>{shortInr(l.outstanding)}</td><td>{l.rate != null ? `${l.rate}%` : '—'}</td></tr>)}
            </tbody></table>
          : <p className="wd-note">EMI {inr(d.monthlyEmi.value)} a month · {shortInr(d.totalDebt.value)} outstanding. Add each loan to track due dates and interest.</p>}
        <Meter value={emiLoad / 0.5} label={`EMI load ${pct(emiLoad)} of take-home (keep under 30–40%)`} tone={emiLoad > 0.4 ? 'bad' : emiLoad > 0.3 ? 'warn' : 'good'}/>
        <button type="button" className="wd-link" onClick={() => onNavigate('emi-manager')}>Manage EMIs <ArrowRight size={13}/></button>
      </article>
      <article className="wd-card">
        <header><h2>Goals & retirement</h2><small>Freedom number</small></header>
        <p className="wd-big">{shortInr(r.freedom.corpusNeeded)}</p>
        <Meter value={d.freedomProgress} label={`Current investments reach ${pct(d.freedomProgress)} of it by ${profile.retireAge ?? 60}`} tone={d.freedomProgress >= 0.8 ? 'good' : 'warn'}/>
        <ul className="wd-kv">
          <li><span>SIP needed</span><b>{inr(r.freedom.monthlySipNeeded)}/mo</b></li>
          <li><span>Free by age</span><b>{r.freedom.freedomAge ?? '—'}</b></li>
          {r.goal && <li><span>Your goal</span><b>{shortInr(r.goal.futureCost)} · {inr(r.goal.monthlySip)}/mo</b></li>}
        </ul>
        <button type="button" className="wd-link" onClick={() => onNavigate('overview')}>See the full plan <ArrowRight size={13}/></button>
      </article>
      <article className="wd-card">
        <header><h2>Safety & protection</h2><small>Emergency fund and insurance</small></header>
        <Meter value={emergencyRatio} label={`Emergency fund ${pct(emergencyRatio)} of ${shortInr(r.emergency.target)} (6 months)`} tone={emergencyRatio >= 1 ? 'good' : emergencyRatio >= 0.5 ? 'warn' : 'bad'}/>
        <ul className="wd-kv">
          <li><span>Term cover needed</span><b>{shortInr(r.protection.termCoverNeeded)}</b></li>
          <li><span>Term cover gap</span><b className={r.protection.termGap > 0 ? 'neg' : 'pos'}>{r.protection.termGap > 0 ? shortInr(r.protection.termGap) : 'Covered'}</b></li>
          <li><span>Health cover gap</span><b className={r.protection.healthGap > 0 ? 'neg' : 'pos'}>{r.protection.healthGap > 0 ? shortInr(r.protection.healthGap) : 'Covered'}</b></li>
        </ul>
        <button type="button" className="wd-link" onClick={() => onNavigate('financial-health')}>Health details <ArrowRight size={13}/></button>
      </article>
    </section>

    <section className="wd-grid two">
      <article className="wd-card">
        <header><h2>Next best steps</h2><small>In priority order</small></header>
        <ol className="wd-actions">{actions.map((a) => <li key={a.title}><b>{a.title}</b><span>{a.detail}</span></li>)}</ol>
        {!actions.length && <p className="wd-note">Nothing urgent. Keep your SIPs going and review once a quarter.</p>}
      </article>
      <article className="wd-card">
        <header><h2>This month</h2><small>{d.spendThisMonth != null ? 'From your recorded expenses' : 'No expenses recorded yet'}</small></header>
        {d.spendThisMonth != null
          ? <><p className="wd-big">{inr(d.spendThisMonth)}</p><p className="wd-note">spent so far{d.topCategory ? <> · most on <b>{d.topCategory.name}</b> ({inr(d.topCategory.amount)})</> : null}</p>
              <Meter value={d.monthlyExpenses.value ? d.spendThisMonth / d.monthlyExpenses.value : 0} label={`${pct(d.monthlyExpenses.value ? d.spendThisMonth / d.monthlyExpenses.value : 0)} of your usual ${inr(d.monthlyExpenses.value)}`} tone={d.spendThisMonth > d.monthlyExpenses.value ? 'bad' : 'good'}/></>
          : <p className="wd-note">Record spending to see this month against your usual {inr(d.monthlyExpenses.value)}.</p>}
        <div className="wd-quick">
          <button type="button" onClick={() => onNavigate('expenses')}><ReceiptText size={14}/> Expenses</button>
          <button type="button" onClick={() => onNavigate('budgeting')}><Target size={14}/> Budget</button>
          <button type="button" onClick={() => onNavigate('money-planner')}><Coins size={14}/> Planner</button>
          <button type="button" onClick={() => onNavigate('financial-health')}><ShieldCheck size={14}/> Health</button>
        </div>
      </article>
    </section>

    <p className="wd-foot">Figures are calculated from what you entered and recorded; tax uses FY 2025-26 rules. Educational estimates, not investment or tax advice.</p>
  </div>;
};
