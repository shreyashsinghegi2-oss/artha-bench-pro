import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, BadgeIndianRupee, ClipboardList, FileUp, Gauge, RotateCcw, ShieldCheck, Sparkles, Target, UserRound } from 'lucide-react';
import { buildMoneyCheck, SAMPLE_MONEY_CHECK, type MoneyCheckReport } from '../../services/moneyCheck';
import { clearMoneyProfile, loadMoneyProfile, onMoneyProfileChange, saveMoneyProfile, type MoneyProfile } from '../../services/moneyProfile';
import type { AppNavigationDestination } from '../../navigationTypes';
import { AiCfoChat } from '../ai/AiCfoChat';
import '../ai/aiCfo.css';
import { MoneyReportView, moneyAskPrompt, shortInr } from './MoneyReport';
import { MoneySetup } from './MoneySetup';
import { CalculatorsHub, CALCULATOR_COUNT } from './CalculatorsHub';
import './moneyHome.css';

type Mode = { kind: 'home' } | { kind: 'setup'; scan: boolean };

interface Area {
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  line: (r: MoneyCheckReport) => string;
  links: Array<{ label: string; to: AppNavigationDestination } | { label: string; ask: string }>;
}

const AREAS: Area[] = [
  { id: 'understand', title: 'Understand', icon: Gauge, line: (r) => `Health score ${r.health.score}/100 · ${r.health.status}`,
    links: [{ label: 'Financial health', to: 'financial-health' }, { label: 'Monthly reports', to: 'finance-reports' }, { label: 'Expenses', to: 'expenses' }] },
  { id: 'optimise', title: 'Optimise', icon: BadgeIndianRupee, line: (r) => (r.tax.better === 'same' ? 'Both tax regimes cost the same' : `${r.tax.better === 'new' ? 'New' : 'Old'} regime saves ${shortInr(r.tax.saving)} a year`),
    links: [{ label: 'Income & tax', to: 'income' }, { label: 'EMI manager', to: 'emi-manager' }, { label: 'Budgeting', to: 'budgeting' }] },
  { id: 'protect', title: 'Protect', icon: ShieldCheck, line: (r) => (r.protection.termGap > 0 ? `Term cover gap ${shortInr(r.protection.termGap)}` : r.emergency.gap > 0 ? `Emergency gap ${shortInr(r.emergency.gap)}` : 'Cover and emergency fund in place'),
    links: [{ label: 'Check my insurance', ask: 'Using my money report, explain my term and health insurance gaps and what kind of policy would close them. Keep it simple.' }, { label: 'Emergency fund plan', ask: 'Using my money report, build a month-by-month plan to fill my emergency fund.' }] },
  { id: 'plan', title: 'Plan', icon: Target, line: (r) => `Freedom number ${shortInr(r.freedom.corpusNeeded)}${r.freedom.freedomAge ? ` · free by ${r.freedom.freedomAge}` : ''}`,
    links: [{ label: 'What-if scenarios', to: 'financial-twin' }, { label: 'Decision replay', to: 'decision-replay' }, { label: 'Retirement plan', ask: 'Using my money report, draft my retirement plan: SIP amount, asset mix by decade, and what to review each year.' }] },
];

const LEARN_LINKS: Array<[string, string, AppNavigationDestination]> = [
  ['Financial tutor', 'Ask any money question and learn step by step', 'tutor'],
  ['Learning', 'Short lessons on tax, investing and insurance', 'learning'],
  ['Market data', 'NIFTY, SENSEX, stocks and funds with sources', 'markets'],
  ['Business news', 'Headlines explained in plain language', 'news'],
  ['Crypto', 'Live Binance charts with risk labels', 'crypto'],
  ['Economic data', 'Inflation, rates and growth indicators', 'economy'],
];

/** Sticky in-page section bar; highlights the section in view. */
const SectionNav: React.FC<{ sections: Array<[string, string]>; onGo: (id: string) => void }> = ({ sections, onGo }) => {
  const [active, setActive] = useState(sections[0]?.[0]);
  const key = sections.map(([id]) => id).join('|');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: '-140px 0px -55% 0px' });
    sections.forEach(([id]) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <nav className="mh-secnav" aria-label="Home sections">
    {sections.map(([id, label]) => <button key={id} type="button" className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined} onClick={() => { setActive(id); onGo(id); }}>{label}</button>)}
  </nav>;
};

const SOURCE_LABEL: Record<MoneyProfile['source'], string> = { questions: 'from your answers', scan: 'from your document and answers', sample: 'from a sample profile' };

export const MoneyHome: React.FC<{ onNavigate: (destination: AppNavigationDestination) => void }> = ({ onNavigate }) => {
  const reduced = useReducedMotion();
  const [profile, setProfile] = useState<MoneyProfile | null>(() => loadMoneyProfile());
  const [mode, setMode] = useState<Mode>({ kind: 'home' });
  const [cfoPrompt, setCfoPrompt] = useState<{ id: number; text: string } | null>(null);
  const cfoRef = useRef<HTMLElement>(null);

  useEffect(() => onMoneyProfileChange(setProfile), []);
  const report = useMemo(() => {
    if (!profile) return null;
    try { return buildMoneyCheck(profile); } catch { return null; }
  }, [profile]);

  const ask = (text: string) => {
    setCfoPrompt({ id: Date.now(), text });
    cfoRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };
  const askWithContext = (text: string) => ask(profile && report ? `${text} ${moneyAskPrompt(profile, report)}` : text);

  const done = (next: MoneyProfile) => { saveMoneyProfile(next); setProfile(next); setMode({ kind: 'home' }); window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); };
  const trySample = () => done({ ...SAMPLE_MONEY_CHECK, source: 'sample', updatedAt: new Date().toISOString() });

  if (mode.kind === 'setup') {
    return <div className="mh mh-setup-wrap">
      <MoneySetup initial={profile} startWithScan={mode.scan} onDone={done} onCancel={() => setMode({ kind: 'home' })}/>
    </div>;
  }

  const hello = profile?.name ? `Hi ${profile.name}.` : 'Welcome.';
  const updated = profile ? new Date(profile.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

  const sections = [
    ...(profile && report ? [['mh-snapshot', 'Snapshot'], ['mh-report', 'Report'], ['mh-plan', 'Plan']] : [['mh-start', 'Get started']]),
    ['mh-tools', 'Calculators'], ['mh-learn', 'Learn & markets'], ['mh-cfo', 'AI CFO'],
  ] as Array<[string, string]>;
  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  const runway = report ? (Number.isFinite(report.runwayMonths) ? (report.runwayMonths >= 24 ? `${(report.runwayMonths / 12).toFixed(1)} years` : `${report.runwayMonths.toFixed(1)} months`) : 'No outgoings') : '';

  return <div className="mh">
    <div className="mh-sticky" data-keep-clear>
    <header className="mh-head">
      <div>
        <small className="mh-kicker">Home</small>
        <h1>{profile ? `${hello} Here is your money, worked out.` : 'Your money, in one clear place.'}</h1>
        <p>{profile ? `Built ${SOURCE_LABEL[profile.source]} · updated ${updated} · saved on this device only.` : 'Answer a few simple questions, or scan a payslip, and get a complete report: tax, freedom number, insurance, emergency fund and a plan.'}</p>
      </div>
      {profile && <div className="mh-head-actions">
        <button type="button" className="mh-btn" onClick={() => setMode({ kind: 'setup', scan: false })}><UserRound size={15}/> Edit answers</button>
        <button type="button" className="mh-btn" onClick={() => setMode({ kind: 'setup', scan: true })}><FileUp size={15}/> Scan a document</button>
        <button type="button" className="mh-btn ghost" onClick={() => { if (window.confirm('Remove your money profile from this device?')) clearMoneyProfile(); }}><RotateCcw size={15}/> Start over</button>
      </div>}
    </header>

    <SectionNav sections={sections} onGo={goTo}/>
    </div>

    {!profile && <motion.section id="mh-start" className="mh-start mh-anchor" initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <button type="button" className="mh-start-card primary" onClick={() => setMode({ kind: 'setup', scan: false })}>
        <ClipboardList size={22}/><b>Answer about 12 quick questions</b><span>One at a time, mostly taps. About two minutes.</span><em>Start <ArrowRight size={14}/></em>
      </button>
      <button type="button" className="mh-start-card" onClick={() => setMode({ kind: 'setup', scan: true })}>
        <FileUp size={22}/><b>Scan a payslip or statement</b><span>PDF payslip, Form 16 or bank CSV. Read on your device; you confirm every number.</span><em>Upload <ArrowRight size={14}/></em>
      </button>
      <button type="button" className="mh-start-card" onClick={trySample}>
        <Sparkles size={22}/><b>Look around with a sample</b><span>See a full report for a sample 29-year-old, then replace it with yours.</span><em>Try it <ArrowRight size={14}/></em>
      </button>
    </motion.section>}

    {profile && report && <>
      <section id="mh-snapshot" className="mh-snapshot mh-anchor" aria-label="Snapshot">
        {[
          ['Money health', `${report.health.score}/100`, report.health.status],
          ['Net worth', shortInr(report.netWorth), 'Cash + investments − loans'],
          ['Monthly surplus', shortInr(report.cashflow.surplus), `${Math.round(report.cashflow.savingsRate * 100)}% of take-home`],
          ['If income stops', runway, 'Savings and investments cover spending + EMIs'],
          ['Financially free by', report.freedom.freedomAge ? `Age ${report.freedom.freedomAge}` : 'Not yet', 'Investing your full surplus'],
        ].map(([k, v, sub], i) => <motion.div key={k} className="mh-stat" initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <small>{k}</small><b>{v}</b><span>{sub}</span>
        </motion.div>)}
      </section>

      <section id="mh-report" className="mh-report mh-anchor" aria-labelledby="mh-report-title">
        <h2 id="mh-report-title">Your money report</h2>
        <MoneyReportView report={report} onAsk={() => ask(moneyAskPrompt(profile, report))}/>
      </section>

      <section id="mh-plan" className="mh-areas mh-anchor" aria-labelledby="mh-areas-title">
        <h2 id="mh-areas-title">Your plan, area by area</h2>
        <div className="mh-area-grid">
          {AREAS.map((area, i) => {
            const Icon = area.icon;
            return <motion.article key={area.id} className={`mh-area a-${area.id}`} initial={reduced ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ delay: i * 0.06 }}>
              <header><span className="mh-area-icon"><Icon size={18}/></span><div><small>0{i + 1}</small><b>{area.title}</b></div></header>
              <p>{area.line(report)}</p>
              <ul>{area.links.map((link) => <li key={link.label}>
                <button type="button" onClick={() => ('to' in link ? onNavigate(link.to) : askWithContext(link.ask))}>{link.label}<span>{'to' in link ? 'Open' : 'Ask AI'} <ArrowRight size={13}/></span></button>
              </li>)}</ul>
            </motion.article>;
          })}
        </div>
      </section>
    </>}

    <section id="mh-tools" className="mh-tools mh-anchor" aria-labelledby="mh-tools-title">
      <h2 id="mh-tools-title">Calculators</h2>
      <p className="mh-section-sub">{CALCULATOR_COUNT} India-specific calculators for investing, safe savings, tax, loans and retirement.{profile ? ' Your numbers are filled in already.' : ''}</p>
      <CalculatorsHub profile={profile}/>
    </section>

    <section id="mh-learn" className="mh-learn mh-anchor" aria-labelledby="mh-learn-title">
      <h2 id="mh-learn-title">Learn & markets</h2>
      <div className="mh-link-grid">
        {LEARN_LINKS.map(([label, sub, to]) => <button key={to} type="button" className="mh-link" onClick={() => onNavigate(to)}><b>{label}</b><span>{sub}</span><ArrowRight size={15}/></button>)}
      </div>
    </section>

    <section id="mh-cfo" ref={cfoRef} className="mh-cfo mh-anchor" aria-labelledby="mh-cfo-title">
      <div className="mh-cfo-copy">
        <small className="mh-kicker">AI CFO</small>
        <h2 id="mh-cfo-title">Ask anything about your money.</h2>
        <p>{profile ? 'Your verified numbers are shared with the AI CFO when you ask from the report, so answers are about you, not a generic example.' : 'Ask in English, Hindi or Hinglish. Set up your profile first for answers that use your own numbers.'}</p>
      </div>
      <div className="mh-cfo-chat"><AiCfoChat externalPrompt={cfoPrompt} compact offerPlan={false}/></div>
    </section>
  </div>;
};
