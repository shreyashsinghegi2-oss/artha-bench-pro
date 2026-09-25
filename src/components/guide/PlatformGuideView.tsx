import React from 'react';
import { ArrowRight, Bot, Compass, GraduationCap, LineChart, Mic, ShieldCheck, Sparkles, Target, UserRoundCheck, Wallet } from 'lucide-react';
import type { AppNavigationDestination } from '../../navigationTypes';
import '../planners/planners.css';
import './guide.css';

type Step = { title: string; what: string; how: string; to?: AppNavigationDestination };
const SECTIONS: Array<{ title: string; icon: React.ComponentType<{ size?: number }>; color: string; steps: Step[] }> = [
  { title: 'Start here (5 minutes)', icon: Compass, color: '#059669', steps: [
    { title: '1. Build your money profile', what: 'Answer 12 quick questions or scan a payslip.', how: 'Money report → "Answer about 12 quick questions". Everything else fills in from this.', to: 'overview' },
    { title: '2. Open your Dashboard', what: 'Your whole financial life on one page, colour-coded.', how: 'Green is healthy, red is a problem, amber needs attention, blue is information.', to: 'my-dashboard' },
    { title: '3. Ask the AI to review it', what: 'A ranked list of what to fix first, with amounts.', how: 'Dashboard → "AI analysis" → "Give me a complete analysis".', to: 'my-dashboard' },
  ] },
  { title: 'Grow and plan', icon: Target, color: '#2563eb', steps: [
    { title: 'Portfolio & net worth', what: 'True returns (XIRR), asset mix and fund overlap.', how: 'Import your CAS statement PDF or add holdings by hand.', to: 'portfolio' },
    { title: 'Retirement planner', what: 'The corpus you need and whether you are on track.', how: 'Move the sliders; the chart shows the age your money lasts to.', to: 'retirement-planner' },
    { title: 'Child education planner', what: 'Bachelors, MBBS, MBA or study abroad, each with its SIP.', how: 'Add courses and replace the indicative fees with real ones.', to: 'education-planner' },
    { title: 'Job switch planner', what: 'Whether an offer really pays after tax and living costs.', how: 'Enter both CTCs, the new city costs and the switching costs.', to: 'job-switch-planner' },
    { title: 'Invest a lump sum', what: 'Where each rupee of a bonus should go, in order.', how: 'Enter the amount; the planner splits it step by step.', to: 'money-planner' },
  ] },
  { title: 'Track your money', icon: Wallet, color: '#d97706', steps: [
    { title: 'Income & tax', what: 'Salary and other income, old vs new regime.', how: 'Add each income source once; tax updates everywhere.', to: 'income' },
    { title: 'Expenses & budget', what: 'Where the money goes, against your plan.', how: 'Record spending; the dashboard colours categories that run over.', to: 'expenses' },
    { title: 'EMI & loans', what: 'Every loan, EMI load and prepayment options.', how: 'Add each loan with its rate; EMI load turns red above 40% of take-home.', to: 'emi-manager' },
  ] },
  { title: 'Markets and news', icon: LineChart, color: '#7c3aed', steps: [
    { title: 'Market overview', what: 'NIFTY, SENSEX, stocks, forex and crypto with sources.', how: 'Prices are delayed quotes from the connected providers, labelled with their time.', to: 'markets' },
    { title: 'Business news', what: 'Headlines explained in plain words.', how: 'Open any story and ask the AI what it means for you.', to: 'news' },
  ] },
  { title: 'Learn', icon: GraduationCap, color: '#0891b2', steps: [
    { title: 'Financial tutor', what: 'Course tracks, lessons, quizzes, books and official guides.', how: 'Pick a track, take lessons in order and check your streak on the tutor dashboard.', to: 'tutor' },
  ] },
];

const AI_TIPS: Array<{ icon: React.ComponentType<{ size?: number }>; title: string; text: string }> = [
  { icon: Bot, title: 'Ask AI on every page', text: 'The green "Ask AI" button reads the page you are on. Drag it anywhere below the header.' },
  { icon: Mic, title: 'Speak and listen', text: 'Tap the mic to ask by voice; press Listen under any answer and choose the language and speed.' },
  { icon: UserRoundCheck, title: 'Use my data', text: 'Switch it on next to "Web search" and every assistant uses your saved income, spending, loans and portfolio.' },
  { icon: Sparkles, title: 'Live facts', text: 'Web search (Auto) fetches current prices, rates, fees and news, and shows the sources with dates.' },
  { icon: ShieldCheck, title: 'Your data stays yours', text: 'Profile and portfolio stay on your device unless you save them; we never ask for PINs or OTPs.' },
];

/** "How to use ArthaMind": what each part does, when to use it and how, with a button to open it. */
export const PlatformGuideView: React.FC<{ onNavigate: (d: AppNavigationDestination) => void }> = ({ onNavigate }) => <div className="pk gd">
  <header className="pk-head"><div><small>Guide</small><h1>How to use ArthaMind</h1><p>ArthaMind is your AI CFO: set up once, then every page, plan and assistant works from the same numbers. Start with the three steps below.</p></div></header>
  {SECTIONS.map((sec) => { const Icon = sec.icon; return <section key={sec.title} className="gd-sec" style={{ '--c': sec.color } as React.CSSProperties}>
    <h2><span><Icon size={17}/></span>{sec.title}</h2>
    <div className="gd-grid">{sec.steps.map((st) => <article key={st.title} className="gd-card">
      <b>{st.title}</b><p>{st.what}</p><small>{st.how}</small>
      {st.to && <button type="button" onClick={() => onNavigate(st.to!)}>Open <ArrowRight size={13}/></button>}
    </article>)}</div>
  </section>; })}
  <section className="gd-sec" style={{ '--c': '#dc2626' } as React.CSSProperties}>
    <h2><span><Bot size={17}/></span>Getting the most from the AI</h2>
    <div className="gd-grid">{AI_TIPS.map((t) => { const Icon = t.icon; return <article key={t.title} className="gd-card"><b><Icon size={14}/> {t.title}</b><p>{t.text}</p></article>; })}</div>
  </section>
</div>;
