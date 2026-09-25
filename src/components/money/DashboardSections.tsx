import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bot, Brain, GraduationCap, History, PieChart, ReceiptText, Sparkles, UserRound } from 'lucide-react';
import type { AppNavigationDestination } from '../../navigationTypes';
import type { StructuredFinancialAnswer } from '../../types';
import type { MoneyProfile } from '../../services/moneyProfile';
import type { CompleteDashboard } from '../../services/completeDashboard';
import { loadPortfolio, PORTFOLIO_EVENT, summarise, type PortfolioSummary } from '../../services/portfolio';
import { loadExpenses } from '../../services/personalFinanceStorage';
import { loadQuestions, QUESTION_LOG_EVENT } from '../../services/questionLog';
import { loadTutorProgress, streak } from '../../services/tutorProgress';
import { StructuredFinancialAnswerView } from '../ai/StructuredFinancialAnswer';
import { ThinkingSteps } from '../ai/ThinkingSteps';

const inr = (v: number) => `${v < 0 ? '−' : ''}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
type Tone = 'good' | 'warn' | 'bad' | 'info';

/** Colours for asset classes and spending categories, used consistently across the dashboard. */
const PALETTE = ['#059669', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#db2777', '#65a30d', '#64748b'];

export const SECTIONS: Array<[string, string]> = [
  ['dash-overview', 'Overview'], ['dash-ai', 'AI analysis'], ['dash-profile', 'Profile'], ['dash-cash', 'Cash flow & tax'],
  ['dash-invest', 'Investments & spending'], ['dash-loans', 'Loans, goals & safety'], ['dash-activity', 'Your activity'], ['dash-markets', 'Markets & news'],
];

/** Sticky section menu; highlights the section in view. */
export const SectionNav: React.FC = () => {
  const [active, setActive] = useState(SECTIONS[0][0]);
  useEffect(() => {
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((es) => { const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setActive(v.target.id); }, { rootMargin: '-120px 0px -55% 0px' });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return <nav className="wd-nav" aria-label="Dashboard sections">{SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className={active === id ? 'on' : ''} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{label}</a>)}</nav>;
};

function lifeStage(age: number) { return age < 30 ? 'Early career' : age < 40 ? 'Building wealth' : age < 50 ? 'Peak earning' : age < 60 ? 'Pre-retirement' : 'Retirement'; }

/** Who the numbers belong to: personal details, life stage and risk capacity. */
export const ProfileCard: React.FC<{ profile: MoneyProfile; d: CompleteDashboard; onNavigate: (dest: AppNavigationDestination) => void }> = ({ profile, d, onNavigate }) => {
  const r = d.report;
  const months = r.emergency.months;
  const capacity: [string, Tone] = months >= 6 && profile.dependants <= 2 && r.cashflow.savingsRate >= 0.2 ? ['High', 'good'] : months >= 3 && r.cashflow.savingsRate >= 0.1 ? ['Moderate', 'warn'] : ['Low', 'bad'];
  const rows: Array<[string, string, Tone?]> = [
    ['Name', profile.name || 'Not set'],
    ['Age', `${profile.age} years`],
    ['Life stage', lifeStage(profile.age), 'info'],
    ['Dependants', String(profile.dependants)],
    ['Plans to retire at', `${profile.retireAge ?? 60}`],
    ['Annual salary', inr(profile.annualSalary)],
    ['Savings rate', pct(Math.max(0, r.cashflow.savingsRate)), r.cashflow.savingsRate >= 0.2 ? 'good' : r.cashflow.savingsRate >= 0.1 ? 'warn' : 'bad'],
    ['Risk capacity', capacity[0], capacity[1]],
    ['Data', `${profile.source === 'sample' ? 'Sample profile' : profile.source === 'scan' ? 'From a scanned document' : 'From your answers'} · ${new Date(profile.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`],
  ];
  return <article className="wd-card info">
    <header><h2><UserRound size={16}/> Your financial profile</h2><span className="wd-status info">Personal</span><small className="wd-sub">Kept on this device only</small></header>
    <ul className="wd-kv wd-profile">{rows.map(([k, v, t]) => <li key={k}><span>{k}</span><b className={t ? `wd-chip ${t}` : ''}>{v}</b></li>)}</ul>
    <button type="button" className="wd-link" onClick={() => onNavigate('overview')}>Edit your details <ArrowRight size={13}/></button>
  </article>;
};

const Donut: React.FC<{ parts: Array<{ label: string; value: number; color: string }> }> = ({ parts }) => {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  let acc = 0;
  const stops = parts.map((p) => { const a = acc; acc += (p.value / total) * 360; return `${p.color} ${a}deg ${acc}deg`; }).join(',');
  return <div className="wd-donut" style={{ background: `conic-gradient(${stops})` }} role="img" aria-label={parts.map((p) => `${p.label} ${pct(p.value / total)}`).join(', ')}><span/></div>;
};

/** Investments: the portfolio if imported, otherwise the totals from setup, never an empty box. */
export const InvestmentsCard: React.FC<{ profile: MoneyProfile; d: CompleteDashboard; onNavigate: (dest: AppNavigationDestination) => void }> = ({ profile, d, onNavigate }) => {
  const [pf, setPf] = useState<PortfolioSummary | null>(() => { const p = loadPortfolio(); return p.holdings.length ? summarise(p, profile.age) : null; });
  useEffect(() => { const s = () => { const p = loadPortfolio(); setPf(p.holdings.length ? summarise(p, profile.age) : null); }; window.addEventListener(PORTFOLIO_EVENT, s); return () => window.removeEventListener(PORTFOLIO_EVENT, s); }, [profile.age]);
  const parts = pf
    ? pf.byClass.map((c, i) => ({ label: c.cls, value: c.value, color: PALETTE[i % PALETTE.length] }))
    : [{ label: 'Long-term investments', value: profile.investments, color: PALETTE[0] }, { label: 'Cash & savings', value: profile.liquidSavings, color: PALETTE[1] }].filter((p) => p.value > 0);
  const gainTone: Tone = pf?.gain == null ? 'info' : pf.gain >= 0 ? 'good' : 'bad';
  return <article className={`wd-card ${gainTone}`}>
    <header><h2><PieChart size={16}/> Investments</h2><span className={`wd-status ${gainTone}`}>{pf ? (pf.gain >= 0 ? 'In profit' : 'In loss') : 'From setup'}</span><small className="wd-sub">{pf ? 'From your imported portfolio' : 'Import your CAS statement for fund-level detail and true returns'}</small></header>
    <div className="wd-invest">
      {parts.length ? <Donut parts={parts}/> : null}
      <ul className="wd-legend">{parts.map((p) => <li key={p.label}><i style={{ background: p.color }}/>{p.label}<b>{inr(p.value)}</b></li>)}</ul>
    </div>
    {pf ? <ul className="wd-kv">
      <li><span>Current value</span><b>{inr(pf.assets)}</b></li>
      <li><span>Gain / loss</span><b className={pf.gain >= 0 ? 'pos' : 'neg'}>{pf.gain >= 0 ? '+' : ''}{inr(pf.gain)}{pf.gainPct != null ? ` (${(pf.gainPct * 100).toFixed(1)}%)` : ''}</b></li>
      <li><span>True return (XIRR)</span><b className={pf.xirr == null ? '' : pf.xirr >= 0 ? 'pos' : 'neg'}>{pf.xirr == null ? '—' : `${(pf.xirr * 100).toFixed(1)}% a year`}</b></li>
      {pf.topHoldings.slice(0, 3).map((h) => <li key={h.name}><span>{h.name}</span><b>{inr(h.value)} · {pct(h.share)}</b></li>)}
    </ul> : <ul className="wd-kv">
      <li><span>Total invested (setup)</span><b>{inr(d.totalInvestments.value)}</b></li>
      <li><span>Freedom goal reached</span><b className={d.freedomProgress >= 0.5 ? 'pos' : 'neg'}>{pct(d.freedomProgress)}</b></li>
      <li><span>SIP needed for retirement</span><b>{inr(d.report.freedom.monthlySipNeeded)}/mo</b></li>
    </ul>}
    <button type="button" className="wd-link" onClick={() => onNavigate('portfolio')}>{pf ? 'Open portfolio' : 'Import your investments'} <ArrowRight size={13}/></button>
  </article>;
};

/** Where the money went this month, by category. */
export const SpendingCard: React.FC<{ d: CompleteDashboard; onNavigate: (dest: AppNavigationDestination) => void }> = ({ d, onNavigate }) => {
  const cats = useMemo(() => {
    const now = new Date(), key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const map = new Map<string, number>();
    for (const e of loadExpenses()) if (e.date?.startsWith(key)) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, []);
  const total = cats.reduce((s, [, v]) => s + v, 0);
  const usual = d.monthlyExpenses.value;
  const tone: Tone = !cats.length ? 'info' : total > usual ? 'bad' : total > usual * 0.8 ? 'warn' : 'good';
  return <article className={`wd-card ${tone}`}>
    <header><h2><ReceiptText size={16}/> Spending this month</h2><span className={`wd-status ${tone}`}>{!cats.length ? 'No records' : total > usual ? 'Over usual' : total > usual * 0.8 ? 'Close to usual' : 'Under control'}</span><small className="wd-sub">{cats.length ? `${inr(total)} of your usual ${inr(usual)}` : `Your usual spending is ${inr(usual)} a month`}</small></header>
    {cats.length ? <ul className="wd-cats">{cats.slice(0, 7).map(([name, v], i) => <li key={name}><span>{name}</span><i><b style={{ width: `${(v / cats[0][1]) * 100}%`, background: PALETTE[i % PALETTE.length] }}/></i><em>{inr(v)}</em></li>)}</ul>
      : <p className="wd-note">Add expenses (or upload a bank statement later) to see each category in colour, and where you can save.</p>}
    <button type="button" className="wd-link" onClick={() => onNavigate('expenses')}>{cats.length ? 'All expenses' : 'Record an expense'} <ArrowRight size={13}/></button>
  </article>;
};

/** What the user has been doing on ArthaMind: questions asked and learning progress. */
export const ActivityCard: React.FC<{ onNavigate: (dest: AppNavigationDestination) => void }> = ({ onNavigate }) => {
  const [qs, setQs] = useState(loadQuestions);
  useEffect(() => { const s = () => setQs(loadQuestions()); window.addEventListener(QUESTION_LOG_EVENT, s); return () => window.removeEventListener(QUESTION_LOG_EVENT, s); }, []);
  const tp = loadTutorProgress();
  return <article className="wd-card info">
    <header><h2><History size={16}/> Your activity</h2><span className="wd-status info">{qs.length} questions</span><small className="wd-sub">Your recent questions to the assistants and your learning</small></header>
    <div className="wd-activity-kpis">
      <span className="good"><GraduationCap size={14}/> {tp.lessons.length} lessons</span>
      <span className="info"><Bot size={14}/> {tp.questions + qs.length} questions</span>
      <span className="warn">🔥 {streak(tp)}-day streak</span>
    </div>
    {qs.length ? <ul className="wd-questions">{qs.slice(0, 6).map((q) => <li key={q.at + q.q}><em>{q.area}</em><span>{q.q}</span><small>{new Date(q.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></li>)}</ul>
      : <p className="wd-note">Questions you ask any assistant will appear here, so you can pick up where you left off.</p>}
    <button type="button" className="wd-link" onClick={() => onNavigate('tutor')}>Continue learning <ArrowRight size={13}/></button>
  </article>;
};

/** Everything on the dashboard as plain text, so the AI can analyse the complete picture. */
export function dashboardSummary(profile: MoneyProfile, d: CompleteDashboard): string {
  const r = d.report;
  const p = loadPortfolio();
  const pf = p.holdings.length ? summarise(p, profile.age) : null;
  const lines = [
    `Person: ${profile.name || 'user'}, age ${profile.age}, ${profile.dependants} dependants, plans to retire at ${profile.retireAge ?? 60}.`,
    `Income: salary ${inr(profile.annualSalary)} a year; take-home ${inr(d.monthlyTakeHome.value)} a month.`,
    `Spending: ${inr(d.monthlyExpenses.value)} a month; EMIs ${inr(d.monthlyEmi.value)} a month; surplus ${inr(d.monthlySurplus.value)} a month; savings rate ${pct(Math.max(0, r.cashflow.savingsRate))}.`,
    `Balance sheet: cash ${inr(d.totalSavings.value)}, investments ${inr(d.totalInvestments.value)}, loans ${inr(d.totalDebt.value)}, net worth ${inr(d.netWorth.value)}.`,
    `Tax FY 2025-26: old regime ${inr(r.tax.oldRegimeTax)}, new regime ${inr(r.tax.newRegimeTax)}; better: ${r.tax.better}.`,
    `Emergency fund: ${Number.isFinite(r.emergency.months) ? r.emergency.months.toFixed(1) : '—'} months (target 6, gap ${inr(r.emergency.gap)}).`,
    `Insurance: term cover gap ${inr(r.protection.termGap)}, health cover gap ${inr(r.protection.healthGap)}.`,
    `Retirement: freedom number ${inr(r.freedom.corpusNeeded)}, reached ${pct(d.freedomProgress)}, SIP needed ${inr(r.freedom.monthlySipNeeded)} a month.`,
    `Health score ${r.health.score}/100 (${r.health.status}).`,
    pf ? `Portfolio: value ${inr(pf.assets)}, gain ${inr(pf.gain)}, XIRR ${pf.xirr == null ? 'unknown' : `${(pf.xirr * 100).toFixed(1)}%`}, split ${pf.byClass.map((c) => `${c.cls} ${pct(c.share)}`).join(', ')}.` : 'Portfolio: not imported.',
    d.loans.length ? `Loans: ${d.loans.map((l) => `${l.name} EMI ${inr(l.emi)}, ${inr(l.outstanding)} left${l.rate != null ? ` at ${l.rate}%` : ''}`).join('; ')}.` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

const QUICK = ['Give me a complete analysis of my finances', 'What are my three biggest risks?', 'How can I retire earlier?', 'Where should my next ₹50,000 go?'];

/** The AI reads the complete dashboard and answers with a colour-coded, structured analysis. */
export const DashboardAI: React.FC<{ summary: string }> = ({ summary }) => {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<StructuredFinancialAnswer | null>(null);
  const [error, setError] = useState('');
  const ask = async (q: string) => {
    if (busy) return;
    setBusy(true); setError(''); setAnswer(null);
    try {
      const res = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        task: 'cfo',
        prompt: `You are analysing the user's complete financial dashboard. Use every number below, today's market and news context, and answer the question for this person specifically. Rank issues by urgency, show the numbers behind each point, and give concrete next steps with amounts.\n\nDASHBOARD\n${summary}\n\nQuestion: ${q}`,
        context: { country: 'India', currency: 'INR', language: 'english', detail: 'detailed' },
      }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The AI could not answer right now.');
      if (data.structuredAnswer) setAnswer(data.structuredAnswer); else throw new Error('No analysis came back. Please try again.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  return <article className="wd-card wd-ai info" id="dash-ai">
    <header><h2><Brain size={16}/> AI analysis of your complete dashboard</h2><span className="wd-status info"><Sparkles size={11}/> Live data</span><small className="wd-sub">The AI reads every figure on this page plus live markets and news, then ranks what matters most for you.</small></header>
    <div className="wd-ai-quick">{QUICK.map((q, i) => <button key={q} type="button" className={i === 0 ? 'primary' : ''} onClick={() => void ask(q)} disabled={busy}>{q}</button>)}</div>
    <ThinkingSteps active={busy}/>
    {error && <p className="wd-note neg">{error}</p>}
    {answer && <StructuredFinancialAnswerView answer={answer} compact/>}
  </article>;
};
