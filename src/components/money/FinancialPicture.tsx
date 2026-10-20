import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, CircleAlert, Pencil, UserRound } from 'lucide-react';
import type { CompleteDashboard } from '../../services/completeDashboard';
import type { MoneyProfile } from '../../services/moneyProfile';
import { analyseFinances, type Slice } from '../../services/financialAnalysis';
import { GOAL_OPTIONS, WORK_OPTIONS, loadOnboardingRecord } from '../../services/onboarding';
import { moneyInWords } from '../../services/userPrefs';
import { openAnswersEditor } from '../../services/answersEditor';
import { InvestmentPlanCard } from './InvestmentPlanCard';
import './financialPicture.css';

/** One accent family (brand teal) plus amber for debt/tax and slate for the rest, so slices stay readable. */
export const CHART_COLORS = ['#0F766E', '#1E3A8A', '#C9A227', '#14B8A6', '#0E7490', '#16A34A', '#B45309'];
const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const short = (v: number) => (Math.abs(v) >= 1e5 ? `₹${moneyInWords(v, 'INR')}` : inr(v));

const Donut: React.FC<{ title: string; sub: string; data: Slice[]; empty: string }> = ({ title, sub, data, empty }) => {
  const total = data.reduce((s, x) => s + x.value, 0);
  return <article className="fp-card">
    <header><h3>{title}</h3><small>{sub}</small></header>
    {total > 0 ? <div className="fp-donut">
      <div className="fp-donut-chart" aria-hidden="true">
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={52} outerRadius={84} paddingAngle={1.5} stroke="none" isAnimationActive={false}>
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
            </Pie>
            <Tooltip formatter={(v: number) => inr(v)}/>
          </PieChart>
        </ResponsiveContainer>
        <b className="fp-donut-total">{short(total)}</b>
      </div>
      <ul className="fp-legend">{data.map((s, i) => <li key={s.label}><i style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}/><span>{s.label}</span><b>{inr(s.value)}</b><em>{Math.round((s.value / total) * 100)}%</em></li>)}</ul>
    </div> : <p className="fp-empty">{empty}</p>}
  </article>;
};

/**
 * The complete picture on the dashboard: everything the person told us, charted and analysed (strengths,
 * weak spots), using the same analysis as the PDF report.
 */
export const FinancialPicture: React.FC<{ profile: MoneyProfile; d: CompleteDashboard }> = ({ profile, d }) => {
  const record = loadOnboardingRecord();
  const a = record?.answers ?? {};
  const x = analyseFinances(profile, d, a);
  const work = [WORK_OPTIONS.find((w) => w.value === a.work)?.label, a.jobTitle].filter(Boolean).join(' · ');
  const goals = (a.goals ?? (a.goal ? [a.goal] : [])).map((g) => GOAL_OPTIONS.find((o) => o.value === g)?.label ?? g);
  const about: Array<[string, string]> = [
    ['Age', `${profile.age}`],
    ['Work', work || '—'],
    ...(a.jobYears !== undefined ? [['Years in this work', `${a.jobYears} (total ${a.totalYears ?? '—'})`] as [string, string]] : []),
    ['Income', `${inr(d.annualIncome.value / 12)} a month${a.steadiness ? ` · ${a.steadiness === 'fixed' ? 'steady' : a.steadiness === 'varies' ? 'changes a little' : 'changes a lot'}` : ''}`],
    ...(a.incomeSources?.length ? [['Income from', a.incomeSources.join(', ')] as [string, string]] : []),
    ['People who depend on you', `${profile.dependants}`],
    ['Goals', goals.length ? goals.join(' → ') : '—'],
    ['Stop working at', `${profile.retireAge ?? 60}`],
    ...(a.taxRegime ? [['Tax regime used', a.taxRegime === 'unsure' ? 'Not sure' : a.taxRegime === 'new' ? 'New' : 'Old'] as [string, string]] : []),
    ...(a.nominees ? [['Nominees', a.nominees === 'all' ? 'On all accounts' : a.nominees === 'some' ? 'On some' : 'Not added']] as Array<[string, string]> : []),
    ...(record ? [['Money mindset', `${record.result.riskLabel.split(':')[0]} · ${record.result.habitLabel.split(':')[0]}`] as [string, string]] : []),
  ];

  return <section className="fp" id="dash-picture" aria-label="Your complete financial picture">
    <header className="fp-head">
      <div><h2>Your complete financial picture</h2><p>{x.verdict}</p></div>
      <button type="button" className="fp-edit" onClick={openAnswersEditor}><Pencil size={14}/> Edit my answers</button>
    </header>

    <div className="fp-grid three">
      <Donut title="Where your monthly money goes" sub={`Income ${inr(d.annualIncome.value / 12)} a month, before tax`} data={x.monthlyFlow} empty="No income or spending entered yet."/>
      <Donut title="What you own" sub="Cash, investments, gold, property" data={x.assets} empty="No savings or investments entered yet."/>
      <Donut title="What you owe" sub={x.liabilities.length ? `Total ${inr(d.totalDebt.value)}` : 'No loans'} data={x.liabilities} empty="No loans. You are debt-free."/>
    </div>

    <div className="fp-grid two">
      <article className="fp-card">
        <header><h3>Protection: how much of what you need is covered</h3><small>Emergency fund and insurance · 100% = fully covered</small></header>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={x.protection.map((p) => ({ ...p, covered: p.need > 0 ? Math.min(100, Math.round((p.have / p.need) * 100)) : 100 }))} layout="vertical" margin={{ left: 8, right: 36 }}>
            <CartesianGrid horizontal={false} stroke="var(--border-subtle)"/>
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}/>
            <YAxis type="category" dataKey="label" width={104} tick={{ fontSize: 12, fill: 'var(--text-primary)' }}/>
            <Tooltip formatter={(_v: number, _n: string, item: { payload?: { have: number; need: number } }) => [`${inr(item.payload?.have ?? 0)} of ${inr(item.payload?.need ?? 0)}`, 'Covered']}/>
            <Bar dataKey="covered" radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: 'right', formatter: (v: number) => `${v}%`, fontSize: 11, fill: 'var(--text-primary)' }}>
              {x.protection.map((p) => { const c = p.need > 0 ? p.have / p.need : 1; return <Cell key={p.label} fill={c >= 1 ? '#16A34A' : c >= 0.5 ? '#F59E0B' : '#DC2626'}/>; })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <ul className="fp-legend">{x.protection.map((p) => <li key={p.label}><i style={{ background: p.need > 0 && p.have / p.need < 1 ? (p.have / p.need >= 0.5 ? '#F59E0B' : '#DC2626') : '#16A34A' }}/><span>{p.label}</span><b>{inr(p.have)}</b><em>of {short(p.need)}</em></li>)}</ul>
      </article>
      <article className="fp-card">
        <header><h3>Road to retirement</h3><small>Investments growing ~10% a year with today’s surplus invested, vs money needed</small></header>
        {x.retirementPath.length > 1 ? <ResponsiveContainer width="100%" height={220}>
          <LineChart data={x.retirementPath} margin={{ left: 8, right: 16 }}>
            <CartesianGrid stroke="var(--border-subtle)"/>
            <XAxis dataKey="age" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} label={{ value: 'Age', position: 'insideBottomRight', offset: -2, fontSize: 11 }}/>
            <YAxis tickFormatter={(v: number) => short(v)} width={84} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}/>
            <Tooltip formatter={(v: number) => inr(v)} labelFormatter={(l) => `Age ${l}`}/>
            <Legend wrapperStyle={{ fontSize: 12 }}/>
            <Line type="monotone" dataKey="projected" name="Your investments" stroke="#0F766E" strokeWidth={2.5} dot={false} isAnimationActive={false}/>
            <Line type="monotone" dataKey="needed" name="Needed at retirement" stroke="#F59E0B" strokeDasharray="6 4" dot={false} isAnimationActive={false}/>
          </LineChart>
        </ResponsiveContainer> : <p className="fp-empty">You are at or past your planned retirement age. Your plan focuses on making savings last.</p>}
      </article>
    </div>

    <InvestmentPlanCard profile={profile} d={d}/>

    <div className="fp-grid three">
      <article className="fp-card">
        <header><h3><CheckCircle2 size={16} className="pos"/> Strengths</h3><small>What is working</small></header>
        {x.strengths.length ? <ul className="fp-list good">{x.strengths.map((s) => <li key={s.title}><b>{s.title}</b><span>{s.detail}</span></li>)}</ul> : <p className="fp-empty">No clear strengths yet. The steps on the right will build them.</p>}
      </article>
      <article className="fp-card">
        <header><h3><CircleAlert size={16} className="neg"/> Needs attention</h3><small>Most urgent first</small></header>
        {x.weaknesses.length ? <ul className="fp-list bad">{x.weaknesses.map((s) => <li key={s.title} className={s.severity}><b>{s.title}</b><span>{s.detail}</span></li>)}</ul> : <p className="fp-empty">Nothing urgent. Keep going.</p>}
      </article>
      <article className="fp-card">
        <header><h3><UserRound size={16}/> About you</h3><small>From your answers</small></header>
        <dl className="fp-about">{about.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </article>
    </div>
  </section>;
};
