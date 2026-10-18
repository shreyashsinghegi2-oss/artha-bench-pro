import React, { useEffect, useRef, useState } from 'react';
import { BadgeCheck, FileLock2, Languages, LineChart, Mic, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';
import { formatPrice, QUOTE_NAMES, useHeroMarket } from './HeroTicker';
import './landingStory.css';

/**
 * What ArthaMind does, told as one scroll story (Groww F&O style): the stage stays pinned while the
 * visitor scrolls, and each step swaps the short text on the left and the product picture on the right.
 * Pictures are drawn in code from the same sample numbers the Money Check uses, so they stay sharp and
 * honest. Reduced-motion visitors get the same chapters as a plain list.
 */

type Chapter = { id: string; eyebrow: string; title: string; text: string; points: string[]; Visual: React.FC };

const Ring: React.FC<{ value: number }> = ({ value }) => (
  <svg viewBox="0 0 120 120" className="st-ring" aria-hidden="true">
    <circle cx="60" cy="60" r="50" className="st-ring-bg" />
    <circle cx="60" cy="60" r="50" className="st-ring-fg" strokeDasharray={`${(value / 100) * 314} 314`} />
    <text x="60" y="66" textAnchor="middle">{value}</text>
  </svg>
);

/** 1. The CFO idea: three goals. */
const VisualWhy: React.FC = () => (
  <div className="st-panel st-why">
    <div className="st-why-mark"><ArthaMindLogoMark size={56} tone="light" cut="transparent" /></div>
    {[['Grow your money', 'True returns (XIRR), where a lump sum should go'], ['Secure your future', 'Emergency fund, insurance cover, freedom number'], ['Decide with confidence', 'Working and sources shown, in your language']].map(([b, s], i) => (
      <div key={b} className="st-why-card" style={{ '--i': i } as React.CSSProperties}>
        <i>{['₹', '◎', '✓'][i]}</i><b>{b}</b><span>{s}</span>
      </div>
    ))}
  </div>
);

/** 2. AI CFO: a question, the checked answer. */
const VisualCfo: React.FC = () => (
  <div className="st-panel st-chat">
    <div className="st-chat-head"><ArthaMindLogoMark size={22} tone="light" cut="transparent" /><b>AI CFO</b><span className="st-live">online</span></div>
    <p className="st-q">I earn ₹12,00,000 a year. Old or new tax regime?</p>
    <div className="st-a">
      <b>New regime saves you ₹1,63,800 this year.</b>
      <span>Old: ₹1,63,800 tax · New: ₹0 (rebate under 87A)</span>
      <ol><li>Tell your employer you choose the new regime</li><li>Check that TDS matches from April</li></ol>
      <em><BadgeCheck size={14} aria-hidden="true" /> Checked by the tax engine · FY 2026-27 slabs</em>
    </div>
  </div>
);

/** 3. Money Check: score and the six numbers. */
const VisualCheck: React.FC = () => (
  <div className="st-panel st-check">
    <div className="st-check-top"><Ring value={93} /><div><small>Money health</small><b>Strong</b><span>You keep 75% of take-home. EMIs use 5% of income.</span></div></div>
    <div className="st-tiles">
      {[['Better tax regime', 'New · saves ₹1,63,800', 'ok'], ['Monthly take-home', '₹1,00,000', 'ok'], ['Freedom number', '₹3,08,59,391', 'plan'], ['Emergency fund', 'Gap ₹29,800', 'act'], ['Term insurance', 'Gap ₹61,24,089', 'act'], ['Net worth', '₹1,80,200', 'ok']].map(([k, v, t]) => (
        <div key={k} className={`st-tile ${t}`}><small>{k}</small><b>{v}</b></div>
      ))}
    </div>
    <p className="st-sample">Sample profile: age 30, salary ₹12 lakh</p>
  </div>
);

/** 4. Goals: a Monte Carlo fan for retirement. */
const VisualGoals: React.FC = () => {
  const xs = Array.from({ length: 13 }, (_, i) => i);
  const path = (k: number) => xs.map((i) => `${i === 0 ? 'M' : 'L'}${20 + i * 25},${150 - Math.pow(i / 12, 1.6) * k}`).join(' ');
  return (
    <div className="st-panel st-goals">
      <div className="st-goal-head"><small>Retirement</small><b>Freedom number ₹3,08,59,391</b><span>SIP ₹14,338 a month · range across 1,000 market paths</span></div>
      <svg viewBox="0 0 340 160" className="st-fan" aria-hidden="true">
        <path d={`${path(128)} L320,150 L20,150 Z`} className="st-fan-hi" />
        <path d={`${path(92)} L320,150 L20,150 Z`} className="st-fan-mid" />
        <path d={path(92)} className="st-fan-line" />
        <line x1="20" x2="320" y1={150 - 100} y2={150 - 100} className="st-fan-goal" />
        <text x="24" y={150 - 104} className="st-fan-label">Goal</text>
      </svg>
      <div className="st-chips">{['Retirement', 'Child education', 'Home', 'Job switch', 'Emergency fund'].map((c) => <span key={c}>{c}</span>)}</div>
      <p className="st-sample">Illustration from the sample profile</p>
    </div>
  );
};

/** 5. Markets: live quotes (only real quotes; a calm note when none have loaded). */
const VisualMarkets: React.FC = () => {
  const { quotes, nifty } = useHeroMarket();
  const pts = nifty.length > 1 ? nifty : [];
  const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const up = pts.length > 1 ? pts[pts.length - 1] >= pts[0] : true;
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * 340},${118 - ((p - min) / span) * 100}`).join(' ');
  const nf = quotes.find((q) => q.symbol === '^NSEI');
  return (
    <div className="st-panel st-markets">
      <div className="st-mk-head"><small>NIFTY 50 · today</small><b>{nf ? formatPrice(nf) : '—'}</b>{nf && <em className={Number(nf.changePercent ?? 0) >= 0 ? 'up' : 'down'}>{Number(nf.changePercent ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(Number(nf.changePercent ?? 0)).toFixed(2)}%</em>}</div>
      {pts.length > 1 ? (
        <svg viewBox="0 0 340 124" preserveAspectRatio="none" className="st-mk-chart" aria-hidden="true">
          <path d={`${d} L340,124 L0,124 Z`} className={up ? 'st-mk-fill up' : 'st-mk-fill down'} />
          <path d={d} className={up ? 'st-mk-line up' : 'st-mk-line down'} />
        </svg>
      ) : <div className="st-mk-empty">Live chart appears when the market feed answers</div>}
      <ul className="st-mk-list">
        {quotes.filter((q) => q.symbol !== '^NSEI').slice(0, 4).map((q) => {
          const c = Number(q.changePercent ?? 0);
          return <li key={q.symbol}><b>{QUOTE_NAMES[q.symbol] ?? q.symbol}</b><span>{formatPrice(q)}</span><em className={c >= 0 ? 'up' : 'down'}>{c >= 0 ? '+' : '−'}{Math.abs(c).toFixed(2)}%</em></li>;
        })}
      </ul>
    </div>
  );
};

/** 6. Languages by voice. */
const VisualLanguages: React.FC = () => (
  <div className="st-panel st-lang">
    {[['हिन्दी', 'क्या मुझे होम लोन पहले चुकाना चाहिए?'], ['தமிழ்', 'என் அவசர நிதி போதுமா?'], ['বাংলা', 'নতুন কর ব্যবস্থায় আমার কত সাশ্রয়?'], ['Hinglish', 'SIP kitna karun retirement ke liye?']].map(([l, q], i) => (
      <div key={l} className="st-bubble" style={{ '--i': i } as React.CSSProperties}><small>{l}</small>{q}</div>
    ))}
    <div className="st-mic"><Mic size={22} aria-hidden="true" /><span>Tap and speak</span></div>
  </div>
);

/** 7. Checked and private. */
const VisualTrust: React.FC = () => (
  <div className="st-panel st-trust">
    <div className="st-trust-row"><BadgeCheck size={20} aria-hidden="true" /><div><b>Formula shown</b><span>Tax slabs, EMI, SIP and XIRR from tested code, not the AI</span></div></div>
    <div className="st-trust-row"><LineChart size={20} aria-hidden="true" /><div><b>Sources listed</b><span>Official rules and live data behind every answer</span></div></div>
    <div className="st-trust-row"><FileLock2 size={20} aria-hidden="true" /><div><b>Read on your device</b><span>Statements you upload are parsed in your browser, never sent</span></div></div>
    <div className="st-trust-row"><ShieldCheck size={20} aria-hidden="true" /><div><b>Your data is yours</b><span>Row-level security; we never sell it</span></div></div>
  </div>
);

const CHAPTERS: Chapter[] = [
  { id: 'why', eyebrow: 'Why ArthaMind', title: 'A CFO for every Indian family.', text: 'Companies have a CFO who checks every number before a big decision. Most families do not. ArthaMind reads your money, does the maths and tells you what to do next.', points: ['Grow your money', 'Secure your future', 'Decide with confidence'], Visual: VisualWhy },
  { id: 'cfo', eyebrow: 'AI CFO', title: 'Ask anything. Get a checked answer.', text: 'Old or new tax regime, prepay the home loan or invest, how big an emergency fund. You ask, our engine does the maths, you get a clear next step.', points: ['Answers in plain rupees', 'Working and assumptions shown', 'Tax, loans, goals and business cash flow'], Visual: VisualCfo },
  { id: 'check', eyebrow: 'Money Check', title: 'Six numbers. Your complete money report.', text: 'Fill it once. Your money health score, better tax regime, freedom number, insurance gaps, emergency fund and net worth, with what to fix first.', points: ['Ready in about 2 minutes', 'Calculated on your device', 'Free forever'], Visual: VisualCheck },
  { id: 'goals', eyebrow: 'Plan every goal', title: 'See your future before it happens.', text: 'Retirement, your child’s education in India or abroad, a home, a job switch. Plans built from your real numbers and tested across a thousand market paths.', points: ['Monthly SIP for every goal', 'Inflation shown year by year', 'What-if scenarios'], Visual: VisualGoals },
  { id: 'markets', eyebrow: 'Invest and track', title: 'Your portfolio and the market, live.', text: 'Import your mutual fund statement, see true returns (XIRR), and follow NIFTY, SENSEX, US stocks, gold and crypto as they move.', points: ['CAS import in one step', 'India, US, forex and crypto', 'Education, never stock tips'], Visual: VisualMarkets },
  { id: 'lang', eyebrow: 'Your language', title: 'Speak to it in 13 Indian languages.', text: 'Hindi, Tamil, Bengali, Marathi, Telugu, Hinglish and more, by voice or text. Simple enough for your parents to use.', points: ['Voice in and voice out', '13 Indian + 7 international languages', 'Learn at your own pace'], Visual: VisualLanguages },
  { id: 'trust', eyebrow: 'Checked and private', title: 'Every number checked. Your data stays yours.', text: 'Numbers come from tested formulas, never from the AI guessing. Documents are read on your device.', points: ['Evidence first', 'Export or delete any time', 'Never sold'], Visual: VisualTrust },
];

const ICONS = [Sparkles, Sparkles, Target, Target, LineChart, Languages, ShieldCheck];

export const LandingStory: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const range = el.offsetHeight - window.innerHeight;
      const p = range > 0 ? Math.min(1, Math.max(0, -r.top / range)) : 0;
      el.style.setProperty('--p', p.toFixed(4));
      setStep(Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length)));
    };
    const on = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); if (frame) cancelAnimationFrame(frame); };
  }, [reduced]);

  /** Jump to a chapter from the progress rail. */
  const go = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const range = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: el.offsetTop + (range * (i + 0.5)) / CHAPTERS.length, behavior: 'smooth' });
  };

  if (reduced) {
    return (
      <section id="features" className="st st-static" aria-label="What ArthaMind does">
        {CHAPTERS.map(({ id, eyebrow, title, text, points, Visual }) => (
          <article key={id} className="st-static-row">
            <div className="st-copy"><small>{eyebrow}</small><h2>{title}</h2><p>{text}</p><ul>{points.map((p) => <li key={p}>{p}</li>)}</ul></div>
            <div className="st-visual"><Visual /></div>
          </article>
        ))}
      </section>
    );
  }

  return (
    <section id="features" ref={ref} className="st" style={{ height: `${CHAPTERS.length * 85 + 40}svh` }} aria-label="What ArthaMind does">
      <div className="st-stage">
        <div className="st-glow" aria-hidden="true" />
        <div className="st-inner">
          <div className="st-left">
            <div className="st-texts">
              {CHAPTERS.map(({ id, eyebrow, title, text, points }, i) => {
                const Icon = ICONS[i];
                return (
                  <article key={id} className={'st-copy' + (i === step ? ' on' : i < step ? ' past' : '')} aria-hidden={i !== step}>
                    <small><Icon size={14} aria-hidden="true" /> {eyebrow}</small>
                    <h2>{title}</h2>
                    <p>{text}</p>
                    <ul>{points.map((p) => <li key={p}>{p}</li>)}</ul>
                  </article>
                );
              })}
            </div>
            <div className="st-foot">
              <button type="button" className="st-cta" onClick={onStart}>Sign up free</button>
              <nav className="st-rail" aria-label="Story steps">
                {CHAPTERS.map((c, i) => <button key={c.id} type="button" className={i === step ? 'on' : ''} aria-label={c.eyebrow} aria-current={i === step ? 'step' : undefined} onClick={() => go(i)} />)}
              </nav>
            </div>
          </div>
          <div className="st-right">
            {CHAPTERS.map(({ id, Visual }, i) => (
              <div key={id} className={'st-visual' + (i === step ? ' on' : i < step ? ' past' : '')} aria-hidden={i !== step}>
                {Math.abs(i - step) <= 1 && <Visual />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
