import React from 'react';

type Asset = { name: string; short: string; kind: 'ETF' | 'Company' };
const ASSETS: Record<string, Asset> = {
  SPY: { name: 'SPDR S&P 500 ETF Trust', short: 'SPY', kind: 'ETF' },
  AAPL: { name: 'Apple', short: 'AAPL', kind: 'Company' },
  NVDA: { name: 'NVIDIA', short: 'NVDA', kind: 'Company' },
  MSFT: { name: 'Microsoft', short: 'MSFT', kind: 'Company' },
};

export const MarketAssetIdentity: React.FC<{ symbol: string; compact?: boolean; showName?: boolean }> = ({ symbol, compact = false, showName = true }) => {
  const asset = ASSETS[symbol.toUpperCase()] ?? { name: symbol, short: symbol.slice(0, 4).toUpperCase(), kind: 'Company' as const };
  return <div className="flex min-w-0 items-center gap-2.5">
    <div role="img" aria-label={`${asset.name} identity mark`} className={`${compact ? 'h-7 w-7 text-[8px]' : 'h-9 w-9 text-[9px]'} flex shrink-0 items-center justify-center rounded-xl border border-line bg-canvas font-black tracking-tight text-interactive`}>{asset.short.slice(0,4)}</div>
    {showName && <div className="min-w-0"><div className="truncate text-[10px] font-black text-ink">{asset.name}</div><div className="text-[8px] font-bold uppercase tracking-wider text-secondary">{asset.short} · {asset.kind}</div></div>}
  </div>;
};

export const MARKET_MARK_DISCLOSURE = 'Company and fund names and marks belong to their respective owners. Identity tiles are shown only to identify public market references; Artha Bench is not affiliated with or endorsed by them.';
