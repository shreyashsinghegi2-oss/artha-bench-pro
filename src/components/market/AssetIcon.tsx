import React from 'react';

/**
 * Drawn symbols for assets that have no company logo: gold, silver, crude oil (and oil & gas stocks),
 * currency pairs as flags, US indices and funds, Bitcoin and Ethereum. Pure SVG, no image requests.
 */
export type AssetKind = 'gold' | 'silver' | 'oil' | 'us' | 'btc' | 'eth' | 'pair';
type Flag = 'IN' | 'US' | 'EU' | 'GB' | 'JP';

const CCY_FLAG: Record<string, Flag> = { INR: 'IN', USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP' };
const OIL_STOCKS = new Set(['ONGC', 'BPCL', 'IOC', 'HINDPETRO', 'OIL', 'GAIL', 'PETRONET', 'XOM', 'CVX', 'BP', 'SHEL']);

const norm = (s: string) => s.toUpperCase().replace(/\.(NS|BO)$/, '').replace(/:(NSE|BSE|NASDAQ|NYSE|FX)$/, '').trim();

/** Currency pair → [base, quote] flags, from "USD/INR", "USDINR=X", "INR=X" (USD/INR) or a currency name. */
function pairFlags(s: string): [Flag, Flag] | [Flag] | null {
  if (s === 'INR=X' || s === 'US DOLLAR') return s === 'INR=X' ? ['US', 'IN'] : ['US'];
  if (s === 'EURO') return ['EU'];
  if (s === 'POUND') return ['GB'];
  const m = s.replace('=X', '').match(/^([A-Z]{3})\s*\/?\s*([A-Z]{3})$/);
  if (m && CCY_FLAG[m[1]] && CCY_FLAG[m[2]]) return [CCY_FLAG[m[1]], CCY_FLAG[m[2]]];
  return null;
}

export function assetKind(symbol: string): { kind: AssetKind; flags?: Flag[] } | null {
  const s = norm(symbol);
  if (/^(GOLD|GC=F|XAU|XAUUSD|XAU\/USD|GOLDBEES|GOLD COMEX)$/.test(s) || /^GOLD\b/.test(s)) return { kind: 'gold' };
  if (/^(SILVER|SI=F|XAG|XAGUSD|SILVERBEES)$/.test(s)) return { kind: 'silver' };
  if (/^(CL=F|BZ=F|CRUDE|CRUDE OIL|BRENT|WTI|OIL PRICE)$/.test(s) || OIL_STOCKS.has(s)) return { kind: 'oil' };
  if (/^(BTC|BTC-USD|BTCUSDT|BTC\/USDT|BTC\/USD|BITCOIN)$/.test(s)) return { kind: 'btc' };
  if (/^(ETH|ETH-USD|ETHUSDT|ETH\/USDT|ETH\/USD|ETHEREUM)$/.test(s)) return { kind: 'eth' };
  if (/^(\^GSPC|S&P 500|S&P 500 INDEX|\^DJI|DOW|DOW JONES|DOW JONES INDUSTRIAL AVERAGE|NASDAQ|\^IXIC|NASDAQ 100|SPY|QQQ|DIA|US MARKETS?)$/.test(s)) return { kind: 'us', flags: ['US'] };
  const flags = pairFlags(s);
  if (flags) return { kind: 'pair', flags };
  return null;
}

const FlagSvg: React.FC<{ flag: Flag; id: string }> = ({ flag, id }) => {
  switch (flag) {
    case 'IN': return <g>
      <rect width="40" height="13.4" fill="#FF9933"/><rect y="13.3" width="40" height="13.4" fill="#fff"/><rect y="26.6" width="40" height="13.4" fill="#138808"/>
      <circle cx="20" cy="20" r="4.6" fill="none" stroke="#000080" strokeWidth="1.1"/><circle cx="20" cy="20" r="1" fill="#000080"/>
    </g>;
    case 'US': return <g>
      {Array.from({ length: 7 }, (_, i) => <rect key={i} y={i * 5.72} width="40" height="2.86" fill="#B22234"/>)}
      <rect y="2.86" width="40" height="2.86" fill="#fff"/>
      <rect width="19" height="20" fill="#3C3B6E"/>
      {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={3.2 + (i % 4) * 4.2} cy={3.4 + Math.floor(i / 4) * 5.6} r="1" fill="#fff"/>)}
    </g>;
    case 'EU': return <g>
      <rect width="40" height="40" fill="#003399"/>
      {Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return <circle key={i} cx={20 + Math.cos(a) * 10} cy={20 + Math.sin(a) * 10} r="1.5" fill="#FFCC00"/>; })}
    </g>;
    case 'GB': return <g>
      <rect width="40" height="40" fill="#012169"/>
      <path d="M0 0L40 40M40 0L0 40" stroke="#fff" strokeWidth="8"/><path d="M0 0L40 40M40 0L0 40" stroke="#C8102E" strokeWidth="3"/>
      <path d="M20 0V40M0 20H40" stroke="#fff" strokeWidth="11"/><path d="M20 0V40M0 20H40" stroke="#C8102E" strokeWidth="6"/>
    </g>;
    case 'JP': return <g><rect width="40" height="40" fill="#fff"/><circle cx="20" cy="20" r="9" fill="#BC002D"/></g>;
  }
};

const RoundFlag: React.FC<{ flag: Flag; id: string; x?: number; y?: number; r?: number }> = ({ flag, id, x = 20, y = 20, r = 20 }) => <g>
  <clipPath id={`${id}-${flag}`}><circle cx={x} cy={y} r={r}/></clipPath>
  <g clipPath={`url(#${id}-${flag})`} transform={`translate(${x - r} ${y - r}) scale(${r / 20})`}><FlagSvg flag={flag} id={id}/></g>
  <circle cx={x} cy={y} r={r - 0.5} fill="none" stroke="rgba(15,23,42,.18)"/>
</g>;

let uid = 0;
export const AssetIcon: React.FC<{ symbol: string; size?: number; className?: string; title?: string }> = ({ symbol, size = 28, className = '', title }) => {
  const info = assetKind(symbol);
  const [id] = React.useState(() => `ai${++uid}`);
  if (!info) return null;
  const label = title ?? symbol;
  const common = { width: size, height: size, viewBox: '0 0 40 40', className: `asset-icon shrink-0 ${className}`.trim(), role: 'img' as const, 'aria-label': label, style: { width: size, height: size } };
  switch (info.kind) {
    case 'gold':
    case 'silver': {
      const [a, b, c] = info.kind === 'gold' ? ['#fde68a', '#f5b92e', '#b7791f'] : ['#f1f5f9', '#cbd5e1', '#64748b'];
      return <svg {...common}>
        <defs><linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a}/><stop offset=".55" stopColor={b}/><stop offset="1" stopColor={c}/></linearGradient></defs>
        <rect width="40" height="40" rx="10" fill={info.kind === 'gold' ? '#fff8e6' : '#f8fafc'}/>
        <path d="M8 29 L12 20 H28 L32 29 Z" fill={`url(#${id}-g)`} stroke={c} strokeWidth=".8"/>
        <path d="M13 19 L16 11 H24 L27 19 Z" fill={`url(#${id}-g)`} stroke={c} strokeWidth=".8"/>
        <path d="M14 13 H22" stroke="#fff" strokeWidth="1.2" opacity=".75"/>
        <text x="20" y="27" textAnchor="middle" fontSize="5.5" fontWeight="800" fill={c}>{info.kind === 'gold' ? 'Au' : 'Ag'}</text>
      </svg>;
    }
    case 'oil': return <svg {...common}>
      <defs><linearGradient id={`${id}-o`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#334155"/><stop offset="1" stopColor="#0b0f14"/></linearGradient></defs>
      <rect width="40" height="40" rx="10" fill="#fff4e5"/>
      <path d="M20 7 C20 7 11 18 11 24 a9 9 0 0 0 18 0 C29 18 20 7 20 7 Z" fill={`url(#${id}-o)`}/>
      <path d="M16 23 a4.5 4.5 0 0 0 4 5" stroke="#f59e0b" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    </svg>;
    case 'btc': return <svg {...common}>
      <circle cx="20" cy="20" r="20" fill="#F7931A"/>
      <text x="20" y="27.5" textAnchor="middle" fontSize="21" fontWeight="800" fill="#fff" transform="rotate(12 20 20)">₿</text>
    </svg>;
    case 'eth': return <svg {...common}>
      <circle cx="20" cy="20" r="20" fill="#627EEA"/>
      <path d="M20 6 L20 16.5 L28.6 20.3 Z" fill="#fff" opacity=".6"/><path d="M20 6 L11.4 20.3 L20 16.5 Z" fill="#fff"/>
      <path d="M20 27.4 L20 34 L28.6 22 Z" fill="#fff" opacity=".6"/><path d="M20 34 L20 27.4 L11.4 22 Z" fill="#fff"/>
      <path d="M20 25.6 L28.6 20.3 L20 16.5 Z" fill="#fff" opacity=".2"/><path d="M11.4 20.3 L20 25.6 L20 16.5 Z" fill="#fff" opacity=".6"/>
    </svg>;
    case 'us': return <svg {...common}><RoundFlag flag="US" id={id}/></svg>;
    case 'pair': {
      const f = info.flags ?? [];
      if (f.length === 1) return <svg {...common}><RoundFlag flag={f[0]} id={id}/></svg>;
      return <svg {...common}><RoundFlag flag={f[1]} id={id} x={26} y={26} r={13}/><RoundFlag flag={f[0]} id={id} x={14} y={14} r={13}/></svg>;
    }
  }
};
