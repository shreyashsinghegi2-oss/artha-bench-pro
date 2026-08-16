import type { Request, Response } from 'express';
import express from 'express';

import { apiRouter } from './routes';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use('/api', apiRouter);

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
