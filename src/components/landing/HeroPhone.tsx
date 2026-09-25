import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { CompanyLogo, companyLogoSrc, hasMarketMark } from '../market/CompanyLogo';
import { BarChart3, Bell, BookOpen, Bot, Calculator, Check, EyeOff, Home, KeyRound, LayoutGrid, LockKeyhole, Newspaper, ReceiptText, ShieldCheck, Sparkles, Star, Target, Wallet } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../LanguageSelector';
import { LANDING_REVIEWS } from '../../data/landingReviews';
import { buildMoneyCheck, type MoneyCheckInputs } from '../../services/moneyCheck';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';

/**
 * Hero phone: a continuously running tour of the app. It keeps playing on hover and click and only
 * rests while off-screen or in a background tab. Money figures are computed by the Money Check engine
 * for a labelled sample profile; market prices are a labelled demo feed, not live data.
 */

const HERO_SAMPLE: MoneyCheckInputs = { age: 28, annualSalary: 1_200_000, monthlyExpenses: 45_000, monthlyEmi: 8_000, liquidSavings: 200_000, investments: 650_000, dependants: 0, section80C: 150_000, section80D: 25_000, retireAge: 60 };
export const HERO_REPORT = buildMoneyCheck(HERO_SAMPLE);

/** "Hello" in each supported language, keyed by the codes in SUPPORTED_LANGUAGES. */
const GREETINGS: Record<string, string> = {
  en: 'Hello', hi: 'नमस्ते', mr: 'नमस्कार', gu: 'નમસ્તે', bn: 'নমস্কার', ta: 'வணக்கம்', te: 'నమస్కారం', kn: 'ನಮಸ್ಕಾರ', ml: 'നമസ്കാരം', pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ',
  ur: 'السلام علیکم', or: 'ନମସ୍କାର', as: 'নমস্কাৰ', es: 'Hola', fr: 'Bonjour', de: 'Hallo', ar: 'مرحبا', pt: 'Olá', it: 'Ciao', ja: 'こんにちは',
};

/** Cycles through the supported languages; shared by the phone and the hero badge. */
export function useLanguageCycle(running: boolean, ms = 900) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % SUPPORTED_LANGUAGES.length), ms);
    return () => window.clearInterval(id);
  }, [running, ms]);
  const [code, name] = SUPPORTED_LANGUAGES[i];
  return { index: i, total: SUPPORTED_LANGUAGES.length, code, name, greeting: GREETINGS[code] ?? 'Hello' };
}

const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

/** Animates to `target`; starts from `initial` (0 for count-ups, the current value for live prices). */
function useCountUp(target: number, duration = 900, run = true, initial = 0): number {
  const [value, setValue] = useState(run ? initial : target);
  const from = useRef(initial);
  useEffect(() => {
    if (!run) { setValue(target); return; }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      // rAF timestamps can precede the start time by a few ms; clamp so the value never runs negative.
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setValue(origin + (target - origin) * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick); else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, run]);
  return value;
}
const Count: React.FC<{ to: number; format?: (v: number) => string; run: boolean; duration?: number }> = ({ to, format = (v) => Math.round(v).toLocaleString('en-IN'), run, duration }) => <>{format(useCountUp(to, duration, run))}</>;

/** Illustrated portrait; pass `photoSrc` to use a real, licensed photo instead. */
const Portrait: React.FC<{ photoSrc?: string }> = ({ photoSrc }) => photoSrc
  ? <img className="hp-avatar" src={photoSrc} alt="" width={36} height={36}/>
  : <svg className="hp-avatar" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="#dbeafe"/>
      <path d="M12 64c2-12 10-18 20-18s18 6 20 18z" fill="#0f766e"/>
      <path d="M26 40h12v8a6 6 0 0 1-12 0z" fill="#c68863"/>
      <ellipse cx="32" cy="29" rx="11" ry="12.5" fill="#d99a72"/>
      <path d="M20 29c-1-10 5-17 13-17 9 0 14 7 12 17-2-6-6-9-12-9-6 0-10 3-13 9z" fill="#1f2937"/>
      <path d="M19 30c-2 8 0 16 4 19-1-7-1-13 0-19z M45 30c2 8 0 16-4 19 1-7 1-13 0-19z" fill="#1f2937"/>
      <circle cx="28" cy="30" r="1.3" fill="#1f2937"/><circle cx="36" cy="30" r="1.3" fill="#1f2937"/>
      <path d="M29 35.5c1.8 1.4 4.2 1.4 6 0" stroke="#7c2d12" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
    </svg>;

/**
 * Rows use the owner-supplied company logo when one exists (see CompanyLogo), otherwise a badge in the
 * company's brand colour with its ticker initials.
 */
type Row = { name: string; ticker: string; badge: string; color: string; value: number; change: number; decimals: number; logo?: string };
const MARKETS: Record<'India' | 'US' | 'Gold & Oil' | 'Forex', Row[]> = {
  India: [
    { name: 'Reliance', ticker: 'RELIANCE', badge: 'RIL', color: '#0a3d91', value: 1412.5, change: 0.64, decimals: 1 },
    { name: 'TCS', ticker: 'TCS', badge: 'TCS', color: '#1f3b8c', value: 3380, change: -0.31, decimals: 1 },
    { name: 'HDFC Bank', ticker: 'HDFCBANK', badge: 'HB', color: '#004c8f', value: 1968.4, change: 0.22, decimals: 1 },
  ],
  US: [
    { name: 'Apple', ticker: 'AAPL', badge: 'AAPL', color: '#111827', value: 228.6, change: 0.35, decimals: 2 },
    { name: 'Microsoft', ticker: 'MSFT', badge: 'MSFT', color: '#0078d4', value: 512.3, change: 0.48, decimals: 2 },
    { name: 'NVIDIA', ticker: 'NVDA', badge: 'NVDA', color: '#76b900', value: 178.9, change: -0.27, decimals: 2 },
  ],
  'Gold & Oil': [
    { name: 'Gold', ticker: 'GOLD', badge: 'Au', color: '#b7791f', value: 2386.4, change: 0.54, decimals: 1 },
    { name: 'Crude oil (WTI)', ticker: 'CL=F', badge: 'OIL', color: '#0b0f14', value: 78.62, change: -0.83, decimals: 2 },
    { name: 'ONGC', ticker: 'ONGC', badge: 'ONGC', color: '#7c2d12', value: 268.4, change: -0.41, decimals: 1 },
  ],
  Forex: [
    { name: 'US dollar', ticker: 'USD/INR', badge: '$', color: '#15803d', value: 86.42, change: 0.05, decimals: 2 },
    { name: 'Euro', ticker: 'EUR/INR', badge: '€', color: '#1d4ed8', value: 95.1, change: -0.12, decimals: 2 },
    { name: 'Pound', ticker: 'GBP/INR', badge: '£', color: '#7c2d12', value: 112.3, change: 0.09, decimals: 2 },
  ],
};
const MARKET_TABS = Object.keys(MARKETS) as Array<keyof typeof MARKETS>;
/** When the US, Forex and Intraday tabs open (ms into the markets screen). */
const TAB_AT = [1900, 2900, 3900];

function useDemoFeed(active: boolean) {
  const [rows, setRows] = useState(MARKETS);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setRows((cur) => Object.fromEntries((Object.entries(cur) as Array<[string, Row[]]>).map(([k, list]) => [k, list.map((r) => {
        const step = (Math.random() - 0.5) * 0.0018;
        return { ...r, value: r.value * (1 + step), change: Math.max(-2, Math.min(2, r.change + step * 100)) };
      })])) as typeof MARKETS);
    }, 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return rows;
}
const Price: React.FC<{ row: Row; run: boolean }> = ({ row, run }) => {
  const v = useCountUp(row.value, 650, run, row.value);
  return <b>{v.toLocaleString('en-IN', { minimumFractionDigits: row.decimals, maximumFractionDigits: row.decimals })}</b>;
};

// The tour walks through the app the way a user would: home, markets, a stock, the AI CFO and tutor,
// news, tax, language and what people say.
const SCREENS = ['splash', 'home', 'markets', 'stock', 'cfo', 'tutor', 'news', 'tax', 'language', 'security', 'people'] as const;
type Screen = typeof SCREENS[number];
const DURATION: Record<Screen, number> = { splash: 5400, home: 4600, markets: 5200, stock: 4800, cfo: 3800, tutor: 5000, news: 4800, tax: 3400, language: 4200, security: 4600, people: 3400 };
type TabId = 'home' | 'markets' | 'ai' | 'news' | 'more';
const TAB_OF: Record<Screen, TabId> = { splash: 'home', home: 'home', markets: 'markets', stock: 'markets', cfo: 'ai', tutor: 'ai', news: 'news', tax: 'more', language: 'more', security: 'more', people: 'more' };
const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'home', label: 'Home', icon: Home }, { id: 'markets', label: 'Markets', icon: BarChart3 }, { id: 'ai', label: 'AI', icon: Bot },
  { id: 'news', label: 'News', icon: Newspaper }, { id: 'more', label: 'More', icon: LayoutGrid },
];
const QUICK: Array<[string, React.ComponentType<{ size?: number }>]> = [['Tax', ReceiptText], ['SIP', Target], ['Insure', ShieldCheck], ['Wallet', Wallet]];

/** Gold coin face: polished metal with a bevelled rim, engraved brand name and a specular highlight. */
const CoinFace: React.FC<{ id: string }> = ({ id }) => <svg viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff4c2"/><stop offset=".22" stopColor="#f0c75a"/><stop offset=".5" stopColor="#9a6a12"/><stop offset=".72" stopColor="#f6d77a"/><stop offset="1" stopColor="#7a5410"/></linearGradient>
    <radialGradient id={`${id}-g`} cx="36%" cy="30%" r="78%"><stop offset="0" stopColor="#fff1b8"/><stop offset=".35" stopColor="#f2c451"/><stop offset=".7" stopColor="#c8921f"/><stop offset="1" stopColor="#8f6310"/></radialGradient>
    <radialGradient id={`${id}-c`} cx="42%" cy="36%" r="72%"><stop offset="0" stopColor="#ffe28a"/><stop offset=".6" stopColor="#dca63a"/><stop offset="1" stopColor="#b07c1c"/></radialGradient>
    <radialGradient id={`${id}-spec`} cx="32%" cy="24%" r="38%"><stop offset="0" stopColor="#fffdf2" stopOpacity=".95"/><stop offset="1" stopColor="#fffdf2" stopOpacity="0"/></radialGradient>
    <path id={`${id}-t`} d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0"/>
  </defs>
  <circle cx="60" cy="60" r="59" fill={`url(#${id}-rim)`}/>
  <circle cx="60" cy="60" r="54.5" fill={`url(#${id}-g)`}/>
  <circle cx="60" cy="60" r="53" fill="none" stroke="#7a5410" strokeWidth="1.1" strokeDasharray="1 2.1" opacity=".75"/>
  <text fontSize="7" fontWeight="900" letterSpacing="2.1" fill="#6b4a0c" opacity=".9"><textPath href={`#${id}-t`}>ARTHAMIND AI · ARTHA BENCH PRO · INDIA ·</textPath></text>
  <circle cx="60" cy="60" r="36" fill={`url(#${id}-c)`} stroke="#8f6310" strokeWidth="1.4"/>
  <circle cx="60" cy="60" r="34.5" fill="none" stroke="#fff3c4" strokeWidth=".8" opacity=".55"/>
  <ellipse cx="46" cy="36" rx="30" ry="18" fill={`url(#${id}-spec)`}/>
</svg>;

// Coin intro, 4.4 s: drop spinning, bounce twice and settle (0–2.2 s); rest while the app loads
// (2.2–3.4 s); flip once more with a small lift (3.4–4.4 s) and settle steady before Home opens.
const COIN_TIMES = [0, 0.21, 0.29, 0.36, 0.43, 0.5, 0.773, 0.886, 1];
const COIN_EASE = ['easeIn', 'easeOut', 'easeIn', 'easeOut', 'easeIn', 'linear', 'easeOut', 'easeIn'] as const;
const CoinDrop: React.FC<{ animate: boolean }> = ({ animate }) => { const coinRef = useRef<HTMLDivElement>(null); return <div className="hp-coin-stage">
  <div className="hp-coin-wrap">
    <motion.div className="hp-coin" initial={animate ? { y: -260, rotateY: 0 } : false}
      onUpdate={(latest) => {
        // Every half-turn the light sweeps across the face and the gold flares as it faces the viewer.
        const r = Number(latest.rotateY ?? 0);
        const el = coinRef.current; if (!el) return;
        const phase = ((r % 180) + 180) % 180 / 180;
        el.style.setProperty('--sweep', `${-70 + phase * 200}%`);
        el.style.setProperty('--flare', `${Math.abs(Math.cos((r * Math.PI) / 180)) ** 6}`);
      }}
      ref={coinRef}
      animate={{ y: [-260, 0, -46, 0, -12, 0, 0, -26, 0], rotateY: [0, 1080, 1260, 1380, 1428, 1440, 1440, 1620, 1800] }}
      transition={{ duration: 4.4, times: COIN_TIMES, ease: [...COIN_EASE] }}>
      <span className="hp-coin-face"><CoinFace id="coin-f"/><span className="hp-coin-mark"><ArthaMindLogoMark size={46} tone="ink" cut="#e6bd5c"/></span><i className="hp-coin-sweep" aria-hidden="true"/><i className="hp-coin-glint" aria-hidden="true"/></span>
      <span className="hp-coin-face back"><CoinFace id="coin-b"/><span className="hp-coin-mark"><ArthaMindLogoMark size={46} tone="ink" cut="#e6bd5c"/></span><i className="hp-coin-sweep" aria-hidden="true"/></span>
    </motion.div>
    <motion.span className="hp-coin-shadow" initial={animate ? { scaleX: 0.2, opacity: 0 } : false}
      animate={{ scaleX: [0.2, 1, 0.55, 1, 0.85, 1, 1, 0.62, 1], opacity: [0, 0.55, 0.3, 0.55, 0.45, 0.55, 0.55, 0.32, 0.55] }}
      transition={{ duration: 4.4, times: COIN_TIMES }}/>
  </div>
  <motion.div className="hp-coin-title" initial={animate ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: animate ? 2.25 : 0, duration: 0.4 }}>
    <b>ArthaMind <em>AI</em></b><small>by Artha Bench Pro</small>
  </motion.div>
  <motion.div className="hp-coin-load" initial={animate ? { opacity: 0 } : false} animate={{ opacity: animate ? [0, 1, 1, 0] : 1 }} transition={{ duration: 2.2, delay: animate ? 2.2 : 0, times: [0, 0.1, 0.8, 1] }}>
    <span className="hp-coin-bar"><motion.i initial={animate ? { scaleX: 0 } : false} animate={{ scaleX: 1 }} transition={{ delay: animate ? 2.3 : 0, duration: 1.4, ease: [0.4, 0, 0.2, 1] }}/></span>
    <small>Loading your money dashboard…</small>
  </motion.div>
</div>; };

/** Demo NIFTY-style candles (deterministic), drawn left to right. */
const CANDLES = (() => {
  let price = 24620;
  return Array.from({ length: 20 }, (_, i) => {
    const drift = Math.sin(i * 0.55) * 38 + Math.cos(i * 0.21) * 22 + 12;
    const open = price, close = price + drift;
    price = close;
    return { open, close, high: Math.max(open, close) + 18 + (i % 3) * 7, low: Math.min(open, close) - 16 - (i % 4) * 6 };
  });
})();
const CandleChart: React.FC<{ animate: boolean }> = ({ animate }) => {
  const W = 240, H = 104, pad = 6;
  const lo = Math.min(...CANDLES.map((c) => c.low)), hi = Math.max(...CANDLES.map((c) => c.high));
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (H - pad * 2);
  const step = W / CANDLES.length;
  const ma = CANDLES.map((_, i) => { const s = CANDLES.slice(Math.max(0, i - 4), i + 1); return [step * (i + 0.5), y(s.reduce((a, c) => a + c.close, 0) / s.length)] as const; });
  const last = CANDLES[CANDLES.length - 1];
  return <svg className="hp-candles" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
    {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#eef1f6" strokeDasharray="3 4"/>)}
    {CANDLES.map((c, i) => { const up = c.close >= c.open; const x = step * (i + 0.5); return <motion.g key={i} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }} initial={animate ? { scaleY: 0, opacity: 0 } : false} animate={{ scaleY: 1, opacity: 1 }} transition={{ delay: animate ? 0.15 + i * 0.05 : 0, duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}>
      <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={up ? '#059669' : '#dc2626'} strokeWidth="1.2"/>
      <rect x={x - step * 0.3} y={Math.min(y(c.open), y(c.close))} width={step * 0.6} height={Math.max(1.5, Math.abs(y(c.open) - y(c.close)))} rx="1" fill={up ? '#10b981' : '#f87171'}/>
    </motion.g>; })}
    <motion.path d={ma.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')} fill="none" stroke="#4f46e5" strokeWidth="1.6" strokeLinecap="round" initial={animate ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ delay: animate ? 0.5 : 0, duration: 1.2, ease: 'easeOut' }}/>
    <line x1="0" x2={W} y1={y(last.close)} y2={y(last.close)} stroke="#059669" strokeDasharray="3 3" opacity=".6"/>
    <circle className="hp-candle-ping" cx={step * (CANDLES.length - 0.5)} cy={y(last.close)} r="3" fill="#10b981"/>
  </svg>;
};

/** Breadth and top movers for the visible tab: green for gains, red for losses. */
const MarketPulse: React.FC<{ rows: Row[]; tab: string }> = ({ rows, tab }) => {
  const up = rows.filter((r) => r.change >= 0).length;
  const sorted = [...rows].sort((a, b) => b.change - a.change);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  return <div className="hp-card hp-pulse">
    <div className="hp-pulse-head"><small>{tab} pulse</small><b><span className="up">{up} up</span> · <span className="down">{rows.length - up} down</span></b></div>
    <span className="hp-breadth" aria-hidden="true"><i style={{ width: `${(up / rows.length) * 100}%` }}/></span>
    <div className="hp-movers">
      <span><small>Top gainer</small><b>{best.name}</b><em className={best.change >= 0 ? 'up' : 'down'}>{pct(best.change)}</em></span>
      <span><small>{worst.change < 0 ? 'Top loser' : 'Weakest'}</small><b>{worst.name}</b><em className={worst.change >= 0 ? 'up' : 'down'}>{pct(worst.change)}</em></span>
    </div>
  </div>;
};

/** Demo one-month price path for the stock screen (deterministic). */
const STOCK_SERIES = Array.from({ length: 36 }, (_, i) => 1352 + i * 1.7 + Math.sin(i * 0.62) * 9 + Math.cos(i * 0.27) * 6);
const StockChart: React.FC<{ animate: boolean }> = ({ animate }) => {
  const W = 240, H = 92, lo = Math.min(...STOCK_SERIES) - 4, hi = Math.max(...STOCK_SERIES) + 4;
  const pts = STOCK_SERIES.map((v, i) => [(i / (STOCK_SERIES.length - 1)) * W, H - ((v - lo) / (hi - lo)) * H] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return <svg className="hp-stock-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="hp-stock-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity=".28"/><stop offset="1" stopColor="#10b981" stopOpacity="0"/></linearGradient></defs>
    {[0.33, 0.66].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#eef1f6" strokeDasharray="3 4"/>)}
    <motion.path d={`${line} L${W} ${H} L0 ${H} Z`} fill="url(#hp-stock-fill)" initial={animate ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: animate ? 0.7 : 0, duration: 0.6 }}/>
    <motion.path d={line} fill="none" stroke="#059669" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" initial={animate ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 1.3, ease: 'easeOut' }}/>
    <circle className="hp-candle-ping" cx={lx} cy={ly} r="3.2" fill="#10b981"/>
  </svg>;
};

/** Illustrated news thumbnails (drawn, not photos). */
const NewsThumb: React.FC<{ theme: 'bank' | 'chip' | 'oil' }> = ({ theme }) => {
  const bg = { bank: ['#1e3a8a', '#0f766e'], chip: ['#312e81', '#7c3aed'], oil: ['#78350f', '#0b0f14'] }[theme];
  return <svg className="hp-news-img" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id={`hp-n-${theme}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={bg[0]}/><stop offset="1" stopColor={bg[1]}/></linearGradient></defs>
    <rect width="64" height="64" rx="12" fill={`url(#hp-n-${theme})`}/>
    {theme === 'bank' && <g fill="#fff"><path d="M14 26 L32 15 L50 26 Z" opacity=".95"/>{[18, 26, 34, 42].map((x) => <rect key={x} x={x} y="29" width="4" height="16" rx="1" opacity=".85"/>)}<rect x="13" y="47" width="38" height="4" rx="1"/><path d="M40 20 l7 -6 m0 0 h-5 m5 0 v5" stroke="#34c46f" strokeWidth="2.4" fill="none" strokeLinecap="round"/></g>}
    {theme === 'chip' && <g><rect x="20" y="20" width="24" height="24" rx="4" fill="#fff" opacity=".95"/><rect x="26" y="26" width="12" height="12" rx="2" fill="#7c3aed"/>{[24, 30, 36].flatMap((v) => [<rect key={`t${v}`} x={v + 1} y="13" width="2" height="6" fill="#fff"/>, <rect key={`b${v}`} x={v + 1} y="45" width="2" height="6" fill="#fff"/>, <rect key={`l${v}`} x="13" y={v + 1} width="6" height="2" fill="#fff"/>, <rect key={`r${v}`} x="45" y={v + 1} width="6" height="2" fill="#fff"/>])}</g>}
    {theme === 'oil' && <g><path d="M22 50 L28 20 H36 L42 50 Z" fill="none" stroke="#fde68a" strokeWidth="2.2"/><path d="M25 36 H39 M24 43 H40 M27 28 H37" stroke="#fde68a" strokeWidth="1.6"/><path d="M46 18 c0 0 -6 7 -6 11 a6 6 0 0 0 12 0 c0 -4 -6 -11 -6 -11z" fill="#f59e0b"/></g>}
  </svg>;
};

const NEWS: Array<{ theme: 'bank' | 'chip' | 'oil'; source: string; time: string; title: string; tag: string; tone: 'up' | 'down' | 'flat'; logo?: string }> = [
  { theme: 'bank', source: 'Markets desk', time: '12 min', title: 'Private banks lead as NIFTY 50 edges higher', tag: 'Banks ▲', tone: 'up', logo: 'HDFCBANK' },
  { theme: 'chip', source: 'Tech wire', time: '38 min', title: 'Chip stocks slip after new export rules', tag: 'Tech ▼', tone: 'down', logo: 'NVDA' },
  { theme: 'oil', source: 'Energy brief', time: '1 hr', title: 'Crude eases; oil marketers may see margin relief', tag: 'Energy ◆', tone: 'flat', logo: 'CL=F' },
];

/** App bar shown at the top of every screen after the splash. */
const AppBar: React.FC<{ dark: boolean; photoSrc?: string }> = ({ dark, photoSrc }) => <div className={`hp-appbar ${dark ? 'dark' : ''}`}>
  <ArthaMindLogoMark size={22} tone="app"/>
  <b>ArthaMind <em>AI</em></b>
  <span className="hp-appbar-icons" aria-hidden="true"><Bell size={14}/><Portrait photoSrc={photoSrc}/></span>
</div>;


export const HeroPhone: React.FC<{ photoSrc?: string }> = ({ photoSrc }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const reduced = Boolean(useReducedMotion());
  const [pageVisible, setPageVisible] = useState(true);
  const [index, setIndex] = useState(0);
  const [marketTab, setMarketTab] = useState(0);
  const [chatStep, setChatStep] = useState(0);
  const [clock, setClock] = useState(() => new Date());
  // The coin intro waits for the page to go idle; otherwise a busy first load swallows the animation.
  const [introReady, setIntroReady] = useState(false);
  const running = inView && pageVisible && !reduced;
  const screen: Screen = reduced ? 'home' : SCREENS[index];
  const feed = useDemoFeed(running && screen === 'markets');
  const lang = useLanguageCycle(running && screen === 'language', 420);
  const r = HERO_REPORT;

  // 3D tilt that follows the pointer; the tour keeps running underneath it.
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-14, 14]), { stiffness: 140, damping: 16 });
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 140, damping: 16 });
  const onMove = (e: React.PointerEvent) => {
    if (reduced || e.pointerType === 'touch') return;
    const b = ref.current?.getBoundingClientRect(); if (!b) return;
    mx.set((e.clientX - b.left) / b.width - 0.5); my.set((e.clientY - b.top) / b.height - 0.5);
  };
  const onLeave = () => { mx.set(0); my.set(0); };

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  useEffect(() => {
    if (!running || introReady) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) { const id = w.requestIdleCallback(() => setIntroReady(true), { timeout: 1500 }); return () => w.cancelIdleCallback?.(id); }
    const id = window.setTimeout(() => setIntroReady(true), 400);
    return () => window.clearTimeout(id);
  }, [running, introReady]);
  // Advance screens on a timer; the splash shows once, then the tour loops from Home.
  useEffect(() => {
    if (!running || (SCREENS[index] === 'splash' && !introReady)) return;
    const id = window.setTimeout(() => setIndex((i) => ((i + 1) % SCREENS.length) || 1), DURATION[SCREENS[index]]);
    return () => window.clearTimeout(id);
  }, [running, index, introReady]);
  useEffect(() => {
    if (!running || screen !== 'markets') return;
    // India stays up longest so the company logos can be read; the other tabs flick past.
    setMarketTab(0);
    const timers = TAB_AT.map((ms, k) => window.setTimeout(() => setMarketTab(k + 1), ms));
    return () => timers.forEach(window.clearTimeout);
  }, [running, screen]);
  useEffect(() => {
    if (screen !== 'cfo' && screen !== 'tutor') return;
    setChatStep(0);
    const timers = (screen === 'tutor' ? [300, 1100, 1900, 3300] : [400, 1300, 2200]).map((ms, k) => window.setTimeout(() => setChatStep(k + 1), ms));
    return () => timers.forEach(window.clearTimeout);
  }, [screen]);
  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const animate = !reduced;
  const time = clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dark = screen === 'splash' || screen === 'home';

  return <div ref={ref} className="hp" onPointerMove={onMove} onPointerLeave={onLeave} role="img" aria-label="ArthaMind app preview on a phone: sample profile and demo market feed">
    <motion.div className="hp-device" style={reduced ? undefined : { rotateX: rotX, rotateY: rotY }}>
      <span className="hp-btn hp-btn-action" aria-hidden="true"/><span className="hp-btn hp-btn-up" aria-hidden="true"/><span className="hp-btn hp-btn-down" aria-hidden="true"/><span className="hp-btn hp-btn-power" aria-hidden="true"/>
      <div className="hp-bezel">
        <div className={`hp-screen ${dark ? 'is-dark' : ''}`}>
          <div className="hp-island" aria-hidden="true"><i/></div>
          <div className="hp-status" aria-hidden="true"><span>{time}</span><span className="hp-sys"><span className="hp-sig"><i/><i/><i/><i/></span><span className="hp-batt"><i/></span></span></div>

          {screen !== 'splash' && <AppBar dark={dark} photoSrc={photoSrc}/>}
          <AnimatePresence mode="wait">
            <motion.div key={screen} className={`hp-page hp-${screen}`} initial={animate ? (screen === 'home' ? { opacity: 0, scale: 0.94 } : { opacity: 0, y: 14 }) : false} animate={{ opacity: 1, y: 0, scale: 1 }} exit={animate ? { opacity: 0, y: -10 } : undefined} transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}>

              {screen === 'splash' && (introReady || !animate) && <CoinDrop animate={animate}/>}

              {screen === 'home' && <>
                <div className="hp-hello"><small>Good evening, Priya · sample profile</small><div><b><Count to={r.netWorth} run={animate} format={inr}/></b><span className="hp-up">+<Count to={r.cashflow.surplus} run={animate} format={inr}/>/mo</span></div><small>Net worth</small></div>
                <div className="hp-card hp-chart">
                  <div className="hp-chart-head"><img className="hp-chart-logo" src={companyLogoSrc('NIFTY 50')} alt="" width={26} height={26}/><span><b>NIFTY 50</b><small>Demo feed · 15 min candles</small></span><span className="hp-chart-val"><b><Count to={CANDLES[CANDLES.length - 1].close} run={animate} format={(v) => v.toLocaleString('en-IN', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}/></b><em className="up">+0.84%</em></span></div>
                  <CandleChart animate={animate}/>
                </div>
                <div className="hp-actions">{QUICK.map(([label, Icon]) => <span key={label}><i><Icon size={15}/></i>{label}</span>)}</div>
                <div className="hp-card hp-health">
                  <div className="hp-ring" style={{ '--deg': `${r.health.score * 3.6}deg` } as React.CSSProperties}><b><Count to={r.health.score} run={animate}/></b></div>
                  <div><small>Money health</small><b>{r.health.status}</b><span>Free by age <Count to={r.freedom.freedomAge ?? 60} run={animate}/> · {r.emergency.months.toFixed(1)} mo runway</span></div>
                </div>
              </>}

              {screen === 'markets' && <>
                <div className="hp-head"><b>Markets</b><small>Demo feed · not live prices</small></div>
                <div className="hp-seg" aria-hidden="true">{MARKET_TABS.map((t, i) => <span key={t} className={i === marketTab ? 'on' : ''}>{t}</span>)}</div>
                <ul className="hp-rows">{feed[MARKET_TABS[marketTab]].map((row) => <li key={row.ticker}>
                  <span className={`hp-logo ${hasMarketMark(row.ticker) ? 'has-mark' : ''}`} style={{ background: row.color }}>{hasMarketMark(row.ticker) ? <CompanyLogo symbol={row.ticker} size={34}/> : row.badge}</span>
                  <span className="hp-rname"><b>{row.name}</b><small>{row.ticker}</small></span>
                  <span className="hp-rval"><Price row={row} run={animate}/><em className={row.change >= 0 ? 'up' : 'down'}>{row.change >= 0 ? '+' : ''}{row.change.toFixed(2)}%</em></span>
                </li>)}</ul>
                <MarketPulse rows={feed[MARKET_TABS[marketTab]]} tab={MARKET_TABS[marketTab]}/>
              </>}

              {screen === 'stock' && <>
                <div className="hp-stock-head">
                  <CompanyLogo symbol="RELIANCE" size={36}/>
                  <span><b>Reliance Industries</b><small>RELIANCE · NSE · demo</small></span>
                </div>
                <div className="hp-stock-price"><b>₹<Count to={1412.5} run={animate} format={(v) => v.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/></b><em className="up">+₹8.95 (+0.64%)</em></div>
                <div className="hp-range" aria-hidden="true">{['1D', '1W', '1M', '1Y', '5Y'].map((r) => <span key={r} className={r === '1M' ? 'on' : ''}>{r}</span>)}</div>
                <div className="hp-card hp-stock-card"><StockChart animate={animate}/></div>
                <div className="hp-stats">{[['Open', '₹1,404'], ['Day high', '₹1,418'], ['Day low', '₹1,398'], ['52W range', '₹1,115–1,551']].map(([k, v]) => <span key={k}><small>{k}</small><b>{v}</b></span>)}</div>
                <motion.div className="hp-card hp-insight" initial={animate ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: animate ? 1.4 : 0 }}>
                  <Sparkles size={13}/><p><b>AI read:</b> up on retail and Jio growth; weaker refining margins are the risk to watch.</p>
                </motion.div>
              </>}

              {screen === 'cfo' && <>
                <div className="hp-head"><b>AI CFO</b><small>Answers with the working shown</small></div>
                <div className="hp-chat">
                  {chatStep >= 1 && <motion.p className="hp-bubble me" initial={animate ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }}>Old or new tax regime on a ₹12,00,000 salary?</motion.p>}
                  {chatStep === 2 && <p className="hp-bubble ai typing" aria-hidden="true"><i/><i/><i/></p>}
                  {chatStep >= 3 && <motion.div className="hp-bubble ai" initial={animate ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }}>
                    <p><b>New regime</b> saves <b>{inr(r.tax.saving)}</b> a year with ₹1,75,000 of 80C + 80D.</p>
                    <div className="hp-src"><span>87A rebate</span><span>FY 25-26 slabs</span><span>Verify with Form 16</span></div>
                  </motion.div>}
                </div>
                <div className="hp-input" aria-hidden="true"><span>Ask in any language…</span><i><Bot size={13}/></i></div>
              </>}

              {screen === 'tutor' && <>
                <div className="hp-head"><b>AI Tutor</b><small>Learn with worked examples</small></div>
                <div className="hp-card hp-lesson"><span className="hp-lesson-ico"><BookOpen size={14}/></span><div><small>Lesson 3 of 8 · Investing basics</small><b>Compounding and CAGR</b><span className="hp-lesson-bar"><motion.i initial={animate ? { width: 0 } : false} animate={{ width: '38%' }} transition={{ duration: 0.9 }}/></span></div></div>
                <div className="hp-chat">
                  {chatStep >= 1 && <motion.p className="hp-bubble me" initial={animate ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }}>What is CAGR?</motion.p>}
                  {chatStep === 2 && <p className="hp-bubble ai typing" aria-hidden="true"><i/><i/><i/></p>}
                  {chatStep >= 3 && <motion.div className="hp-bubble ai" initial={animate ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }}>
                    <p>The yearly rate that turns a start value into an end value.</p>
                    <code className="hp-formula">CAGR = (End ÷ Start)<sup>1/yrs</sup> − 1</code>
                    <p className="hp-eg">₹1,00,000 → ₹2,00,000 in 6 years = <b>12.2% a year</b></p>
                  </motion.div>}
                </div>
                {chatStep >= 4 && <motion.div className="hp-quiz" initial={animate ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }}>
                  <small>Quick check · doubles in 6 years ≈ ?</small>
                  <div><span>8%</span><span className="right"><Check size={11}/> 12%</span><span>18%</span></div>
                </motion.div>}
              </>}

              {screen === 'news' && <>
                <div className="hp-head"><b>News</b><small>Sample headlines · illustrations</small></div>
                <div className="hp-chips" aria-hidden="true">{['For you', 'Markets', 'Economy', 'Companies'].map((c, i) => <span key={c} className={i === 0 ? 'on' : ''}>{c}</span>)}</div>
                <ul className="hp-newslist">{NEWS.map((n, i) => <motion.li key={n.title} initial={animate ? { opacity: 0, y: 14 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.18 }}>
                  <NewsThumb theme={n.theme}/>
                  <div><small>{n.logo && <CompanyLogo symbol={n.logo} size={13}/>}{n.source} · {n.time}</small><b>{n.title}</b><em className={n.tone}>{n.tag}</em></div>
                </motion.li>)}</ul>
                <motion.div className="hp-card hp-insight" initial={animate ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: animate ? 1.2 : 0 }}><Sparkles size={13}/><p><b>Research brief</b> ready: what happened, market impact and what to verify.</p></motion.div>
              </>}

              {screen === 'tax' && <>
                <div className="hp-head"><b>Tax · FY 2025-26</b><small>Example: ₹12,00,000 salary, 80C + 80D used</small></div>
                <div className="hp-card hp-bars">
                  <div><span>Old</span><i><motion.b initial={animate ? { width: 0 } : false} animate={{ width: '100%' }} transition={{ duration: 0.9 }}/></i><em><Count to={r.tax.oldRegimeTax} run={animate} format={inr}/></em></div>
                  <div className="win"><span>New</span><i><motion.b initial={animate ? { width: 0 } : false} animate={{ width: `${Math.max(3, (r.tax.newRegimeTax / Math.max(1, r.tax.oldRegimeTax)) * 100)}%` }} transition={{ duration: 0.9 }}/></i><em><Count to={r.tax.newRegimeTax} run={animate} format={inr}/></em></div>
                </div>
                <div className="hp-save"><small>You save with the {r.tax.better === 'old' ? 'old' : 'new'} regime</small><b><Count to={r.tax.saving} run={animate} format={inr}/></b><span>Take-home <Count to={r.tax.monthlyTakeHome} run={animate} format={inr}/>/mo</span></div>
              </>}

              {screen === 'language' && <>
                <div className="hp-head"><b>Language</b><small>The whole app, translated</small></div>
                <div className="hp-card hp-lang2">
                  <div className="hp-lang2-top"><span className="hp-lang2-count"><b>{String(lang.index + 1).padStart(2, '0')}</b> / {lang.total}</span><small>languages</small></div>
                  <div className="hp-lang2-hello" aria-hidden="true">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={lang.code} initial={animate ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} exit={animate ? { opacity: 0, y: -10 } : undefined} transition={{ duration: 0.16 }}>
                        <b>{lang.greeting}</b><small>{lang.name}</small>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <span className="hp-lang-bar"><i style={{ transform: `scaleX(${(lang.index + 1) / lang.total})` }}/></span>
                </div>
                <div className="hp-lang-grid" aria-hidden="true">{SUPPORTED_LANGUAGES.slice(0, 12).map(([code, name], i) => <span key={code} className={i === lang.index ? 'on' : i < lang.index ? 'done' : ''}>{name}</span>)}</div>
                <p className="hp-note">AI CFO replies in English, हिन्दी and Hinglish.</p>
              </>}

              {screen === 'security' && <>
                <div className="hp-head"><b>Your data, protected</b><small>How ArthaMind keeps it private</small></div>
                <div className="hp-shield" aria-hidden="true">
                  <motion.span className="hp-shield-ring" initial={animate ? { scale: 0.6, opacity: 0 } : false} animate={{ scale: [0.6, 1.08, 1], opacity: 1 }} transition={{ duration: 0.8 }}/>
                  <motion.span className="hp-shield-core" initial={animate ? { rotateY: 90 } : false} animate={{ rotateY: 0 }} transition={{ duration: 0.6, delay: 0.2 }}><ShieldCheck size={30}/></motion.span>
                  <motion.span className="hp-shield-lock" initial={animate ? { y: -10, opacity: 0 } : false} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}><LockKeyhole size={12}/></motion.span>
                </div>
                <ul className="hp-secure">{([
                  [Calculator, 'Your numbers are calculated with plain maths on your phone'],
                  [LockKeyhole, 'Everything sent is encrypted (HTTPS)'],
                  [KeyRound, 'Saved records open only for your account'],
                  [EyeOff, 'AI sees only the question you ask'],
                ] as Array<[React.ComponentType<{ size?: number }>, string]>).map(([Icon, text], i) => <motion.li key={text} initial={animate ? { opacity: 0, x: 14 } : false} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 + i * 0.45 }}>
                  <span><Icon size={12}/></span>{text}<Check size={11} className="hp-secure-ok"/>
                </motion.li>)}</ul>
                <motion.p className="hp-secure-note" initial={animate ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: 2.9 }}>We never ask for bank passwords, PINs or OTPs.</motion.p>
              </>}

              {screen === 'people' && <>
                <div className="hp-head"><b>What people say</b><small>Illustrative sample comments</small></div>
                <ul className="hp-comments">{LANDING_REVIEWS.slice(0, 3).map((rv, i) => <motion.li key={rv.name} initial={animate ? { opacity: 0, x: 16 } : false} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.16 }}>
                  <div><b>{rv.name}</b><span className="hp-stars" aria-hidden="true">{Array.from({ length: rv.rating }, (_, k) => <Star key={k} size={9}/>)}</span></div>
                  <p>{rv.quote.length > 84 ? `${rv.quote.slice(0, 82)}…` : rv.quote}</p>
                </motion.li>)}</ul>
              </>}
            </motion.div>
          </AnimatePresence>

          {screen !== 'splash' && <nav className="hp-tabbar" aria-hidden="true">{TABS.map(({ id, label, icon: Icon }) => <span key={id} className={id === TAB_OF[screen] ? 'on' : ''}><Icon size={15}/>{label}</span>)}</nav>}
          <span className="hp-homebar" aria-hidden="true"/>
          <span className="hp-glare" aria-hidden="true"/>
        </div>
      </div>
    </motion.div>
  </div>;
};
