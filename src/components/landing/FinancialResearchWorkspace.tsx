import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { NavigationDestination } from '../../types';
import { ArthaMindLogo } from './ArthaMindLogo';
import { illustrativeMarketData } from './illustrativeMarketData';

type Props = {
  onEnter: (destination?: NavigationDestination) => void;
};

type Candle = {
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
};

const candles: Candle[] = [
  { x: 34, open: 155, close: 143, high: 134, low: 166 },
  { x: 54, open: 143, close: 149, high: 137, low: 158 },
  { x: 74, open: 149, close: 136, high: 129, low: 156 },
  { x: 94, open: 136, close: 128, high: 120, low: 143 },
  { x: 114, open: 128, close: 134, high: 121, low: 142 },
  { x: 134, open: 134, close: 119, high: 112, low: 140 },
  { x: 154, open: 119, close: 124, high: 114, low: 132 },
  { x: 174, open: 124, close: 111, high: 103, low: 130 },
  { x: 194, open: 111, close: 116, high: 106, low: 124 },
  { x: 214, open: 116, close: 102, high: 96, low: 122 },
  { x: 234, open: 102, close: 108, high: 97, low: 115 },
  { x: 254, open: 108, close: 95, high: 89, low: 114 },
  { x: 274, open: 95, close: 101, high: 91, low: 109 },
  { x: 294, open: 101, close: 91, high: 84, low: 107 },
  { x: 314, open: 91, close: 98, high: 87, low: 105 },
  { x: 334, open: 98, close: 86, high: 79, low: 104 },
  { x: 354, open: 86, close: 80, high: 73, low: 93 },
  { x: 374, open: 80, close: 88, high: 76, low: 96 },
  { x: 394, open: 88, close: 78, high: 70, low: 94 },
  { x: 414, open: 78, close: 83, high: 74, low: 91 },
];

const selectedSymbols = ['NIFTY 50', 'S&P 500', 'GOLD', 'BTC', 'RELIANCE'];

const destinationForSymbol = (symbol: string): NavigationDestination =>
  symbol === 'BTC' ? 'crypto' : 'markets';

export const FinancialResearchWorkspace: React.FC<Props> = ({ onEnter }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [privacyTipOpen, setPrivacyTipOpen] = useState(false);

  const watchlist = useMemo(
    () => selectedSymbols.map((symbol) => illustrativeMarketData.find((item) => item.symbol === symbol)).filter(Boolean),
    [],
  );

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setVisible(true);
      setActiveIndex(0);
      return;
    }

    const node = rootRef.current;
    if (!node || !('IntersectionObserver' in window)) {
      setVisible(true);
      const fallbackTimer = window.setTimeout(() => setActiveIndex(0), 2400);
      return () => window.clearTimeout(fallbackTimer);
    }

    let selectionTimer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        selectionTimer = window.setTimeout(() => setActiveIndex(0), 2400);
        observer.disconnect();
      },
      { threshold: 0.24 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (selectionTimer) window.clearTimeout(selectionTimer);
    };
  }, []);

  return (
    <div ref={rootRef} className={`artha-research-workspace ${visible ? 'is-visible' : ''}`}>
      <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.09)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <ArthaMindLogo className="h-7 w-7" compact />
            <div>
              <div className="text-[12px] font-bold text-slate-900">Research workspace</div>
              <div className="text-[9px] text-slate-500">Market question → evidence view</div>
            </div>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-semibold text-slate-600">Research preview</span>
        </div>

        <div className="grid lg:grid-cols-[24%_51%_25%]">
          <aside className="border-b border-slate-200 p-3 sm:p-4 lg:border-b-0 lg:border-r" aria-label="Sample market watchlist">
            <div className="mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Watchlist</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:block lg:space-y-1.5">
              {watchlist.map((item, index) => {
                if (!item) return null;
                const active = index === activeIndex;
                return (
                  <button
                    type="button"
                    key={item.symbol}
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onClick={() => onEnter(destinationForSymbol(item.symbol))}
                    aria-label={`Open ${item.symbol} in ${item.symbol === 'BTC' ? 'Crypto' : 'Market Data'}`}
                    className={`artha-watch-row artha-preview-action w-full rounded-xl border px-2.5 py-2.5 text-left lg:px-3 ${active ? 'border-teal-200 bg-teal-50' : 'border-transparent bg-slate-50/70'}`}
                    style={{ animationDelay: `${0.3 + index * 0.11}s` }}
                  >
                    <div className="flex items-start justify-between gap-2 lg:items-center">
                      <div className="min-w-0">
                        <div className="truncate text-[10px] font-bold text-slate-800">{item.symbol}</div>
                        <div className="mt-0.5 hidden text-[8px] text-slate-400 lg:block">{item.label}</div>
                      </div>
                      <span className={`shrink-0 text-[9px] font-semibold ${item.direction === 'up' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}% {item.direction === 'up' ? '↑' : '↓'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="border-b border-slate-200 p-3 sm:p-4 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold text-slate-900">NIFTY 50 · 1D</div>
                <div className="mt-0.5 text-[9px] text-slate-400">Research chart</div>
              </div>
              <button
                type="button"
                onClick={() => onEnter('markets')}
                className="artha-preview-action inline-flex items-center gap-1 text-[9px] font-bold text-teal-700"
              >
                Open Market Data <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>

            <svg
              viewBox="0 0 470 250"
              className="artha-research-chart block h-auto w-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
              role="img"
              tabIndex={0}
              aria-labelledby="artha-research-chart-title artha-research-chart-desc"
            >
              <title id="artha-research-chart-title">Sample NIFTY candlestick research chart</title>
              <desc id="artha-research-chart-desc">A non-live sample candlestick chart used to demonstrate the research workspace. Hover or focus the chart to reveal the inspection crosshair.</desc>

              <g className="artha-chart-grid" stroke="#E2E8F0" strokeWidth="1">
                {[38, 78, 118, 158, 198].map((y) => <line key={`h-${y}`} x1="22" y1={y} x2="430" y2={y} />)}
                {[70, 150, 230, 310, 390].map((x) => <line key={`v-${x}`} x1={x} y1="24" x2={x} y2="210" />)}
              </g>

              <g className="artha-candles">
                {candles.map((candle, index) => {
                  const up = candle.close < candle.open;
                  const top = Math.min(candle.open, candle.close);
                  const height = Math.max(5, Math.abs(candle.close - candle.open));
                  return (
                    <g key={candle.x} className={`artha-candle candle-${index + 1}`} style={{ animationDelay: `${0.82 + index * 0.075}s` }}>
                      <line x1={candle.x} x2={candle.x} y1={candle.high} y2={candle.low} stroke={up ? '#0F766E' : '#B4535A'} strokeWidth="1.6" />
                      <rect x={candle.x - 4.5} y={top} width="9" height={height} rx="1.5" fill={up ? '#2A9D8F' : '#C96A70'} />
                    </g>
                  );
                })}
              </g>

              <line className="artha-final-price-line" x1="342" y1="83" x2="430" y2="83" stroke="#0F766E" strokeDasharray="4 5" strokeWidth="1.4" />
              <circle className="artha-final-price-line" cx="414" cy="83" r="3" fill="#0F766E" />

              <g fill="#94A3B8" fontSize="9" fontFamily="inherit">
                <text x="436" y="42">25,020</text>
                <text x="436" y="82">24,960</text>
                <text x="436" y="122">24,900</text>
                <text x="436" y="162">24,840</text>
                <text x="436" y="202">24,780</text>
                <text x="26" y="231">09:30</text>
                <text x="194" y="231">12:00</text>
                <text x="372" y="231">15:15</text>
              </g>

              <g className="artha-crosshair">
                <line x1="236" y1="24" x2="236" y2="210" stroke="#64748B" strokeWidth="1" strokeDasharray="3 4" opacity=".65" />
                <g className="artha-crosshair-tooltip">
                  <rect x="244" y="38" width="105" height="30" rx="7" fill="#0F172A" />
                  <text x="255" y="51" fill="#CBD5E1" fontSize="8">Sample value</text>
                  <text x="255" y="62" fill="#FFFFFF" fontSize="9" fontWeight="700">24,912</text>
                </g>
              </g>
            </svg>
            <p className="mt-2 text-[8px] leading-4 text-slate-400">Sample chart for product preview — not live market data.</p>
          </div>

          <aside className="p-4 sm:p-5" aria-label="Sample ArthaMind response panel">
            <div className="artha-answer-reveal" style={{ animationDelay: '3.1s' }}>
              <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-teal-700">ArthaMind response</div>
              <h3 className="mt-3 text-[12px] font-bold leading-5 text-slate-900">What may be driving today’s NIFTY movement?</h3>
            </div>
            <p className="artha-answer-reveal mt-3 text-[10px] leading-5 text-slate-600" style={{ animationDelay: '3.35s' }}>
              The move may reflect broader market sentiment and sector performance.
            </p>

            <div className="mt-5 space-y-2.5 text-[9px] text-slate-600">
              <div className="artha-answer-reveal flex items-center justify-between border-b border-slate-100 pb-2" style={{ animationDelay: '3.6s' }}><span>Market context</span><span className="font-semibold text-slate-800">Included</span></div>
              <div className="artha-answer-reveal flex items-center justify-between border-b border-slate-100 pb-2" style={{ animationDelay: '3.82s' }}><span>Sources</span><span className="font-semibold text-slate-800">3 reviewed</span></div>
              <div className="artha-answer-reveal flex items-center justify-between border-b border-slate-100 pb-2" style={{ animationDelay: '4.02s' }}><span>Verification</span><span className="font-semibold text-amber-700">Required</span></div>
            </div>

            <button
              type="button"
              onClick={() => onEnter('evaluation-lab')}
              className="artha-answer-reveal artha-preview-action mt-5 inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-[10px] font-bold text-teal-800"
              style={{ animationDelay: '4.18s' }}
            >
              Inspect evidence <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          </aside>
        </div>

        <div className="artha-context-boundary relative flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[9px] text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span><strong className="font-semibold text-slate-800">Public market context:</strong> active</span>
          <span className="flex items-center gap-1.5">
            <strong className="font-semibold text-slate-800">Personal context:</strong> off by default
            <span className="group relative inline-flex">
              <button
                type="button"
                onClick={() => setPrivacyTipOpen((open) => !open)}
                aria-label="Why personal context is off by default"
                aria-describedby="personal-context-tooltip"
                aria-expanded={privacyTipOpen}
                className="artha-preview-action rounded p-0.5 text-slate-500"
              >
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span
                id="personal-context-tooltip"
                role="tooltip"
                className={`pointer-events-none absolute bottom-full right-0 z-10 mb-2 w-52 rounded-lg bg-slate-900 px-3 py-2 text-[9px] leading-4 text-white shadow-lg transition-opacity ${privacyTipOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}
              >
                Personal categories are used only after you enable them.
              </span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
