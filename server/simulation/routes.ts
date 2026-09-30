/**
 * GET /api/simulation/params → NIFTY 50 return and volatility over the last 10 years of daily closes, for the
 * Monte Carlo simulator's defaults. Falls back to labelled planning assumptions when history is unavailable.
 */
import { Router, type Request, type Response } from 'express';
import { niftyHistory } from '../advisor/fetchers';
import { paramsFromCloses } from '../../src/simulation/historical';

export const FALLBACK_PARAMS = { expected_return: 0.12, volatility: 0.16 } as const;

export function createSimulationRouter(history: () => Promise<Array<{ date: string; close: number }>> = niftyHistory): Router {
  const router = Router();
  router.get('/params', async (_req: Request, res: Response) => {
    try {
      const p = paramsFromCloses(await history());
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      res.json({ asset: 'NIFTY 50', ...p, source: `NIFTY 50 daily closes ${p.from} to ${p.to} (Yahoo Finance ^NSEI)`, is_historical: true });
    } catch (e) {
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        asset: 'NIFTY 50',
        ...FALLBACK_PARAMS,
        cagr: null,
        source: 'Planning assumption (live history unavailable)',
        is_historical: false,
        note: e instanceof Error ? e.message.slice(0, 160) : 'unavailable',
      });
    }
  });
  return router;
}

export const simulationRouter = createSimulationRouter();
