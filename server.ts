import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes';
import { personalAccountRouter } from './server/personalAccountRoutes';
import { evaluationComparisonRouter } from './server/evaluationComparisonRoutes';
import { freeMarketRouter } from './server/freeMarketRoutes';

dotenv.config();

const __dirname = process.cwd();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ArthaBench Pro server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
