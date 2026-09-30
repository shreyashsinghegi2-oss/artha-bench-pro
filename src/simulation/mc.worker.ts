/// <reference lib="webworker" />
/** Runs Monte Carlo simulations off the main thread so the page never freezes. */
import { contributionForProbability, simulate, simulatePortfolio, type PortfolioInput, type SimulationInput } from './monte-carlo';

export type WorkerRequest =
  | { id: number; kind: 'simulate'; input: SimulationInput }
  | { id: number; kind: 'portfolio'; input: PortfolioInput }
  | { id: number; kind: 'contribution'; input: SimulationInput; target: number; probability: number };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    const result =
      msg.kind === 'simulate'
        ? simulate(msg.input)
        : msg.kind === 'portfolio'
          ? simulatePortfolio(msg.input)
          : contributionForProbability(msg.input, msg.target, msg.probability);
    (self as unknown as Worker).postMessage({ id: msg.id, ok: true, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: msg.id, ok: false, error: err instanceof Error ? err.message : 'Simulation failed' });
  }
};
