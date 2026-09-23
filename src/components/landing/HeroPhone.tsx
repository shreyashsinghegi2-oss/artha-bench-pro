import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { BarChart3, Globe2, Home, MessageSquareQuote, ReceiptText, Star } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../LanguageSelector';
import { LANDING_REVIEWS } from '../../data/landingReviews';
import { buildMoneyCheck, type MoneyCheckInputs } from '../../services/moneyCheck';

/** Sample profile shown on the phone; every money figure is computed from it by the Money Check engine. */
const HERO_SAMPLE: MoneyCheckInputs = { age: 28, annualSalary: 1_200_000, monthlyExpenses: 45_000, monthlyEmi: 8_000, liquidSavings: 200_000, investments: 650_000, dependants: 0, section80C: 150_000, section80D: 25_000, retireAge: 60 };
const REPORT = buildMoneyCheck(HERO_SAMPLE);

/**
 * Hero phone: a continuously running tour of the app on a phone screen. It keeps playing on hover
 * and click (it only rests while off-screen or in a background tab, to save battery). Figures on the
 * money screens are a labelled sample profile; market prices are a labelled demo feed, not live data.
 */

const SCREEN_MS = 3600;
const SCREENS = ['home', 'markets', 'tax', 'languages', 'community'] as const;
type Screen = typeof SCREENS[number];
const TAB_META: Record<Screen, { label: string; icon: React.ComponentType<{ size?: number }> }> = {
  home: { label: 'Home', icon: Home },
  markets: { label: 'Markets', icon: BarChart3 },
  tax: { label: 'Tax', icon: ReceiptText },
  languages: { label: 'Language', icon: Globe2 },
  community: { label: 'People', icon: MessageSquareQuote },
};

const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

/** Animates from the previous value to `target` whenever it changes. */
function useCountUp(target: number, duration = 900, run = true): number {
  const [value, setValue] = useState(run ? 0 : target);
  const from = useRef(0);
  useEffect(() => {
    if (!run) { setValue(target); return; }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(origin + (target - origin) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, run]);
  return value;
}

const Count: React.FC<{ to: number; format?: (v: number) => string; run: boolean; duration?: number }> = ({ to, format = (v) => Math.round(v).toLocaleString('en-IN'), run, duration }) => {
  const v = useCountUp(to, duration, run);
  return <>{format(v)}</>;
};

/** Illustrated portrait used until a real, licensed photo is supplied via `photoSrc`. */
const Portrait: React.FC<{ photoSrc?: string }> = ({ photoSrc }) => photoSrc
  ? <img className="hp-avatar" src={photoSrc} alt="" width={44} height={44}/>
  : <svg className="hp-avatar" viewBox="0 0 64 64" aria-hidden="true">
      <defs><linearGradient id="hp-av-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fde68a"/><stop offset="1" stopColor="#fca5a5"/></linearGradient></defs>
      <circle cx="32" cy="32" r="32" fill="url(#hp-av-bg)"/>
      <path d="M12 64c2-12 10-18 20-18s18 6 20 18z" fill="#0f766e"/>
      <path d="M26 40h12v8a6 6 0 0 1-12 0z" fill="#c68863"/>
      <ellipse cx="32" cy="29" rx="11" ry="12.5" fill="#d99a72"/>
      <path d="M20 29c-1-10 5-17 13-17 9 0 14 7 12 17-2-6-6-9-12-9-6 0-10 3-13 9z" fill="#1f2937"/>
      <path d="M19 30c-2 8 0 16 4 19-1-7-1-13 0-19z M45 30c2 8 0 16-4 19 1-7 1-13 0-19z" fill="#1f2937"/>
      <circle cx="28" cy="30" r="1.3" fill="#1f2937"/><circle cx="36" cy="30" r="1.3" fill="#1f2937"/>
      <path d="M29 35.5c1.8 1.4 4.2 1.4 6 0" stroke="#7c2d12" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
    </svg>;

// Demo market feed: starting values drift a little each tick. Clearly labelled as not live.
type Row = { name: string; value: number; change: number; decimals: number };
const MARKETS: Record<'India' | 'US' | 'Forex' | 'Intraday', Row[]> = {
  India: [{ name: 'NIFTY 50', value: 24850, change: 0.42, decimals: 1 }, { name: 'SENSEX', value: 81420, change: 0.36, decimals: 1 }, { name: 'BANK NIFTY', value: 53210, change: -0.18, decimals: 1 }],
  US: [{ name: 'S&P 500', value: 6480, change: 0.21, decimals: 1 }, { name: 'NASDAQ', value: 21320, change: 0.48, decimals: 1 }, { name: 'DOW', value: 44910, change: -0.07, decimals: 1 }],
  Forex: [{ name: 'USD/INR', value: 86.42, change: 0.05, decimals: 2 }, { name: 'EUR/INR', value: 95.1, change: -0.12, decimals: 2 }, { name: 'GBP/INR', value: 112.3, change: 0.09, decimals: 2 }],
  Intraday: [{ name: 'RELIANCE', value: 1412.5, change: 0.64, decimals: 1 }, { name: 'TCS', value: 3380, change: -0.31, decimals: 1 }, { name: 'HDFCBANK', value: 1968.4, change: 0.22, decimals: 1 }],
};
const MARKET_TABS = Object.keys(MARKETS) as Array<keyof typeof MARKETS>;

function useDemoFeed(active: boolean) {
  const [rows, setRows] = useState(MARKETS);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setRows((cur) => Object.fromEntries((Object.entries(cur) as Array<[string, Row[]]>).map(([k, list]) => [k, list.map((r) => {
        const step = (Math.random() - 0.5) * 0.0016;
        return { ...r, value: r.value * (1 + step), change: Math.max(-2, Math.min(2, r.change + step * 100)) };
      })])) as typeof MARKETS);
    }, 1100);
    return () => window.clearInterval(id);
  }, [active]);
  return rows;
}

const PriceCell: React.FC<{ row: Row; run: boolean }> = ({ row, run }) => {
  const v = useCountUp(row.value, 700, run);
  return <b>{v.toLocaleString('en-IN', { minimumFractionDigits: row.decimals, maximumFractionDigits: row.decimals })}</b>;
};

export const HeroPhone: React.FC<{ photoSrc?: string }> = ({ photoSrc }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const reduced = Boolean(useReducedMotion());
  const [pageVisible, setPageVisible] = useState(true);
  const [index, setIndex] = useState(0);
  const [marketTab, setMarketTab] = useState(0);
  const [langIndex, setLangIndex] = useState(0);
  const [clock, setClock] = useState(() => new Date());
  const running = inView && pageVisible && !reduced;
  const screen = SCREENS[index];
  const feed = useDemoFeed(running && screen === 'markets');

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  // Screen rotation: keeps going on hover and click by design; rests only off-screen.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % SCREENS.length), SCREEN_MS);
    return () => window.clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (!running || screen !== 'markets') return;
    setMarketTab(0);
    const id = window.setInterval(() => setMarketTab((t) => (t + 1) % MARKET_TABS.length), 900);
    return () => window.clearInterval(id);
  }, [running, screen]);
  useEffect(() => {
    if (!running || screen !== 'languages') return;
    const id = window.setInterval(() => setLangIndex((i) => (i + 1) % SUPPORTED_LANGUAGES.length), 260);
    return () => window.clearInterval(id);
  }, [running, screen]);
  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const animate = !reduced;
  const reviews = LANDING_REVIEWS.slice(0, 3);
  const time = clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

  return <div ref={ref} className="hp" aria-label="App preview on a phone: sample profile and demo market feed" role="img">
    <div className={`hp-frame ${screen === 'tax' || screen === 'community' ? 'hp-light' : ''}`}>
      <div className="hp-island" aria-hidden="true"/>
      <div className="hp-status" aria-hidden="true"><span>{time}</span><span className="hp-sig"><i/><i/><i/><i/></span></div>
      <div className="hp-screen">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={screen} className={`hp-page hp-${screen}`} initial={animate ? { opacity: 0, x: 26 } : false} animate={{ opacity: 1, x: 0 }} exit={animate ? { opacity: 0, x: -26 } : undefined} transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}>
            {screen === 'home' && <>
              <header className="hp-hero">
                <Portrait photoSrc={photoSrc}/>
                <div><small>Sample profile</small><b>Good evening, Priya</b></div>
              </header>
              <div className="hp-score">
                <div className="hp-ring" style={{ '--deg': `${REPORT.health.score * 3.6}deg` } as React.CSSProperties}><b><Count to={REPORT.health.score} run={animate}/></b><span>/100</span></div>
                <div><small>Money health</small><b>{REPORT.health.status}</b><span>Savings rate <Count to={Math.round(REPORT.cashflow.savingsRate * 100)} run={animate} format={(v) => `${Math.round(v)}%`}/></span></div>
              </div>
              <div className="hp-tiles">
                <div className="t1"><small>Net worth</small><b><Count to={REPORT.netWorth} run={animate} format={inr}/></b></div>
                <div className="t2"><small>Surplus / mo</small><b><Count to={REPORT.cashflow.surplus} run={animate} format={inr}/></b></div>
                <div className="t3"><small>Free by age</small><b><Count to={REPORT.freedom.freedomAge ?? 60} run={animate}/></b></div>
                <div className="t4"><small>Emergency</small><b><Count to={REPORT.emergency.months} run={animate} format={(v) => `${v.toFixed(1)} mo`}/></b></div>
              </div>
            </>}

            {screen === 'markets' && <>
              <div className="hp-title"><b>Markets</b><small>Demo feed · not live prices</small></div>
              <div className="hp-seg" aria-hidden="true">{MARKET_TABS.map((t, i) => <span key={t} className={i === marketTab ? 'on' : ''}>{t}</span>)}</div>
              <ul className="hp-rows">{feed[MARKET_TABS[marketTab]].map((r) => <li key={r.name}>
                <span>{r.name}</span><PriceCell row={r} run={animate}/><em className={r.change >= 0 ? 'up' : 'down'}>{r.change >= 0 ? '+' : ''}{r.change.toFixed(2)}%</em>
              </li>)}</ul>
              <div className="hp-spark" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ height: `${30 + Math.abs(Math.sin((i + marketTab * 3) * 0.7)) * 60}%` }}/>)}</div>
            </>}

            {screen === 'tax' && <>
              <div className="hp-title"><b>Old vs new regime</b><small>Example · ₹12 L salary · FY 2025-26</small></div>
              <div className="hp-bars">
                <div><span>Old</span><i><motion.b initial={animate ? { width: 0 } : false} animate={{ width: `${Math.max(3, (REPORT.tax.oldRegimeTax / Math.max(REPORT.tax.oldRegimeTax, REPORT.tax.newRegimeTax, 1)) * 100)}%` }} transition={{ duration: 0.9 }}/></i><em><Count to={REPORT.tax.oldRegimeTax} run={animate} format={inr}/></em></div>
                <div className="win"><span>New</span><i><motion.b initial={animate ? { width: 0 } : false} animate={{ width: `${Math.max(3, (REPORT.tax.newRegimeTax / Math.max(REPORT.tax.oldRegimeTax, REPORT.tax.newRegimeTax, 1)) * 100)}%` }} transition={{ duration: 0.9 }}/></i><em><Count to={REPORT.tax.newRegimeTax} run={animate} format={inr}/></em></div>
              </div>
              <div className="hp-save"><small>{REPORT.tax.better === 'old' ? 'Old' : 'New'} regime saves</small><b><Count to={REPORT.tax.saving} run={animate} format={inr}/></b><span>a year on these numbers</span></div>
              <div className="hp-chips"><span>87A rebate</span><span>Std. deduction</span><span>80C · 80D</span></div>
            </>}

            {screen === 'languages' && <>
              <div className="hp-title"><b>Your language</b><small>Whole site, translated</small></div>
              <div className="hp-lang-count"><b><Count to={SUPPORTED_LANGUAGES.length} run={animate} duration={1200}/></b><span>languages</span></div>
              <div className="hp-lang-now" aria-hidden="true">{SUPPORTED_LANGUAGES[langIndex][1]}</div>
              <p className="hp-note">AI CFO answers in English, हिन्दी and Hinglish.</p>
            </>}

            {screen === 'community' && <>
              <div className="hp-title"><b>What people say</b><small>Illustrative sample comments</small></div>
              <ul className="hp-comments">{reviews.map((r, i) => <motion.li key={r.name} initial={animate ? { opacity: 0, y: 12 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.18 }}>
                <div><b>{r.name}</b><span className="hp-stars" aria-hidden="true">{Array.from({ length: r.rating }, (_, k) => <Star key={k} size={10}/>)}</span></div>
                <p>{r.quote.length > 92 ? `${r.quote.slice(0, 90)}…` : r.quote}</p>
              </motion.li>)}</ul>
            </>}
          </motion.div>
        </AnimatePresence>
      </div>
      <nav className="hp-tabbar" aria-hidden="true">{SCREENS.map((s) => { const Icon = TAB_META[s].icon; return <span key={s} className={s === screen ? 'on' : ''}><Icon size={14}/>{TAB_META[s].label}</span>; })}</nav>
    </div>
  </div>;
};
