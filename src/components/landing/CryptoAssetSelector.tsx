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
  resetDisabled?: boolean;
}

export const CryptoAssetSelector: React.FC<Props> = ({
  symbol,
  interval,
  onSymbolChange,
  onIntervalChange,
  onReset,
  resetDisabled = false,
}) => (
  <div className="flex flex-col gap-3 border-b border-[#262626] pb-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
      <label className="sr-only" htmlFor="landing-crypto-asset">Crypto asset</label>
      <select
        id="landing-crypto-asset"
        value={symbol}
        onChange={(event) => onSymbolChange(event.target.value as CryptoSymbol)}
        className="min-w-0 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-xs font-bold text-[#111827] outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA] sm:w-[220px]"
      >
        {CRYPTO_SYMBOLS.map((item) => (
          <option key={item} value={item} className="bg-white text-[#111827]">{ASSET_NAMES[item]}</option>
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
            className={`shrink-0 min-h-[36px] rounded-lg border px-3 py-2 text-[13px] font-semibold leading-none text-[#111827] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] ${interval === item ? 'border-2 border-[#2563EB] bg-[#F3F4F6] text-[#111827] hover:bg-[#E5E7EB]' : 'border-[#D1D5DB] bg-white text-[#111827] hover:border-[#94A3B8] hover:bg-[#F3F4F6]'} [&_svg]:text-[#111827]`}
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
      disabled={resetDisabled}
      className="inline-flex min-h-[36px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-[13px] font-semibold leading-none text-[#111827] hover:border-[#94A3B8] hover:bg-[#F3F4F6] active:bg-[#E5E7EB] disabled:cursor-not-allowed disabled:border-[#D1D5DB] disabled:bg-[#FFFFFF] disabled:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] [&_svg]:text-[#111827]"
      aria-label="Reset crypto chart view" aria-disabled={resetDisabled}
    >
      <RotateCcw className="h-3.5 w-3.5" /> Reset view
    </button>
  </div>
);
