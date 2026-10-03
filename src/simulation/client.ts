/**
 * Browser entry to the simulator: runs in a Web Worker when available, otherwise (tests, old browsers) on the
 * main thread after yielding once so the UI can paint first.
 */
import type { PortfolioInput, SimulationInput, SimulationResult } from './monte-carlo';
import type { WorkerRequest } from './mc.worker';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (worker || typeof Worker === 'undefined') return worker;
  try {
    worker = new Worker(new URL('./mc.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error ?? 'Simulation failed'));
    };
    worker.onerror = () => {
      for (const p of pending.values()) p.reject(new Error('Simulation worker crashed'));
      pending.clear();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

type Req = WorkerRequest extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never;

async function run<T>(req: Req): Promise<T> {
  const w = getWorker();
  if (w) {
    const id = nextId++;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      w.postMessage({ ...req, id });
    });
  }
  await new Promise((r) => setTimeout(r, 0));
  const mc = await import('./monte-carlo');
  if (req.kind === 'simulate') return mc.simulate(req.input) as T;
  if (req.kind === 'portfolio') return mc.simulatePortfolio(req.input) as T;
  return mc.contributionForProbability(req.input, req.target, req.probability) as T;
}

export const runSimulation = (input: SimulationInput) => run<SimulationResult>({ kind: 'simulate', input });
export const runPortfolio = (input: PortfolioInput) => run<SimulationResult>({ kind: 'portfolio', input });
export const findContribution = (input: SimulationInput, target: number, probability: number) =>
  run<number | null>({ kind: 'contribution', input, target, probability });

export interface SimulationDefaults {
  asset: string;
  expected_return: number;
  volatility: number;
  cagr: number | null;
  source: string;
  is_historical: boolean;
}

let defaultsPromise: Promise<SimulationDefaults> | null = null;
export function loadDefaults(): Promise<SimulationDefaults> {
  defaultsPromise ??= fetch('/api/simulation/params')
    .then((r) => (r.ok ? (r.json() as Promise<SimulationDefaults>) : Promise.reject(new Error(String(r.status)))))
    .catch(() => ({
      asset: 'NIFTY 50',
      expected_return: 0.12,
      volatility: 0.16,
      cagr: null,
      source: 'Planning assumption (live history unavailable)',
      is_historical: false,
    }));
  return defaultsPromise;
}
