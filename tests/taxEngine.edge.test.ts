/**
 * India income-tax edge cases (FY 2026-27 rules), salary only, resident individual below 60.
 * The reference below is written independently of the engine in exact integer arithmetic
 * (amounts scaled by 1,000,000) from the published slab tables, so float or Decimal slips in the
 * engine show up as mismatches rather than being baked into expected values.
 */
import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { FY2026_27_RULES } from '../src/config/taxRules/india/FY2026_27';
import { calculateCess, calculateSlabTax, calculateSurcharge, compareTaxRegimes } from '../src/services/indiaTaxEngine';
import type { IncomeSource } from '../src/services/incomeStorage';
import { createDefaultTaxProfile } from '../src/services/taxWorkspaceStorage';

const NEW = [
  [4_00_000, 0],
  [8_00_000, 5],
  [12_00_000, 10],
  [16_00_000, 15],
  [20_00_000, 20],
  [24_00_000, 25],
  [Infinity, 30],
] as const;
const OLD = [
  [2_50_000, 0],
  [5_00_000, 5],
  [10_00_000, 20],
  [Infinity, 30],
] as const;

/** Slab tax in units of ₹1/100 (percent rates on whole-rupee incomes are exact). */
function slab100(income: number, table: ReadonlyArray<readonly [number, number]>) {
  let tax = 0,
    lower = 0;
  for (const [upTo, pct] of table) {
    if (income <= lower) break;
    tax += (Math.min(income, upTo) - lower) * pct;
    lower = upTo;
  }
  return tax;
}
const roundHalfUp = (units: number, per: number) => Math.floor((units + per / 2) / per);

/** Reference liability for salary-only income below the surcharge threshold. */
function reference(gross: number, regime: 'new' | 'old') {
  const taxable = Math.max(0, gross - (regime === 'new' ? 75_000 : 50_000));
  const tax = slab100(taxable, regime === 'new' ? NEW : OLD);
  let rebate = 0;
  if (regime === 'new') {
    if (taxable <= 12_00_000) rebate = Math.min(tax, 60_000 * 100);
    else rebate = Math.max(0, tax - (taxable - 12_00_000) * 100); // marginal relief
  } else if (taxable <= 5_00_000) rebate = Math.min(tax, 12_500 * 100);
  const after = tax - rebate;
  return { taxable, total: roundHalfUp(after * 104, 100 * 100) }; // + 4% cess
}

function salary(annual: number): IncomeSource {
  return {
    id: 's',
    type: 'Salary',
    amount: annual,
    currency: 'INR',
    frequency: 'Annually',
    description: 'Salary',
    taxStatus: 'Pre-tax',
    startDate: '2026-04-01',
    tags: [],
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  };
}
const profile = () => ({ ...createDefaultTaxProfile(), financialYear: 'FY2026-27' as const });
const engine = (gross: number) => compareTaxRegimes([salary(gross)], profile(), [], []);

// Every slab edge ±1 (in gross terms, so the standard deduction is included), rebate edges, and a spread.
const edges = new Set<number>([0, 1, 50_000, 74_999, 75_000, 75_001]);
for (const t of [2_50_000, 4_00_000, 5_00_000, 8_00_000, 10_00_000, 12_00_000, 16_00_000, 20_00_000, 24_00_000]) {
  for (const sd of [75_000, 50_000]) for (const d of [-1, 0, 1]) edges.add(t + sd + d);
}
for (const extra of [100, 1_000, 10_000, 50_000, 70_000, 71_000, 80_000]) edges.add(12_75_000 + extra); // marginal-relief zone
for (let g = 3_00_000; g <= 49_00_000; g += 1_37_457) edges.add(g);
const grossCases = [...edges].filter((g) => g <= 50_00_000).sort((a, b) => a - b);

describe('slab tax against the reference', () => {
  it(`covers ${grossCases.length} gross incomes`, () => expect(grossCases.length).toBeGreaterThanOrEqual(50));

  it.each(grossCases)('new regime, gross ₹%d', (gross) => {
    const ref = reference(gross, 'new');
    const r = engine(gross).new;
    expect(r.taxableIncome).toBe(String(ref.taxable));
    expect(Number(r.totalTaxLiability)).toBe(ref.total);
  });

  it.each(grossCases)('old regime, gross ₹%d', (gross) => {
    const ref = reference(gross, 'old');
    const r = engine(gross).old;
    expect(r.taxableIncome).toBe(String(ref.taxable));
    expect(Number(r.totalTaxLiability)).toBe(ref.total);
  });
});

describe('statutory anchor points (FY 2026-27, new regime)', () => {
  it.each([
    [12_75_000, 0], // exactly ₹12,00,000 taxable: full ₹60,000 rebate
    [12_75_001, 1], // ₹1 over: marginal relief caps tax at the excess (₹1 + cess rounds to ₹1)
    [12_85_000, 10_400], // ₹10,000 over → ₹10,000 + 4% cess
    [4_75_000, 0],
    [24_75_000, 3_00_000 * 1.04],
  ])('gross ₹%d → ₹%d', (gross, want) => expect(Number(engine(gross).new.totalTaxLiability)).toBe(want));

  it('slab tax on ₹24,00,000 is ₹3,00,000', () => {
    expect(calculateSlabTax(new Decimal(24_00_000), FY2026_27_RULES.slabs.new).toNumber()).toBe(3_00_000);
  });
});

describe('properties', () => {
  it('liability never decreases as income rises (up to ₹50,00,000)', () => {
    for (const regime of ['new', 'old'] as const) {
      let prev = -1;
      for (let g = 0; g <= 50_00_000; g += 5_000) {
        const t = reference(g, regime).total;
        expect(t).toBeGreaterThanOrEqual(prev);
        prev = t;
      }
    }
    let prev = -1;
    for (let g = 11_00_000; g <= 14_00_000; g += 2_500) {
      const t = Number(engine(g).new.totalTaxLiability);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it('marginal relief: extra tax never exceeds extra income above ₹12,00,000', () => {
    for (let over = 1; over <= 80_000; over += 997) {
      const tax = Number(engine(12_75_000 + over).new.totalTaxLiability);
      expect(tax).toBeLessThanOrEqual(Math.round(over * 1.04) + 1);
    }
  });

  it('effective rate stays under 31.2% (30% + cess) without surcharge', () => {
    for (const g of grossCases.filter((x) => x > 0)) {
      const r = engine(g);
      expect(Number(r.new.totalTaxLiability) / g).toBeLessThan(0.312);
      expect(Number(r.old.totalTaxLiability) / g).toBeLessThan(0.312);
    }
  });

  it('regime comparison reports the cheaper regime and the exact difference', () => {
    for (const g of grossCases) {
      const c = engine(g);
      const o = Number(c.old.totalTaxLiability),
        n = Number(c.new.totalTaxLiability);
      expect(c.lowerEstimatedRegime).toBe(o === n ? 'same' : o < n ? 'old' : 'new');
      expect(Number(c.estimatedDifference)).toBe(Math.abs(o - n));
    }
  });

  it('negative and zero incomes produce zero tax, never negative', () => {
    for (const g of [0, -1, -10_00_000]) {
      const c = engine(g);
      expect(Number(c.new.totalTaxLiability)).toBe(0);
      expect(Number(c.old.totalTaxLiability)).toBe(0);
    }
  });
});

describe('surcharge and cess', () => {
  const R = FY2026_27_RULES;
  it.each([
    [50_00_000, 0],
    [50_00_001, 0.1],
    [1_00_00_001, 0.15],
    [2_00_00_001, 0.25],
    [5_00_00_001, 0.37],
  ])('old regime: income ₹%d → rate %d', (income, rate) => {
    const s = calculateSurcharge(new Decimal(income), new Decimal(10_00_000), 'old', R);
    expect(s.toNumber()).toBeCloseTo(10_00_000 * rate, 6);
  });

  it('new regime caps surcharge at 25% above ₹5 crore', () => {
    expect(calculateSurcharge(new Decimal(6_00_00_000), new Decimal(1_00_000), 'new', R).toNumber()).toBe(25_000);
  });

  it('listed-equity gains surcharge is capped at 15%', () => {
    const s = calculateSurcharge(new Decimal(3_00_00_000), new Decimal(1_00_000), 'old', R, new Decimal(40_000));
    expect(s.toNumber()).toBeCloseTo(60_000 * 0.25 + 40_000 * 0.15, 6);
  });

  it('cess is 4% of tax plus surcharge', () => {
    expect(calculateCess(new Decimal(1_23_457), R).toNumber()).toBeCloseTo(4_938.28, 6);
  });
});
