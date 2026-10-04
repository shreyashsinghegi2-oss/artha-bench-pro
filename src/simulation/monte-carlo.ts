/**
 * Module 23 — Monte Carlo simulation (deterministic, seeded, no AI).
 *
 * Model: geometric Brownian motion with monthly steps
 *   S(t+dt) = S(t) · exp((μ − σ²/2)·dt + σ·√dt·Z),  Z ~ N(0,1), dt = 1/12
 * The monthly contribution is added at the start of every month (like a SIP), then the month's return applies.
 * σ = 0 collapses to the deterministic compound-growth result (e.g. an FD), so no paths are drawn.
 * Portfolios of several assets use a Cholesky factor of the correlation matrix and rebalance monthly.
 *
 * Same inputs + same seed ⇒ identical output, so a result can be shared and reproduced.
 * Label: "Simulation based on historical volatility. Not a guarantee."
 */

export const SIMULATION_DISCLAIMER = 'Simulation based on historical volatility. Not a guarantee.';
export const DEFAULT_PATHS = 10_000;
export const DEFAULT_SEED = 42;
export const MAX_PATHS = 50_000;
export const MAX_YEARS = 50;

export interface SimulationInput {
  initial_amount: number;
  monthly_contribution: number;
  years: number;
  /** Expected annual return, as a fraction (0.12 = 12%). Interpreted as the arithmetic drift μ. */
  expected_return: number;
  /** Annual volatility σ, as a fraction (0.16 = 16%). */
  volatility: number;
  paths?: number;
  seed?: number;
  /** Amounts to report the probability of ending above (₹). */
  targets?: number[];
}

export interface AssetSpec {
  name: string;
  weight: number;
  expected_return: number;
  volatility: number;
}

export interface PortfolioInput extends Omit<SimulationInput, 'expected_return' | 'volatility'> {
  assets: AssetSpec[];
  /** Symmetric correlation matrix, same order as assets; identity when omitted. */
  correlation?: number[][];
}

export interface Percentiles {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface YearBand extends Percentiles {
  year: number;
  invested: number;
}

export interface SimulationResult {
  percentiles: Percentiles;
  /** Keyed by the target amount in rupees. */
  probability_above: Record<string, number>;
  /** Share of paths that end below the total amount invested. */
  probability_loss: number;
  confidence_interval_95: [number, number];
  /** Percentile bands at every year end (year 0 = start), for the fan chart. */
  bands: YearBand[];
  total_invested: number;
  /** Median of the deterministic (σ = 0) path, for reference. */
  deterministic_value: number;
  paths_sampled: number;
  seed: number;
  runtime_ms: number;
  model: 'GBM' | 'GBM-portfolio' | 'deterministic';
  disclaimer: string;
}

export class SimulationInputError extends Error {}

// ---------------------------------------------------------------------------------------------------------
// Seeded randomness: mulberry32 uniform + Box–Muller normals.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalGenerator(seed: number): () => number {
  const u = mulberry32(seed);
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u1 = u();
    while (u1 <= Number.EPSILON) u1 = u();
    const u2 = u();
    const r = Math.sqrt(-2 * Math.log(u1));
    spare = r * Math.sin(2 * Math.PI * u2);
    return r * Math.cos(2 * Math.PI * u2);
  };
}

// ---------------------------------------------------------------------------------------------------------

export function quantileSorted(sorted: Float64Array | number[], q: number): number {
  const n = sorted.length;
  if (!n) return Number.NaN;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.min(n - 1, lo + 1);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (pos - lo);
}

function percentilesOf(sorted: Float64Array): Percentiles {
  return {
    p5: quantileSorted(sorted, 0.05),
    p25: quantileSorted(sorted, 0.25),
    p50: quantileSorted(sorted, 0.5),
    p75: quantileSorted(sorted, 0.75),
    p95: quantileSorted(sorted, 0.95),
  };
}

/** Lower-triangular L with L·Lᵀ = matrix. Throws if the matrix is not positive definite. */
export function cholesky(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = matrix[i]?.[j] ?? 0;
      for (let k = 0; k < j; k += 1) sum -= (L[i]?.[k] ?? 0) * (L[j]?.[k] ?? 0);
      if (i === j) {
        if (sum <= 1e-12) throw new SimulationInputError('Correlation matrix is not positive definite.');
        (L[i] as number[])[j] = Math.sqrt(sum);
      } else {
        (L[i] as number[])[j] = sum / (L[j]?.[j] ?? 1);
      }
    }
  }
  return L;
}

function validate(input: Omit<SimulationInput, 'expected_return' | 'volatility'>): { paths: number; seed: number; months: number } {
  const finite = (v: number, name: string, min: number, max: number) => {
    if (!Number.isFinite(v) || v < min || v > max) throw new SimulationInputError(`${name} must be between ${min} and ${max}.`);
  };
  finite(input.initial_amount, 'initial_amount', 0, 1e12);
  finite(input.monthly_contribution, 'monthly_contribution', 0, 1e10);
  finite(input.years, 'years', 1 / 12, MAX_YEARS);
  if (input.initial_amount === 0 && input.monthly_contribution === 0) throw new SimulationInputError('Enter an initial amount or a monthly contribution.');
  const paths = Math.round(input.paths ?? DEFAULT_PATHS);
  finite(paths, 'paths', 100, MAX_PATHS);
  const seed = Math.round(input.seed ?? DEFAULT_SEED);
  finite(seed, 'seed', 0, 2 ** 32 - 1);
  return { paths, seed, months: Math.max(1, Math.round(input.years * 12)) };
}

function deterministicValue(initial: number, monthly: number, months: number, annualReturn: number): number {
  const g = Math.exp(annualReturn / 12); // continuous-compounding equivalent of the GBM median drift at σ=0
  let v = initial;
  for (let m = 0; m < months; m += 1) v = (v + monthly) * g;
  return v;
}

function summarise(
  finals: Float64Array,
  yearly: Float64Array[],
  input: SimulationInput | PortfolioInput,
  months: number,
  seed: number,
  t0: number,
  model: SimulationResult['model'],
  deterministic: number,
): SimulationResult {
  const invested = input.initial_amount + input.monthly_contribution * months;
  finals.sort();
  const percentiles = percentilesOf(finals);
  const probability_above: Record<string, number> = {};
  for (const t of input.targets ?? []) {
    let count = 0;
    for (let i = 0; i < finals.length; i += 1) if ((finals[i] ?? 0) >= t) count += 1;
    probability_above[String(t)] = count / finals.length;
  }
  let losses = 0;
  for (let i = 0; i < finals.length; i += 1) if ((finals[i] ?? 0) < invested) losses += 1;
  const bands: YearBand[] = yearly.map((arr, y) => {
    arr.sort();
    return { year: y, invested: input.initial_amount + input.monthly_contribution * Math.min(months, y * 12), ...percentilesOf(arr) };
  });
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    percentiles,
    probability_above,
    probability_loss: losses / finals.length,
    confidence_interval_95: [quantileSorted(finals, 0.025), quantileSorted(finals, 0.975)],
    bands,
    total_invested: invested,
    deterministic_value: deterministic,
    paths_sampled: finals.length,
    seed,
    runtime_ms: Math.round(now - t0),
    model,
    disclaimer: SIMULATION_DISCLAIMER,
  };
}

function yearSlots(months: number, paths: number): { slots: Float64Array[]; yearOf: Int32Array } {
  const years = Math.ceil(months / 12);
  const slots = Array.from({ length: years + 1 }, () => new Float64Array(paths));
  // yearOf[m] = year index recorded after month m (1-based), or -1.
  const yearOf = new Int32Array(months + 1).fill(-1);
  for (let y = 1; y <= years; y += 1) yearOf[Math.min(months, y * 12)] = y;
  return { slots, yearOf };
}

/** Single asset (or a blended portfolio described by one μ and σ). */
export function simulate(input: SimulationInput): SimulationResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const { paths, seed, months } = validate(input);
  const mu = input.expected_return;
  const sigma = input.volatility;
  if (!Number.isFinite(mu) || mu < -0.5 || mu > 1) throw new SimulationInputError('expected_return must be between -50% and 100%.');
  if (!Number.isFinite(sigma) || sigma < 0 || sigma > 2) throw new SimulationInputError('volatility must be between 0% and 200%.');
  const deterministic = deterministicValue(input.initial_amount, input.monthly_contribution, months, mu - (sigma * sigma) / 2);

  if (sigma === 0) {
    const n = 1;
    const { slots, yearOf } = yearSlots(months, n);
    const g = Math.exp(mu / 12);
    let v = input.initial_amount;
    (slots[0] as Float64Array)[0] = v;
    for (let m = 1; m <= months; m += 1) {
      v = (v + input.monthly_contribution) * g;
      const y = yearOf[m] ?? -1;
      if (y >= 0) (slots[y] as Float64Array)[0] = v;
    }
    return { ...summarise(Float64Array.of(v), slots, input, months, seed, t0, 'deterministic', v), paths_sampled: 1 };
  }

  const dt = 1 / 12;
  const drift = (mu - (sigma * sigma) / 2) * dt;
  const vol = sigma * Math.sqrt(dt);
  const z = normalGenerator(seed);
  const finals = new Float64Array(paths);
  const { slots, yearOf } = yearSlots(months, paths);
  for (let p = 0; p < paths; p += 1) {
    let v = input.initial_amount;
    (slots[0] as Float64Array)[p] = v;
    for (let m = 1; m <= months; m += 1) {
      v = (v + input.monthly_contribution) * Math.exp(drift + vol * z());
      const y = yearOf[m] ?? -1;
      if (y >= 0) (slots[y] as Float64Array)[p] = v;
    }
    finals[p] = v;
  }
  return summarise(finals, slots, input, months, seed, t0, 'GBM', deterministic);
}

/** Several correlated assets, rebalanced to their weights every month. */
export function simulatePortfolio(input: PortfolioInput): SimulationResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const { paths, seed, months } = validate(input);
  const n = input.assets.length;
  if (n < 1 || n > 8) throw new SimulationInputError('Use between 1 and 8 assets.');
  const wSum = input.assets.reduce((a, x) => a + x.weight, 0);
  if (!input.assets.every((a) => a.weight >= 0 && Number.isFinite(a.volatility) && a.volatility >= 0) || Math.abs(wSum - 1) > 1e-6)
    throw new SimulationInputError('Asset weights must be non-negative and add up to 1.');
  const corr = input.correlation ?? input.assets.map((_, i) => input.assets.map((__, j) => (i === j ? 1 : 0)));
  if (
    corr.length !== n ||
    corr.some((r, i) => r.length !== n || r[i] !== 1 || r.some((v, j) => Math.abs(v - (corr[j]?.[i] ?? Number.NaN)) > 1e-9 || v < -1 || v > 1))
  )
    throw new SimulationInputError('Correlation must be a symmetric matrix with 1 on the diagonal.');
  const L = cholesky(corr);
  const dt = 1 / 12;
  const drifts = input.assets.map((a) => (a.expected_return - (a.volatility * a.volatility) / 2) * dt);
  const vols = input.assets.map((a) => a.volatility * Math.sqrt(dt));
  const weights = input.assets.map((a) => a.weight);
  const blendedMu = input.assets.reduce((s, a) => s + a.weight * a.expected_return, 0);
  const deterministic = deterministicValue(input.initial_amount, input.monthly_contribution, months, blendedMu);
  const z = normalGenerator(seed);
  const indep = new Float64Array(n);
  const finals = new Float64Array(paths);
  const { slots, yearOf } = yearSlots(months, paths);
  for (let p = 0; p < paths; p += 1) {
    let v = input.initial_amount;
    (slots[0] as Float64Array)[p] = v;
    for (let m = 1; m <= months; m += 1) {
      for (let i = 0; i < n; i += 1) indep[i] = z();
      let growth = 0;
      for (let i = 0; i < n; i += 1) {
        let c = 0;
        const row = L[i] as number[];
        for (let k = 0; k <= i; k += 1) c += (row[k] ?? 0) * (indep[k] ?? 0);
        growth += (weights[i] ?? 0) * Math.exp((drifts[i] ?? 0) + (vols[i] ?? 0) * c);
      }
      v = (v + input.monthly_contribution) * growth;
      const y = yearOf[m] ?? -1;
      if (y >= 0) (slots[y] as Float64Array)[p] = v;
    }
    finals[p] = v;
  }
  return summarise(finals, slots, input, months, seed, t0, 'GBM-portfolio', deterministic);
}

/**
 * Smallest monthly contribution (to the nearest ₹500) that reaches `target` with at least `probability`,
 * using the same seed so the answer is reproducible. Returns null when even ₹10 lakh a month is not enough.
 */
export function contributionForProbability(input: SimulationInput, target: number, probability: number): number | null {
  const reach = (monthly: number) => {
    const r = simulate({ ...input, monthly_contribution: monthly, targets: [target], paths: Math.min(input.paths ?? DEFAULT_PATHS, 4000) });
    return (r.probability_above[String(target)] ?? 0) >= probability;
  };
  let lo = 0;
  let hi = Math.max(500, input.monthly_contribution);
  while (!reach(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > 1_000_000) return null;
  }
  while (hi - lo > 500) {
    const mid = Math.round((lo + hi) / 2 / 500) * 500;
    if (mid <= lo || mid >= hi) break;
    if (reach(mid)) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi / 500) * 500;
}
