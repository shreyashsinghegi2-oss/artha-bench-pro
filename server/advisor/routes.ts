/**
 * Advisory pipeline HTTP routes.
 *   Layer A: POST /api/advisor/parse   { question } → { parsed, meta }
 *   Layer B: POST /api/advisor/context { question } → { parsed, context, sources }
 *   Full:    POST /api/advisor/ask     { question, profile? } → NDJSON stream: one {"type":"layer"} line per
 *            layer as it finishes, then {"type":"answer", answer, audit}. Signed-in answers are stored (Layer G).
 *   Share:   POST /api/advisor/share   { id } (signed in) → { share_id }
 *            GET  /api/advisor/shared/:shareId → the shared answer without personal profile data
 * user_id comes from a verified Supabase session (Authorization: Bearer <access token>), never from the body.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { parseQuery, MAX_QUESTION_CHARS } from '../../src/advisor/query-parser';
import type { AiExtractor } from '../../src/advisor/types';
import { bearer, verifyUser } from '../personalAccountRoutes';
import { createRateLimiter } from '../rateLimiter';
import { createGroqExtractor } from './groq-extractor';
import { gatherContext, sourceSummary, type Fetchers } from '../../src/advisor/data-gathering';
import { niftyHistory, serverFetchers } from './fetchers';
import { computeFeatures } from '../../src/advisor/features';
import { runPipeline } from '../../src/advisor/pipeline';
import type { Llm } from '../../src/advisor/explainer';
import type { MarketState } from '../../src/advisor/context';
import { createGroqExplainer } from './groq-explainer';
import { supabaseAuditStore, type AuditStore } from './audit';

const money = z.number().finite().min(0).max(1e11);
export const profileSchema = z
  .object({
    age: z.number().int().min(15).max(100),
    annual_income: money,
    monthly_expenses: money,
    monthly_emi: money,
    liquid_savings: money,
    investments: money,
    dependants: z.number().int().min(0).max(20),
    risk_tolerance: z.enum(['low', 'medium', 'high']),
    income_stability: z.enum(['stable', 'variable']),
    equity_share: z.number().min(0).max(100),
    term_cover: money,
    health_cover: money,
    section_80c_used: money,
    nps_extra_used: money,
    retire_age: z.number().int().min(30).max(90),
    goals: z.array(z.object({ name: z.string().max(80), target_amount: money, years: z.number().min(0).max(60) })).max(10),
  })
  .partial()
  .strict();
const askSchema = z.object({ question: z.string().trim().min(2).max(MAX_QUESTION_CHARS), profile: profileSchema.nullish() });
const SHARE_ID = /^[A-Za-z0-9_-]{16,32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let featureCache: { at: number; rows: MarketState[] } | null = null;
async function featureHistory(): Promise<MarketState[]> {
  if (featureCache && Date.now() - featureCache.at < 3_600_000) return featureCache.rows;
  const rows = computeFeatures(await niftyHistory());
  featureCache = { at: Date.now(), rows };
  return rows;
}

const bodySchema = z.object({ question: z.string().trim().min(2).max(MAX_QUESTION_CHARS) });

export interface AdvisorRouterDeps {
  /** Injected for tests; defaults to the Groq extractor (undefined when GROQ_API_KEY is missing). */
  ai?: () => AiExtractor | undefined;
  resolveUser?: (req: Request) => Promise<string | null>;
  fetchers?: Partial<Fetchers>;
  history?: () => Promise<MarketState[]>;
  llm?: () => Llm | undefined;
  audit?: AuditStore;
}

async function defaultResolveUser(req: Request): Promise<string | null> {
  const token = bearer(req);
  if (!token) return null;
  try {
    return (await verifyUser(token)).id;
  } catch {
    return null;
  }
}

export function createAdvisorRouter(deps: AdvisorRouterDeps = {}): Router {
  const router = Router();
  const limiter = createRateLimiter({ windowMs: 60_000, max: 30, message: 'Too many questions at once. Please wait a minute.' });
  const aiFor = deps.ai ?? (() => createGroqExtractor());
  const resolveUser = deps.resolveUser ?? defaultResolveUser;

  router.post('/parse', limiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const body = bodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: { code: 'invalid_question', message: `Send { "question": "..." } with 2 to ${MAX_QUESTION_CHARS} characters.` } });
      return;
    }
    try {
      const userId = (await resolveUser(req)) ?? 'anonymous';
      const result = await parseQuery(body.data.question, { userId, ai: aiFor() });
      res.json(result);
    } catch (e) {
      console.error('[advisor/parse] unexpected error', e);
      res.status(500).json({ error: { code: 'internal_error', message: 'The question could not be parsed.' } });
    }
  });

  router.post('/context', limiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const body = bodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: { code: 'invalid_question', message: `Send { "question": "..." } with 2 to ${MAX_QUESTION_CHARS} characters.` } });
      return;
    }
    try {
      const userId = (await resolveUser(req)) ?? 'anonymous';
      const { parsed } = await parseQuery(body.data.question, { userId, ai: aiFor() });
      const context = await gatherContext({ question: body.data.question, parsed, fetchers: deps.fetchers ?? serverFetchers });
      res.json({ parsed, context, sources: sourceSummary(context) });
    } catch (e) {
      console.error('[advisor/context] unexpected error', e);
      res.status(500).json({ error: { code: 'internal_error', message: 'Market context could not be gathered.' } });
    }
  });

  const audit = deps.audit ?? supabaseAuditStore();
  const llmFor = deps.llm ?? (() => createGroqExplainer());

  router.post('/ask', limiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const body = askSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        error: { code: 'invalid_request', message: `Send { "question": "..." } with 2 to ${MAX_QUESTION_CHARS} characters, and an optional valid profile.` },
      });
      return;
    }
    const userId = await resolveUser(req);
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('X-Accel-Buffering', 'no');
    const line = (o: unknown) => res.write(`${JSON.stringify(o)}\n`);
    try {
      const answer = await runPipeline(body.data.question, {
        userId: userId ?? 'anonymous',
        profile: body.data.profile ?? null,
        extractor: aiFor(),
        fetchers: deps.fetchers ?? serverFetchers,
        history: deps.history ?? featureHistory,
        llm: llmFor(),
        onLayer: (e) => line({ type: 'layer', ...e }),
      });
      let ref: { id: string; share_id: string } | null = null;
      let auditNote: string | null = userId ? null : 'Sign in to save answers and share them.';
      const token = bearer(req);
      if (userId && token) {
        try {
          ref = await audit.save(token, answer);
        } catch (e) {
          auditNote = 'This answer could not be saved to your history.';
          console.warn('[advisor/ask] audit save failed', e instanceof Error ? e.message : e);
        }
      }
      line({ type: 'answer', answer, audit: ref, audit_note: auditNote });
    } catch (e) {
      console.error('[advisor/ask] unexpected error', e);
      line({ type: 'error', message: 'The advisor could not answer right now. Please try again.' });
    }
    res.end();
  });

  router.post('/share', limiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const id = typeof req.body?.id === 'string' ? req.body.id : '';
    const token = bearer(req);
    if (!UUID.test(id)) {
      res.status(400).json({ error: { code: 'invalid_id', message: 'Send { "id": "<answer id>" }.' } });
      return;
    }
    if (!token || !(await resolveUser(req))) {
      res.status(401).json({ error: { code: 'sign_in_required', message: 'Sign in to share answers.' } });
      return;
    }
    try {
      const shareId = await audit.share(token, id);
      if (!shareId) {
        res.status(404).json({ error: { code: 'not_found', message: 'Answer not found.' } });
        return;
      }
      res.json({ share_id: shareId });
    } catch (e) {
      console.warn('[advisor/share] failed', e instanceof Error ? e.message : e);
      res.status(502).json({ error: { code: 'share_failed', message: 'Could not create the share link.' } });
    }
  });

  router.get('/shared/:shareId', async (req: Request, res: Response) => {
    const shareId = String(req.params.shareId ?? '');
    if (!SHARE_ID.test(shareId)) {
      res.status(400).json({ error: { code: 'invalid_share_id', message: 'Invalid share link.' } });
      return;
    }
    try {
      const shared = await audit.getShared(shareId);
      if (!shared) {
        res.status(404).json({ error: { code: 'not_found', message: 'This shared answer does not exist or is no longer shared.' } });
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(shared);
    } catch (e) {
      console.warn('[advisor/shared] failed', e instanceof Error ? e.message : e);
      res.status(502).json({ error: { code: 'lookup_failed', message: 'Could not load the shared answer.' } });
    }
  });

  return router;
}

export const advisorRouter = createAdvisorRouter();
