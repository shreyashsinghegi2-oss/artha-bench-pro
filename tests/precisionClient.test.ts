import { describe, expect, it, vi } from 'vitest';
import { calculate, PrecisionError, verifyCertificate } from '../src/lib/precision-client';

const certificate = {
  calculation: 'EMI',
  input: { principal: '5000000', annual_rate_pct: '8.25', months: 120 },
  output: { value: '61326.3125442320798315018378094', display: '₹61,326.31' },
  certification: {
    guaranteed_relative_error: '≤ 0.000001%',
    certified_relative_error: '7.18e-31',
    certified_absolute_error: '4.4e-26',
    certified_interval: ['61326.31254423207983150183780936', '61326.31254423207983150183780943'],
    interval_width: '7e-26',
    verification: {
      method_1: 'closed_form @ 30 digits',
      method_2: 'exact rational arithmetic',
      method_3: 'interval',
      max_disagreement: '1e-25',
      all_agree: true,
    },
    working_precision: '30 decimal digits',
    convergence: { iterations: 0, residual: '0' },
    timestamp: '2026-09-28T00:00:00Z',
    engine_version: 'precision-engine-1.0.0',
    scope: '',
    notes: [],
  },
};

const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('precision client', () => {
  it('returns display, full precision, interval and a badge that counts the methods', async () => {
    const fetchImpl = reply(200, certificate);
    const r = await calculate('emi', { principal: '5000000', annual_rate_pct: '8.25', months: 120 }, { fetchImpl });
    expect(r.display).toBe('₹61,326.31');
    expect(r.fullPrecision).toBe(certificate.output.value);
    expect(r.interval).toEqual(certificate.certification.certified_interval);
    expect(r.badge).toBe('Verified to 0.000001% (3 methods agree, interval width 7e-26)');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/precision/emi');
    expect(JSON.parse(String(init.body))).toEqual({ principal: '5000000', annual_rate_pct: '8.25', months: 120 });
  });

  it('refuses JS floating-point numbers before sending anything', async () => {
    const fetchImpl = reply(200, certificate);
    await expect(calculate('emi', { principal: 100000.5 as unknown as string, annual_rate_pct: '8', months: 12 }, { fetchImpl })).rejects.toThrow(
      /decimal string/,
    );
    await expect(calculate('xirr', { cashflows: [{ amount: 0.1 }] } as never, { fetchImpl })).rejects.toThrow(/decimal string/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [503, { configured: false }, 'not_configured'],
    [422, { verified: false, error: 'no single rate is correct' }, 'refused'],
    [422, { detail: [{ msg: 'Input should be a valid string' }] }, 'invalid'],
    [500, { error: 'boom' }, 'unavailable'],
  ])('maps HTTP %d to %s', async (status, body, kind) => {
    const err = await calculate('xirr', { cashflows: [] }, { fetchImpl: reply(status, body) }).catch((e) => e);
    expect(err).toBeInstanceOf(PrecisionError);
    expect(err.kind).toBe(kind);
  });

  it('treats a certificate without all_agree as a failed verification', async () => {
    const bad = { ...certificate, certification: { ...certificate.certification, verification: { all_agree: false } } };
    await expect(calculate('emi', {}, { fetchImpl: reply(200, bad) })).rejects.toThrow('Verification failed');
  });

  it('reports network failure as unavailable', async () => {
    const err = await calculate(
      'emi',
      {},
      {
        fetchImpl: vi.fn(async () => {
          throw new TypeError('offline');
        }),
      },
    ).catch((e) => e);
    expect(err.kind).toBe('unavailable');
  });

  it('verifyCertificate posts to /verify', async () => {
    const fetchImpl = reply(200, { valid: true, checks: ['ok'] });
    expect(await verifyCertificate(certificate as never, { fetchImpl })).toEqual({ valid: true, checks: ['ok'] });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('/api/precision/verify');
  });
});
