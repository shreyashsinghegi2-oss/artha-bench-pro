import React from 'react';
import { illustrativeDisclosure, illustrativeMarketData } from './illustrativeMarketData';

export const MarketTicker: React.FC = () => {
  const items = [...illustrativeMarketData, ...illustrativeMarketData];
  return (
    <div className="artha-ticker mt-7 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]" aria-label="Illustrative market context ticker" tabIndex={0}>
      <div className="flex items-center border-b border-white/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
        <span className="text-emerald-300">Market context</span>
        <span className="mx-2 text-slate-700">•</span>
        <span>{illustrativeDisclosure}</span>
      </div>
      <div className="artha-ticker-track flex w-max items-center gap-7 px-4 py-2.5 text-[10px]">
        {items.map((item, index) => (
          <div key={`${item.symbol}-${index}`} className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-black text-slate-200">{item.symbol}</span>
            <span className="text-slate-600">{item.label}</span>
            <span className={item.direction === 'up' ? 'text-emerald-300' : 'text-rose-300'}>
              {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}% {item.direction === 'up' ? '↑' : '↓'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
