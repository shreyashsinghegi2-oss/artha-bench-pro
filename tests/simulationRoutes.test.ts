import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { paramsFromCloses } from '../src/simulation/historical';
import { createSimulationRouter } from '../server/simulation/routes';
import { formToQuery, readForm } from '../src/components/simulation/SimulationPage';

function gbmCloses(years: number, mu: number, sigma: number, seed = 5) {
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const out: Array<{ date: string; close: number }> = [];
  let p = 10000;
  const dt = 1 / 252;
  for (let i = 0; i < years * 252; i += 1) {
    const z = Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
    p *= Math.exp((mu - sigma ** 2 / 2) * dt + sigma * Math.sqrt(dt) * z);
    out.push({ date: new Date(Date.UTC(2016, 0, 1) + i * (365.25 / 252) * 86_400_000).toISOString().slice(0, 10), close: p });
  }
  return out;
}

describe('historical parameters', () => {
  it('recovers volatility from simulated daily closes', () => {
    const p = paramsFromCloses(gbmCloses(10, 0.12, 0.18));
    expect(p.volatility).toBeGreaterThan(0.17);
    expect(p.volatility).toBeLessThan(0.19);
    expect(p.days).toBe(2520);
    // median growth of the model equals the historical CAGR (continuous)
    expect(Math.exp(p.expected_return - p.volatility ** 2 / 2) - 1).toBeCloseTo(p.cagr, 2);
  });
  it('rejects short series', () => {
    expect(() => paramsFromCloses(gbmCloses(0.5, 0.1, 0.2))).toThrow(/at least a year/);
  });
});

describe('GET /api/simulation/params', () => {
  let server: http.Server;
  let base = '';
  let fail = false;
  beforeAll(async () => {
    const app = express();
    app.use(
      '/api/simulation',
      createSimulationRouter(async () => {
        if (fail) throw new Error('Yahoo 403');
        return gbmCloses(10, 0.12, 0.16);
      }),
    );
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/simulation`;
  });
  afterAll(() => server.close());

  it('returns historical parameters with their source', async () => {
    const body = await (await fetch(`${base}/params`)).json();
    expect(body).toMatchObject({ asset: 'NIFTY 50', is_historical: true });
    expect(body.source).toMatch(/NIFTY 50 daily closes/);
  });
  it('falls back to labelled assumptions', async () => {
    fail = true;
    const body = await (await fetch(`${base}/params`)).json();
    expect(body).toMatchObject({ expected_return: 0.12, volatility: 0.16, is_historical: false });
    expect(body.source).toMatch(/assumption/);
  });
});

describe('share link helpers', () => {
  it('round-trips the form through the URL and ignores junk', () => {
    const f = { initial: 100000, monthly: 5000, years: 10, ret: 11.5, vol: 15, target: 5000000, seed: 42 };
    expect(readForm(`?${formToQuery(f)}`)).toEqual(f);
    expect(readForm('?years=abc&seed=7')).toEqual({ seed: 7 });
  });
});
