import express from 'express';
import { apiRouter } from '../server/routes';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/__probe-routes', (_req, res) => res.status(200).json({ ok: true, layer: 'routes-imported', runtime: process.version }));
app.use('/api', apiRouter);
export default app;
