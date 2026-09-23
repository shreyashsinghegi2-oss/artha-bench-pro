import React, { useEffect, useMemo, useRef, useState } from 'react';

type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
interface Candle { t: number; open: number; high: number; low: number; close: number }

const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
const W = 520, H = 200, PAD_T = 14, PAD_B = 22, BARS = 36;

/** Deterministic sample series, used only while the live feed is loading or unavailable (always labelled). */
function sampleCandles(): Candle[] {
  let price = 100;
  return Array.from({ length: BARS }, (_, i) => {
    const drift = Math.sin(i * 0.38) * 1.6 + Math.sin(i * 0.11) * 1.1 + 0.18;
    const open = price;
    const close = open + drift;
    price = close;
    return { t: i, open, close, high: Math.max(open, close) + 0.8 + (i % 3) * 0.35, low: Math.min(open, close) - 0.7 - (i % 4) * 0.3 };
  });
}

const fmt = (value: number) => value >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : value.toFixed(2);

/**
 * Hero preview chart: live BTC/USDT candles from the server's Binance route, drawn as candles over an
 * area gradient with a moving average and a pulsing last-price marker. Polls only while visible.
 */
export const LandingPreviewChart: React.FC = () => {
  const [interval, setInterval] = useState<Interval>('1h');
  const [live, setLive] = useState<Candle[] | null>(null);
  const [state, setState] = useState<'loading' | 'live' | 'offline'>('loading');
  const [visible, setVisible] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '120px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const response = await fetch(`/api/crypto/klines?symbol=BTCUSDT&interval=${interval}`);
        if (!response.ok) throw new Error('unavailable');
        const data = await response.json();
        const candles: Candle[] = (Array.isArray(data.candles) ? data.candles : [])
          .map((c: Record<string, unknown>) => ({ t: Number(c.openTime), open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) }))
          .filter((c: Candle) => [c.open, c.high, c.low, c.close].every(Number.isFinite))
          .slice(-BARS);
        if (!alive) return;
        if (candles.length < 2) throw new Error('empty');
        setLive(candles);
        setState('live');
      } catch {
        if (alive) setState((current) => (current === 'live' ? 'live' : 'offline'));
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [interval, visible]);

  const candles = state === 'live' && live ? live : sampleCandles();
  const isSample = !(state === 'live' && live);

  const geometry = useMemo(() => {
    const min = Math.min(...candles.map((c) => c.low));
    const max = Math.max(...candles.map((c) => c.high));
    const span = max - min || 1;
    const y = (v: number) => PAD_T + (1 - (v - min) / span) * (H - PAD_T - PAD_B);
    const step = (W - 16) / candles.length;
    const x = (i: number) => 8 + step * (i + 0.5);
    const closes = candles.map((c, i) => [x(i), y(c.close)] as const);
    const line = closes.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
    const area = `${line} L${closes[closes.length - 1][0].toFixed(1)} ${H - PAD_B} L${closes[0][0].toFixed(1)} ${H - PAD_B} Z`;
    const ma = candles.map((_, i) => {
      const from = Math.max(0, i - 6);
      const slice = candles.slice(from, i + 1);
      return [x(i), y(slice.reduce((sum, c) => sum + c.close, 0) / slice.length)] as const;
    }).map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
    return { y, x, step, line, area, ma, min, max };
  }, [candles]);

  const last = candles[candles.length - 1];
  const first = candles[0];
  const change = ((last.close - first.open) / first.open) * 100;
  const up = change >= 0;
  const lastY = geometry.y(last.close);
  const label = state === 'live' ? 'Live · Binance public market data' : state === 'loading' ? 'Connecting to Binance…' : 'Sample data · live feed unavailable';

  return <div className="lpc" ref={box}>
    <div className="lpc-head">
      <span className="lpc-pair"><b>BTC/USDT</b>{!isSample && <strong className={up ? 'up' : 'down'}>{fmt(last.close)} <em>{up ? '+' : ''}{change.toFixed(2)}%</em></strong>}</span>
      <span className={`lpc-status ${state}`}><i aria-hidden="true"/>{label}</span>
    </div>
    <div className="lpc-frames" role="group" aria-label="Candle interval">
      {INTERVALS.map((value) => <button key={value} type="button" className={interval === value ? 'on' : ''} aria-pressed={interval === value} onClick={() => setInterval(value)}>{value}</button>)}
    </div>
    <svg viewBox={`0 0 ${W} ${H}`} className="lpc-svg" role="img" aria-label={isSample ? 'Illustrative sample candlestick chart' : `BTC/USDT ${interval} candlestick chart, last ${fmt(last.close)}`} key={`${interval}-${isSample ? 's' : 'l'}`}>
      <defs>
        <linearGradient id="lpc-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={up ? '#10b981' : '#ef4444'} stopOpacity=".28"/>
          <stop offset="1" stopColor={up ? '#10b981' : '#ef4444'} stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="lpc-ma" x1="0" x2="1">
          <stop offset="0" stopColor="#6366f1"/><stop offset="1" stopColor="#0ea5e9"/>
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2={W} y1={PAD_T + i * ((H - PAD_T - PAD_B) / 3)} y2={PAD_T + i * ((H - PAD_T - PAD_B) / 3)} className="lpc-grid"/>)}
      <path d={geometry.area} fill="url(#lpc-area)" className="lpc-area"/>
      <path d={geometry.ma} className="lpc-ma" pathLength={1} stroke="url(#lpc-ma)"/>
      {candles.map((c, i) => {
        const rising = c.close >= c.open;
        const cx = geometry.x(i);
        const bw = Math.max(3, geometry.step * 0.56);
        return <g key={c.t} className={`lpc-candle ${rising ? 'up' : 'down'}`} style={{ '--i': i } as React.CSSProperties}>
          <line x1={cx} x2={cx} y1={geometry.y(c.high)} y2={geometry.y(c.low)}/>
          <rect x={cx - bw / 2} y={Math.min(geometry.y(c.open), geometry.y(c.close))} width={bw} height={Math.max(1.5, Math.abs(geometry.y(c.open) - geometry.y(c.close)))} rx="1"/>
        </g>;
      })}
      <line x1="0" x2={W} y1={lastY} y2={lastY} className={`lpc-last ${up ? 'up' : 'down'}`}/>
      <circle cx={geometry.x(candles.length - 1)} cy={lastY} r="3.5" className={`lpc-dot ${up ? 'up' : 'down'}`}/>
      <circle cx={geometry.x(candles.length - 1)} cy={lastY} r="3.5" className={`lpc-ping ${up ? 'up' : 'down'}`}/>
    </svg>
    <div className="lpc-legend"><span><i className="c"/>Candles</span><span><i className="m"/>7-bar average</span>{isSample && <span className="lpc-sample">Illustrative shape, not prices</span>}</div>
  </div>;
};
