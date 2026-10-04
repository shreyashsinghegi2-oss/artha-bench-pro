/**
 * Edge cases for EMI, CAGR and XIRR, checked against independent reference implementations
 * (amortisation schedule, compounding back-substitution, NPV = 0) rather than hard-coded outputs alone.
 */
import { describe, expect, it } from 'vitest';
import { cagr, emi } from '../src/services/calculators';
import { xirr } from '../src/services/portfolio';

/** Balance left after paying `payment` for `months` at monthly rate r. */
function amortise(principal: number, annual: number, months: number, payment: number) {
  let bal = principal;
  const r = annual / 12;
  for (let i = 0; i < months; i++) bal = bal * (1 + r) - payment;
  return bal;
}

describe('EMI — reference: the EMI must amortise the loan to ~0 in exactly n months', () => {
  const cases: Array<[number, number, number]> = [];
  for (const p of [10_000, 1_00_000, 5_00_000, 25_00_000, 1_00_00_000]) {
    for (const rate of [0.0001, 0.065, 0.085, 0.105, 0.18, 0.36]) {
      for (const n of [1, 12, 60, 240]) cases.push([p, rate, n]);
    }
  }
  it(`covers ${cases.length} principal × rate × tenure combinations`, () => expect(cases.length).toBeGreaterThanOrEqual(100));
  it.each(cases)('P=%d rate=%d n=%d', (p, rate, n) => {
    const e = emi(p, rate, n);
    expect(e).toBeGreaterThan(0);
    // Rounding the EMI to paise leaves at most n × ₹0.005 compounding; allow that plus float noise.
    const leftover = amortise(p, rate, n, e);
    expect(Math.abs(leftover)).toBeLessThan(n * 0.005 * (1 + rate / 12) ** n + 1e-6);
    expect(Number.isInteger(Math.round(e * 100))).toBe(true);
    expect(e * n).toBeGreaterThanOrEqual(p - 0.01); // never pay back less than borrowed
  });

  it.each([
    [10_00_000, 0.085, 240, 8678.23],
    [50_00_000, 0.09, 360, 40231.1],
    [1_00_000, 0.12, 12, 8884.88],
    [5_00_000, 0.105, 60, 10746.95],
  ])('known value P=%d rate=%d n=%d → %d', (p, r, n, want) => expect(emi(p, r, n)).toBeCloseTo(want, 1));

  it.each([
    [1_20_000, 12, 10_000],
    [1_00_000, 7, 14285.71],
    [1, 3, 0.33],
    [99_999, 1, 99_999],
  ])('zero rate splits principal evenly: %d over %d', (p, n, want) => expect(emi(p, 0, n)).toBe(want));

  it('one month = principal plus one month of interest', () => expect(emi(1_00_000, 0.12, 1)).toBe(101_000));

  it.each([
    [0, 0.1, 12],
    [-5000, 0.1, 12],
    [1_00_000, 0.1, 0],
    [1_00_000, 0.1, -12],
    [Number.NaN, 0.1, 12],
    [1_00_000, Number.NaN, 12],
    [1_00_000, 0.1, Number.NaN],
    [Number.POSITIVE_INFINITY, 0.1, 12],
    [1_00_000, Number.POSITIVE_INFINITY, 12],
    [1_00_000, 0.1, Number.POSITIVE_INFINITY],
  ])('invalid input (%d, %d, %d) returns 0', (p, r, n) => expect(emi(p, r, n)).toBe(0));

  it('is monotonic in rate, principal and (inversely) tenure', () => {
    for (let r = 0.01; r < 0.3; r += 0.01) expect(emi(10_00_000, r + 0.01, 120)).toBeGreaterThan(emi(10_00_000, r, 120));
    for (let n = 12; n < 360; n += 12) expect(emi(10_00_000, 0.09, n + 12)).toBeLessThan(emi(10_00_000, 0.09, n));
    expect(emi(20_00_000, 0.09, 120)).toBeCloseTo(2 * emi(10_00_000, 0.09, 120), 1);
  });

  it('long tenure approaches pure interest (P × r/12)', () => {
    expect(emi(10_00_000, 0.12, 1200)).toBeCloseTo(10_000, 0);
  });
});

describe('CAGR — reference: start × (1 + cagr)^years must equal end', () => {
  const cases: Array<[number, number, number]> = [];
  for (const start of [1, 1000, 1_00_000, 1_00_00_000]) {
    for (const mult of [0.01, 0.5, 0.9, 1, 1.1, 2, 10, 100]) {
      for (const years of [0.25, 1, 3, 10]) cases.push([start, start * mult, years]);
    }
  }
  it(`covers ${cases.length} combinations`, () => expect(cases.length).toBeGreaterThanOrEqual(100));
  it.each(cases)('start=%d end=%d years=%d', (s, e, y) => {
    const g = cagr(s, e, y);
    expect(Number.isFinite(g)).toBe(true);
    expect(g).toBeGreaterThan(-1);
    expect(s * (1 + g) ** y).toBeCloseTo(e, Math.max(0, 8 - Math.ceil(Math.log10(e + 1))));
  });

  it.each([
    [100, 200, 1, 1],
    [100, 121, 2, 0.1],
    [100, 100, 7, 0],
    [100, 50, 1, -0.5],
    [1_00_000, 2_00_000, 6, 2 ** (1 / 6) - 1],
  ])('known %d → %d over %d years = %d', (s, e, y, want) => expect(cagr(s, e, y)).toBeCloseTo(want, 12));

  it.each([
    [0, 100, 1],
    [-100, 100, 1],
    [100, 0, 1],
    [100, -5, 1],
    [100, 200, 0],
    [100, 200, -1],
    [Number.NaN, 1, 1],
    [1, Number.NaN, 1],
    [1, 1, Number.NaN],
    [1, Number.POSITIVE_INFINITY, 1],
    [Number.POSITIVE_INFINITY, 1, 1],
    [1, 2, Number.POSITIVE_INFINITY],
  ])('invalid (%d, %d, %d) → NaN', (s, e, y) => expect(cagr(s, e, y)).toBeNaN());

  it('longer holding period for the same gain means lower CAGR', () => {
    for (let y = 1; y < 30; y++) expect(cagr(100, 300, y + 1)).toBeLessThan(cagr(100, 300, y));
  });
});

describe('XIRR — reference: NPV at the returned rate is ~0', () => {
  const day = (d: number) => new Date(Date.UTC(2020, 0, 1) + d * 86_400_000).toISOString().slice(0, 10);
  const npv = (flows: Array<{ date: string; amount: number }>, r: number) => {
    const t0 = Math.min(...flows.map((f) => Date.parse(f.date)));
    return flows.reduce((s, f) => s + f.amount / (1 + r) ** ((Date.parse(f.date) - t0) / (365 * 86_400_000)), 0);
  };

  const cases: Array<[string, Array<{ date: string; amount: number }>]> = [];
  for (const growth of [0.2, 0.5, 0.9, 1, 1.05, 1.1, 1.5, 2, 5]) {
    for (const days of [30, 365, 1000, 3650])
      if (!(growth === 0.2 && days === 30))
        cases.push([
          `lump ×${growth} over ${days}d`,
          [
            { date: day(0), amount: -10_000 },
            { date: day(days), amount: 10_000 * growth },
          ],
        ]);
  }
  for (const final of [50_000, 60_000, 66_000, 80_000]) {
    for (const months of [6, 12, 60]) {
      const flows = Array.from({ length: months }, (_, i) => ({ date: day(i * 30), amount: -(final / months / 1.1) }));
      cases.push([`SIP ${months}m → ${final}`, [...flows, { date: day(months * 30 + 10), amount: final }]]);
    }
  }
  cases.push([
    'withdrawal mid-way',
    [
      { date: day(0), amount: -1_00_000 },
      { date: day(200), amount: 20_000 },
      { date: day(400), amount: -10_000 },
      { date: day(730), amount: 1_10_000 },
    ],
  ]);
  cases.push([
    'two-year doubling in quarterly top-ups',
    [0, 91, 182, 273].map((d) => ({ date: day(d), amount: -2_500 })).concat({ date: day(730), amount: 20_000 }),
  ]);
  cases.push([
    'unsorted input',
    [
      { date: day(730), amount: 12_100 },
      { date: day(0), amount: -10_000 },
    ],
  ]);

  it(`covers ${cases.length} cash-flow patterns`, () => expect(cases.length).toBeGreaterThanOrEqual(50));
  it.each(cases)('%s', (_name, flows) => {
    const r = xirr(flows);
    expect(r).not.toBeNull();
    const scale = Math.max(...flows.map((f) => Math.abs(f.amount)));
    expect(Math.abs(npv(flows, r!))).toBeLessThan(scale * 1e-5);
  });

  it.each([
    [
      [
        { date: day(0), amount: -1000 },
        { date: day(365), amount: 1100 },
      ],
      0.1,
    ],
    [
      [
        { date: day(0), amount: -1000 },
        { date: day(730), amount: 1210 },
      ],
      0.1,
    ],
    [
      [
        { date: day(0), amount: -1000 },
        { date: day(365), amount: 500 },
      ],
      -0.5,
    ],
    [
      [
        { date: day(0), amount: -1000 },
        { date: day(365), amount: 1000 },
      ],
      0,
    ],
  ])('known case %#', (flows, want) => expect(xirr(flows)).toBeCloseTo(want, 6));

  it.each<[string, Array<{ date: string; amount: number }>]>([
    ['empty', []],
    ['single flow', [{ date: day(0), amount: -1000 }]],
    [
      'only outflows',
      [
        { date: day(0), amount: -1000 },
        { date: day(10), amount: -5 },
      ],
    ],
    [
      'only inflows',
      [
        { date: day(0), amount: 1000 },
        { date: day(10), amount: 5 },
      ],
    ],
    [
      'same day',
      [
        { date: day(0), amount: -1000 },
        { date: day(0), amount: 1100 },
      ],
    ],
    [
      'zero amounts only',
      [
        { date: day(0), amount: 0 },
        { date: day(10), amount: 0 },
      ],
    ],
    [
      'invalid dates',
      [
        { date: 'not a date', amount: -1000 },
        { date: 'nope', amount: 1100 },
      ],
    ],
    [
      'NaN amounts',
      [
        { date: day(0), amount: Number.NaN },
        { date: day(10), amount: 1100 },
      ],
    ],
  ])('%s → null', (_n, flows) => expect(xirr(flows)).toBeNull());

  it('returns null when the annualised loss is beyond the −99.99% solver floor (−80% in 30 days)', () => {
    expect(
      xirr([
        { date: day(0), amount: -10_000 },
        { date: day(30), amount: 2_000 },
      ]),
    ).toBeNull();
  });

  it('ignores zero, NaN and invalid-date rows when a valid pair remains', () => {
    const r = xirr([
      { date: day(0), amount: -1000 },
      { date: day(100), amount: 0 },
      { date: 'bad', amount: 50 },
      { date: day(200), amount: Number.NaN },
      { date: day(365), amount: 1100 },
    ]);
    expect(r).toBeCloseTo(0.1, 6);
  });

  it('a bigger final value always means a higher XIRR', () => {
    let prev = -Infinity;
    for (let v = 500; v <= 5000; v += 250) {
      const r = xirr([
        { date: day(0), amount: -1000 },
        { date: day(500), amount: v },
      ])!;
      expect(r).toBeGreaterThan(prev);
      prev = r;
    }
  });
});
