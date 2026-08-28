import React from 'react';
import { illustrativeMarketData } from './illustrativeMarketData';

export const MarketTicker: React.FC = () => {
  const items = [...illustrativeMarketData, ...illustrativeMarketData];
  return (
    <div className="artha-ticker mt-7 overflow-hidden border-y border-white/[0.07] bg-transparent" aria-label="Illustrative market context ticker" tabIndex={0}>
      <div className="flex items-center gap-2 px-1 pt-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        <span className="text-slate-400">Market context</span><span>•</span><span>Illustrative market context — not live market data.</span>
      </div>
      <div className="artha-ticker-track flex w-max items-center gap-8 px-1 py-2.5 text-[9px]">
        {items.map((item, index) => (
          <div key={`${item.symbol}-${index}`} className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-bold text-slate-300">{item.symbol}</span>
            <span className={item.direction === 'up' ? 'text-emerald-400' : 'text-rose-400'}>{item.change > 0 ? '+' : ''}{item.change.toFixed(2)}% {item.direction === 'up' ? '↑' : '↓'}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
