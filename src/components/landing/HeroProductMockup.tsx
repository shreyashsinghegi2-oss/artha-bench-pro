import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, LockKeyhole, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { NavigationDestination } from '../../types';

type Props = { onEnter: (destination?: NavigationDestination) => void };

type Candle = { open: number; close: number; high: number; low: number; volume: number };

const prices = [24912, 24884, 24926, 24862, 24898, 24944, 24918, 24972, 24940, 24988, 24954, 25018, 24986, 25042, 25012, 25068, 25034, 25088, 25056, 25096, 25072, 25110, 25082, 25128];
const candles: Candle[] = prices.map((close, i) => {
  const open = i === 0 ? 24930 : prices[i - 1];
  const high = Math.max(open, close) + [18, 12, 15, 10, 16][i % 5];
  const low = Math.min(open, close) - [13, 17, 9, 15, 11][i % 5];
  return { open, close, high, low, volume: 28 + ((i * 17) % 64) };
});

const watchlist = [
  ['NIFTY 50', '+0.64%', 'up'],
  ['SENSEX', '+0.42%', 'up'],
  ['S&P 500', '-0.18%', 'down'],
  ['GOLD', '+0.27%', 'up'],
  ['BTC', '+1.14%', 'up'],
];

function chartGeometry(width = 720, height = 300) {
  const left = 18, right = 82, top = 18, bottom = 44;
  const chartW = width - left - right;
  const chartH = height - top - bottom;
  const min = Math.min(...candles.map(c => c.low)) - 8;
  const max = Math.max(...candles.map(c => c.high)) + 8;
  const x = (i: number) => left + (i / (candles.length - 1)) * chartW;
  const y = (value: number) => top + ((max - value) / (max - min)) * chartH;
  return { left, right, top, bottom, chartW, chartH, min, max, x, y };
}

export const HeroProductMockup: React.FC<Props> = ({ onEnter }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [activeRange, setActiveRange] = useState('1D');
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);
  const reduceMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const geo = useMemo(() => chartGeometry(), []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    if (reduceMotion || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.18 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduceMotion]);

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion || window.innerWidth < 900) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -7, y: px * 7 });
  };

  const handleLeave = () => setTilt({ x: 0, y: 0 });

  const linePoints = [0, 5, 10, 15, 19, 23].map(i => `${geo.x(i)},${geo.y(candles[i].close)}`).join(' ');
  const ma20 = candles.map((_, i) => {
    const start = Math.max(0, i - 4);
    const avg = candles.slice(start, i + 1).reduce((sum, c) => sum + c.close, 0) / (i - start + 1);
    return `${geo.x(i)},${geo.y(avg)}`;
  }).join(' ');
  const ma50 = candles.map((c, i) => `${geo.x(i)},${geo.y(c.close - 34 + Math.sin(i * 0.7) * 7)}`).join(' ');

  return (
    <div ref={rootRef} className={`hero-mockup-stage ${visible ? 'is-visible' : ''}`} onMouseMove={handleMove} onMouseLeave={handleLeave}>
      <div className="hero-aurora hero-aurora-a" /><div className="hero-aurora hero-aurora-b" />
      <div className="hero-mockup-shadow" />
      <div className="hero-mockup" style={{ transform: `perspective(1400px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
        <div className="hero-mockup-chrome">
          <div className="flex items-center gap-2"><span className="hero-window-dot"/><span className="hero-window-dot"/><span className="hero-window-dot"/></div>
          <div className="flex items-center gap-2 text-[9px] text-slate-400"><span>Research workspace</span><span className="rounded-full border border-white/10 bg-white/[.04] px-2 py-1">Illustrative</span></div>
        </div>

        <div className="hero-mockup-body">
          <aside className="hero-layer hero-watchlist">
            <div className="mb-3 flex items-center justify-between"><span className="hero-kicker">Watchlist</span><Search className="h-3.5 w-3.5 text-slate-500"/></div>
            {watchlist.map(([symbol, change, direction], i) => <button key={symbol} type="button" onClick={() => onEnter(symbol === 'BTC' ? 'crypto' : 'markets')} className={`hero-watch-item ${i === 0 ? 'active' : ''}`}>
              <span><strong>{symbol}</strong><small>{i === 0 ? 'Index' : 'Sample context'}</small></span><b className={direction === 'up' ? 'positive' : 'negative'}>{direction === 'up' ? '↑' : '↓'} {change}</b>
            </button>)}
          </aside>

          <section className="hero-layer hero-chart-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="hero-kicker">Market research</div><div className="mt-1 text-sm font-bold text-white">NIFTY 50 <span className="font-normal text-slate-500">· sample view</span></div></div>
              <div className="hero-range-group" role="group" aria-label="Chart range">
                {['1D', '1W', '1M', '1Y'].map(range => <button key={range} type="button" onClick={() => setActiveRange(range)} className={activeRange === range ? 'active' : ''}>{range}</button>)}
              </div>
            </div>
            <div className="hero-chart-wrap" onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.max(geo.left, Math.min(geo.left + geo.chartW, ((e.clientX - rect.left) / rect.width) * 720));
              const y = Math.max(geo.top, Math.min(geo.top + geo.chartH, ((e.clientY - rect.top) / rect.height) * 300));
              setCrosshair({ x, y });
            }} onMouseLeave={() => setCrosshair(null)}>
              <svg viewBox="0 0 720 300" role="img" aria-label="Illustrative NIFTY 50 candlestick chart with moving averages">
                <defs><linearGradient id="heroChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2dd4bf" stopOpacity=".16"/><stop offset="1" stopColor="#2dd4bf" stopOpacity="0"/></linearGradient></defs>
                {[0,1,2,3,4].map(i => <line key={`h${i}`} x1="18" x2="638" y1={18 + i * 54} y2={18 + i * 54} className="hero-chart-grid"/>)}
                {[0,1,2,3,4,5].map(i => <line key={`v${i}`} x1={18 + i * 124} x2={18 + i * 124} y1="18" y2="256" className="hero-chart-grid"/>)}
                <polygon points={`18,${geo.y(candles[0].close)} ${linePoints} 638,256 18,256`} fill="url(#heroChartFill)" className="hero-chart-area"/>
                <polyline points={ma50} fill="none" className="hero-ma hero-ma-50"/>
                <polyline points={ma20} fill="none" className="hero-ma hero-ma-20"/>
                <polyline points={linePoints} fill="none" className="hero-price-line"/>
                {candles.map((c, i) => { const x = geo.x(i); const up = c.close >= c.open; const yOpen = geo.y(c.open), yClose = geo.y(c.close); return <g key={i} className="hero-candle" style={{ animationDelay: `${0.45 + i * 0.025}s` }}>
                  <line x1={x} x2={x} y1={geo.y(c.high)} y2={geo.y(c.low)} className={up ? 'hero-candle-wick up' : 'hero-candle-wick down'}/>
                  <rect x={x - 5} y={Math.min(yOpen, yClose)} width="10" height={Math.max(4, Math.abs(yOpen - yClose))} rx="1.5" className={up ? 'hero-candle-body up' : 'hero-candle-body down'}/>
                  <rect x={x - 4} y={260 - c.volume * .55} width="8" height={c.volume * .55} rx="1" className="hero-volume"/>
                </g>; })}
                <line x1="18" x2="638" y1={geo.y(25096)} y2={geo.y(25096)} className="hero-current-line"/>
                {crosshair && <g className="hero-crosshair"><line x1={crosshair.x} x2={crosshair.x} y1="18" y2="256"/><line x1="18" x2="638" y1={crosshair.y} y2={crosshair.y}/><circle cx={crosshair.x} cy={crosshair.y} r="4"/></g>}
                <g className="hero-chart-labels"><text x="650" y="40">25,140</text><text x="650" y="94">25,080</text><text x="650" y="148">25,020</text><text x="650" y="202">24,960</text><text x="650" y="256">24,900</text><text x="18" y="286">09:30</text><text x="305" y="286">12:00</text><text x="590" y="286">15:15</text></g>
              </svg>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[8px] text-slate-500">MA20 <i/> MA50 <em/> Volume</span><span className="text-[8px] text-slate-500">Sample chart for product preview — not live market data.</span></div>
          </section>

          <aside className="hero-layer hero-ai-panel">
            <div className="flex items-center justify-between"><span className="hero-kicker">ArthaMind response</span><Sparkles className="h-3.5 w-3.5 text-teal-300"/></div>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[.035] p-3"><div className="text-[11px] font-semibold leading-5 text-white">What may be driving today’s NIFTY movement?</div><p className="mt-2 text-[9px] leading-4 text-slate-400">Context suggests a mix of broad sentiment and sector movement. The answer stays inspectable rather than presenting confidence as correctness.</p></div>
            <div className="mt-3 space-y-2"><Status icon={<CheckCircle2/>} label="Sources" value="3 reviewed"/><Status icon={<ShieldCheck/>} label="Verification" value="Required" warn/><Status icon={<LockKeyhole/>} label="Personal context" value="Off"/></div>
            <button type="button" onClick={() => onEnter('evaluation-lab')} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-[9px] font-bold text-teal-200 transition hover:bg-teal-400/15">Inspect evidence <ArrowRight className="h-3 w-3"/></button>
          </aside>
        </div>
        <div className="hero-mockup-footer"><span><b>Public market context</b> active</span><span><b>Personal context</b> off by default</span><span className="hero-footer-status"><i/> Evidence-first preview</span></div>
      </div>

      <div className="hero-source-chip hero-source-chip-a"><span className="hero-chip-dot"/> 3 sources reviewed</div>
      <div className="hero-source-chip hero-source-chip-b"><span className="hero-chip-check">✓</span> Verification required</div>
    </div>
  );
};

const Status = ({ icon, label, value, warn = false }: { icon: React.ReactNode; label: string; value: string; warn?: boolean }) => <div className="hero-status"><span className="flex items-center gap-2"><span className="hero-status-icon">{icon}</span>{label}</span><b className={warn ? 'warn' : ''}>{value}</b></div>;
