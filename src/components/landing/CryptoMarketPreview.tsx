import React, { useCallback, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Wifi } from 'lucide-react';
import { useCryptoKlines, useCryptoMarkets } from '../crypto/useCryptoMarketData';
import { CRYPTO_INTERVALS, CRYPTO_SYMBOLS, CryptoInterval, CryptoSymbol } from '../crypto/cryptoTypes';
import { CryptoAssetSelector, cryptoDisplayName } from './CryptoAssetSelector';
import { InteractiveCandlestickChart } from './InteractiveCandlestickChart';

const STORAGE_SYMBOL = 'artha_landing_crypto_symbol_v2';
const STORAGE_INTERVAL = 'artha_landing_crypto_interval_v2';

function readSymbol(): CryptoSymbol {
  if (typeof window === 'undefined') return 'BTCUSDT';
  const saved = localStorage.getItem(STORAGE_SYMBOL);
  return CRYPTO_SYMBOLS.includes(saved as CryptoSymbol) ? saved as CryptoSymbol : 'BTCUSDT';
}
function readInterval(): CryptoInterval {
  if (typeof window === 'undefined') return '15m';
  const saved = localStorage.getItem(STORAGE_INTERVAL);
  return CRYPTO_INTERVALS.includes(saved as CryptoInterval) ? saved as CryptoInterval : '15m';
}

export const CryptoMarketPreview: React.FC = () => {
  const [symbol, setSymbol] = useState<CryptoSymbol>(readSymbol);
  const [interval, setInterval] = useState<CryptoInterval>(readInterval);
  const [resetChart, setResetChart] = useState<(() => void) | null>(null);
  const market = useCryptoMarkets();
  const { candles, status, retry, diagnostics } = useCryptoKlines(symbol, interval);
  const quote = useMemo(() => market.quotes.find((item) => item.symbol === symbol), [market.quotes, symbol]);
  const latest = candles.at(-1);
  const change = quote?.changePercent ?? (latest?.open ? ((latest.close / latest.open) - 1) * 100 : 0);
  const displayPrice = quote?.price ?? latest?.close;
  const label = status === 'live' ? 'LIVE' : status === 'cached' ? 'CACHED' : status === 'reconnecting' ? 'RECONNECTING' : status === 'stale' ? 'STALE' : status === 'connecting' ? 'CONNECTING' : 'UNAVAILABLE';

  const chooseSymbol = useCallback((next: CryptoSymbol) => { setSymbol(next); localStorage.setItem(STORAGE_SYMBOL, next); }, []);
  const chooseInterval = useCallback((next: CryptoInterval) => { setInterval(next); localStorage.setItem(STORAGE_INTERVAL, next); }, []);
  const registerReset = useCallback((reset: () => void) => setResetChart(() => reset), []);
  const openDashboard = `/workspace/crypto?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`;

  return (
    <section className="mt-8 overflow-hidden rounded-[26px] border border-white/10 bg-[#050505] text-white shadow-[0_24px_70px_rgba(0,0,0,.18)]" aria-label={`${cryptoDisplayName(symbol)} live candlestick preview`}>
      <div className="border-b border-white/10 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-[.14em]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/75"><Wifi className="h-3 w-3" /> LIVE CRYPTO MARKET DATA</span>
              <span className="text-white/35">Binance Public Market Data · {symbol} · {interval}</span>
            </div>
            <h3 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{cryptoDisplayName(symbol)} live candlestick</h3>
            <p className="mt-1 text-xs leading-5 text-white/45">Provider-backed OHLC candles. Feed state is shown honestly; no sample candles are substituted.</p>
          </div>
          <div className="flex shrink-0 items-end gap-4">
            <div className="text-right"><div className="text-[9px] uppercase tracking-[.12em] text-white/35">Current price</div><div className="text-xl font-black tabular-nums">{displayPrice === undefined ? '—' : `${displayPrice.toLocaleString(undefined, { maximumFractionDigits: displayPrice < 1 ? 6 : 2 })} USDT`}</div><div className={`text-[10px] font-bold ${change >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{displayPrice === undefined ? 'Waiting for provider data' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}</div></div>
            <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black text-white/65 hover:border-white/25 hover:text-white" aria-label="Refresh crypto market data"><RefreshCw className="h-3 w-3" /> Refresh</button>
          </div>
        </div>
        <div className="mt-5"><CryptoAssetSelector symbol={symbol} interval={interval} onSymbolChange={chooseSymbol} onIntervalChange={chooseInterval} onReset={() => resetChart?.()} /></div>
      </div>
      <div className="px-3 pb-3 sm:px-5 sm:pb-5">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#050505]">
          {candles.length ? <InteractiveCandlestickChart candles={candles} onResetReady={registerReset} /> : <div className="flex h-[300px] items-center justify-center text-xs font-semibold text-white/35 sm:h-[400px]">{status === 'unavailable' ? 'Crypto market data temporarily unavailable.' : 'Loading provider-backed candles…'}</div>}
        </div>
        <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3 text-[9px] text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>{label} · Updated {diagnostics.lastValidMessageAt ? new Date(diagnostics.lastValidMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : diagnostics.restSnapshotAt ? new Date(diagnostics.restSnapshotAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
          <a href={openDashboard} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white px-3 py-2 text-[10px] font-black text-black hover:bg-white/90" aria-label={`Open ${cryptoDisplayName(symbol)} in Crypto Dashboard`}>
            Open Crypto Dashboard ↗ <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
};
