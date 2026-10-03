import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, PieChart, BadgeIndianRupee, CalendarClock, Coins, Gauge, Landmark, PiggyBank, ReceiptText, ShieldCheck, Sparkles, Target, TrendingUp, Wallet } from 'lucide-react';
import { SAMPLE_MONEY_CHECK } from '../../services/moneyCheck';
import { loadMoneyProfile, onMoneyProfileChange, saveMoneyProfile, type MoneyProfile } from '../../services/moneyProfile';
import { buildCompleteDashboard, type Figure, type FigureSource } from '../../services/completeDashboard';
import { EMI_RECORDS_CHANGED_EVENT, loadEmiRecords } from '../../services/emiStorage';
import { loadIncomeSources } from '../../services/incomeStorage';
import { loadExpenses } from '../../services/personalFinanceStorage';
import type { AppNavigationDestination } from '../../navigationTypes';
import './workspaceDash.css';
import { LiveBoard } from './LiveBoard';
import { ActivityCard, dashboardSummary, DashboardAI, InvestmentsCard, ProfileCard, SectionNav, SpendingCard } from './DashboardSections';

/** ₹ with Indian grouping (12,00,000). Amounts are always shown in full, never as k, L or Cr. */
export const inr = (v: number) => `${v < 0 ? '−' : ''}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`;
export const shortInr = inr;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const SOURCE: Record<FigureSource, string> = { profile: 'From your setup', loans: 'From your EMI records', income: 'From your income records', expenses: 'From your expenses', calculated: 'Calculated' };

type Tone = 'good' | 'warn' | 'bad' | 'info';
const STATUS: Record<Tone, string> = { good: 'Healthy', warn: 'Watch', bad: 'At risk', info: 'Info' };
/** Status pill in a card header; the card's top edge takes the same colour. */
const Status: React.FC<{ tone: Tone; label?: string }> = ({ tone, label }) => <span className={`wd-status ${tone}`}>{label ?? STATUS[tone]}</span>;

const Tile: React.FC<{ icon: React.ReactNode; label: string; fig: Figure; sub?: string; tone?: Tone }> = ({ icon, label, fig, sub, tone }) =>
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
      <section className="wd-markets"><header className="wd-markets-head"><h2>Markets & news</h2><small>Live quotes, fund check and business headlines</small></header><LiveBoard onNavigate={onNavigate}/></section>
    </div>;
  }

  const r = d.report;
  const emiLoad = d.monthlyTakeHome.value > 0 ? d.monthlyEmi.value / d.monthlyTakeHome.value : 0;
  const healthTone = r.health.score >= 70 ? 'good' : r.health.score >= 45 ? 'warn' : 'bad';
  const emergencyRatio = r.emergency.target > 0 ? Math.min(1, profile.liquidSavings / r.emergency.target) : 1;
  const actions = r.actions.slice(0, 4);
  const flowTone: Tone = r.cashflow.savingsRate >= 0.2 ? 'good' : r.cashflow.savingsRate >= 0.1 ? 'warn' : 'bad';
  const emiTone: Tone = emiLoad > 0.4 ? 'bad' : emiLoad > 0.3 ? 'warn' : 'good';
  const goalTone: Tone = d.freedomProgress >= 0.8 ? 'good' : d.freedomProgress >= 0.4 ? 'warn' : 'bad';
  const safetyTone: Tone = emergencyRatio >= 1 && r.protection.termGap <= 0 && r.protection.healthGap <= 0 ? 'good' : emergencyRatio < 0.5 ? 'bad' : 'warn';
  const monthTone: Tone = d.spendThisMonth == null ? 'info' : d.spendThisMonth > d.monthlyExpenses.value ? 'bad' : 'good';

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
    <SectionNav/>

    <div id="dash-overview" className="wd-anchor"/>
    <section className="wd-tiles" aria-label="Key figures">
      <Tile icon={<TrendingUp size={15}/>} label="Net worth" fig={d.netWorth} sub="Cash + investments − loans" tone={d.netWorth.value >= 0 ? 'good' : 'bad'}/>
      <Tile icon={<PiggyBank size={15}/>} label="Total investments" fig={d.totalInvestments} tone="good"/>
      <Tile icon={<Wallet size={15}/>} label="Cash & savings" fig={d.totalSavings} sub={`${r.emergency.months === Infinity ? '—' : r.emergency.months.toFixed(1)} months of expenses`} tone={r.emergency.months < 3 ? 'warn' : 'info'}/>
      <Tile icon={<Landmark size={15}/>} label="Loans outstanding" fig={d.totalDebt} sub={d.totalDebt.value > 0 ? 'Debt: money you owe' : 'Debt-free'} tone={d.totalDebt.value > 0 ? 'bad' : 'good'}/>
      <Tile icon={<BadgeIndianRupee size={15}/>} label="Annual income" fig={d.annualIncome} tone="info"/>
      <Tile icon={<ReceiptText size={15}/>} label="Tax this year" fig={d.taxThisYear} sub={`${r.tax.better === 'same' ? 'Either regime' : `${r.tax.better === 'new' ? 'New' : 'Old'} regime`} · ${(d.effectiveTaxRate * 100).toFixed(1)}% effective`} tone="warn"/>
      <Tile icon={<CalendarClock size={15}/>} label="Monthly EMI" fig={d.monthlyEmi} sub={`${pct(emiLoad)} of take-home`} tone={emiLoad > 0.4 ? 'bad' : emiLoad > 0.3 ? 'warn' : 'good'}/>
      <article className={`wd-tile wd-health ${healthTone}`}>
        <header><span className="wd-tile-ico"><Gauge size={15}/></span><small>Health score</small></header>
        <div className="wd-ring" style={{ '--p': r.health.score / 100 } as React.CSSProperties}><b>{r.health.score}</b></div>
        <span className="wd-tile-sub">{r.health.status}</span>
      </article>
    </section>

    <section className="wd-signals" aria-label="Colour guide">
      <span className="good">Green · growth, healthy</span><span className="bad">Red · loss, debt, risk</span><span className="warn">Amber · needs attention</span><span className="info">Blue · information</span>
    </section>

    <DashboardAI summary={dashboardSummary(profile, d)}/>

    <section className="wd-grid two" id="dash-profile">
      <ProfileCard profile={profile} d={d} onNavigate={onNavigate}/>
      <article className={`wd-card ${actions.length ? 'warn' : 'good'}`}>
        <header><h2>Next best steps</h2><Status tone={actions.length ? 'warn' : 'good'} label={actions.length ? `${actions.length} to do` : 'All clear'}/><small className="wd-sub">In priority order</small></header>
        <ol className="wd-actions">{actions.map((a) => <li key={a.title} className={a.priority <= 2 ? 'bad' : a.priority <= 4 ? 'warn' : 'info'}><b>{a.title}</b><span>{a.detail}</span></li>)}</ol>
        {!actions.length && <p className="wd-note">Nothing urgent. Keep your SIPs going and review once a quarter.</p>}
      </article>
    </section>

    <section className="wd-grid three" id="dash-cash">
      <article className={`wd-card ${flowTone}`}>
        <header><h2>Monthly cash flow</h2><Status tone={flowTone}/><small className="wd-sub">Take-home {inr(d.monthlyTakeHome.value)}</small></header>
        <Bar parts={[{ label: 'Living expenses', value: d.monthlyExpenses.value, cls: 'c-ink' }, { label: 'EMIs', value: d.monthlyEmi.value, cls: 'c-amber' }, { label: 'Left to save', value: Math.max(0, d.monthlySurplus.value), cls: 'c-green' }]}/>
        <p className="wd-note">Savings rate <b>{pct(Math.max(0, r.cashflow.savingsRate))}</b>{d.monthlySurplus.value < 0 ? ' · spending more than take-home' : ''}</p>
      </article>
      <article className={`wd-card ${d.netWorth.value >= 0 ? 'good' : 'bad'}`}>
        <header><h2>Balance sheet</h2><Status tone={d.netWorth.value >= 0 ? 'good' : 'bad'} label={d.netWorth.value >= 0 ? 'Positive' : 'In debt'}/><small className="wd-sub">Net worth {shortInr(d.netWorth.value)}</small></header>
        <Bar parts={[{ label: 'Cash & savings', value: d.totalSavings.value, cls: 'c-teal' }, { label: 'Investments', value: d.totalInvestments.value, cls: 'c-green' }, { label: 'Loans', value: d.totalDebt.value, cls: 'c-red' }]}/>
        <p className="wd-note">Runway <b>{Number.isFinite(r.runwayMonths) ? `${r.runwayMonths.toFixed(1)} months` : '—'}</b> if income stopped today</p>
      </article>
      <article className="wd-card info">
        <header><h2>Tax · FY 2025-26</h2><Status tone="info" label={r.tax.better === 'same' ? 'Either regime' : `${r.tax.better === 'new' ? 'New' : 'Old'} regime wins`}/><small className="wd-sub">Estimated from salary and deductions</small></header>
        <div className="wd-tax">
          {([['Old regime', r.tax.oldRegimeTax, r.tax.better === 'old'], ['New regime', r.tax.newRegimeTax, r.tax.better === 'new']] as const).map(([label, v, win]) =>
            <div key={label} className={win ? 'win' : ''}><span>{label}</span><i><b style={{ width: `${(v / Math.max(r.tax.oldRegimeTax, r.tax.newRegimeTax, 1)) * 100}%` }}/></i><em>{inr(v)}</em></div>)}
        </div>
        <p className="wd-note">{r.tax.better === 'same' ? 'Both regimes cost the same.' : <>The {r.tax.better} regime saves <b>{inr(r.tax.saving)}</b> a year.</>}</p>
        <button type="button" className="wd-link" onClick={() => onNavigate('income')}>Income & tax details <ArrowRight size={13}/></button>
      </article>
    </section>

    <section className="wd-grid two" id="dash-invest">
      <InvestmentsCard profile={profile} d={d} onNavigate={onNavigate}/>
      <SpendingCard d={d} onNavigate={onNavigate}/>
    </section>

    <section className="wd-grid three" id="dash-loans">
      <article className={`wd-card ${emiTone}`}>
        <header><h2>Loans & EMIs</h2><Status tone={emiTone}/><small className="wd-sub">{d.loans.length ? `${d.loans.length} active` : 'From your setup'}</small></header>
        {d.loans.length
          ? <table className="wd-table"><thead><tr><th>Loan</th><th>EMI</th><th>Left</th><th>Rate</th></tr></thead><tbody>
              {d.loans.slice(0, 5).map((l) => <tr key={l.name + l.nextDue}><td>{l.name}<small>{l.nextDue ? `Next ${new Date(l.nextDue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : l.type}</small></td><td>{inr(l.emi)}</td><td>{shortInr(l.outstanding)}</td><td>{l.rate != null ? `${l.rate}%` : '—'}</td></tr>)}
            </tbody></table>
          : <p className="wd-note">EMI {inr(d.monthlyEmi.value)} a month · {shortInr(d.totalDebt.value)} outstanding. Add each loan to track due dates and interest.</p>}
        <Meter value={emiLoad / 0.5} label={`EMI load ${pct(emiLoad)} of take-home (keep under 30–40%)`} tone={emiLoad > 0.4 ? 'bad' : emiLoad > 0.3 ? 'warn' : 'good'}/>
        <button type="button" className="wd-link" onClick={() => onNavigate('emi-manager')}>Manage EMIs <ArrowRight size={13}/></button>
      </article>
      <article className={`wd-card ${goalTone}`}>
        <header><h2>Goals & retirement</h2><Status tone={goalTone} label={goalTone === 'good' ? 'On track' : goalTone === 'warn' ? 'Behind' : 'Far behind'}/><small className="wd-sub">Freedom number</small></header>
        <p className="wd-big">{shortInr(r.freedom.corpusNeeded)}</p>
        <Meter value={d.freedomProgress} label={`Current investments reach ${pct(d.freedomProgress)} of it by ${profile.retireAge ?? 60}`} tone={d.freedomProgress >= 0.8 ? 'good' : 'warn'}/>
        <ul className="wd-kv">
          <li><span>SIP needed</span><b>{inr(r.freedom.monthlySipNeeded)}/mo</b></li>
          <li><span>Free by age</span><b>{r.freedom.freedomAge ?? '—'}</b></li>
          {r.goal && <li><span>Your goal</span><b>{shortInr(r.goal.futureCost)} · {inr(r.goal.monthlySip)}/mo</b></li>}
        </ul>
        <button type="button" className="wd-link" onClick={() => onNavigate('overview')}>See the full plan <ArrowRight size={13}/></button>
      </article>
      <article className={`wd-card ${safetyTone}`}>
        <header><h2>Safety & protection</h2><Status tone={safetyTone}/><small className="wd-sub">Emergency fund and insurance</small></header>
        <Meter value={emergencyRatio} label={`Emergency fund ${pct(emergencyRatio)} of ${shortInr(r.emergency.target)} (6 months)`} tone={emergencyRatio >= 1 ? 'good' : emergencyRatio >= 0.5 ? 'warn' : 'bad'}/>
        <ul className="wd-kv">
          <li><span>Term cover needed</span><b>{shortInr(r.protection.termCoverNeeded)}</b></li>
          <li><span>Term cover gap</span><b className={r.protection.termGap > 0 ? 'neg' : 'pos'}>{r.protection.termGap > 0 ? shortInr(r.protection.termGap) : 'Covered'}</b></li>
          <li><span>Health cover gap</span><b className={r.protection.healthGap > 0 ? 'neg' : 'pos'}>{r.protection.healthGap > 0 ? shortInr(r.protection.healthGap) : 'Covered'}</b></li>
        </ul>
        <button type="button" className="wd-link" onClick={() => onNavigate('financial-health')}>Health details <ArrowRight size={13}/></button>
      </article>
    </section>

    <section className="wd-grid two" id="dash-activity">
      <ActivityCard onNavigate={onNavigate}/>
      <article className="wd-card info">
        <header><h2>Go to a feature</h2><Status tone="info" label="Shortcuts"/><small className="wd-sub">Every part of your money, one tap away</small></header>
        <div className="wd-quick">
          <button type="button" onClick={() => onNavigate('expenses')}><ReceiptText size={14}/> Expenses</button>
          <button type="button" onClick={() => onNavigate('budgeting')}><Target size={14}/> Budget</button>
          <button type="button" onClick={() => onNavigate('portfolio')}><PieChart size={14}/> Portfolio</button>
          <button type="button" onClick={() => onNavigate('money-planner')}><Coins size={14}/> Planner</button>
          <button type="button" onClick={() => onNavigate('financial-health')}><ShieldCheck size={14}/> Health</button>
        </div>
      </article>
    </section>

    <section id="dash-markets" className="wd-markets">
      <header className="wd-markets-head"><h2>Markets & news</h2><small>Live quotes, fund check and business headlines</small></header>
      <LiveBoard onNavigate={onNavigate}/>
    </section>

    <p className="wd-foot">Figures are calculated from what you entered and recorded; tax uses FY 2025-26 rules. Educational estimates, not investment or tax advice.</p>
  </div>;
};
