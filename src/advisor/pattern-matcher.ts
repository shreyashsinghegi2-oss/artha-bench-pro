/**
 * Layer C — historical pattern matcher (deterministic, no AI).
 *
 * Finds past NIFTY days whose market state (5- and 20-day return, 20-day volatility, RSI, distance from the
 * 50- and 200-day averages) was closest to today's, then reports what NIFTY did over the next 20 and 60
 * trading days. Features are z-scored over the whole history so no single feature dominates the distance.
 * Matches must be at least MIN_GAP trading days apart (otherwise one episode would fill every slot) and must
 * have the full forward window available.
 *
 * The output is always labelled "Historical pattern, not a prediction".
 */
import type { MarketState } from './context';

export const PATTERN_DISCLAIMER = 'Historical pattern, not a prediction. Past market behaviour does not guarantee future returns.';
export const FEATURE_KEYS = ['return_5d', 'return_20d', 'volatility_20d', 'rsi_14', 'dist_ma50', 'dist_ma200'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const DEFAULT_K = 15;
export const MIN_GAP = 10;
export const HORIZONS = [20, 60] as const;

export interface PatternMatch {
  date: string;
  close: number;
  /** 0-1, 1 = identical state. */
  similarity: number;
  forward_20d: number;
  forward_60d: number;
}

export interface HorizonStats {
  horizon_days: number;
  median: number;
  p25: number;
  p75: number;
  worst: number;
  best: number;
  /** Share of matches that ended higher (0-1). */
  positive_share: number;
}

export interface PatternResult {
  as_of: string;
  current: MarketState;
  matches: PatternMatch[];
  stats: HorizonStats[];
  /** Unconditional baseline over the same history, so the matches can be compared with "any day". */
  baseline: HorizonStats[];
  confidence: 'low' | 'medium' | 'high';
  confidence_reason: string;
  history_days: number;
  history_from: string;
  disclaimer: string;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return Number.NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (pos - lo);
}

export function horizonStats(values: number[], horizon: number): HorizonStats {
  const s = [...values].sort((a, b) => a - b);
  return {
    horizon_days: horizon,
    median: quantile(s, 0.5),
    p25: quantile(s, 0.25),
    p75: quantile(s, 0.75),
    worst: s[0] ?? Number.NaN,
    best: s.at(-1) ?? Number.NaN,
    positive_share: s.length ? s.filter((v) => v > 0).length / s.length : Number.NaN,
  };
}

function zScorer(history: MarketState[]): (s: MarketState) => number[] {
  const params = FEATURE_KEYS.map((k) => {
    const v = history.map((h) => h[k]);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, v.length - 1)) || 1;
    return { k, mean, sd };
  });
  return (s) => params.map(({ k, mean, sd }) => (s[k] - mean) / sd);
}

/**
 * @param history daily features, oldest first, consecutive trading days (from computeFeatures).
 * @param current  today's state; defaults to the last history row.
 */
export function matchPatterns(history: MarketState[], current: MarketState | undefined = history.at(-1), k = DEFAULT_K): PatternResult {
  if (!current) throw new Error('no market history');
  const maxH = Math.max(...HORIZONS);
  if (history.length < maxH + 250) throw new Error(`need at least ${maxH + 250} days of features, got ${history.length}`);
  const z = zScorer(history);
  const target = z(current);

  // Only days with a full forward window are candidates.
  const candidates: Array<{ i: number; d: number }> = [];
  for (let i = 0; i + maxH < history.length; i += 1) {
    const row = history[i];
    if (!row || row.date >= current.date) continue;
    const v = z(row);
    let d = 0;
    for (let j = 0; j < v.length; j += 1) d += ((v[j] ?? 0) - (target[j] ?? 0)) ** 2;
    candidates.push({ i, d: Math.sqrt(d) });
  }
  candidates.sort((a, b) => a.d - b.d);

  const chosen: Array<{ i: number; d: number }> = [];
  for (const c of candidates) {
    if (chosen.length >= k) break;
    if (chosen.every((x) => Math.abs(x.i - c.i) >= MIN_GAP)) chosen.push(c);
  }

  const fwd = (i: number, h: number) => (history[i + h]?.close ?? Number.NaN) / (history[i]?.close ?? Number.NaN) - 1;
  const matches: PatternMatch[] = chosen.map(({ i, d }) => ({
    date: history[i]?.date ?? '',
    close: history[i]?.close ?? Number.NaN,
    similarity: 1 / (1 + d),
    forward_20d: fwd(i, 20),
    forward_60d: fwd(i, 60),
  }));

  const stats = HORIZONS.map((h) =>
    horizonStats(
      matches.map((m) => (h === 20 ? m.forward_20d : m.forward_60d)),
      h,
    ),
  );
  const baseline = HORIZONS.map((h) =>
    horizonStats(
      Array.from({ length: history.length - h }, (_, i) => fwd(i, h)),
      h,
    ),
  );

  const meanSim = matches.reduce((a, m) => a + m.similarity, 0) / Math.max(1, matches.length);
  const s60 = stats[1];
  const spread = s60 ? s60.p75 - s60.p25 : Number.POSITIVE_INFINITY;
  const confidence: PatternResult['confidence'] = matches.length < 8 || meanSim < 0.4 ? 'low' : meanSim >= 0.6 && spread < 0.08 ? 'high' : 'medium';
  const confidence_reason = `${matches.length} past episodes, average similarity ${(meanSim * 100).toFixed(0)}%, 60-day middle range ${(spread * 100).toFixed(1)} points wide`;

  return {
    as_of: current.date,
    current,
    matches,
    stats,
    baseline,
    confidence,
    confidence_reason,
    history_days: history.length,
    history_from: history[0]?.date ?? '',
    disclaimer: PATTERN_DISCLAIMER,
  };
}
