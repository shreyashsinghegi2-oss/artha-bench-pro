import type { Request, Response } from 'express';
import express from 'express';

import { apiRouter } from './routes';
import { aiRouter } from './aiRoutes';
import { personalAccountRouter } from './personalAccountRoutes';
import { evaluationComparisonRouter } from './evaluationComparisonRoutes';
import { freeMarketRouter } from './freeMarketRoutes';
import { handleNvidiaTutor } from './nvidiaService';
import { handleNewsImage } from './newsImageProxy';
import { groundingMiddleware, liveSourceStatus } from './liveGrounding';

const app = express();
/** Assistant endpoints that answer with live market data, news and web search. */
const GROUNDED_AI_PATHS = new Set(['/ai/chat', '/ai/tutor', '/tutor', '/nvidia-tutor', '/crypto/assistant', '/company/assistant', '/dashboard/assistant', '/personal/assistant', '/finance/scenario-assistant', '/news/explain', '/news/brief']);
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.get('/api/news/image', handleNewsImage);
app.use('/api', (req, res, next) => (GROUNDED_AI_PATHS.has(req.path) ? groundingMiddleware(req, res, next) : next()));
app.get('/api/ai/live-sources', (_req, res) => { res.json(liveSourceStatus()); });
app.post('/api/nvidia-tutor', handleNvidiaTutor);
app.use('/api', aiRouter);
app.use('/api', apiRouter);
app.use('/api', personalAccountRouter);
app.use('/api', evaluationComparisonRouter);
app.use('/api', freeMarketRouter);

export default function handler(req: Request, res: Response) { return app(req, res); }
