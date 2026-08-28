import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  Time,
} from 'lightweight-charts';
import { ChartCandlestick, Copy, Minus, Plus, RefreshCw, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { useCryptoKlines } from './useCryptoMarketData';
import {
  CRYPTO_INTERVALS,
  CRYPTO_SYMBOLS,
  CryptoCandle,
  CryptoCandleSelectionMode,
  CryptoChartContext,
  CryptoInterval,
  CryptoSymbol,
} from './cryptoTypes';

function formatTimestamp(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(timestamp)).replace(',', '');
}

function formatUpdatedAt(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value)) : '—';
}

function pricePrecision(symbol: CryptoSymbol, close: number, change = 0) {
  if (symbol.startsWith('BTC') || close >= 100) return 2;
  if (close >= 1) return 4;
  const values = [Math.abs(close), Math.abs(change)].filter((value) => value > 0);
  return values.length && Math.min(...values) < 0.001 ? 8 : 6;
}

function clampRange(from: number, to: number, length: number) {
  if (length <= 0) return { from: 0, to: 0 };
  const minSpan = Math.min(5, length);
  let nextFrom = Math.max(0, Math.min(from, length - minSpan));
  let nextTo = Math.min(length - 1, Math.max(to, nextFrom + minSpan - 1));
  if (nextTo - nextFrom + 1 < minSpan) nextFrom = Math.max(0, nextTo - minSpan + 1);
  return { from: nextFrom, to: nextTo };
}

export const CandleDetails: React.FC<{ candle: CryptoCandle | null; symbol: CryptoSymbol; mode?: CryptoCandleSelectionMode }> = ({ candle, symbol, mode = 'latest' }) => {
  if (!candle) return <aside className="rounded-2xl border border-line bg-surface p-4 text-sm text-secondary">Candle details unavailable.</aside>;
  const absoluteChange = candle.close - candle.open;
  const percentChange = candle.open === 0 ? 0 : absoluteChange / candle.open * 100;
  const direction = absoluteChange > 0 ? 'up' : absoluteChange < 0 ? 'down' : 'flat';
  const DirectionIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const precision = pricePrecision(symbol, candle.close, absoluteChange);
  const formatPrice = (value: number) => `${value.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })} USDT`;
  const candleState = candle.closeTime > Date.now() ? 'Forming' : 'Closed';
  const detailRows = [
    ['Time (UTC)', formatTimestamp(candle.openTime, 'UTC'), 'text-blue-600 border-blue-500/25 bg-blue-500/5'],
    ['Time (IST)', formatTimestamp(candle.openTime, 'Asia/Kolkata'), 'text-violet-600 border-violet-500/25 bg-violet-500/5'],
    ['Open', formatPrice(candle.open), 'text-amber-600 border-amber-500/25 bg-amber-500/5'],
    ['High', formatPrice(candle.high), 'text-success border-success-fill/25 bg-success-fill/5'],
    ['Low', formatPrice(candle.low), 'text-danger border-danger/25 bg-danger/5'],
    ['Close', formatPrice(candle.close), 'text-cyan-600 border-cyan-500/25 bg-cyan-500/5'],
  ];
  const copyText = `Candle Details | ${symbol} | ${detailRows[0][1]} UTC | ${detailRows[1][1]} IST | O ${candle.open} H ${candle.high} L ${candle.low} C ${candle.close} | Change ${absoluteChange} (${percentChange}%) | Volume ${candle.volume} | Trades ${candle.trades} | ${candleState}`;
  const modeLabel = mode === 'pinned' ? 'Pinned candle' : mode === 'hover' ? 'Hover preview' : 'Latest candle';

  return (
    <aside className="rounded-2xl border border-line bg-surface p-4 shadow-sm" aria-label="Candle details">
      <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold leading-snug text-ink">Candle Details</h3><span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-medium text-secondary">{modeLabel} · {candleState}</span></div>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        {detailRows.map(([label, value, className]) => <div key={label} className={`min-w-0 rounded-xl border p-2.5 ${className}`}><dt className="text-sm font-medium leading-snug">{label}</dt><dd className="mt-1 break-words font-mono text-base font-semibold leading-snug tabular-nums text-ink">{value}</dd></div>)}
        <div className={`min-w-0 rounded-xl border p-2.5 ${direction === 'up' ? 'border-success-fill/25 bg-success-fill/5 text-success' : direction === 'down' ? 'border-danger/25 bg-danger/5 text-danger' : 'border-line bg-subtle text-secondary'}`}><dt className="text-sm font-medium leading-snug">Change</dt><dd className="mt-1 flex items-start font-mono text-lg font-bold leading-snug tabular-nums"><DirectionIcon className="mr-1 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span className="break-words">{absoluteChange > 0 ? '+' : ''}{absoluteChange.toFixed(precision)} ({percentChange > 0 ? '+' : ''}{percentChange.toFixed(2)}%)</span></dd></div>
        <div className="min-w-0 rounded-xl border border-orange-500/25 bg-orange-500/5 p-2.5"><dt className="text-sm font-medium leading-snug text-orange-600">Volume / trades</dt><dd className="mt-1 break-words font-mono text-base font-semibold leading-snug tabular-nums text-ink">{candle.volume.toLocaleString('en-US', { maximumFractionDigits: 4 })} {symbol.replace('USDT', '')} / {candle.trades.toLocaleString()}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void navigator.clipboard.writeText(copyText)} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-secondary hover:text-interactive"><Copy className="h-3.5 w-3.5" /> Copy candle data</button><button type="button" onClick={() => void navigator.clipboard.writeText(`Research note — ${copyText}\nObservation: `)} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-secondary hover:text-interactive"><Copy className="h-3.5 w-3.5" /> Copy research note</button></div>
    </aside>
  );
};

interface CryptoChartProps {
  symbol: CryptoSymbol;
  interval: CryptoInterval;
  onSymbolChange: (symbol: CryptoSymbol) => void;
  onIntervalChange: (interval: CryptoInterval) => void;
  onContextChange: (context: CryptoChartContext) => void;
}

export const CryptoChart: React.FC<CryptoChartProps> = ({ symbol, interval, onSymbolChange, onIntervalChange, onContextChange }) => {
  const { candles, status, diagnostics, retry } = useCryptoKlines(symbol, interval);
  const [hoverCandle, setHoverCandle] = useState<CryptoCandle | null>(null);
  const [pinnedCandle, setPinnedCandle] = useState<CryptoCandle | null>(null);
  const [visibleWindow, setVisibleWindow] = useState({ from: 0, to: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const candleByTimeRef = useRef(new Map<number, CryptoCandle>());
  const candlesRef = useRef<CryptoCandle[]>([]);
  const rangeGuardRef = useRef(false);
  const latestCandle = candles.at(-1) ?? null;
  const selectedCandle = pinnedCandle ?? hoverCandle ?? latestCandle;
  const selectionMode: CryptoCandleSelectionMode = pinnedCandle ? 'pinned' : hoverCandle ? 'hover' : 'latest';

  const selectedIndex = useMemo(() => selectedCandle ? candles.findIndex((candle) => candle.openTime === selectedCandle.openTime) : -1, [candles, selectedCandle]);

  useEffect(() => { setHoverCandle(null); setPinnedCandle(null); }, [interval, symbol]);
  useEffect(() => onContextChange({ symbol, interval, candle: selectedCandle, selectionMode, status, updatedAt: diagnostics.lastValidMessageAt ?? diagnostics.restSnapshotAt }), [diagnostics.lastValidMessageAt, diagnostics.restSnapshotAt, interval, onContextChange, selectedCandle, selectionMode, status, symbol]);

  const setLogicalRange = (from: number, to: number) => {
    const chart = chartRef.current;
    const length = candlesRef.current.length;
    if (!chart || !length) return;
    const next = clampRange(from, to, length);
    rangeGuardRef.current = true;
    (chart.timeScale() as any).setVisibleLogicalRange({ from: next.from, to: next.to });
    setVisibleWindow(next);
    window.requestAnimationFrame(() => { rangeGuardRef.current = false; });
  };

  const resetZoom = () => {
    const chart = chartRef.current;
    if (!chart || !candlesRef.current.length) return;
    rangeGuardRef.current = true;
    chart.timeScale().fitContent();
    setVisibleWindow({ from: 0, to: candlesRef.current.length - 1 });
    setPinnedCandle(null); setHoverCandle(null);
    window.requestAnimationFrame(() => { rangeGuardRef.current = false; });
  };

  const zoom = (factor: number) => {
    const length = candlesRef.current.length;
    if (!length) return;
    const current = visibleWindow.to > visibleWindow.from ? visibleWindow : { from: 0, to: length - 1 };
    const span = current.to - current.from + 1;
    const nextSpan = Math.max(Math.min(5, length), Math.min(length, Math.round(span * factor)));
    const center = selectedIndex >= current.from && selectedIndex <= current.to ? selectedIndex : (current.from + current.to) / 2;
    setLogicalRange(center - (nextSpan - 1) / 2, center + (nextSpan - 1) / 2);
  };

  const pan = (bars: number) => setLogicalRange(visibleWindow.from + bars, visibleWindow.to + bars);

  const pinByIndex = (index: number) => {
    const next = candlesRef.current[Math.max(0, Math.min(index, candlesRef.current.length - 1))];
    if (next) { setPinnedCandle(next); setHoverCandle(null); }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 380,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#64748B' },
      grid: { vertLines: { color: '#E2E8F0' }, horzLines: { color: '#E2E8F0' } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 2, barSpacing: 9, minBarSpacing: 2 },
      rightPriceScale: { borderColor: '#E2E8F0' },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true } },
    } as any);
    const candleSeries = chart.addSeries(CandlestickSeries, { upColor: '#16A34A', downColor: '#DC2626', wickUpColor: '#16A34A', wickDownColor: '#DC2626', borderVisible: false });
    const volumeSeries = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume' });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleCrosshair = (event: any) => {
      if (event?.time === undefined || !event?.point) { setHoverCandle(null); return; }
      if (pinnedCandle) return;
      setHoverCandle(candleByTimeRef.current.get(Number(event.time)) ?? null);
    };
    const handleClick = (event: any) => {
      if (event?.time === undefined) return;
      const candle = candleByTimeRef.current.get(Number(event.time));
      if (candle) { setPinnedCandle(candle); setHoverCandle(null); }
    };
    const handleVisibleRange = (range: any) => {
      if (!range || rangeGuardRef.current || !candlesRef.current.length) return;
      const length = candlesRef.current.length;
      const normalized = clampRange(Math.floor(range.from), Math.ceil(range.to), length);
      setVisibleWindow(normalized);
      const span = range.to - range.from + 1;
      if (span < Math.min(5, length) - 0.2 || range.from < -1 || range.to > length) setLogicalRange(normalized.from, normalized.to);
    };
    chart.subscribeCrosshairMove(handleCrosshair);
    (chart as any).subscribeClick?.(handleClick);
    (chart.timeScale() as any).subscribeVisibleLogicalRangeChange?.(handleVisibleRange);
    if (reduceMotion) chart.applyOptions({ kineticScroll: { mouse: false, touch: false } } as any);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshair);
      (chart as any).unsubscribeClick?.(handleClick);
      (chart.timeScale() as any).unsubscribeVisibleLogicalRangeChange?.(handleVisibleRange);
      chart.remove();
      chartRef.current = null; candleSeriesRef.current = null; volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries || !candles.length) return;
    candlesRef.current = candles;
    candleByTimeRef.current = new Map(candles.map((candle) => [Math.floor(candle.openTime / 1_000), candle]));
    candleSeries.setData(candles.map((candle) => ({ time: Math.floor(candle.openTime / 1_000) as Time, open: candle.open, high: candle.high, low: candle.low, close: candle.close })));
    volumeSeries.setData(candles.map((candle) => ({ time: Math.floor(candle.openTime / 1_000) as Time, value: candle.volume, color: candle.close >= candle.open ? 'rgba(22,163,74,.35)' : 'rgba(220,38,38,.35)' })));
    if (visibleWindow.to === 0 || visibleWindow.to >= candles.length - 2) {
      chart.timeScale().fitContent();
      setVisibleWindow({ from: 0, to: candles.length - 1 });
    }
  }, [candles]);

  const statusLine = status === 'live'
    ? `LIVE · Streaming from Binance · Updated ${formatUpdatedAt(diagnostics.lastValidMessageAt)} IST`
    : status === 'cached'
      ? `CACHED · REST snapshot · Retrieved ${formatUpdatedAt(diagnostics.restSnapshotAt)} IST`
      : `${status.toUpperCase()} · Last verified ${formatUpdatedAt(diagnostics.lastValidMessageAt ?? diagnostics.restSnapshotAt)} IST`;

  const hoverChange = hoverCandle ? hoverCandle.close - hoverCandle.open : 0;
  const hoverPercent = hoverCandle && hoverCandle.open ? hoverChange / hoverCandle.open * 100 : 0;
  const navigatorMax = Math.max(0, candles.length - 1);

  return (
    <section className="rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <header className="flex flex-col gap-3 border-b border-line pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-interactive"><ChartCandlestick className="h-4 w-4" /> Crypto chart</div><h2 className="mt-1 text-lg font-black text-ink">{symbol.replace('USDT', '')}/USDT candlesticks</h2><p className="mt-1 text-xs text-secondary">Binance Public Market Data · {statusLine}</p></div>
        <div className="flex flex-wrap items-center gap-2"><label className="text-xs text-secondary">Asset<select aria-label="Crypto chart asset" value={symbol} onChange={(event) => onSymbolChange(event.target.value as CryptoSymbol)} className="ml-2 rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs font-bold text-ink">{CRYPTO_SYMBOLS.map((option) => <option key={option} value={option}>{option.replace('USDT', '/USDT')}</option>)}</select></label><label className="text-xs text-secondary">Interval<select aria-label="Crypto chart interval" value={interval} onChange={(event) => onIntervalChange(event.target.value as CryptoInterval)} className="ml-2 rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs font-bold text-ink">{CRYPTO_INTERVALS.map((option) => <option key={option}>{option}</option>)}</select></label><div className="flex items-center rounded-xl border border-line bg-canvas p-1" aria-label="Chart zoom controls"><button type="button" onClick={() => zoom(0.7)} className="rounded-lg p-1.5 text-secondary hover:bg-surface hover:text-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-interactive" aria-label="Zoom in chart"><Plus className="h-4 w-4" /></button><button type="button" onClick={() => zoom(1.45)} className="rounded-lg p-1.5 text-secondary hover:bg-surface hover:text-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-interactive" aria-label="Zoom out chart"><Minus className="h-4 w-4" /></button><button type="button" onClick={resetZoom} className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-secondary hover:bg-surface hover:text-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-interactive" aria-label="Reset chart zoom"><RotateCcw className="mr-1 inline h-3.5 w-3.5" />Reset</button><button type="button" onClick={() => { setPinnedCandle(null); setHoverCandle(null); (chartRef.current?.timeScale() as any)?.scrollToRealTime?.(); }} className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-secondary hover:bg-surface hover:text-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-interactive">Latest candle</button></div></div>
      </header>
      <div
        className="relative mt-3 h-[300px] w-full sm:h-[360px] lg:h-[430px]"
        onWheel={(event) => {
          if (!event.shiftKey) return;
          event.preventDefault();
          pan(event.deltaY > 0 ? 3 : -3);
        }}
      >
        <div
          ref={containerRef}
          className="crypto-chart-canvas h-full w-full cursor-grab rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive active:cursor-grabbing"
          role="application"
          aria-label={`${symbol} ${interval} Binance candlestick chart. Mouse wheel or pinch to zoom, drag to pan, arrow keys select candles, plus and minus zoom, R resets, Escape clears pinned selection.`}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') { event.preventDefault(); pinByIndex(selectedIndex < 0 ? candles.length - 2 : selectedIndex - 1); }
            else if (event.key === 'ArrowRight') { event.preventDefault(); pinByIndex(selectedIndex < 0 ? candles.length - 1 : selectedIndex + 1); }
            else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(0.7); }
            else if (event.key === '-' || event.key === '_') { event.preventDefault(); zoom(1.45); }
            else if (event.key.toLowerCase() === 'r') { event.preventDefault(); resetZoom(); }
            else if (event.key === 'Escape') { setPinnedCandle(null); setHoverCandle(null); }
          }}
        />
        {hoverCandle && !pinnedCandle && <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[300px] rounded-xl border border-line bg-surface/95 p-3 text-[10px] shadow-lg backdrop-blur" aria-live="polite"><div className="font-black text-ink">{formatTimestamp(hoverCandle.openTime, 'UTC')} UTC</div><div className="mt-0.5 text-secondary">{formatTimestamp(hoverCandle.openTime, 'Asia/Kolkata')} IST</div><div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-ink"><span>O {hoverCandle.open}</span><span>H {hoverCandle.high}</span><span>L {hoverCandle.low}</span><span>C {hoverCandle.close}</span><span>{hoverChange >= 0 ? '+' : ''}{hoverChange.toFixed(pricePrecision(symbol, hoverCandle.close, hoverChange))} ({hoverPercent >= 0 ? '+' : ''}{hoverPercent.toFixed(2)}%)</span><span>Vol {hoverCandle.volume.toLocaleString('en-US',{maximumFractionDigits:4})}</span><span>Trades {hoverCandle.trades.toLocaleString()}</span></div><div className="mt-2 text-secondary">Click to pin this candle.</div></div>}
        {status === 'connecting' && !candles.length ? <p className="pointer-events-none absolute inset-0 bg-surface/80 p-8 text-center text-sm text-secondary">Loading Binance candle history…</p> : null}
        {status === 'unavailable' && !candles.length ? <div className="absolute inset-0 bg-surface/90 p-8 text-center text-sm text-danger"><p>Binance candle data is temporarily unavailable.</p><button type="button" onClick={retry} className="mx-auto mt-3 inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2"><RefreshCw className="h-3.5 w-3.5" /> Retry</button></div> : null}
      </div>

      {candles.length > 1 && <div className="mt-3 rounded-xl border border-line bg-canvas p-3" aria-label="Chart range navigator"><div className="flex items-center justify-between text-[9px] font-semibold text-secondary"><span>History navigator</span><span>Candles {Math.round(visibleWindow.from) + 1}–{Math.round(visibleWindow.to) + 1} of {candles.length}</span></div><div className="relative mt-2 grid gap-2 sm:grid-cols-2"><label className="text-[9px] text-secondary">Window start<input type="range" min={0} max={navigatorMax} value={Math.min(navigatorMax, Math.round(visibleWindow.from))} onChange={(event) => setLogicalRange(Number(event.target.value), visibleWindow.to)} className="mt-1 w-full accent-teal-600" aria-label="Visible chart window start" /></label><label className="text-[9px] text-secondary">Window end<input type="range" min={0} max={navigatorMax} value={Math.min(navigatorMax, Math.round(visibleWindow.to))} onChange={(event) => setLogicalRange(visibleWindow.from, Number(event.target.value))} className="mt-1 w-full accent-teal-600" aria-label="Visible chart window end" /></label></div></div>}

      <p className="mt-3 text-[10px] leading-5 text-secondary">Chart controls: wheel/pinch zoom · drag horizontally to pan · Shift+wheel pans · click pins a candle · arrow keys move selection · +/− zoom · R resets · Escape clears selection. Educational market data only—not investment advice.</p>
      <details className="mt-3 rounded-xl border border-line bg-canvas p-3 text-xs text-secondary"><summary className="cursor-pointer font-bold text-ink">Connection diagnostics</summary><dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"><div><dt>REST snapshot</dt><dd>{formatUpdatedAt(diagnostics.restSnapshotAt)}</dd></div><div><dt>Socket</dt><dd>{diagnostics.socketState}</dd></div><div><dt>Endpoint</dt><dd className="break-all">{diagnostics.socketEndpoint ?? '—'}</dd></div><div><dt>Last raw message</dt><dd>{formatUpdatedAt(diagnostics.lastRawMessageAt)}</dd></div><div><dt>Last valid kline</dt><dd>{formatUpdatedAt(diagnostics.lastValidMessageAt)}</dd></div><div><dt>Retry / next</dt><dd>{diagnostics.retryAttempt} / {formatUpdatedAt(diagnostics.nextRetryAt)}</dd></div>{diagnostics.lastError ? <div className="col-span-2 sm:col-span-3"><dt>Last error</dt><dd>{diagnostics.lastError}</dd></div> : null}</dl></details>
    </section>
  );
};
