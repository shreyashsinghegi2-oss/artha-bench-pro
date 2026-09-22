import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AreaSeries, CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, createChart, type IChartApi, type ISeriesApi, type MouseEventParams, type Time, type UTCTimestamp } from 'lightweight-charts';
import { AlertTriangle, Maximize2, RefreshCw, RotateCcw } from 'lucide-react';
import {
  candlePollMs, fetchTerminalCandles, formatAgo, formatIst, formatMarketPrice, TERMINAL_INTERVAL_OPTIONS, TERMINAL_TABS,
  useNow, usePageVisible, type TerminalCandles, type TerminalInstrumentId, type TerminalInterval,
} from '../../services/marketTerminalApi';

type Legend = { time: number; open: number; high: number; low: number; close: number; volume?: number } | null;

const UP = '#22c55e';
const DOWN = '#ef4444';

function visibleBars(interval: TerminalInterval, width: number) {
  const target: Record<TerminalInterval, number> = { '1m': 120, '5m': 110, '15m': 100, '1h': 90, '4h': 80, '1d': 120 };
  return Math.max(30, Math.round(target[interval] * (width >= 1024 ? 1 : width >= 640 ? 0.75 : 0.5)));
}

function timeLabel(seconds: number, timezone: string, interval: TerminalInterval) {
  const date = new Date(seconds * 1000);
  const tz = timezone === 'UTC' ? 'Asia/Kolkata' : timezone;
  return interval === '1d'
    ? date.toLocaleDateString('en-IN', { timeZone: tz, day: '2-digit', month: 'short', year: 'numeric' })
    : `${date.toLocaleString('en-IN', { timeZone: tz, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} IST`;
}

/**
 * Fintech-terminal candlestick chart for NIFTY 50, SENSEX, USD/INR, Gold and BTC/USDT.
 * Uses the same Lightweight Charts stack as the existing BTC chart; instruments that return
 * closes only fall back to an area line with an explanation instead of fabricated candles.
 */
const MarketTerminalChart: React.FC = () => {
  const [instrument, setInstrument] = useState<TerminalInstrumentId>('nifty50');
  const [interval, setIntervalValue] = useState<TerminalInterval>('15m');
  const [data, setData] = useState<TerminalCandles | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [legend, setLegend] = useState<Legend>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const visible = usePageVisible();
  const now = useNow(1000);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const modeRef = useRef<'candles' | 'line' | null>(null);
  const viewKeyRef = useRef('');
  const dataRef = useRef<TerminalCandles | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Create the chart once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: '#0a0f17' }, textColor: '#94a3b8', fontFamily: 'Inter, system-ui, sans-serif'},
      grid: { vertLines: { color: 'rgba(148,163,184,.07)' }, horzLines: { color: 'rgba(148,163,184,.07)' } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#475569', labelBackgroundColor: '#1e293b' }, horzLine: { color: '#475569', labelBackgroundColor: '#1e293b' } },
      rightPriceScale: { borderColor: 'rgba(148,163,184,.15)', scaleMargins: { top: 0.1, bottom: 0.25 } },
      timeScale: { borderColor: 'rgba(148,163,184,.15)', timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 8, minBarSpacing: 2 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: true },
      localization: { priceFormatter: (price: number) => price.toLocaleString('en-IN', { maximumFractionDigits: dataRef.current?.decimals ?? 2, minimumFractionDigits: Math.min(2, dataRef.current?.decimals ?? 2) }) },
    });
    chartRef.current = chart;
    const onMove = (param: MouseEventParams<Time>) => {
      const series = priceSeriesRef.current;
      const point = param.time && series ? param.seriesData.get(series) as { open?: number; high?: number; low?: number; close?: number; value?: number } | undefined : undefined;
      if (!point || !param.time) { setLegend(null); return; }
      const volume = volumeSeriesRef.current ? (param.seriesData.get(volumeSeriesRef.current) as { value?: number } | undefined)?.value : undefined;
      const close = point.close ?? point.value ?? 0;
      setLegend({ time: Number(param.time), open: point.open ?? close, high: point.high ?? close, low: point.low ?? close, close, volume });
    };
    chart.subscribeCrosshairMove(onMove);
    return () => { chart.unsubscribeCrosshairMove(onMove); chart.remove(); chartRef.current = null; priceSeriesRef.current = null; volumeSeriesRef.current = null; modeRef.current = null; };
  }, []);

  const resetView = useCallback(() => {
    const chart = chartRef.current, current = dataRef.current, container = containerRef.current;
    if (!chart || !current || !container || !current.candles.length) return;
    const bars = Math.min(visibleBars(current.interval, container.clientWidth), current.candles.length);
    chart.timeScale().setVisibleLogicalRange({ from: current.candles.length - bars, to: current.candles.length + 2 });
    chart.priceScale('right').applyOptions({ autoScale: true });
  }, []);

  // Push data into the chart, switching between candles and a line fallback when needed.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !data) return;
    dataRef.current = data;
    const mode = data.hasOhlc ? 'candles' : 'line';
    if (modeRef.current !== mode) {
      if (priceSeriesRef.current) chart.removeSeries(priceSeriesRef.current);
      priceSeriesRef.current = mode === 'candles'
        ? chart.addSeries(CandlestickSeries, { upColor: UP, downColor: DOWN, wickUpColor: UP, wickDownColor: DOWN, borderVisible: false, priceLineVisible: true, priceLineStyle: 2 })
        : chart.addSeries(AreaSeries, { lineColor: '#2dd4bf', topColor: 'rgba(45,212,191,.28)', bottomColor: 'rgba(45,212,191,0)', lineWidth: 2, priceLineVisible: true });
      modeRef.current = mode;
    }
    if (data.hasVolume && !volumeSeriesRef.current) {
      volumeSeriesRef.current = chart.addSeries(HistogramSeries, { priceScaleId: 'volume', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    } else if (!data.hasVolume && volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
    const tz = data.timezone;
    chart.applyOptions({
      localization: { timeFormatter: (time: Time) => timeLabel(Number(time), tz, data.interval) },
      timeScale: {
        timeVisible: data.interval !== '1d',
        tickMarkFormatter: (time: Time) => {
          const date = new Date(Number(time) * 1000);
          return data.interval === '1d'
            ? date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' })
            : date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
        },
      },
    });
    const series = priceSeriesRef.current!;
    if (mode === 'candles') {
      (series as ISeriesApi<'Candlestick'>).setData(data.candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));
    } else {
      (series as ISeriesApi<'Area'>).setData(data.candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
    }
    volumeSeriesRef.current?.setData(data.candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.volume ?? 0, color: c.close >= c.open ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)' })));
    // Reset the view only when instrument or interval changes, so refreshes keep the user's zoom.
    const key = `${data.instrument}:${data.interval}`;
    if (viewKeyRef.current !== key) { viewKeyRef.current = key; resetView(); }
  }, [data, resetView]);

  // Fetch now, then poll while the tab is visible.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const load = async (initial: boolean) => {
      if (initial) { setLoading(true); setError(''); }
      try {
        const next = await fetchTerminalCandles(instrument, interval, controller.signal);
        if (!cancelled) { setData(next); setError(''); }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === 'AbortError')) setError(err instanceof Error ? err.message : 'Candles are unavailable.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const switched = !dataRef.current || dataRef.current.instrument !== instrument || dataRef.current.interval !== interval || reloadKey > 0;
    void load(switched);
    const id = visible ? window.setInterval(() => void load(false), candlePollMs(instrument, interval)) : undefined;
    return () => { cancelled = true; controller.abort(); if (id) window.clearInterval(id); };
  }, [instrument, interval, visible, reloadKey]);

  const showing = data && data.instrument === instrument && data.interval === interval ? data : null;
  const last = showing?.candles.at(-1);
  const first = showing?.candles[0];
  const active = legend ?? (last ? { ...last } : null);
  const movePct = active && active.open ? ((active.close - active.open) / active.open) * 100 : null;
  const sessionPct = last && first && first.open ? ((last.close - first.open) / first.open) * 100 : null;
  const fmt = (value: number) => showing ? formatMarketPrice(value, showing.currency, showing.decimals) : String(value);
  const isLive = showing && !showing.stale && showing.instrument === 'btcusdt';

  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = (index + (event.key === 'ArrowRight' ? 1 : TERMINAL_TABS.length - 1)) % TERMINAL_TABS.length;
    setInstrument(TERMINAL_TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return <div className={`mt-terminal ${showing || !loading ? 'is-ready' : ''}`}>
    <div className="mt-toolbar">
      <div className="mt-tabs" role="tablist" aria-label="Instrument">
        {TERMINAL_TABS.map((tab, index) => <button key={tab.id} ref={(el) => { tabRefs.current[index] = el; }} type="button" role="tab" aria-selected={instrument === tab.id} tabIndex={instrument === tab.id ? 0 : -1} onKeyDown={(event) => onTabKey(event, index)} onClick={() => setInstrument(tab.id)} className={instrument === tab.id ? 'on' : ''}>{tab.label}</button>)}
      </div>
      <div className="mt-intervals" role="group" aria-label="Candle interval">
        {TERMINAL_INTERVAL_OPTIONS.map((value) => <button key={value} type="button" aria-pressed={interval === value} onClick={() => setIntervalValue(value)} className={interval === value ? 'on' : ''}>{value.toUpperCase()}</button>)}
        <button type="button" className="mt-icon" onClick={resetView} aria-label="Reset chart view" title="Reset view"><RotateCcw size={15}/></button>
        <button type="button" className="mt-icon" aria-label="Full screen chart" title="Full screen" onClick={() => { const el = containerRef.current?.closest('.mt-terminal') as HTMLElement | null; if (document.fullscreenElement) void document.exitFullscreen?.(); else void el?.requestFullscreen?.(); }}><Maximize2 size={15}/></button>
      </div>
    </div>

    <div className="mt-head" aria-live="polite">
      <div className="mt-title">
        <b>{TERMINAL_TABS.find((tab) => tab.id === instrument)?.label}</b>
        <span>{showing?.category ?? (error && !loading ? 'Unavailable' : 'Loading…')}</span>
        {showing && <span className={`mt-status ${isLive ? 'live' : ''}`}><i aria-hidden="true"/>{showing.stale ? 'Showing last good data' : isLive ? 'Live' : 'Delayed'}</span>}
      </div>
      {active && showing && <dl className="mt-ohlc">
        <div><dt>O</dt><dd>{fmt(active.open)}</dd></div>
        <div><dt>H</dt><dd>{fmt(active.high)}</dd></div>
        <div><dt>L</dt><dd>{fmt(active.low)}</dd></div>
        <div><dt>C</dt><dd>{fmt(active.close)}</dd></div>
        {movePct !== null && <div className={movePct >= 0 ? 'up' : 'down'}><dt>Δ</dt><dd>{movePct >= 0 ? '▲ +' : '▼ −'}{Math.abs(movePct).toFixed(2)}%</dd></div>}
        {legend && <div className="mt-when"><dd>{timeLabel(legend.time, showing.timezone, showing.interval)}</dd></div>}
      </dl>}
    </div>

    <div className="mt-canvas-wrap">
      <div ref={containerRef} className="mt-canvas" aria-label={`${TERMINAL_TABS.find((tab) => tab.id === instrument)?.label} ${interval} ${showing?.hasOhlc === false ? 'line' : 'candlestick'} chart`} role="img"/>
      {loading && !showing && <div className="mt-skeleton" role="status" aria-label="Loading chart"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div>}
      {error && !showing && !loading && <div className="mt-overlay" role="alert"><AlertTriangle size={20}/><b>Chart data is unavailable right now.</b><span>{error}</span><button type="button" onClick={() => setReloadKey((key) => key + 1)}><RefreshCw size={14}/>Try again</button></div>}
      {showing && !showing.hasOhlc && <div className="mt-note">Intraday candles are unavailable for this instrument from the provider; showing the closing-price line instead.</div>}
    </div>

    <div className="mt-foot">
      <span>Source: {showing?.source ?? '—'}</span>
      <span>{showing ? `Last candle ${timeLabel(showing.candles.at(-1)!.time, showing.timezone, showing.interval)}` : ''}</span>
      <span>Updated {showing ? formatAgo(showing.retrievedAt, now) : '—'}{showing ? ` · ${formatIst(showing.retrievedAt)}` : ''}</span>
      {sessionPct !== null && <span className={sessionPct >= 0 ? 'up' : 'down'}>Window {sessionPct >= 0 ? '▲ +' : '▼ −'}{Math.abs(sessionPct).toFixed(2)}%</span>}
      <span className="mt-disclaimer">{showing?.delayNote ?? 'Market data may be delayed.'} Informational use only.</span>
    </div>
  </div>;
};

export default MarketTerminalChart;
