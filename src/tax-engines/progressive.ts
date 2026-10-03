/**
 * One engine for every progressive income-tax schedule: allowance (with optional taper) → brackets →
 * credits. Countries differ only in their JSON config.
 */
import type { NamedAmount, SlabLine, TaxConfig, TaxEngine, TaxOptions, TaxResult, TaxSchedule } from './types';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export class TaxInputError extends Error {}

function allowanceFor(schedule: TaxSchedule, income: number): number {
  const taper = schedule.allowance_taper;
  if (!taper || income <= taper.start) return schedule.allowance;
  return Math.max(0, schedule.allowance - Math.floor((income - taper.start) / taper.per));
}

function bracketTax(schedule: TaxSchedule, taxable: number): { tax: number; lines: SlabLine[] } {
  let lower = 0;
  let tax = 0;
  const lines: SlabLine[] = [];
  for (const b of schedule.brackets) {
    const upper = b.up_to ?? Number.POSITIVE_INFINITY;
    const inBand = Math.max(0, Math.min(taxable, upper) - lower);
    const bandTax = inBand * b.rate;
    lines.push({ from: lower, to: b.up_to, rate: b.rate, taxable_amount: round2(inBand), tax: round2(bandTax) });
    tax += bandTax;
    lower = upper;
    if (taxable <= upper) break;
  }
  return { tax, lines };
}

function compute(schedule: TaxSchedule, income: number, extraDeductions: number) {
  const allowance = allowanceFor(schedule, income);
  const taxable = Math.max(0, income - allowance - extraDeductions);
  const { tax: gross, lines } = bracketTax(schedule, taxable);
  const credit = Math.min(gross, schedule.credit ?? 0);
  return { allowance, taxable, gross, credit, tax: Math.max(0, gross - credit), lines };
}

export function progressiveEngine(configs: TaxConfig[]): TaxEngine {
  const first = configs[0];
  if (!first) throw new Error('A tax engine needs at least one year of rules.');
  const byYear = new Map(configs.map((c) => [c.year, c]));
  return {
    country: first.country,
    name: first.name,
    years: configs.map((c) => c.year),
    filingStatuses: Object.keys(first.schedules),
    calculate(income: number, year?: string, options: TaxOptions = {}): TaxResult {
      if (!Number.isFinite(income) || income < 0) throw new TaxInputError('Income must be zero or more.');
      const cfg = byYear.get(year ?? first.year);
      if (!cfg) throw new TaxInputError(`${first.name}: rules are available for ${[...byYear.keys()].join(', ')} only.`);
      const status = options.filing_status ?? Object.keys(cfg.schedules)[0] ?? 'default';
      const schedule = cfg.schedules[status];
      if (!schedule) throw new TaxInputError(`Filing status must be one of: ${Object.keys(cfg.schedules).join(', ')}.`);
      const extra = Math.max(0, options.deductions ?? 0);
      const r = compute(schedule, income, extra);
      // Marginal rate measured on the next 100 units of income, so allowance tapers and credits are included.
      const next = compute(schedule, income + 100, extra);
      const deductions: NamedAmount[] = [];
      if (r.allowance > 0)
        deductions.push({ name: schedule.allowance_taper ? 'Personal allowance' : 'Standard deduction / allowance', amount: round2(r.allowance) });
      if (extra > 0) deductions.push({ name: 'Other deductions (caller supplied)', amount: round2(extra) });
      const credits: NamedAmount[] = r.credit > 0 ? [{ name: 'Personal relief / tax credit', amount: round2(r.credit) }] : [];
      return {
        country: cfg.country,
        year: cfg.year,
        year_label: cfg.year_label,
        currency: cfg.currency,
        income: round2(income),
        taxable_income: round2(r.taxable),
        tax: round2(r.tax),
        effective_rate: income > 0 ? Math.round((r.tax / income) * 10_000) / 10_000 : 0,
        marginal_rate: Math.round(((next.tax - r.tax) / 100) * 10_000) / 10_000,
        slab_breakdown: r.lines,
        deductions_applied: deductions,
        credits_applied: credits,
        notes: cfg.notes,
        sources: cfg.sources,
        last_verified: cfg.last_verified,
      };
    },
  };
}
