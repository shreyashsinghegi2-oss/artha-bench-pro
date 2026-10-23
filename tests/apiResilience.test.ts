import { describe, expect, it } from 'vitest';
import { fitNewsQuery } from '../server/providers/newsProvider';
import { postWithRetry } from '../server/groqService';

const reply = (status: number) => new Response('{}', { status });

describe('news query length', () => {
  it('keeps short queries and cuts long ones to 100 characters at a word', () => {
    expect(fitNewsQuery('markets')).toBe('markets');
    const long = '(business OR finance OR markets OR economy OR companies OR stocks OR crypto OR technology OR AI OR central bank)';
    const fitted = fitNewsQuery(long);
    expect(long.length).toBeGreaterThan(100);
    expect(fitted.length).toBeLessThanOrEqual(100);
    expect(fitted).not.toMatch(/\b(OR|AND)\)?$/);
    expect((fitted.match(/\(/g) ?? []).length).toBe((fitted.match(/\)/g) ?? []).length);
  });
});

describe('Groq retry', () => {
  it('retries once after a timeout and returns the second answer', async () => {
    let calls = 0;
    const response = await postWithRetry(async () => { calls += 1; if (calls === 1) throw new Error('timeout'); return reply(200); });
    expect(calls).toBe(2);
    expect(response.status).toBe(200);
  });

  it('retries a rate limit once and then gives up with the last response', async () => {
    let calls = 0;
    const response = await postWithRetry(async () => { calls += 1; return reply(429); });
    expect(calls).toBe(2);
    expect(response.status).toBe(429);
  });

  it('does not retry a client error', async () => {
    let calls = 0;
    await postWithRetry(async () => { calls += 1; return reply(400); });
    expect(calls).toBe(1);
  });

  it('throws the last error when both attempts fail', async () => {
    await expect(postWithRetry(async () => { throw new Error('down'); })).rejects.toThrow('down');
  });
});
