import React from 'react';
import { RotateCcw } from 'lucide-react';
import { CRYPTO_INTERVALS, CRYPTO_SYMBOLS, CryptoInterval, CryptoSymbol } from '../crypto/cryptoTypes';

const ASSET_NAMES: Record<CryptoSymbol, string> = {
  BTCUSDT: 'Bitcoin / USDT',
  ETHUSDT: 'Ethereum / USDT',
  SOLUSDT: 'Solana / USDT',
  BNBUSDT: 'Binance Coin / USDT',
  XRPUSDT: 'XRP / USDT',
  ADAUSDT: 'Cardano / USDT',
  DOGEUSDT: 'Dogecoin / USDT',
};

const INTERVAL_LABELS: Record<CryptoInterval, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1D',
};

export const cryptoDisplayName = (symbol: CryptoSymbol) => ASSET_NAMES[symbol];

interface Props {
  symbol: CryptoSymbol;
  interval: CryptoInterval;
  onSymbolChange: (symbol: CryptoSymbol) => void;
  onIntervalChange: (interval: CryptoInterval) => void;
  onReset: () => void;
}

export const CryptoAssetSelector: React.FC<Props> = ({
  symbol,
  interval,
  onSymbolChange,
  onIntervalChange,
  onReset,
}) => (
  <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
      <label className="sr-only" htmlFor="landing-crypto-asset">Crypto asset</label>
      <select
        id="landing-crypto-asset"
        value={symbol}
        onChange={(event) => onSymbolChange(event.target.value as CryptoSymbol)}
        className="min-w-0 rounded-xl border border-white/10 bg-[#151515] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 sm:w-[220px]"
      >
        {CRYPTO_SYMBOLS.map((item) => (
          <option key={item} value={item}>{ASSET_NAMES[item]}</option>
        ))}
      </select>
      <div className="flex min-w-0 gap-1 overflow-x-auto" role="tablist" aria-label="Crypto chart timeframe">
        {CRYPTO_INTERVALS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={interval === item} aria-pressed={interval === item}
            onClick={() => onIntervalChange(item)}
            className={`shrink-0 min-h-[36px] rounded-lg border px-3 py-2 text-[13px] font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${interval === item ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white hover:bg-[#16324F] hover:text-white' : 'border-[#CBD5E1] bg-white text-[#334155] hover:border-[#1D4ED8] hover:bg-[#EFF6FF] hover:text-[#1D4ED8]'}`}
            aria-label={`${INTERVAL_LABELS[item]} timeframe for ${cryptoDisplayName(symbol)}`}
          >
            {INTERVAL_LABELS[item]}
          </button>
        ))}
      </div>
    </div>
    <button
      type="button"
      onClick={onReset}
      className="inline-flex min-h-[36px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-[13px] font-semibold leading-none text-[#1E3A5F] hover:border-[#1D4ED8] hover:bg-[#EFF6FF] hover:text-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      aria-label="Reset crypto chart view"
    >
      <RotateCcw className="h-3.5 w-3.5" /> Reset view
    </button>
  </div>
);
