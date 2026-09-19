import React from 'react';
import { RotateCcw, ChevronDown, Search, SlidersHorizontal, CandlestickChart } from 'lucide-react';
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
}) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const filtered = CRYPTO_SYMBOLS.filter((item) =>
    ASSET_NAMES[item].toLowerCase().includes(query.toLowerCase()) || item.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="crypto-toolbar" aria-label="Crypto chart controls">
      <div className="crypto-asset-combobox">
        <button type="button" className="crypto-asset-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span className="crypto-coin-mark" aria-hidden="true">₿</span>
          <span className="crypto-asset-copy"><strong>{cryptoDisplayName(symbol)}</strong><small>{symbol}</small></span>
          <ChevronDown className="crypto-chevron" size={15} aria-hidden="true" />
        </button>
        {open && (
          <div className="crypto-asset-menu" role="listbox" aria-label="Select crypto asset">
            <div className="crypto-search">
              <Search size={14} aria-hidden="true" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search asset" aria-label="Search crypto asset" />
            </div>
            {filtered.map((item) => (
              <button key={item} type="button" role="option" aria-selected={symbol === item} onClick={() => { onSymbolChange(item); setOpen(false); setQuery(''); }} className="crypto-asset-option">
                <span>{ASSET_NAMES[item]}</span><small>{item}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="crypto-toolbar-divider" aria-hidden="true" />
      <div className="crypto-timeframes" role="tablist" aria-label="Crypto chart timeframe">
        {CRYPTO_INTERVALS.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={interval === item} onClick={() => onIntervalChange(item)}
            className={`crypto-timeframe ${interval === item ? 'is-active' : ''}`} aria-label={`${INTERVAL_LABELS[item]} timeframe`}>
            {INTERVAL_LABELS[item]}
          </button>
        ))}
      </div>
      <div className="crypto-toolbar-divider" aria-hidden="true" />
      <button type="button" className="crypto-tool-button" aria-label="Chart indicators" title="Indicators"><SlidersHorizontal size={15}/><span>Indicators</span></button>
      <button type="button" className="crypto-tool-button" aria-label="Chart type: Candles" title="Candles"><CandlestickChart size={15}/><span>Candles</span></button>
      <button type="button" onClick={onReset} disabled={resetDisabled} className="crypto-icon-button" aria-label="Reset chart view" title="Reset view"><RotateCcw size={16}/></button>
    </div>
  );
};
