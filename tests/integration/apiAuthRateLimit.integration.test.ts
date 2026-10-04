/** Real HTTP through Express: rate limiter → auth → route response. Supabase is stubbed at the fetch layer. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRateLimiter } from '../../server/rateLimiter';
import { personalAccountRouter } from '../../server/personalAccountRoutes';

let server: http.Server;
let port: number;

function call(method: string, path: string, headers: Record<string, string> = {}, ip = '203.0.113.1') {
  return new Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path, headers: { 'x-forwarded-for': ip, ...headers } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode!, body: data ? JSON.parse(data) : null, headers: res.headers }));
    });
    r.on('error', reject);
    r.end();
  });
}

beforeAll(async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Only Supabase calls are stubbed; the test's own HTTP goes through node:http, not fetch.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      return auth === 'Bearer valid-token'
        ? new Response(JSON.stringify({ id: 'user-123' }), { status: 200 })
        : new Response(JSON.stringify({ msg: 'invalid JWT' }), { status: 401 });
    }),
  );
  const app = express();
  app.use(express.json());
  app.use('/api', createRateLimiter({ windowMs: 60_000, max: 5, message: 'Slow down.' }), personalAccountRouter);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => {
  vi.unstubAllGlobals();
  server?.close();
});

describe('API: auth → rate limit → response', () => {
  it('401 without a token', async () => {
    const r = await call('DELETE', '/api/account/delete', {}, '198.51.100.1');
    expect(r.status).toBe(401);
    expect(r.headers['x-ratelimit-limit']).toBe('5');
  });

  it('401 with an invalid or expired token', async () => {
    const r = await call('DELETE', '/api/account/delete', { authorization: 'Bearer expired' }, '198.51.100.2');
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/invalid or expired/);
  });

  it('a valid token passes auth and reaches the handler (503: service role deliberately not configured)', async () => {
    const r = await call('DELETE', '/api/account/delete', { authorization: 'Bearer valid-token' }, '198.51.100.3');
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('429 after the per-IP limit, before auth runs, and other IPs are unaffected', async () => {
    const ip = '198.51.100.9';
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await call('DELETE', '/api/account/delete', {}, ip)).status);
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses.slice(5)).toEqual([429, 429]);
    expect((await call('DELETE', '/api/account/delete', {}, '198.51.100.10')).status).toBe(401);
  });
});
