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
        className="crypto-control crypto-text-control min-h-[32px] min-w-0 border-0 bg-transparent px-0 py-1 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-[#60A5FA] sm:w-[180px]"
      >
        {CRYPTO_SYMBOLS.map((item) => (
          <option key={item} value={item} className="bg-[#050505] text-white">{ASSET_NAMES[item]}</option>
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
            className={`crypto-control crypto-timeframe shrink-0 min-h-[32px] rounded-md border-0 bg-transparent px-2 py-1 text-[12px] font-semibold leading-none text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] ${interval === item ? 'bg-[#1F2937] text-white' : 'text-white/90 hover:bg-[#111827] hover:text-white'} [&_svg]:text-white`}
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
      className="crypto-control crypto-text-control inline-flex min-h-[32px] shrink-0 items-center justify-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-[12px] font-semibold leading-none text-white hover:bg-[#111827] hover:text-white disabled:cursor-not-allowed disabled:bg-transparent disabled:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] [&_svg]:text-white"
      aria-label="Reset crypto chart view" aria-disabled={resetDisabled}
    >
      <RotateCcw className="h-3.5 w-3.5" /> Reset view
    </button>
  </div>
);
