import type { Request, Response } from 'express';
import express from 'express';

type ApiApp = ReturnType<typeof express>;

let appPromise: Promise<ApiApp> | undefined;

function getApp() {
  if (!appPromise) {
    appPromise = import('../server/routes').then(({ apiRouter }) => {
      const app = express();
      app.disable('x-powered-by');
      app.use(express.json({ limit: '2mb' }));
      app.use('/api', apiRouter);
      return app;
    });
  }

  return appPromise;
}

function safeStartupMessage(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown startup error';

  return message
    .replace(/(GROQ|BUSINESS_NEWS|MARKET_DATA)_API_KEY\s*=?\s*\S*/gi, '$1_API_KEY=[redacted]')
    .slice(0, 300);
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    // Keep the function alive and expose only a short, secret-safe startup error.
    appPromise = undefined;
    console.error('API bootstrap failed', error);
    return res.status(500).json({
      error: 'API bootstrap failed',
      detail: safeStartupMessage(error),
    });
  }
}
