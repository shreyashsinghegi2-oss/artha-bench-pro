import type { Request, Response } from 'express';
import express from 'express';

import { apiRouter } from './routes';
import { aiRouter } from './aiRoutes';
import { personalAccountRouter } from './personalAccountRoutes';
import { evaluationComparisonRouter } from './evaluationComparisonRoutes';
import { freeMarketRouter } from './freeMarketRoutes';
import { handleNvidiaTutor } from './nvidiaService';
import { handleNewsImage } from './newsImageProxy';
import { groundingMiddleware, stripUserProfile, liveSourceStatus, webSearch } from './liveGrounding';

const app = express();
/** Assistant endpoints that answer with live market data, news and web search. */
const GROUNDED_AI_PATHS = new Set(['/ai/chat', '/ai/tutor', '/tutor', '/nvidia-tutor', '/crypto/assistant', '/company/assistant', '/dashboard/assistant', '/personal/assistant', '/finance/scenario-assistant', '/news/explain', '/news/brief']);
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.get('/api/news/image', handleNewsImage);
app.use('/api', stripUserProfile);
app.use('/api', (req, res, next) => (GROUNDED_AI_PATHS.has(req.path) ? groundingMiddleware(req, res, next) : next()));
app.get('/api/ai/live-sources', (_req, res) => { res.json(liveSourceStatus()); }); app.get('/api/ai/web-search', async (req, res) => { const q = String(req.query.q ?? '').slice(0, 200).trim(); if (!q) return res.status(400).json({ error: 'Add ?q=your question' }); try { res.json({ query: q, retrievedAt: new Date().toISOString(), ...(await webSearch(q)) }); } catch { res.status(502).json({ error: 'Web search is unavailable right now.' }); } });
// Health of the sign-in service (no secrets): is the Supabase project reachable, and does it accept email sign-up?
app.get('/api/auth/status', async (_req, res) => {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://agjbvoosukxfvrritgto.supabase.co').replace(/\/$/, '');
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_KOdXB7LW5Ho5hDjsi3GMiw_xdogy5oR';
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(8000) });
    const body = await r.json().catch(() => ({})) as Record<string, any>;
    res.json({ reachable: true, status: r.status, project: new URL(url).hostname.split('.')[0], keyType: key.startsWith('sb_') ? 'publishable' : 'jwt', emailEnabled: body?.external?.email ?? null, signupDisabled: body?.disable_signup ?? null, autoConfirm: body?.mailer_autoconfirm ?? null, error: r.ok ? null : (body?.message || body?.msg || body?.error || null) });
  } catch (e) {
    res.json({ reachable: false, error: e instanceof Error ? e.message : 'unreachable' });
  }
});
app.post('/api/nvidia-tutor', handleNvidiaTutor);
app.use('/api', aiRouter);
app.use('/api', apiRouter);
app.use('/api', personalAccountRouter);
app.use('/api', evaluationComparisonRouter);
app.use('/api', freeMarketRouter);

export default function handler(req: Request, res: Response) { return app(req, res); }
