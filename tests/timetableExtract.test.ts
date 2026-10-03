import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { allowedOrigin, cleanRows, createTimetableRouter } from '../server/timetable/routes';

describe('cleanRows', () => {
  it('normalises days and times, drops junk, sorts by day then time', () => {
    const rows = cleanRows({
      rows: [
        { day: 'tuesday', start: '2:00 pm', end: '2:50 PM', subject: 'Physics' },
        { day: 'Mon', start: '9.00', end: '09:50', subject: 'Maths', teacher: 'Mr Rao', room: '' },
        { day: 'Xyz', start: '9:00', end: '10:00', subject: 'Bad' },
        { day: 'Mon', start: '10:00', end: '09:00', subject: 'Backwards' },
        'junk',
      ],
    });
    expect(rows).toEqual([
      { day: 'Mon', start: '09:00', end: '09:50', subject: 'Maths', teacher: 'Mr Rao' },
      { day: 'Tue', start: '14:00', end: '14:50', subject: 'Physics' },
    ]);
    expect(cleanRows(null)).toEqual([]);
  });
  it('allows only the timetable site origins', () => {
    expect(allowedOrigin('https://term-timetable.vercel.app')).toBe(true);
    expect(allowedOrigin('https://term-timetable-abc123-team.vercel.app')).toBe(true);
    expect(allowedOrigin('https://evil.example.com')).toBe(false);
    expect(allowedOrigin(undefined)).toBe(false);
  });
});

describe('POST /api/timetable/extract', () => {
  let server: http.Server;
  let base = '';
  const calls: string[] = [];
  const fetchImpl = (async (u: string | URL | Request, init?: RequestInit) => {
    const url = String(u);
    calls.push(url);
    if (url.includes('timetable_login')) {
      const pw = JSON.parse(String(init?.body)).p_password;
      return new Response(JSON.stringify(pw === '2402' ? { ok: true } : { ok: false, error: 'Wrong password.' }), { status: 200 });
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify({ rows: [{ day: 'Mon', start: '09:00', end: '09:50', subject: 'Maths' }] }) } }] }),
      { status: 200 },
    );
  }) as typeof fetch;
  beforeAll(async () => {
    vi.stubEnv('GROQ_API_KEY', 'k');
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/api/timetable', createTimetableRouter({ fetchImpl }));
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/timetable`;
  });
  afterAll(() => {
    server.close();
    vi.unstubAllEnvs();
  });
  const post = (body: unknown, origin = 'https://term-timetable.vercel.app') =>
    fetch(`${base}/extract`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
  const img = 'data:image/png;base64,iVBORw0KGgo=';

  it('rejects a wrong password before calling the AI', async () => {
    calls.length = 0;
    const res = await post({ password: '1111', image: img });
    expect(res.status).toBe(401);
    expect(calls.some((c) => c.includes('groq'))).toBe(false);
  });
  it('returns cleaned rows for the admin, with CORS for the timetable site', async () => {
    const res = await post({ password: '2402', image: img });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://term-timetable.vercel.app');
    expect((await res.json()).rows).toEqual([{ day: 'Mon', start: '09:00', end: '09:50', subject: 'Maths' }]);
  });
  it('rejects non-images', async () => {
    expect((await post({ password: '2402', image: 'data:text/html;base64,PGh0bWw+' })).status).toBe(400);
  });
});
