/**
 * Advisory pipeline HTTP routes.
 *   Layer A: POST /api/advisor/parse   { question } → { parsed, meta }
 *   Layer B: POST /api/advisor/context { question } → { parsed, context, sources }
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
import { serverFetchers } from './fetchers';

const bodySchema = z.object({ question: z.string().trim().min(2).max(MAX_QUESTION_CHARS) });

export interface AdvisorRouterDeps {
  /** Injected for tests; defaults to the Groq extractor (undefined when GROQ_API_KEY is missing). */
  ai?: () => AiExtractor | undefined;
  resolveUser?: (req: Request) => Promise<string | null>;
  fetchers?: Partial<Fetchers>;
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

  return router;
}

export const advisorRouter = createAdvisorRouter();
