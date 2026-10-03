/**
 * Daily market features from closing prices (deterministic, no AI). Used for the current MarketState (Layer B)
 * and for every historical day the pattern matcher compares against (Layer C).
 *
 *   return_5d / return_20d : close / close n trading days earlier − 1
 *   volatility_20d         : standard deviation of the last 20 daily log returns × √252 (annualised)
 *   rsi_14                 : Wilder's 14-day Relative Strength Index (0-100)
 *   dist_ma50 / dist_ma200 : close / simple moving average − 1
 */
import type { MarketState } from './context';

export interface Close {
  date: string;
  close: number;
}

export const MIN_HISTORY = 201;

function rsiSeries(closes: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = closes.map(() => null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const d = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < closes.length; i += 1) {
    const d = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** Features for every day that has at least 200 days of history before it (oldest first). */
export function computeFeatures(series: Close[]): MarketState[] {
  const clean = series.filter((p) => Number.isFinite(p.close) && p.close > 0);
  const closes = clean.map((p) => p.close);
  const rsi = rsiSeries(closes);
  const out: MarketState[] = [];
  let sum50 = 0;
  let sum200 = 0;
  for (let i = 0; i < closes.length; i += 1) {
    const c = closes[i] ?? 0;
    sum50 += c;
    sum200 += c;
    if (i >= 50) sum50 -= closes[i - 50] ?? 0;
    if (i >= 200) sum200 -= closes[i - 200] ?? 0;
    if (i < MIN_HISTORY - 1) continue;
    const logReturns: number[] = [];
    for (let k = i - 19; k <= i; k += 1) logReturns.push(Math.log((closes[k] ?? 1) / (closes[k - 1] ?? 1)));
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const variance = logReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / (logReturns.length - 1);
    out.push({
      date: clean[i]?.date ?? '',
      close: c,
      return_5d: c / (closes[i - 5] ?? c) - 1,
      return_20d: c / (closes[i - 20] ?? c) - 1,
      volatility_20d: Math.sqrt(variance) * Math.sqrt(252),
      rsi_14: rsi[i] ?? 50,
      dist_ma50: c / (sum50 / 50) - 1,
      dist_ma200: c / (sum200 / 200) - 1,
    });
  }
  return out;
}
