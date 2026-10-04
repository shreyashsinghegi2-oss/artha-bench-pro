/**
 * Read-only views of the Fetch → Refine → Verify pipeline:
 *   GET /api/grounding/status              per-source counters (success, latency, bytes, back-off) and what is enabled
 *   GET /api/grounding/preview?q=…         runs the FETCH and REFINE-INPUT steps for a question (no model call)
 *                                          and shows which sources answered, the numbered sources and verified numbers.
 * No secrets are returned. The preview is rate-limited because it fetches from external sites.
 */
import { Router, type Request, type Response } from 'express';
import { fetchMetrics } from './fetch/registry';
import { firecrawlEnabled } from './fetch/sources';
import { computeVerified, parseIntents } from './fetch/verifyNumbers';
import { gatherLiveContext, liveSourceStatus } from './liveGrounding';
import { precisionEngineUrl } from './precisionRoutes';
import { createRateLimiter } from './rateLimiter';
import { ragEngine } from '../rag/rag_engine';

export const groundingRouter = Router();
const previewLimiter = createRateLimiter({ windowMs: 60_000, max: 20, message: 'Too many previews. Please wait a minute.' });

groundingRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    pipeline: 'fetch → refine → verify',
    enabled: {
      rag: ragEngine.enabled,
      officialFeeds: true,
      firecrawl: firecrawlEnabled(),
      precisionEngine: Boolean(precisionEngineUrl()),
      ...liveSourceStatus(),
    },
    sources: fetchMetrics(),
  });
});

groundingRouter.get('/preview', previewLimiter, async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '')
    .trim()
    .slice(0, 300);
  if (q.length < 3) return res.status(400).json({ error: 'Add ?q= with a question (3 to 300 characters).' });
  const mode = req.query.web === 'off' ? 'off' : req.query.web === 'on' ? 'on' : 'auto';
  const started = Date.now();
  const [live, verified] = await Promise.all([gatherLiveContext(q, mode), computeVerified(parseIntents(q)).catch(() => [])]);
  res.set('Cache-Control', 'no-store');
  return res.json({
    question: q,
    fetchMs: Date.now() - started,
    runs: live.runs.map((r) => ({
      id: r.id,
      ok: r.ok,
      cached: r.cached,
      skipped: r.skipped,
      items: r.items.length,
      latencyMs: r.latencyMs,
      bytes: r.bytes,
      error: r.error,
    })),
    numberedSources: live.numbered,
    verifiedNumbers: verified,
    contextChars: live.text.length,
    context: req.query.full === '1' ? live.text : live.text.slice(0, 1500),
  });
});
