import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { bearer, verifyUser } from '../server/personalAccountRoutes';

const req = (authorization?: string) => ({ headers: authorization === undefined ? {} : { authorization } }) as unknown as Request;

describe('bearer()', () => {
  it.each([
    [undefined, null],
    ['', null],
    ['Basic abc', null],
    ['bearer abc', null],
    ['Bearer', null],
    ['Bearer abc', 'abc'],
    ['Bearer   padded  ', 'padded'],
    ['Bearer a.b.c', 'a.b.c'],
  ])('%s → %s', (header, want) => {
    const t = bearer(req(header as string | undefined));
    expect(want === null ? t === null || t === '' : t === want).toBe(true);
  });
});

describe('verifyUser()', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (status: number, body: unknown) => {
    const fn = vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', fn);
    return fn;
  };

  it('accepts a token Supabase recognises and forwards it with the anon key', async () => {
    const fn = stub(200, { id: 'user-1', email: 'x@example.com' });
    await expect(verifyUser('good')).resolves.toMatchObject({ id: 'user-1' });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/auth\/v1\/user$/);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer good');
    expect((init.headers as Record<string, string>).apikey).toBeTruthy();
  });

  it.each([
    ['expired / invalid (401)', 401, { msg: 'JWT expired' }],
    ['forbidden (403)', 403, {}],
    ['200 without a user id', 200, { aud: 'authenticated' }],
    ['non-JSON body', 200, '<html>oops</html>'],
    ['server error', 500, { error: 'down' }],
  ])('rejects: %s', async (_n, status, body) => {
    stub(status, body);
    await expect(verifyUser('t')).rejects.toThrow(/invalid or expired/);
  });

  it('propagates network failures as a rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    await expect(verifyUser('t')).rejects.toThrow();
  });
});
