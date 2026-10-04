# TR-03 · Reproducible Monte Carlo for Household Investment Planning

**Shreyash Singh** · ArthaBench Pro · Technical report, October 2026
Code: [`src/simulation/`](../../src/simulation), [`server/simulation/routes.ts`](../../server/simulation/routes.ts) · Tests: [`tests/monteCarlo.test.ts`](../../tests/monteCarlo.test.ts), [`tests/simulationRoutes.test.ts`](../../tests/simulationRoutes.test.ts)

> Status: engineering technical report, not peer reviewed. Simulations are based on historical volatility and are not a guarantee.

---

## Abstract

Most consumer SIP calculators show one line: the future value at a fixed return. That hides the question
people actually have: *how likely am I to reach my goal?* This report describes a browser-side Monte Carlo
engine that simulates monthly investing under geometric Brownian motion, supports multi-asset portfolios
through a Cholesky factor of the correlation matrix, takes its default parameters from historical NIFTY
data, and is **seeded and deterministic**, so any result can be shared as a link and reproduced exactly.

## 1. Model

Wealth follows geometric Brownian motion with monthly steps (dt = 1/12):

  S(t+dt) = S(t) · exp((μ − σ²/2)·dt + σ·√dt·Z),  Z ~ N(0, 1)

The monthly contribution is added at the start of each month (as in a SIP), then the month's return applies.
With σ = 0 the model collapses to deterministic compound growth (like a fixed deposit) and no paths are drawn.

**Portfolios.** For several assets, independent normals are correlated with the Cholesky factor L of the
correlation matrix (Z_corr = L·Z), and the portfolio is rebalanced monthly to its target weights.
Non-positive-definite matrices are rejected.

**Randomness.** A seeded `mulberry32` generator feeds a Box–Muller transform. Same inputs and same seed
give identical output; defaults are 10,000 paths and seed 42 (limits: 50,000 paths, 50 years).

## 2. Parameters from data

Defaults come from NIFTY daily closes ([`historical.ts`](../../src/simulation/historical.ts)):

- σ = standard deviation of daily log returns × √252
- μ = mean daily log return × 252 + σ²/2

The σ²/2 term makes the model's *median* growth equal the historical CAGR. At least one year of closes is
required; if the data source fails, the API returns clearly labelled fallback assumptions instead.

## 3. Outputs

- Percentile bands (5th, 25th, 50th, 75th, 95th) for every year, drawn as a fan chart with a table view.
- Probability of ending above each user target.
- Total amount invested, for comparison with outcomes.
- **Inverse problem:** `contributionForProbability` finds the monthly contribution needed to reach a target
  with a chosen probability (e.g. "what SIP gives me a 90 % chance of ₹1 crore in 15 years?").

The simulation runs in a Web Worker so the page stays responsive.

## 4. Validation

The test suite checks the engine against things that are known to be true:

| Test | What it confirms |
|---|---|
| Reproducibility | same seed → identical result; different seed → different paths |
| Normality | generated numbers have the moments of a standard normal |
| Closed form | lump-sum median matches P·exp((μ − σ²/2)t) |
| σ = 0 | output equals deterministic compound growth |
| Cholesky | the factor reproduces the matrix; invalid matrices are rejected |
| Diversification | uncorrelated assets narrow the spread; a one-asset portfolio matches the single-asset engine |
| Inverse problem | the found contribution reaches the target with the requested probability |
| Historical parameters | volatility is recovered from simulated daily closes |
| Performance | 10,000 paths over 10 years run quickly in the test environment |

## 5. Limitations

- GBM assumes normally distributed log returns with constant μ and σ. Real markets have fat tails, volatility
  clustering and regime changes, so extreme outcomes are likely **understated**.
- Historical parameters describe the past window used, not the future.
- Taxes, fees and inflation are not modelled inside the paths unless entered as adjusted inputs.

## 6. Next steps

Planned extensions: bootstrapped historical returns (resampling real monthly returns instead of assuming
normality), Student-t shocks for fat tails, and inflation-adjusted targets.
