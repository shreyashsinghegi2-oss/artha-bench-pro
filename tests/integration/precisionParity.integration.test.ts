/**
 * Parity between the in-browser TypeScript calculators (IEEE-754 doubles) and the certified Python engine.
 * Shows how far the existing JS results are from the certified values, and that they agree to the paisa.
 * Skipped when Python or the engine's dependencies (fastapi, mpmath, sympy, uvicorn) are not installed.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import Decimal from 'decimal.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cagr, emi } from '../../src/services/calculators';
import { xirr } from '../../src/services/portfolio';
import { compareTaxRegimes } from '../../src/services/indiaTaxEngine';
import { createDefaultTaxProfile } from '../../src/services/taxWorkspaceStorage';

const ENGINE_DIR = path.resolve(__dirname, '../../precision-engine');
const available = spawnSync('python3', ['-c', 'import fastapi, mpmath, sympy, uvicorn'], { cwd: ENGINE_DIR }).status === 0;

let proc: ChildProcess | undefined;
let base = '';

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = createServer();
    s.listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });

async function post(kind: string, body: unknown) {
  const res = await fetch(`${base}/api/${kind}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

describe.skipIf(!available)('TS calculators vs certified precision engine', () => {
  beforeAll(async () => {
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    proc = spawn('python3', ['-m', 'uvicorn', 'app.main:app', '--port', String(port)], { cwd: ENGINE_DIR, stdio: 'ignore' });
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`${base}/health`)).ok) return;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error('precision engine did not start');
  }, 30_000);
  afterAll(() => proc?.kill());

  it.each([
    ['1000000', '8.5', 240],
    ['5000000', '8.25', 120],
    ['250000', '14', 36],
    ['75000', '0', 12],
    ['10000000', '10.75', 360],
  ])('EMI %s at %s%% for %d months matches to the paisa', async (p, rate, n) => {
    const { body } = await post('emi', { principal: p, annual_rate_pct: rate, months: n });
    const certified = new Decimal(body.output.value);
    const ts = emi(Number(p), Number(rate) / 100, n);
    expect(ts).toBe(certified.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber());
    expect(certified.minus(ts).abs().lte(0.005)).toBe(true);
  });

  it.each([
    ['100000', '250000', '5'],
    ['50000', '41000', '3'],
    ['1', '1000', '30'],
  ])('CAGR %s → %s over %s years: double precision is within 1e-12 relative of the certified value', async (b, e, y) => {
    const { body } = await post('cagr', { begin_value: b, end_value: e, years: y });
    const certified = new Decimal(body.output.value);
    const ts = new Decimal(cagr(Number(b), Number(e), Number(y)));
    expect(ts.minus(certified).abs().div(certified.abs()).lte(1e-12)).toBe(true);
  });

  it('XIRR: the TS solver is within 1e-7 of the certified rate (it stops at 1e-9 step size)', async () => {
    const flows = [
      { date: '2024-01-01', amount: '-100000' },
      { date: '2024-07-01', amount: '-50000' },
      { date: '2026-09-28', amount: '190000' },
    ];
    const { body } = await post('xirr', { cashflows: flows });
    const ts = xirr(flows.map((f) => ({ date: f.date, amount: Number(f.amount) })))!;
    expect(new Decimal(ts).minus(body.output.value).abs().lte(1e-7)).toBe(true);
  });

  it.each(['500000', '1275000', '1850000', '2400000', '4999990'])(
    'new-regime tax on salary %s matches the TS engine exactly (below the surcharge threshold, income a multiple of ₹10)',
    async (gross) => {
      const { body } = await post('tax', { gross_income: gross, regime: 'new' });
      const profile = { ...createDefaultTaxProfile(), financialYear: 'FY2026-27' as const };
      const source = {
        id: 's',
        type: 'Salary' as const,
        amount: Number(gross),
        currency: 'INR',
        frequency: 'Annually' as const,
        description: 'Salary',
        taxStatus: 'Pre-tax' as const,
        startDate: '2026-04-01',
        tags: [],
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      };
      const ts = compareTaxRegimes([source], profile, [], []).new.totalTaxLiability;
      expect(new Decimal(body.output.value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString()).toBe(ts);
    },
  );
});
