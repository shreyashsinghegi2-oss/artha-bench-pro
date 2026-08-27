import React, { useEffect, useRef, useState } from 'react';
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
import { ChartCandlestick, Copy, Minus, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useCryptoKlines } from './useCryptoMarketData';
import {
  CRYPTO_INTERVALS,
  CRYPTO_SYMBOLS,
  CryptoCandle,
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
  return Math.min(...[Math.abs(close), Math.abs(change)].filter((value) => value > 0)) < 0.001 ? 8 : 6;
}

export const CandleDetails: React.FC<{ candle: CryptoCandle | null; symbol: CryptoSymbol; latest?: boolean }> = ({ candle, symbol, latest = true }) => {
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

  return (
    <aside className="rounded-2xl border border-line bg-surface p-4 shadow-sm" aria-label="Candle details">
      <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold leading-snug text-ink">Candle Details</h3><span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-medium text-secondary">{latest ? 'Latest candle' : 'Crosshair candle'} · {candleState}</span></div>
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
  const [crosshairCandle, setCrosshairCandle] = useState<CryptoCandle | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const candleByTimeRef = useRef(new Map<number, CryptoCandle>());
  const latestCandle = candles.at(-1) ?? null;
  const selectedCandle = crosshairCandle ?? latestCandle;

  useEffect(() => setCrosshairCandle(null), [interval, symbol]);
  useEffect(() => onContextChange({ symbol, interval, candle: selectedCandle, status, updatedAt: diagnostics.lastValidMessageAt ?? diagnostics.restSnapshotAt }), [diagnostics.lastValidMessageAt, diagnostics.restSnapshotAt, interval, onContextChange, selectedCandle, status, symbol]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 380,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#64748B' },
      grid: { vertLines: { color: '#E2E8F0' }, horzLines: { color: '#E2E8F0' } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#E2E8F0' },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, { upColor: '#16A34A', downColor: '#DC2626', wickUpColor: '#16A34A', wickDownColor: '#DC2626', borderVisible: false });
    const volumeSeries = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume' });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    const handleCrosshair = (event: { time?: Time }) => {
      if (event.time !== undefined) setCrosshairCandle(candleByTimeRef.current.get(Number(event.time)) ?? null);
    };
    chart.subscribeCrosshairMove(handleCrosshair);
    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshair);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries || !candles.length) return;
    candleByTimeRef.current = new Map(candles.map((candle) => [Math.floor(candle.openTime / 1_000), candle]));
    candleSeries.setData(candles.map((candle) => ({ time: Math.floor(candle.openTime / 1_000) as Time, open: candle.open, high: candle.high, low: candle.low, close: candle.close })));
    volumeSeries.setData(candles.map((candle) => ({ time: Math.floor(candle.openTime / 1_000) as Time, value: candle.volume, color: candle.close >= candle.open ? 'rgba(22,163,74,.35)' : 'rgba(220,38,38,.35)' })));
    chart.timeScale().fitContent();
  }, [candles]);

  const statusLine = status === 'live'
    ? `LIVE · Streaming from Binance · Updated ${formatUpdatedAt(diagnostics.lastValidMessageAt)} IST`
    : status === 'cached'
      ? `CACHED · REST snapshot · Retrieved ${formatUpdatedAt(diagnostics.restSnapshotAt)} IST`
      : `${status.toUpperCase()} · Last verified ${formatUpdatedAt(diagnostics.lastValidMessageAt ?? diagnostics.restSnapshotAt)} IST`;

  return (
    <section className="rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <header className="flex flex-col gap-3 border-b border-line pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-interactive"><ChartCandlestick className="h-4 w-4" /> Crypto chart</div><h2 className="mt-1 text-lg font-black text-ink">{symbol.replace('USDT', '')}/USDT candlesticks</h2><p className="mt-1 text-xs text-secondary">Binance Public Market Data · {statusLine}</p></div>
        <div className="flex flex-wrap gap-2"><label className="text-xs text-secondary">Asset<select aria-label="Crypto chart asset" value={symbol} onChange={(event) => onSymbolChange(event.target.value as CryptoSymbol)} className="ml-2 rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs font-bold text-ink">{CRYPTO_SYMBOLS.map((option) => <option key={option} value={option}>{option.replace('USDT', '/USDT')}</option>)}</select></label><label className="text-xs text-secondary">Interval<select aria-label="Crypto chart interval" value={interval} onChange={(event) => onIntervalChange(event.target.value as CryptoInterval)} className="ml-2 rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs font-bold text-ink">{CRYPTO_INTERVALS.map((option) => <option key={option}>{option}</option>)}</select></label></div>
      </header>
      <div className="relative mt-3 h-[260px] w-full sm:h-[300px] lg:h-[380px]">
        <div ref={containerRef} className="crypto-chart-canvas h-full w-full" role="img" aria-label={`${symbol} ${interval} Binance candlestick chart`} tabIndex={0} />
        {status === 'connecting' && !candles.length ? <p className="pointer-events-none absolute inset-0 bg-surface/80 p-8 text-center text-sm text-secondary">Loading Binance candle history…</p> : null}
        {status === 'unavailable' && !candles.length ? <div className="absolute inset-0 bg-surface/90 p-8 text-center text-sm text-danger"><p>Binance candle data is temporarily unavailable.</p><button type="button" onClick={retry} className="mx-auto mt-3 inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2"><RefreshCw className="h-3.5 w-3.5" /> Retry</button></div> : null}
      </div>
      <details className="mt-3 rounded-xl border border-line bg-canvas p-3 text-xs text-secondary"><summary className="cursor-pointer font-bold text-ink">Connection diagnostics</summary><dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"><div><dt>REST snapshot</dt><dd>{formatUpdatedAt(diagnostics.restSnapshotAt)}</dd></div><div><dt>Socket</dt><dd>{diagnostics.socketState}</dd></div><div><dt>Endpoint</dt><dd className="break-all">{diagnostics.socketEndpoint ?? '—'}</dd></div><div><dt>Last raw message</dt><dd>{formatUpdatedAt(diagnostics.lastRawMessageAt)}</dd></div><div><dt>Last valid kline</dt><dd>{formatUpdatedAt(diagnostics.lastValidMessageAt)}</dd></div><div><dt>Retry / next</dt><dd>{diagnostics.retryAttempt} / {formatUpdatedAt(diagnostics.nextRetryAt)}</dd></div>{diagnostics.lastError ? <div className="col-span-2 sm:col-span-3"><dt>Last error</dt><dd>{diagnostics.lastError}</dd></div> : null}</dl></details>
    </section>
  );
};
