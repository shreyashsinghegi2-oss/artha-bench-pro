import { describe, expect, it } from 'vitest';
import { computeFeatures } from '../src/advisor/features';
import { horizonStats, matchPatterns, MIN_GAP, PATTERN_DISCLAIMER } from '../src/advisor/pattern-matcher';

/** Deterministic pseudo-random walk (LCG) so tests are repeatable. */
function walk(n: number, seed = 7): Array<{ date: string; close: number }> {
  let s = seed;
  let price = 10000;
  const start = Date.parse('2016-01-01T00:00:00Z');
  return Array.from({ length: n }, (_, i) => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    price *= 1 + (s / 4294967296 - 0.49) * 0.03;
    return { date: new Date(start + i * 86_400_000).toISOString().slice(0, 10), close: price };
  });
}

describe('Layer C: pattern matcher', () => {
  const history = computeFeatures(walk(1500));
  const result = matchPatterns(history);

  it('always carries the not-a-prediction disclaimer', () => {
    expect(result.disclaimer).toBe(PATTERN_DISCLAIMER);
    expect(result.disclaimer).toMatch(/not a prediction/);
  });

  it('returns up to 15 spaced-out matches, each with a full forward window', () => {
    expect(result.matches.length).toBe(15);
    const idx = result.matches.map((m) => history.findIndex((h) => h.date === m.date)).sort((a, b) => a - b);
    for (let i = 1; i < idx.length; i += 1) expect(idx[i]! - idx[i - 1]!).toBeGreaterThanOrEqual(MIN_GAP);
    for (const i of idx) expect(i + 60).toBeLessThan(history.length);
  });

  it('forward returns are traceable to the closes', () => {
    const m = result.matches[0]!;
    const i = history.findIndex((h) => h.date === m.date);
    expect(m.forward_20d).toBeCloseTo(history[i + 20]!.close / history[i]!.close - 1, 12);
    expect(m.similarity).toBeGreaterThan(0);
    expect(m.similarity).toBeLessThanOrEqual(1);
  });

  it('finds an exact earlier copy of today as the best match', () => {
    const target = history[500]!;
    const r = matchPatterns(history, { ...target, date: '2099-01-01' });
    expect(r.matches[0]!.date).toBe(target.date);
    expect(r.matches[0]!.similarity).toBeCloseTo(1, 10);
  });

  it('reports stats for 20 and 60 days and a baseline', () => {
    expect(result.stats.map((s) => s.horizon_days)).toEqual([20, 60]);
    expect(result.baseline).toHaveLength(2);
    expect(['low', 'medium', 'high']).toContain(result.confidence);
  });

  it('refuses short histories', () => {
    expect(() => matchPatterns(history.slice(0, 200))).toThrow(/at least/);
  });

  it('horizonStats computes quantiles', () => {
    const s = horizonStats([-0.1, 0, 0.1, 0.2, 0.3], 20);
    expect(s).toMatchObject({ median: 0.1, p25: 0, p75: 0.2, worst: -0.1, best: 0.3, positive_share: 0.6 });
  });
});
