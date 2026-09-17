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
            aria-selected={interval === item}
            onClick={() => onIntervalChange(item)}
            className={`shrink-0 rounded-lg px-2.5 py-2 text-[10px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${interval === item ? 'bg-white text-black' : 'border border-white/10 bg-white/5 text-white/55 hover:text-white'}`}
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
      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black text-white/65 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      aria-label="Reset crypto chart view"
    >
      <RotateCcw className="h-3.5 w-3.5" /> Reset view
    </button>
  </div>
);
