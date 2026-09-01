import type { Request, Response } from 'express';
import express from 'express';

import { apiRouter } from './routes';
import { personalAccountRouter } from './personalAccountRoutes';
import { evaluationComparisonRouter } from './evaluationComparisonRoutes';
import { indiaMarketRouter } from './indiaMarketRoutes';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use('/api', apiRouter);
app.use('/api', personalAccountRouter);
app.use('/api', evaluationComparisonRouter);
app.use('/api', indiaMarketRouter);

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
