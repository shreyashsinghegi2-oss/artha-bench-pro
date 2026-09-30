import { describe, expect, it } from 'vitest';
import {
  cholesky,
  contributionForProbability,
  mulberry32,
  normalGenerator,
  simulate,
  simulatePortfolio,
  SimulationInputError,
} from '../src/simulation/monte-carlo';

const base = { initial_amount: 100_000, monthly_contribution: 10_000, years: 10, expected_return: 0.12, volatility: 0.16 };

describe('Monte Carlo engine', () => {
  it('is reproducible: same seed, same result; different seed, different paths', () => {
    const a = simulate({ ...base, paths: 2000, seed: 42 });
    const b = simulate({ ...base, paths: 2000, seed: 42 });
    const c = simulate({ ...base, paths: 2000, seed: 7 });
    expect(a.percentiles).toEqual(b.percentiles);
    expect(a.percentiles.p50).not.toBe(c.percentiles.p50);
    expect(a.seed).toBe(42);
  });

  it('random numbers look standard normal', () => {
    const z = normalGenerator(1);
    let s = 0;
    let s2 = 0;
    const n = 200_000;
    for (let i = 0; i < n; i += 1) {
      const x = z();
      s += x;
      s2 += x * x;
    }
    expect(Math.abs(s / n)).toBeLessThan(0.01);
    expect(Math.abs(s2 / n - 1)).toBeLessThan(0.01);
    const u = mulberry32(3);
    for (let i = 0; i < 1000; i += 1) {
      const v = u();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('lump sum: median matches the GBM closed form P·exp((μ − σ²/2)t)', () => {
    const r = simulate({ initial_amount: 1_000_000, monthly_contribution: 0, years: 10, expected_return: 0.12, volatility: 0.16, paths: 20_000 });
    const closedMedian = 1_000_000 * Math.exp((0.12 - 0.16 ** 2 / 2) * 10);
    expect(r.percentiles.p50 / closedMedian).toBeGreaterThan(0.97);
    expect(r.percentiles.p50 / closedMedian).toBeLessThan(1.03);
    // mean of GBM = P·exp(μt)
    expect(r.percentiles.p5).toBeLessThan(r.percentiles.p25);
    expect(r.percentiles.p75).toBeLessThan(r.percentiles.p95);
  });

  it('σ = 0 is deterministic compound growth (FD-like), no randomness', () => {
    const r = simulate({ initial_amount: 100_000, monthly_contribution: 0, years: 5, expected_return: 0.07, volatility: 0 });
    expect(r.model).toBe('deterministic');
    expect(r.percentiles.p5).toBeCloseTo(100_000 * Math.exp(0.07 * 5), 4);
    expect(r.percentiles.p95).toBe(r.percentiles.p5);
    expect(r.probability_loss).toBe(0);
  });

  it('reports probabilities, total invested, 95% interval and yearly bands', () => {
    const r = simulate({ ...base, paths: 5000, targets: [1_000_000, 5_000_000, 100_000_000] });
    expect(r.total_invested).toBe(100_000 + 10_000 * 120);
    expect(r.probability_above['1000000']).toBeGreaterThan(0.99);
    expect(r.probability_above['100000000']).toBe(0);
    expect(r.probability_loss).toBeGreaterThanOrEqual(0);
    expect(r.probability_loss).toBeLessThan(0.1);
    expect(r.confidence_interval_95[0]).toBeLessThan(r.percentiles.p5);
    expect(r.bands).toHaveLength(11);
    expect(r.bands[0]).toMatchObject({ year: 0, p50: 100_000, invested: 100_000 });
    expect(r.bands[10]?.p50).toBeCloseTo(r.percentiles.p50, 6);
    expect(r.disclaimer).toMatch(/Not a guarantee/);
  });

  it('10,000 paths over 10 years run quickly', () => {
    const r = simulate({ ...base });
    expect(r.paths_sampled).toBe(10_000);
    expect(r.runtime_ms).toBeLessThan(3000);
  });

  it('validates inputs', () => {
    expect(() => simulate({ ...base, years: 0 })).toThrow(SimulationInputError);
    expect(() => simulate({ ...base, volatility: -1 })).toThrow(SimulationInputError);
    expect(() => simulate({ ...base, initial_amount: 0, monthly_contribution: 0 })).toThrow(/initial amount or a monthly/);
    expect(() => simulate({ ...base, paths: 1_000_000 })).toThrow(SimulationInputError);
  });
});

describe('portfolio (Cholesky)', () => {
  it('cholesky reproduces the matrix and rejects non-positive-definite input', () => {
    const m = [
      [1, 0.3, 0.1],
      [0.3, 1, -0.2],
      [0.1, -0.2, 1],
    ];
    const L = cholesky(m);
    for (let i = 0; i < 3; i += 1)
      for (let j = 0; j < 3; j += 1) expect(L[i]!.reduce((s, _, k) => s + L[i]![k]! * (L[j]![k] ?? 0), 0)).toBeCloseTo(m[i]![j]!, 12);
    expect(() =>
      cholesky([
        [1, 1.2],
        [1.2, 1],
      ]),
    ).toThrow(/positive definite/);
  });

  it('diversification: uncorrelated assets narrow the spread; a one-asset portfolio matches simulate()', () => {
    const one = simulatePortfolio({
      initial_amount: 1_000_000,
      monthly_contribution: 0,
      years: 10,
      paths: 4000,
      assets: [{ name: 'Equity', weight: 1, expected_return: 0.12, volatility: 0.16 }],
    });
    const single = simulate({ initial_amount: 1_000_000, monthly_contribution: 0, years: 10, paths: 4000, expected_return: 0.12, volatility: 0.16 });
    expect(one.percentiles.p50 / single.percentiles.p50).toBeGreaterThan(0.97);
    expect(one.percentiles.p50 / single.percentiles.p50).toBeLessThan(1.03);
    const two = (rho: number) =>
      simulatePortfolio({
        initial_amount: 1_000_000,
        monthly_contribution: 0,
        years: 10,
        paths: 4000,
        assets: [
          { name: 'A', weight: 0.5, expected_return: 0.1, volatility: 0.2 },
          { name: 'B', weight: 0.5, expected_return: 0.1, volatility: 0.2 },
        ],
        correlation: [
          [1, rho],
          [rho, 1],
        ],
      });
    const spread = (r: ReturnType<typeof two>) => r.percentiles.p95 - r.percentiles.p5;
    expect(spread(two(0))).toBeLessThan(spread(two(0.9)));
    expect(() =>
      simulatePortfolio({ initial_amount: 1, monthly_contribution: 0, years: 1, assets: [{ name: 'A', weight: 0.6, expected_return: 0.1, volatility: 0.1 }] }),
    ).toThrow(/add up to 1/);
  });
});

describe('contributionForProbability', () => {
  it('finds a contribution that reaches the target with the asked probability', () => {
    const input = { initial_amount: 0, monthly_contribution: 10_000, years: 10, expected_return: 0.12, volatility: 0.16, paths: 2000 };
    const need = contributionForProbability(input, 3_000_000, 0.9)!;
    expect(need % 500).toBe(0);
    const r = simulate({ ...input, monthly_contribution: need, targets: [3_000_000], paths: 2000 });
    expect(r.probability_above['3000000']).toBeGreaterThanOrEqual(0.9);
    const below = simulate({ ...input, monthly_contribution: need - 1000, targets: [3_000_000], paths: 2000 });
    expect(below.probability_above['3000000']).toBeLessThan(0.9);
  });
});
