import type { Request, Response } from 'express';
import express from 'express';

import { apiRouter } from './routes';
import { personalAccountRouter } from './personalAccountRoutes';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use('/api', apiRouter);
app.use('/api', personalAccountRouter);

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
