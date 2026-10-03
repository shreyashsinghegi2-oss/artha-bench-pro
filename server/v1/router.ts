/**
 * /api/v1 — the public ArthaBench API.
 *
 * - Open CORS; calculators and market data need no key and are edge-cached for 60 seconds.
 * - Rate limits (per server instance): 100 requests/minute per IP, 1000/minute per valid API key.
 * - Every JSON response uses the envelope in ./envelope.ts; errors use { error: { code, message }, timestamp }.
 */
import express, { type NextFunction, type Request, type Response, Router } from 'express';
import { ZodError } from 'zod';
import { groundingMiddleware } from '../liveGrounding';
import { benchmarkBodySchema, cfoBodySchema, cfoBrief, runBenchmark } from './ai';
import { optionalApiKey, requireApiKey, type ApiLocals } from './auth';
import { CalcError, CALCULATORS, calculatorBySlug } from './calculators';
import { envelope, errorBody } from './envelope';
import { btcQuote, fiiDiiFlows, niftyQuote, sectorRotation, sourceHealth, SourceUnavailableError } from './market';
import { buildOpenApi, SWAGGER_HTML } from './openapi';
import { ParamError, parseParams } from './params';
import { createWebhook, createWebhookSchema, cronAuthorized, deleteWebhook, listWebhooks, runWebhooks, WebhookError } from './webhooks';

export const FREE_LIMIT_PER_MIN = 100;
export const KEY_LIMIT_PER_MIN = 1000;
const STARTED_AT = Date.now();

type Res = Response<unknown, ApiLocals>;
type Handler = (req: Request, res: Res) => Promise<void> | void;
const wrap = (fn: Handler) => (req: Request, res: Res, next: NextFunction) => {
  Promise.resolve(fn(req, res)).catch(next);
};

/* ---------------- Rate limiting ---------------- */

const windows = new Map<string, { count: number; reset: number }>();
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, w] of windows) if (w.reset <= now) windows.delete(k);
}, 60_000);
sweep.unref?.();

export function resetRateLimitsForTests(): void {
  windows.clear();
}

function clientIp(req: Request): string {
  const fwd = req.header('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

function rateLimit(req: Request, res: Res, next: NextFunction): void {
  const keyId = res.locals.apiKeyId;
  const limit = keyId ? KEY_LIMIT_PER_MIN : FREE_LIMIT_PER_MIN;
  const bucket = keyId ? `key:${keyId}` : `ip:${clientIp(req)}`;
  const now = Date.now();
  let w = windows.get(bucket);
  if (!w || w.reset <= now) {
    w = { count: 0, reset: now + 60_000 };
    windows.set(bucket, w);
  }
  w.count += 1;
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - w.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(w.reset / 1000)));
  if (w.count > limit) {
    res.setHeader('Retry-After', String(Math.ceil((w.reset - now) / 1000)));
    res
      .status(429)
      .json(
        errorBody(
          'rate_limited',
          keyId
            ? `Limit of ${limit} requests a minute reached for this API key.`
            : `Limit of ${limit} requests a minute reached for this IP. Use an API key for ${KEY_LIMIT_PER_MIN} a minute.`,
        ),
      );
    return;
  }
  next();
}

/* ---------------- Router ---------------- */

const cache60 = (res: Res) => res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=60');
const noStore = (res: Res) => res.setHeader('Cache-Control', 'no-store');

export const v1Router = Router();
v1Router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});
v1Router.use(express.json({ limit: '64kb' }));
v1Router.use(optionalApiKey);
v1Router.use(rateLimit);

v1Router.get('/calculators', (_req, res: Res) => {
  cache60(res);
  res.json(
    envelope(
      CALCULATORS.map((c) => ({ slug: c.slug, summary: c.summary, formula: c.formula, path: `/api/v1/calculators/${c.slug}`, params: c.params })),
      'ArthaBench calculator registry',
      100,
      true,
    ),
  );
});

v1Router.get('/calculators/:slug', (req, res: Res) => {
  const def = calculatorBySlug(req.params.slug ?? '');
  if (!def) {
    res.status(404).json(errorBody('unknown_calculator', `No calculator "${req.params.slug}". See /api/v1/calculators for the list.`));
    return;
  }
  const values = parseParams(def.params, req.query as Record<string, unknown>);
  const usedAssumedDefault = (def.assumedDefaults ?? []).some((name) => req.query[name] === undefined);
  const data = def.compute(values);
  cache60(res);
  res.json(envelope({ ...data, inputs: values }, def.source, usedAssumedDefault ? 90 : 100, true));
});

const market = (fn: () => Promise<unknown>) =>
  wrap(async (_req, res) => {
    const result = await fn();
    cache60(res);
    res.json(result);
  });
v1Router.get('/market/nifty', market(niftyQuote));
v1Router.get('/market/btc', market(btcQuote));
v1Router.get(
  '/market/fii-dii',
  market(() => fiiDiiFlows()),
);
v1Router.get(
  '/market/sector-rotation',
  market(() => sectorRotation()),
);

v1Router.get(
  '/health',
  wrap(async (_req, res) => {
    const sources = await sourceHealth();
    const status = Object.values(sources).every((s) => s === 'ok') ? 'ok' : 'degraded';
    noStore(res);
    res.json(
      envelope({ status, uptime_s: Math.round((Date.now() - STARTED_AT) / 1000), sources }, 'ArthaBench API live probes', status === 'ok' ? 100 : 70, false),
    );
  }),
);

v1Router.get('/openapi.json', (_req, res: Res) => {
  cache60(res);
  res.json(buildOpenApi());
});
v1Router.get('/docs', (_req, res: Res) => {
  cache60(res);
  res.type('html').send(SWAGGER_HTML);
});

v1Router.post(
  '/ai/cfo',
  requireApiKey,
  groundingMiddleware,
  wrap(async (req, res) => {
    noStore(res);
    res.json(await cfoBrief(cfoBodySchema.parse(req.body)));
  }),
);
v1Router.post(
  '/ai/benchmark',
  requireApiKey,
  wrap(async (req, res) => {
    noStore(res);
    res.json(await runBenchmark(benchmarkBodySchema.parse(req.body)));
  }),
);

const cronRun = wrap(async (req, res) => {
  noStore(res);
  if (!cronAuthorized(req.header('authorization'))) {
    res.status(401).json(errorBody('unauthorized', 'Webhook runs need Authorization: Bearer <CRON_SECRET>.'));
    return;
  }
  res.json(envelope(await runWebhooks(), 'ArthaBench webhook runner', 100, false));
});
v1Router.get('/webhooks/run', cronRun);
v1Router.post('/webhooks/run', cronRun);
v1Router.get(
  '/webhooks',
  requireApiKey,
  wrap(async (_req, res) => {
    noStore(res);
    res.json(envelope(await listWebhooks(res.locals.apiKeyId ?? ''), 'ArthaBench webhooks', 100, true));
  }),
);
v1Router.post(
  '/webhooks',
  requireApiKey,
  wrap(async (req, res) => {
    noStore(res);
    res.status(201).json(envelope(await createWebhook(res.locals.apiKeyId ?? '', createWebhookSchema.parse(req.body)), 'ArthaBench webhooks', 100, true));
  }),
);
v1Router.delete(
  '/webhooks/:id',
  requireApiKey,
  wrap(async (req, res) => {
    noStore(res);
    const deleted = await deleteWebhook(res.locals.apiKeyId ?? '', req.params.id ?? '');
    if (!deleted) {
      res.status(404).json(errorBody('not_found', 'No webhook with that id for this API key.'));
      return;
    }
    res.json(envelope({ deleted: true }, 'ArthaBench webhooks', 100, true));
  }),
);

v1Router.use((req, res: Res) => {
  res.status(404).json(errorBody('not_found', `No endpoint ${req.method} /api/v1${req.path}. See /api/v1/docs.`));
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express needs four arguments to treat this as the error handler
v1Router.use((err: unknown, _req: Request, res: Res, _next: NextFunction) => {
  noStore(res);
  if (err instanceof ParamError)
    return void res.status(400).json(errorBody('invalid_parameters', 'Some query parameters are missing or invalid.', err.details));
  if (err instanceof ZodError) {
    const details = Object.fromEntries(err.issues.map((i) => [i.path.join('.') || 'body', i.message]));
    return void res.status(400).json(errorBody('invalid_body', 'The request body is invalid.', details));
  }
  if (err instanceof SyntaxError) return void res.status(400).json(errorBody('invalid_json', 'The request body is not valid JSON.'));
  if (err instanceof CalcError) return void res.status(422).json(errorBody('not_calculable', err.message));
  if (err instanceof SourceUnavailableError) return void res.status(503).json(errorBody('source_unavailable', err.message));
  if (err instanceof WebhookError) return void res.status(err.status).json(errorBody('webhook_error', err.message));
  console.error('[api/v1] unexpected error', err);
  res.status(500).json(errorBody('internal_error', 'Something went wrong on our side.'));
});
