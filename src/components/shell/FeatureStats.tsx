import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { AppNavigationDestination } from '../../navigationTypes';
import { loadMoneyProfile, onMoneyProfileChange } from '../../services/moneyProfile';
import { buildCompleteDashboard, type CompleteDashboard } from '../../services/completeDashboard';
import { EMI_RECORDS_CHANGED_EVENT, loadEmiRecords } from '../../services/emiStorage';
import { loadIncomeSources } from '../../services/incomeStorage';
import { loadExpenses } from '../../services/personalFinanceStorage';
import './featureStats.css';
import { EvaluationHub, EVALUATION_DESTINATIONS } from '../evaluation/EvaluationHub';

type Tone = 'good' | 'warn' | 'bad' | 'info';
interface Stat { label: string; value: string; note?: string; tone: Tone }
const inr = (v: number) => `${v < 0 ? '−' : ''}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Pages that already carry their own dashboard, or are not about the user's money. */
const SKIP = new Set<AppNavigationDestination>(['platform-guide', 'retirement-planner', 'education-planner', 'job-switch-planner', 'my-dashboard', 'overview', 'portfolio', 'tutor', 'account', 'settings', 'connections', 'methodology', 'go-pro', 'evaluation-lab', 'comparison', 'batch', 'reports', 'quick-check', 'learning']);
const MARKET_PAGES = new Set<AppNavigationDestination>(['markets', 'india-markets', 'us-markets', 'forex-markets', 'intraday-markets', 'market-watchlist', 'market-alerts', 'markets-learn', 'crypto', 'news', 'economy', 'dashboard']);

function monthSpend() {
  const now = new Date(), key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const list = loadExpenses().filter((e) => e.date?.startsWith(key));
  const byCat = new Map<string, number>();
  for (const e of list) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  return { total: list.reduce((s, e) => s + e.amount, 0), count: list.length, top };
}

/** The four figures that matter most on each feature page, coloured by what they mean. */
function statsFor(dest: AppNavigationDestination, d: CompleteDashboard): Stat[] {
  const r = d.report;
  const emiLoad = d.monthlyTakeHome.value > 0 ? d.monthlyEmi.value / d.monthlyTakeHome.value : 0;
  const sr = r.cashflow.savingsRate;
  const surplus: Stat = { label: 'Saved each month', value: inr(d.monthlySurplus.value), tone: d.monthlySurplus.value >= 0 ? 'good' : 'bad', note: `${pct(Math.max(0, sr))} of take-home` };
  const netWorth: Stat = { label: 'Net worth', value: inr(d.netWorth.value), tone: d.netWorth.value >= 0 ? 'good' : 'bad' };
  const emi: Stat = { label: 'EMI load', value: pct(emiLoad), tone: emiLoad > 0.4 ? 'bad' : emiLoad > 0.3 ? 'warn' : 'good', note: `${inr(d.monthlyEmi.value)} a month` };
  const health: Stat = { label: 'Health score', value: `${r.health.score}/100`, tone: r.health.score >= 70 ? 'good' : r.health.score >= 45 ? 'warn' : 'bad', note: r.health.status };
  const m = monthSpend();
  switch (dest) {
    case 'income': return [
      { label: 'Annual income', value: inr(d.annualIncome.value), tone: 'info' },
      { label: 'Take-home a month', value: inr(d.monthlyTakeHome.value), tone: 'info' },
      { label: 'Tax this year', value: inr(d.taxThisYear.value), tone: 'warn', note: `${(d.effectiveTaxRate * 100).toFixed(1)}% effective` },
      { label: 'Better regime', value: r.tax.better === 'same' ? 'Either' : r.tax.better === 'new' ? 'New' : 'Old', tone: 'good', note: r.tax.saving > 0 ? `saves ${inr(r.tax.saving)}` : undefined },
    ];
    case 'expenses': case 'budgeting': return [
      { label: 'Spent this month', value: inr(m.total), tone: m.total > d.monthlyExpenses.value ? 'bad' : m.total > d.monthlyExpenses.value * 0.8 ? 'warn' : 'good', note: `${m.count} records` },
      { label: 'Usual monthly spend', value: inr(d.monthlyExpenses.value), tone: 'info' },
      { label: 'Left this month', value: inr(d.monthlyExpenses.value - m.total), tone: d.monthlyExpenses.value - m.total >= 0 ? 'good' : 'bad' },
      m.top ? { label: 'Biggest category', value: m.top[0], tone: 'warn', note: inr(m.top[1]) } : surplus,
    ];
    case 'emi-manager': return [
      { label: 'Active loans', value: String(d.loans.length || (d.totalDebt.value > 0 ? 1 : 0)), tone: 'info' },
      { label: 'Monthly EMI', value: inr(d.monthlyEmi.value), tone: 'warn' },
      { label: 'Outstanding debt', value: inr(d.totalDebt.value), tone: d.totalDebt.value > 0 ? 'bad' : 'good' },
      emi,
    ];
    case 'financial-health': return [
      health,
      { label: 'Emergency fund', value: Number.isFinite(r.emergency.months) ? `${r.emergency.months.toFixed(1)} months` : '—', tone: r.emergency.months >= 6 ? 'good' : r.emergency.months >= 3 ? 'warn' : 'bad', note: 'target 6 months' },
      { label: 'Life cover gap', value: r.protection.termGap > 0 ? inr(r.protection.termGap) : 'Covered', tone: r.protection.termGap > 0 ? 'bad' : 'good' },
      { label: 'Health cover gap', value: r.protection.healthGap > 0 ? inr(r.protection.healthGap) : 'Covered', tone: r.protection.healthGap > 0 ? 'warn' : 'good' },
    ];
    case 'money-planner': return [
      surplus,
      { label: 'Cash & savings', value: inr(d.totalSavings.value), tone: 'info' },
      { label: 'Investments', value: inr(d.totalInvestments.value), tone: 'good' },
      { label: 'Retirement goal reached', value: pct(d.freedomProgress), tone: d.freedomProgress >= 0.8 ? 'good' : d.freedomProgress >= 0.4 ? 'warn' : 'bad' },
    ];
    default: return [netWorth, surplus, emi, health];
  }
}

const MARKETS = [{ s: '^NSEI', l: 'NIFTY 50' }, { s: '^BSESN', l: 'SENSEX' }, { s: 'INR=X', l: 'USD / INR' }, { s: 'GC=F', l: 'Gold (US$)' }, { s: 'BTC-USD', l: 'Bitcoin (US$)' }];

/** Live index strip for market and news pages. */
const MarketStats: React.FC = () => {
  const [rows, setRows] = useState<Record<string, { price: number; ch: number | null }>>({});
  const [tried, setTried] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () => fetch(`/api/markets/batch?symbols=${encodeURIComponent(MARKETS.map((m) => m.s).join(','))}`).then((r) => r.json()).then((d: { results?: Array<{ symbol: string; quote?: { price: number; changePercent: number | null } }> }) => {
      if (!alive) return;
      setRows(Object.fromEntries((d.results ?? []).filter((x) => x.quote).map((x) => [x.symbol, { price: x.quote!.price, ch: x.quote!.changePercent }])));
    }).catch(() => undefined).finally(() => { if (alive) setTried(true); });
    load();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60_000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);
  return <section className="fs" aria-label="Markets now">{MARKETS.map((m) => { const q = rows[m.s]; const tone: Tone = !q || q.ch == null ? 'info' : q.ch >= 0 ? 'good' : 'bad';
    return <article key={m.s} className={`fs-stat ${tone}`}><small>{m.l}</small><b>{q ? q.price.toLocaleString('en-IN', { maximumFractionDigits: m.s === 'INR=X' ? 2 : 0 }) : '—'}</b><span>{q && q.ch != null ? `${q.ch >= 0 ? '▲' : '▼'} ${Math.abs(q.ch).toFixed(2)}% today` : tried ? 'Unavailable right now' : 'Loading · delayed quotes'}</span></article>; })}</section>;
};

/** A colour-coded summary strip at the top of every feature page, using the user's own numbers. */
export const FeatureStats: React.FC<{ destination: AppNavigationDestination; onNavigate: (d: AppNavigationDestination) => void }> = ({ destination, onNavigate }) => {
  const [profile, setProfile] = useState(() => loadMoneyProfile());
  const [tick, setTick] = useState(0);
  useEffect(() => onMoneyProfileChange(setProfile), []);
  useEffect(() => { const on = () => setTick((t) => t + 1); window.addEventListener(EMI_RECORDS_CHANGED_EVENT, on); window.addEventListener('storage', on); return () => { window.removeEventListener(EMI_RECORDS_CHANGED_EVENT, on); window.removeEventListener('storage', on); }; }, []);
  const d = useMemo(() => { if (!profile) return null; try { return buildCompleteDashboard({ profile, loans: loadEmiRecords(), income: loadIncomeSources(), expenses: loadExpenses() }); } catch { return null; } }, [profile, tick, destination]); // eslint-disable-line react-hooks/exhaustive-deps
  if (EVALUATION_DESTINATIONS.has(destination)) return <EvaluationHub destination={destination} onNavigate={onNavigate}/>;
  if (SKIP.has(destination)) return null;
  if (MARKET_PAGES.has(destination)) return <MarketStats/>;
  if (!d) return <section className="fs fs-empty"><span>Set up your money profile once and every page shows your own numbers here, colour-coded.</span><button type="button" onClick={() => onNavigate('overview')}>Set up in 2 minutes <ArrowRight size={13}/></button></section>;
  return <section className="fs" aria-label="Your numbers for this page">{statsFor(destination, d).map((s) => <article key={s.label} className={`fs-stat ${s.tone}`}><small>{s.label}</small><b>{s.value}</b>{s.note && <span>{s.note}</span>}</article>)}
    <button type="button" className="fs-more" onClick={() => onNavigate('my-dashboard')}>Full dashboard <ArrowRight size={13}/></button></section>;
};
