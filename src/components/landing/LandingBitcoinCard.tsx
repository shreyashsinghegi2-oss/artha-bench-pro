import React, { useEffect, useRef, useState } from 'react';
import { CandlestickSeries, ColorType, createChart, CrosshairMode, HistogramSeries, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { Activity, Clock3 } from 'lucide-react';
import { getCryptoKlines, getCryptoMarkets } from '../../services/cryptoApi';
import type { CryptoCandle, CryptoInterval, CryptoKlinesResponse, CryptoQuote } from '../crypto/cryptoTypes';

type Props = { onOpenCrypto: () => void };
type HoverCandle = CryptoCandle & { x: number; y: number };
const TIMEFRAMES: Array<{ label: string; interval: CryptoInterval }> = [
  { label: '1H', interval: '1h' },
  { label: '4H', interval: '4h' },
  { label: '1D', interval: '1d' },
];
function price(value: number) { return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function formatTime(value: string | null) { if (!value) return 'Time unavailable'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Time unavailable' : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date); }

export const LandingBitcoinCard: React.FC<Props> = ({ onOpenCrypto }) => {
  const [interval, setInterval] = useState<CryptoInterval>('1h');
  const [candles, setCandles] = useState<CryptoCandle[]>([]);
  const [quote, setQuote] = useState<CryptoQuote | null>(null);
  const [retrievedAt, setRetrievedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stale, setStale] = useState(false);
  const [hoverCandle, setHoverCandle] = useState<HoverCandle | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const candlesRef = useRef<CryptoCandle[]>([]);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const controller = new AbortController();
      try {
        const [history, markets] = await Promise.all([
          getCryptoKlines('BTCUSDT', interval, controller.signal),
          getCryptoMarkets(controller.signal),
        ]);
        if (!active) return;
        const candleResponse = history as CryptoKlinesResponse;
        const btc = markets.markets.find((item) => item.symbol === 'BTCUSDT') || null;
        setCandles(candleResponse.candles.slice(-80));
        setQuote(btc);
        setRetrievedAt(candleResponse.retrievedAt || markets.retrievedAt);
        setError(false);
        setStale(false);
      } catch {
        if (active) {
          if (candlesRef.current.length === 0) setError(true);
          else setStale(true);
        }
      } finally {
        if (active) setLoading(false);
        controller.abort();
      }
    };
    setLoading(true);
    void load();
    if (refreshRef.current) clearInterval(refreshRef.current);
    refreshRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 15000);
    const onVisibility = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      if (refreshRef.current) clearInterval(refreshRef.current);
      refreshRef.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [interval]);

  useEffect(() => {
    if (!containerRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 320,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#64748B' },
      grid: { vertLines: { color: 'rgba(148,163,184,.10)' }, horzLines: { color: 'rgba(148,163,184,.10)' } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 2, barSpacing: 9, minBarSpacing: 2, borderColor: 'rgba(148,163,184,.18)' },
      rightPriceScale: { borderColor: 'rgba(148,163,184,.18)' },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true } },
    } as any);
    const candleSeries = chart.addSeries(CandlestickSeries, { upColor: '#16A34A', downColor: '#DC2626', wickUpColor: '#16A34A', wickDownColor: '#DC2626', borderVisible: false });
    const volumeSeries = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume' });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.80, bottom: 0 } });
    const unsubscribe = () => setHoverCandle(null);
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) { unsubscribe(); return; }
      const data = param.seriesData.get(candleSeries) as { open?: number; high?: number; low?: number; close?: number } | undefined;
      if (!data || data.open == null || data.high == null || data.low == null || data.close == null) { unsubscribe(); return; }
      const timeSeconds = typeof param.time === 'number' ? param.time : 0;
      const source = candlesRef.current.find((candle) => Math.floor(candle.openTime / 1000) === timeSeconds);
      if (!source) { unsubscribe(); return; }
      setHoverCandle({ ...source, x: param.point.x, y: param.point.y });
    });
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    if (reduceMotion) chart.applyOptions({ kineticScroll: { mouse: false, touch: false } } as any);
    return () => {
      chart.unsubscribeCrosshairMove(() => undefined);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries || !candles.length) return;
    candlesRef.current = candles;
    candleSeries.setData(candles.map((candle) => ({ time: Math.floor(candle.openTime / 1000) as Time, open: candle.open, high: candle.high, low: candle.low, close: candle.close })));
    volumeSeries.setData(candles.map((candle) => ({ time: Math.floor(candle.openTime / 1000) as Time, value: candle.volume, color: candle.close >= candle.open ? 'rgba(22,163,74,.35)' : 'rgba(220,38,38,.35)' })));
    chart.timeScale().fitContent();
  }, [candles]);

  const latest = candles.at(-1);
  const changePositive = (quote?.changePercent ?? 0) >= 0;

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 p-3 shadow-inner" aria-labelledby="landing-btc-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[.16em] text-teal-300"><Activity className="h-3 w-3" aria-hidden="true" />Provider-backed crypto market</div>
          <div id="landing-btc-title" className="mt-1 text-sm font-black text-white">BTC/USDT <span className="font-normal text-slate-500">· Binance Public Market Data</span></div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[.04] p-1" role="group" aria-label="Bitcoin timeframe">
          {TIMEFRAMES.map((item) => <button key={item.interval} type="button" onClick={() => setInterval(item.interval)} className={`rounded-md px-2 py-1 text-[8px] font-bold transition ${interval === item.interval ? 'bg-teal-400 text-slate-950' : 'text-slate-300 hover:bg-white/[.06]'}`}>{item.label}</button>)}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div><div className="text-lg font-black tabular-nums text-white">{quote ? price(quote.price) : latest ? price(latest.close) : '—'}</div><div className={`mt-1 text-[9px] font-bold ${changePositive ? 'text-emerald-300' : 'text-rose-300'}`}>{quote ? `${changePositive ? '+' : ''}${quote.change.toFixed(2)} · ${changePositive ? '+' : ''}${quote.changePercent.toFixed(2)}%` : 'Provider change unavailable'}</div></div>
        <div className="text-right text-[8px] leading-4 text-slate-400"><div className="inline-flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${stale ? 'bg-amber-300' : 'bg-emerald-300'}`} />{stale ? 'Stale · last successful provider data' : 'Polled provider data · refreshes every 15s while visible'}</div><div>{retrievedAt ? formatTime(retrievedAt) : 'Timestamp unavailable'}</div></div>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#0b1220]">
        {loading && !candles.length ? <div className="flex h-56 items-center justify-center text-[10px] text-slate-400">Loading provider OHLC data…</div> : error && !candles.length ? <div className="flex h-56 flex-col items-center justify-center px-6 text-center text-[10px] text-slate-400"><span className="font-bold text-slate-200">BTC chart unavailable from current provider</span><span className="mt-1">No synthetic candles are shown.</span></div> : <div ref={containerRef} className="relative h-56 w-full" role="img" aria-label="Provider-backed Bitcoin candlestick chart with OHLC tooltip and volume" >{hoverCandle && <div className="pointer-events-none absolute z-10 max-w-[180px] rounded-lg border border-white/10 bg-slate-900/95 p-2 text-[8px] text-slate-200 shadow-xl" style={{ left: Math.max(8, Math.min(hoverCandle.x + 10, 210)), top: Math.max(8, Math.min(hoverCandle.y + 10, 155)) }}><div className="mb-1 font-black text-teal-200">Provider OHLC</div><div className="grid grid-cols-2 gap-x-3 gap-y-1"><span>Open <b>{price(hoverCandle.open)}</b></span><span>High <b>{price(hoverCandle.high)}</b></span><span>Low <b>{price(hoverCandle.low)}</b></span><span>Close <b>{price(hoverCandle.close)}</b></span><span>Volume <b>{hoverCandle.volume.toLocaleString('en-US')}</b></span></div></div>}</div>}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[8px] text-slate-500"><span>Same provider OHLC candles · 1H / 4H / 1D · Educational / market context only</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" aria-hidden="true" />{retrievedAt ? `Updated ${formatTime(retrievedAt)}` : 'Update time unavailable'}</span></div>
      <button type="button" onClick={onOpenCrypto} className="mt-3 w-full rounded-lg border border-teal-400/20 bg-teal-400/[.06] px-3 py-2 text-[9px] font-bold text-teal-200 transition hover:bg-teal-400/[.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300">Open full Crypto workspace</button>
    </section>
  );
};
