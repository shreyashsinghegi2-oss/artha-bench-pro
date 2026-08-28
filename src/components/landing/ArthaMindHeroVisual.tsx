import React from 'react';
import { ArthaMindLogo } from './ArthaMindLogo';

const heroCandles = [
  [44, 146, 132, 125, 154], [68, 132, 139, 127, 146], [92, 139, 121, 114, 145], [116, 121, 128, 116, 136],
  [140, 128, 111, 104, 134], [164, 111, 118, 106, 126], [188, 118, 101, 94, 124], [212, 101, 106, 96, 114],
  [236, 106, 92, 85, 112], [260, 92, 99, 88, 107], [284, 99, 84, 77, 105], [308, 84, 89, 80, 98],
  [332, 89, 76, 70, 94], [356, 76, 82, 72, 90], [380, 82, 73, 67, 88], [404, 73, 78, 69, 86],
];

export const ArthaMindHeroVisual: React.FC = () => (
  <div className="artha-hero-product mx-auto w-full max-w-[520px]" aria-label="Illustrative ArthaMind financial research preview">
    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <ArthaMindLogo className="h-7 w-7" compact />
          <div><div className="text-[11px] font-bold text-slate-900">Research snapshot</div><div className="text-[8px] text-slate-400">Illustrative market context</div></div>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[8px] font-semibold text-slate-500">Demo</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-end justify-between gap-4">
          <div><div className="text-[10px] font-semibold text-slate-500">NIFTY 50</div><div className="mt-1 text-xl font-black tracking-tight text-slate-950">Market research view</div></div>
          <div className="text-right"><div className="text-[9px] font-semibold text-emerald-700">+0.42% ↑</div><div className="mt-0.5 text-[8px] text-slate-400">illustrative</div></div>
        </div>

        <svg viewBox="0 0 450 210" className="mt-4 block h-auto w-full" role="img" aria-labelledby="hero-chart-title hero-chart-desc">
          <title id="hero-chart-title">Illustrative market candlestick chart</title>
          <desc id="hero-chart-desc">A calm non-live candlestick illustration for the ArthaMind research experience.</desc>
          <g stroke="#E2E8F0" strokeWidth="1" opacity=".8">
            {[35,75,115,155,195].map((y) => <line key={y} x1="20" y1={y} x2="430" y2={y} />)}
          </g>
          <g>
            {heroCandles.map(([x, open, close, high, low], index) => {
              const up = close < open;
              const top = Math.min(open, close);
              const height = Math.max(5, Math.abs(close - open));
              return <g key={x} className="artha-hero-candle" style={{ animationDelay: `${0.25 + index * 0.07}s` }}><line x1={x} x2={x} y1={high} y2={low} stroke={up ? '#0F766E' : '#B4535A'} strokeWidth="1.5" /><rect x={x - 5} y={top} width="10" height={height} rx="1.5" fill={up ? '#2A9D8F' : '#C96A70'} /></g>;
            })}
          </g>
          <path className="artha-hero-price-line" d="M332 78 H430" fill="none" stroke="#0F766E" strokeWidth="1.4" strokeDasharray="4 5" />
          <g fill="#94A3B8" fontSize="8"><text x="24" y="206">09:30</text><text x="196" y="206">12:00</text><text x="382" y="206">15:15</text></g>
        </svg>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5"><div className="text-[8px] uppercase tracking-[0.12em] text-slate-400">Question</div><div className="mt-1 text-[9px] font-semibold leading-4 text-slate-700">What may be driving this move?</div></div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5"><div className="text-[8px] uppercase tracking-[0.12em] text-slate-400">Evidence</div><div className="mt-1 text-[9px] font-semibold leading-4 text-slate-700">Sources and assumptions visible</div></div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5"><div className="text-[8px] uppercase tracking-[0.12em] text-slate-400">Boundary</div><div className="mt-1 text-[9px] font-semibold leading-4 text-slate-700">Personal context stays off</div></div>
        </div>
      </div>
    </div>
    <p className="mt-3 text-center text-[8px] uppercase tracking-[0.14em] text-slate-600">Illustrative research preview — not live market data</p>
  </div>
);
