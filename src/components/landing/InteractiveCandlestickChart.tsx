import React, { useEffect, useRef } from 'react';
import { CandlestickSeries, ColorType, CrosshairMode, createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { CryptoCandle, CryptoInterval } from '../crypto/cryptoTypes';

interface Props { candles: CryptoCandle[]; interval?: CryptoInterval; onResetReady?: (reset: () => void) => void; }

const getDefaultVisibleBars = (interval: CryptoInterval = '5m', width: number) => { const targets: Record<CryptoInterval, number> = { '1m': 120, '5m': 100, '15m': 90, '1h': 80, '4h': 70, '1d': 60 }; const target = targets[interval] ?? 85; const responsive = width >= 1024 ? 1 : width >= 640 ? 0.8 : 0.62; return Math.max(width < 640 ? 32 : 40, Math.round(target * responsive)); };

export const InteractiveCandlestickChart: React.FC<Props> = ({ candles, interval = '5m', onResetReady }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLineRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null);
  const hasInitialViewRef = useRef(false);
  const candlesRef = useRef<CryptoCandle[]>([]);
  const intervalRef = useRef<CryptoInterval>(interval);

  const applyDefaultMediumView = () => {
    const chart = chartRef.current;
    const container = containerRef.current;
    const series = seriesRef.current;
    const data = candlesRef.current;
    if (!chart || !container || !series || !data.length || container.clientWidth <= 0 || container.clientHeight <= 0) return;

    const width = container.clientWidth;
    const visibleBars = Math.min(getDefaultVisibleBars(intervalRef.current, width), data.length);
    const from = Math.max(0, data.length - visibleBars);
    const to = data.length - 1;

    chart.timeScale().setVisibleLogicalRange({ from, to });
    series.priceScale().applyOptions({
      autoScale: true,
      scaleMargins: { top: 0.12, bottom: 0.12 },
    });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      height: 540,
      layout: { background: { type: ColorType.Solid, color: '#0B0B0C' }, textColor: '#CBD5E1' },
      grid: { vertLines: { color: '#1A1A1A' }, horzLines: { color: '#1A1A1A' } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#737373', labelBackgroundColor: '#171717' }, horzLine: { color: '#737373', labelBackgroundColor: '#171717' } },
      rightPriceScale: { borderColor: '#262626', textColor: '#94A3B8', autoScale: true, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 7,
        minBarSpacing: 3,
        borderColor: '#262626',
        rightBarStaysOnScroll: true,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: true,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444', wickUpColor: '#22c55e', wickDownColor: '#ef4444', borderUpColor: '#22c55e', borderDownColor: '#ef4444', borderVisible: false, priceLineVisible: false, lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    hasInitialViewRef.current = false;
    onResetReady?.(() => applyDefaultMediumView());

    const resizeObserver = new ResizeObserver(() => {
      if (container.isConnected) {
        chart.applyOptions({ width: container.clientWidth || 0 });
        if (!hasInitialViewRef.current && container.clientWidth > 0 && container.clientHeight > 0 && candlesRef.current.length) {
          applyDefaultMediumView();
          hasInitialViewRef.current = true;
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      priceLineRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [onResetReady]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || !candles.length) return;
    candlesRef.current = candles;
    intervalRef.current = interval;

    series.setData(candles.map((candle) => ({
      time: Math.floor(candle.openTime / 1000) as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })));

    const latest = candles[candles.length - 1];
    if (latest) {
      if (priceLineRef.current) series.removePriceLine(priceLineRef.current);
      priceLineRef.current = series.createPriceLine({ price: latest.close, color: '#22c55e', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'LIVE' });
    }

    // Apply the default range only once after the historical dataset first loads.
    // Subsequent live OHLC updates preserve the user's zoom and pan.
    if (!hasInitialViewRef.current && containerRef.current?.clientWidth && containerRef.current?.clientHeight) {
      applyDefaultMediumView();
      hasInitialViewRef.current = true;
    }
  }, [candles]);

  return <div className="relative h-[300px] w-full sm:h-[420px] lg:h-[540px]" aria-label="Interactive crypto candlestick chart">
    <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-[#262626] bg-[#0B0B0C] px-2.5 py-1.5 text-[9px] font-semibold text-[#CBD5E1]">Scroll/pinch to zoom · Drag to pan</div>
    <div ref={containerRef} className="h-full w-full" />
    <div className="pointer-events-none absolute bottom-2 left-3 z-10 text-[8px] font-semibold text-[#94A3B8]">TradingView Lightweight Charts</div>
  </div>;
};
