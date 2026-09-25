import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, ExternalLink, Flame, GraduationCap, Landmark, LineChart, MessageCircleQuestion, PiggyBank, Receipt, ShieldCheck, Sparkles, Target, Upload, Wallet } from 'lucide-react';
import { lastSevenDays, loadTutorProgress, recordLesson, streak, TUTOR_PROGRESS_EVENT } from '../../services/tutorProgress';
import './tutorDashboard.css';

type Icon = React.ComponentType<{ size?: number }>;
const TRACKS: Array<{ id: string; level: 'Beginner' | 'Intermediate' | 'Advanced'; outcome: string; title: string; color: string; icon: Icon; lessons: string[] }> = [
  { id: 'basics', level: 'Beginner', outcome: 'Build a budget that works, keep a safety net and understand how inflation and compounding move your money.', title: 'Money basics', color: '#059669', icon: Wallet, lessons: ['The 50/30/20 budget', 'Building an emergency fund', 'Needs vs wants', 'Inflation and why it matters', 'The power of compounding'] },
  { id: 'saving', level: 'Beginner', outcome: 'Choose between savings accounts, FDs, RDs and small-savings schemes, and stay safe from UPI frauds.', title: 'Saving & banking', color: '#2563eb', icon: PiggyBank, lessons: ['Savings account vs FD vs RD', 'PPF, EPF and NPS explained', 'Sukanya Samriddhi Yojana', 'UPI safety and common frauds'] },
  { id: 'funds', level: 'Intermediate', outcome: 'Pick mutual funds with confidence: SIPs, index funds, direct plans, XIRR and a mix that fits your age.', title: 'Investing & mutual funds', color: '#7c3aed', icon: Target, lessons: ['What a mutual fund is', 'SIP vs lump sum', 'Index funds', 'Direct vs regular plans', 'XIRR and CAGR', 'Asset allocation by age'] },
  { id: 'stocks', level: 'Intermediate', outcome: 'Read charts and ratios, understand dividends and splits, and manage the risk of owning shares.', title: 'Stock market', color: '#d97706', icon: LineChart, lessons: ['How the stock market works', 'Reading a candlestick chart', 'P/E, EPS and ROE', 'Dividends, bonus and splits', 'Risk and diversification'] },
  { id: 'tax', level: 'Intermediate', outcome: 'Choose the right regime, use deductions, understand capital gains and file your ITR yourself.', title: 'Tax in India', color: '#0891b2', icon: Receipt, lessons: ['Old vs new tax regime', 'Section 80C and 80D', 'Capital gains tax', 'Filing your ITR step by step'] },
  { id: 'loans', level: 'Beginner', outcome: 'Understand how EMIs work, protect your credit score and decide between prepaying and investing.', title: 'Loans & credit', color: '#dc2626', icon: Landmark, lessons: ['How an EMI is calculated', 'Your credit score (CIBIL)', 'Home-loan prepayment vs investing', 'Credit-card traps to avoid'] },
  { id: 'protect', level: 'Advanced', outcome: 'Get the right life and health cover and plan a retirement income that lasts.', title: 'Insurance & retirement', color: '#4f46e5', icon: ShieldCheck, lessons: ['Term life insurance', 'Health insurance and top-ups', 'Your retirement freedom number', 'SWP and annuities'] },
];
const TOTAL_LESSONS = TRACKS.reduce((n, t) => n + t.lessons.length, 0);

/** Well-known books; the tutor summarises their key ideas in its own words. */
const BOOKS = [
  { title: 'The Psychology of Money', author: 'Morgan Housel', color: '#0f766e', idea: 'Behaviour matters more than brilliance with money.' },
  { title: "Let's Talk Money", author: 'Monika Halan', color: '#b45309', idea: 'A simple money system for Indian households.' },
  { title: 'The Intelligent Investor', author: 'Benjamin Graham', color: '#1e3a8a', idea: 'Margin of safety and the patient investor.' },
  { title: 'Rich Dad Poor Dad', author: 'Robert Kiyosaki', color: '#7c2d12', idea: 'Assets vs liabilities and financial literacy.' },
  { title: 'Coffee Can Investing', author: 'Saurabh Mukherjea', color: '#3f6212', idea: 'Buy quality Indian companies and hold for years.' },
  { title: 'The Little Book of Common Sense Investing', author: 'John C. Bogle', color: '#831843', idea: 'Low-cost index funds win over time.' },
  { title: 'One Up On Wall Street', author: 'Peter Lynch', color: '#155e75', idea: 'Invest in what you understand.' },
  { title: 'Stocks to Riches', author: 'Parag Parikh', color: '#4c1d95', idea: 'The investor psychology behind market mistakes.' },
];

/** Official and trusted free learning sites; several offer PDF downloads. */
const GUIDES = [
  { name: 'SEBI Investor Education', by: 'Securities and Exchange Board of India', url: 'https://investor.sebi.gov.in/', tag: 'Official' },
  { name: 'RBI Financial Education', by: 'Reserve Bank of India', url: 'https://www.rbi.org.in/FinancialEducation/Home.aspx', tag: 'Official' },
  { name: 'NCFE free e-learning', by: 'National Centre for Financial Education', url: 'https://ncfe.org.in/', tag: 'Official' },
  { name: 'Mutual Funds Sahi Hai', by: 'AMFI investor awareness', url: 'https://www.mutualfundssahihai.com/en', tag: 'Industry body' },
  { name: 'Income Tax e-filing', by: 'Income Tax Department', url: 'https://www.incometax.gov.in/', tag: 'Official' },
  { name: 'Varsity modules (PDF)', by: 'Zerodha Varsity, free', url: 'https://zerodha.com/varsity/', tag: 'Free PDFs' },
];

/** Learning dashboard at the top of the tutor: progress, course tracks, books and official guides. */
export const TutorDashboard: React.FC<{ onAsk: (prompt: string) => void }> = ({ onAsk }) => {
  const [p, setP] = useState(loadTutorProgress);
  const [openTrack, setOpenTrack] = useState(TRACKS[0].id);
  useEffect(() => { const s = () => setP(loadTutorProgress()); window.addEventListener(TUTOR_PROGRESS_EVENT, s); return () => window.removeEventListener(TUTOR_PROGRESS_EVENT, s); }, []);
  const week = useMemo(() => lastSevenDays(p), [p]);
  const peak = Math.max(1, ...week.map((d) => d.count));
  const accuracy = p.quizTotal ? p.quizCorrect / p.quizTotal : null;
  const accTone = accuracy == null ? 'info' : accuracy >= 0.7 ? 'good' : accuracy >= 0.4 ? 'warn' : 'bad';
  const track = TRACKS.find((t) => t.id === openTrack) ?? TRACKS[0];

  const teach = (t: typeof TRACKS[number], lesson: string, i: number) => {
    recordLesson(`${t.id}:${i}`);
    onAsk(`Teach me "${lesson}" (${t.title}) step by step for an Indian learner: explain simply, give a worked example in rupees, show any formula, and end with 3 quick check questions.`);
  };

  return <section className="td" aria-label="Learning dashboard">
    <div className="td-kpis">
      <article className="td-kpi good"><span className="td-ico"><GraduationCap size={17}/></span><small>Lessons taken</small><b>{p.lessons.length}<em>/{TOTAL_LESSONS}</em></b><i className="td-bar"><span style={{ width: `${(p.lessons.length / TOTAL_LESSONS) * 100}%` }}/></i></article>
      <article className="td-kpi info"><span className="td-ico"><MessageCircleQuestion size={17}/></span><small>Questions asked</small><b>{p.questions}</b><span className="td-note">Ask anything about money or maths</span></article>
      <article className={`td-kpi ${accTone}`}><span className="td-ico"><CheckCircle2 size={17}/></span><small>Quiz accuracy</small><b>{accuracy == null ? '—' : `${Math.round(accuracy * 100)}%`}</b><span className="td-note">{p.quizTotal ? `${p.quizCorrect} of ${p.quizTotal} correct` : 'Take a quiz to see it'}</span></article>
      <article className="td-kpi warn"><span className="td-ico"><Flame size={17}/></span><small>Day streak</small><b>{streak(p)}<em> days</em></b>
        <div className="td-week" aria-label="Activity in the last 7 days">{week.map((d) => <span key={d.label + d.count} title={`${d.label}: ${d.count}`}><i style={{ height: `${Math.max(8, (d.count / peak) * 100)}%` }} className={d.count ? 'on' : ''}/><small>{d.label[0]}</small></span>)}</div>
      </article>
    </div>

    <div className="td-grid">
      <article className="td-card">
        <header><h3><Sparkles size={16}/> Course tracks</h3><small>Pick a lesson; the tutor teaches it with examples and a quick check.</small></header>
        <div className="td-tracks" role="tablist">{TRACKS.map((t) => { const Icon = t.icon; const done = t.lessons.filter((_, i) => p.lessons.includes(`${t.id}:${i}`)).length; return <button key={t.id} type="button" role="tab" aria-selected={t.id === openTrack} className={`td-track ${t.id === openTrack ? 'on' : ''}`} style={{ '--c': t.color } as React.CSSProperties} onClick={() => setOpenTrack(t.id)}>
          <span className="td-track-ico"><Icon size={15}/></span><span><b>{t.title}</b><small>{done}/{t.lessons.length} lessons</small></span><i className="td-ring" style={{ '--p': done / t.lessons.length } as React.CSSProperties}/>
        </button>; })}</div>
        {(() => { const done = track.lessons.filter((_, i) => p.lessons.includes(`${track.id}:${i}`)).length; const next = track.lessons.findIndex((_, i) => !p.lessons.includes(`${track.id}:${i}`)); return <div className="td-course" style={{ '--c': track.color } as React.CSSProperties}>
          <div className="td-course-top"><b>{track.title}</b><span className={`td-level ${track.level.toLowerCase()}`}>{track.level}</span><span className="td-meta">{track.lessons.length} lessons · about {track.lessons.length * 12} min · final quiz</span></div>
          <p>{track.outcome}</p>
          <i className="td-bar"><span style={{ width: `${(done / track.lessons.length) * 100}%`, background: track.color }}/></i>
          <div className="td-course-actions">
            {next >= 0 ? <button type="button" className="primary" onClick={() => teach(track, track.lessons[next], next)}>{done ? 'Continue' : 'Start course'}: {track.lessons[next]}</button> : <span className="td-done">Course complete ✓</span>}
            <button type="button" onClick={() => onAsk(`Give me a 10-question final quiz for the course "${track.title}" covering: ${track.lessons.join(', ')}. Mix multiple-choice and calculation questions with Indian rupee examples. Show the answers with short explanations at the end.`)}>Take the final quiz</button>
          </div>
        </div>; })()}
        <ol className="td-lessons" style={{ '--c': track.color } as React.CSSProperties} key={track.id}>{track.lessons.map((l, i) => { const done = p.lessons.includes(`${track.id}:${i}`); return <li key={l} style={{ '--i': i } as React.CSSProperties}>
          <button type="button" onClick={() => teach(track, l, i)} className={done ? 'done' : ''}><span className="td-num">{done ? <CheckCircle2 size={14}/> : i + 1}</span><span>{l}</span><em>{done ? 'Review' : 'Start'}</em></button>
        </li>; })}</ol>
      </article>

      <article className="td-card">
        <header><h3><BookOpen size={16}/> Bookshelf</h3><small>Classic money books; the tutor explains their key lessons.</small></header>
        <div className="td-books">{BOOKS.map((b, i) => <button key={b.title} type="button" className="td-book" style={{ '--c': b.color, '--i': i } as React.CSSProperties} onClick={() => onAsk(`Explain the key money lessons from the book "${b.title}" by ${b.author} in simple words for an Indian reader, with how to apply each one. Use your own words.`)}>
          <span className="td-cover"><b>{b.title}</b><small>{b.author}</small></span><span className="td-idea">{b.idea}</span>
        </button>)}</div>
      </article>
    </div>

    <article className="td-card td-guides-card">
      <header><h3><ExternalLink size={16}/> Official guides & free PDFs</h3><small>Trusted, free sources from regulators and investor-education bodies.</small>
        <button type="button" className="td-upload" onClick={() => document.querySelector('.tl')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Upload size={14}/> Learn from your own PDF</button></header>
      <div className="td-guides">{GUIDES.map((g) => <a key={g.url} href={g.url} target="_blank" rel="noopener noreferrer" className="td-guide">
        <span className={`td-tag ${g.tag === 'Official' ? 'good' : 'info'}`}>{g.tag}</span><b>{g.name}</b><small>{g.by}</small><em>Open <ExternalLink size={12}/></em>
      </a>)}</div>
    </article>
  </section>;
};
