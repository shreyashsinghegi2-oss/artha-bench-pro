import React, { useEffect, useRef } from 'react';
import { CandlestickSeries, ColorType, createChart, IChartApi } from 'lightweight-charts';
import { RefreshCw, Wifi } from 'lucide-react';
import { useCryptoKlines } from '../crypto/useCryptoMarketData';

export const LandingBitcoinChart: React.FC = () => {
  const { candles, status, retry } = useCryptoKlines('BTCUSDT', '15m');
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      autoSize: true,
      height: 320,
      layout: { background: { type: ColorType.Solid, color: '#0d0d0d' }, textColor: '#cbd5e1' },
      grid: { vertLines: { color: 'rgba(148,163,184,.10)' }, horzLines: { color: 'rgba(148,163,184,.10)' } },
      rightPriceScale: { borderColor: 'rgba(148,163,184,.18)' },
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 8, borderColor: 'rgba(148,163,184,.18)' },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(255,255,255,.35)', labelBackgroundColor: '#151515' },
        horzLine: { color: 'rgba(255,255,255,.35)', labelBackgroundColor: '#151515' },
      },
    } as any);
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#00ff88',
      downColor: '#ff3b3b',
      wickUpColor: '#00ff88',
      wickDownColor: '#ff3b3b',
      borderUpColor: '#00ff88',
      borderDownColor: '#ff3b3b',
      borderVisible: false,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !candles.length) return;
    seriesRef.current.setData(candles.map((c) => ({
      time: Math.floor(c.openTime / 1000) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    })));
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  const latest = candles.at(-1);
  const change = latest?.open ? ((latest.close / latest.open) - 1) * 100 : 0;
  const label = status === 'live' ? 'LIVE' : status === 'cached' ? 'CACHED' : status === 'reconnecting' ? 'RECONNECTING' : 'UNAVAILABLE';

  return (
    <section className="border-t border-white/10 bg-[#0d0d0d] p-4 sm:p-5" aria-label="Bitcoin live candlestick chart">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black tracking-[.12em] text-white/65">
              <Wifi className="h-3 w-3" />{label}
            </span>
            <span className="text-[9px] font-semibold text-white/35">Binance · Bitcoin / USDT · 15m</span>
          </div>
          <h3 className="mt-2 text-xl font-black text-white">Bitcoin live candlestick</h3>
          <p className="mt-1 text-xs text-white/45">Public OHLC market stream with provider-backed status.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-[.12em] text-white/35">Latest close</div>
            <div className="text-lg font-black text-white">{latest ? `$${latest.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}</div>
            <div className={`text-[9px] font-bold ${change >= 0 ? 'text-[#00ff88]' : 'text-[#ff3b3b]'}`}>{latest ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : 'Waiting for data'}</div>
          </div>
          <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[9px] font-black text-white/60 hover:border-white/25 hover:text-white">
            <RefreshCw className="h-3 w-3" />Retry
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d]">
        <div ref={ref} className="h-[320px] w-full" />
        {!candles.length && <div className="-mt-[320px] flex h-[320px] items-center justify-center text-xs font-semibold text-white/35">Loading Bitcoin market candles…</div>}
      </div>
    </section>
  );
};
