import React, { useEffect, useRef } from 'react';
import { CandlestickSeries, ColorType, CrosshairMode, createChart, IChartApi, Time } from 'lightweight-charts';
import { CryptoCandle } from '../crypto/cryptoTypes';

interface Props {
  candles: CryptoCandle[];
  onResetReady?: (reset: () => void) => void;
}

export const InteractiveCandlestickChart: React.FC<Props> = ({ candles, onResetReady }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 430,
      layout: { background: { type: ColorType.Solid, color: '#050505' }, textColor: '#d1d5db' },
      grid: { vertLines: { color: '#171717' }, horzLines: { color: '#171717' } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#6b7280', labelBackgroundColor: '#111111' },
        horzLine: { color: '#6b7280', labelBackgroundColor: '#111111' },
      },
      rightPriceScale: { borderColor: '#292929', textColor: '#e5e7eb', autoScale: true },
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 3, barSpacing: 8, minBarSpacing: 2, borderColor: '#292929' },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true } },
    } as any);
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444', wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      borderUpColor: '#22c55e', borderDownColor: '#ef4444', borderVisible: false,
    });
    chartRef.current = chart;
    onResetReady?.(() => chart.timeScale().fitContent());

    const resizeObserver = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current?.clientWidth || 0 }));
    resizeObserver.observe(containerRef.current);
    return () => { resizeObserver.disconnect(); chart.remove(); chartRef.current = null; };
  }, [onResetReady]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const series = (chart as any).series?.()?.[0];
    if (!series || !candles.length) return;
    series.setData(candles.map((candle) => ({ time: Math.floor(candle.openTime / 1000) as Time, open: candle.open, high: candle.high, low: candle.low, close: candle.close })));
    chart.timeScale().fitContent();
  }, [candles]);

  return <div ref={containerRef} className="h-[300px] w-full sm:h-[400px] lg:h-[430px]" aria-label="Interactive crypto candlestick chart" />;
};
