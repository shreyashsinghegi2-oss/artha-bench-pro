/**
 * Proxy to the Python precision engine (precision-engine/, FastAPI). The engine returns certified results;
 * this route only forwards the JSON body and passes the engine's status through (422 = could not certify).
 *
 * Env: PRECISION_ENGINE_URL (e.g. https://precision.example.com). Without it every route answers 503
 * { configured: false } and the app keeps using its in-browser calculators.
 */
import { Router, type Request, type Response } from 'express';
import { createRateLimiter } from './rateLimiter';

export const PRECISION_KINDS = ['emi', 'sip', 'cagr', 'xirr', 'bond', 'tax', 'verify'] as const;
type Kind = (typeof PRECISION_KINDS)[number];

export const precisionRouter = Router();
const limiter = createRateLimiter({ windowMs: 60_000, max: 60, message: 'Too many calculations. Please wait a minute.' });

export function precisionEngineUrl(): string | null {
  const raw = process.env.PRECISION_ENGINE_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : null;
}

precisionRouter.get('/health', async (_req: Request, res: Response) => {
  const base = precisionEngineUrl();
  if (!base) return res.status(503).json({ configured: false });
  try {
    const upstream = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3_000) });
    return res.status(upstream.status).json({ configured: true, ...(await upstream.json()) });
  } catch {
    return res.status(502).json({ configured: true, ok: false, error: 'Precision engine did not respond.' });
  }
});

precisionRouter.post('/:kind', limiter, async (req: Request, res: Response) => {
  const kind = req.params.kind as Kind;
  if (!PRECISION_KINDS.includes(kind)) return res.status(404).json({ error: 'Unknown calculation.' });
  const base = precisionEngineUrl();
  if (!base) return res.status(503).json({ configured: false, error: 'The precision engine is not configured on this server.' });
  try {
    const upstream = await fetch(`${base}/api/${kind}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await upstream.text();
    res.status(upstream.status).type('application/json').send(text);
  } catch {
    res.status(502).json({ verified: false, error: 'Precision engine did not respond.' });
  }
});
