import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes';
import { personalAccountRouter } from './server/personalAccountRoutes';
import { evaluationComparisonRouter } from './server/evaluationComparisonRoutes';
import { freeMarketRouter } from './server/freeMarketRoutes';
import { aiRouter } from './server/aiRoutes';
import { handleNvidiaTutor } from './server/nvidiaService';
import { handleNewsImage } from './server/newsImageProxy';
import { groundingMiddleware, stripUserProfile, liveSourceStatus, webSearch } from './server/liveGrounding';

dotenv.config();
/** Assistant endpoints that answer with live market data, news and web search. */
const GROUNDED_AI_PATHS = new Set(['/ai/chat', '/ai/tutor', '/tutor', '/nvidia-tutor', '/crypto/assistant', '/company/assistant', '/dashboard/assistant', '/personal/assistant', '/finance/scenario-assistant', '/news/explain', '/news/brief']);
const __dirname = process.cwd();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.get('/api/news/image', handleNewsImage);
  app.use('/api', stripUserProfile);
  app.use('/api', (req, res, next) => (GROUNDED_AI_PATHS.has(req.path) ? groundingMiddleware(req, res, next) : next()));
  app.get('/api/ai/live-sources', (_req, res) => { res.json(liveSourceStatus()); }); app.get('/api/ai/web-search', async (req, res) => { const q = String(req.query.q ?? '').slice(0, 200).trim(); if (!q) return res.status(400).json({ error: 'Add ?q=your question' }); try { res.json({ query: q, retrievedAt: new Date().toISOString(), ...(await webSearch(q)) }); } catch { res.status(502).json({ error: 'Web search is unavailable right now.' }); } });
  app.post('/api/nvidia-tutor', handleNvidiaTutor);
  app.use('/api', aiRouter);
  app.use('/api', apiRouter);
  app.use('/api', personalAccountRouter);
  app.use('/api', evaluationComparisonRouter);
  app.use('/api', freeMarketRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`ArthaBench Pro server running on http://0.0.0.0:${PORT}`));
}
startServer();
