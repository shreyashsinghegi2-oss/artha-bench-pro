import React, { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
} from 'lightweight-charts';
import { CryptoCandle } from '../crypto/cryptoTypes';

interface Props {
  candles: CryptoCandle[];
  onResetReady?: (reset: () => void) => void;
}

export const InteractiveCandlestickChart: React.FC<Props> = ({ candles, onResetReady }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLineRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null);
  const hasInitialFitRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      height: 540,
      layout: {
        background: { type: ColorType.Solid, color: '#050505' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#141414' },
        horzLines: { color: '#141414' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#737373', labelBackgroundColor: '#171717' },
        horzLine: { color: '#737373', labelBackgroundColor: '#171717' },
      },
      rightPriceScale: {
        borderColor: '#2a2a2a',
        textColor: '#e5e7eb',
        autoScale: true,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 9,
        minBarSpacing: 3,
        borderColor: '#2a2a2a',
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      borderVisible: false,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    hasInitialFitRef.current = false;

    onResetReady?.(() => {
      chart.timeScale().fitContent();
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!container.isConnected) return;
      chart.applyOptions({ width: container.clientWidth || 0 });
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

    series.setData(
      candles.map((candle) => ({
        time: Math.floor(candle.openTime / 1000) as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );

    const latest = candles[candles.length - 1];
    if (latest) {
      if (priceLineRef.current) series.removePriceLine(priceLineRef.current);
      priceLineRef.current = series.createPriceLine({
        price: latest.close,
        color: '#22c55e',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'LIVE',
      });
    }

    if (!hasInitialFitRef.current) {
      chart.timeScale().fitContent();
      hasInitialFitRef.current = true;
    }
  }, [candles]);

  return (
    <div className="relative h-[300px] w-full sm:h-[420px] lg:h-[540px]" aria-label="Interactive crypto candlestick chart">
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1.5 text-[9px] font-semibold text-white/45 backdrop-blur-sm">
        Scroll/pinch to zoom · Drag to pan
      </div>
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-2 left-3 z-10 text-[8px] font-semibold text-white/25">
        TradingView Lightweight Charts
      </div>
    </div>
  );
};
