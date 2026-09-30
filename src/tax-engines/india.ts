/**
 * India wrapper around the existing, tested engine (src/services/indiaTaxEngine.ts) so India plugs into the
 * same TaxEngine interface. Rules come from src/config/taxRules/india (FY2025-26 and FY2026-27).
 */
import { getIndiaTaxRules } from '../config/taxRules/india';
import { compareTaxRegimes } from '../services/indiaTaxEngine';
import { createDefaultTaxProfile } from '../services/taxWorkspaceStorage';
import type { IncomeSource } from '../services/incomeStorage';
import type { AgeCategory, FinancialYear, TaxDeductionEntry, TaxSlab } from '../types/taxTypes';
import { TaxInputError } from './progressive';
import type { NamedAmount, SlabLine, TaxEngine, TaxOptions, TaxResult } from './types';

const YEARS: Record<string, FinancialYear> = { '2026': 'FY2026-27', '2025': 'FY2025-26' };

export interface IndiaTaxOptions extends TaxOptions {
  /** 'new' (default) or 'old'. */
  regime?: 'new' | 'old';
  age?: number;
  /** Salary income gets the standard deduction; other income does not. Default true. */
  salaried?: boolean;
}

export const ageCategory = (age: number): AgeCategory => (age >= 80 ? '80-plus' : age >= 60 ? '60-79' : 'below-60');

function slabLines(slabs: TaxSlab[], taxable: number): SlabLine[] {
  const lines: SlabLine[] = [];
  let lower = 0;
  for (const s of slabs) {
    const upper = s.upTo ?? Number.POSITIVE_INFINITY;
    const inBand = Math.max(0, Math.min(taxable, upper) - lower);
    lines.push({ from: lower, to: s.upTo, rate: s.rate, taxable_amount: Math.round(inBand * 100) / 100, tax: Math.round(inBand * s.rate * 100) / 100 });
    lower = upper;
    if (taxable <= upper) break;
  }
  return lines;
}

function run(income: number, fy: FinancialYear, opts: IndiaTaxOptions) {
  const profile = { ...createDefaultTaxProfile(), financialYear: fy, ageCategory: ageCategory(opts.age ?? 30) };
  const now = '2026-04-01T00:00:00.000Z';
  const source: IncomeSource = {
    id: 'api',
    type: opts.salaried === false ? 'Freelance' : 'Salary',
    amount: income,
    currency: 'INR',
    frequency: 'Annually',
    description: 'Income',
    taxStatus: 'Pre-tax',
    startDate: now.slice(0, 10),
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  const deductions: TaxDeductionEntry[] =
    (opts.deductions ?? 0) > 0
      ? [{ id: 'api-80c', type: '80c', amount: opts.deductions ?? 0, description: 'Section 80C (caller supplied)', status: 'added', createdAt: now }]
      : [];
  return compareTaxRegimes([source], profile, deductions, [])[opts.regime ?? 'new'];
}

export const indiaEngine: TaxEngine & { calculate(income: number, year?: string, options?: IndiaTaxOptions): TaxResult } = {
  country: 'IN',
  name: 'India (income tax, resident individual)',
  years: Object.keys(YEARS),
  filingStatuses: ['new', 'old'],
  calculate(income: number, year = '2026', options: IndiaTaxOptions = {}): TaxResult {
    if (!Number.isFinite(income) || income < 0) throw new TaxInputError('Income must be zero or more.');
    const fy = YEARS[year];
    if (!fy) throw new TaxInputError(`India: rules are available for ${Object.keys(YEARS).join(', ')} (financial years starting that April).`);
    const regime = options.regime ?? 'new';
    const rules = getIndiaTaxRules(fy);
    const r = run(income, fy, { ...options, regime });
    // Measured on the next ₹1,000: tax is rounded to the nearest ₹10 (s.288B), which would distort a smaller step.
    const next = run(income + 1000, fy, { ...options, regime });
    const tax = Number(r.totalTaxLiability);
    const taxable = Number(r.taxableIncome);
    const slabs = regime === 'new' ? rules.slabs.new : rules.slabs.old[ageCategory(options.age ?? 30)];
    const deductions: NamedAmount[] = [];
    const std = Number(r.incomeByHead.salary) < income ? income - Number(r.incomeByHead.salary) : 0;
    if (std > 0) deductions.push({ name: 'Standard deduction (salary)', amount: std });
    if (Number(r.deductions) > 0) deductions.push({ name: 'Chapter VI-A deductions (80C etc.)', amount: Number(r.deductions) });
    const credits: NamedAmount[] = [];
    if (Number(r.rebate) > 0) credits.push({ name: 'Rebate u/s 87A', amount: Number(r.rebate) });
    const adds: NamedAmount[] = [];
    if (Number(r.surcharge) > 0) adds.push({ name: 'Surcharge', amount: Number(r.surcharge) });
    if (Number(r.cess) > 0) adds.push({ name: 'Health and education cess (4%)', amount: Number(r.cess) });
    return {
      country: 'IN',
      year,
      year_label: `${fy} (${r.assessmentYear})`,
      currency: 'INR',
      income,
      taxable_income: taxable,
      tax,
      effective_rate: income > 0 ? Math.round((tax / income) * 10_000) / 10_000 : 0,
      marginal_rate: Math.round(((Number(next.totalTaxLiability) - tax) / 1000) * 10_000) / 10_000,
      slab_breakdown: slabLines(slabs, taxable),
      deductions_applied: deductions,
      credits_applied: [...credits, ...adds.map((a) => ({ name: `${a.name} (added)`, amount: a.amount }))],
      notes: [
        `${regime === 'new' ? 'New' : 'Old'} regime, resident individual, ${ageCategory(options.age ?? 30)} age band.`,
        'Tax includes rebate u/s 87A (with marginal relief), surcharge and 4% cess. Slab lines show tax before rebate, surcharge and cess.',
        ...r.assumptions.slice(0, 3),
      ],
      sources: r.officialSourceUrls,
      last_verified: r.lastVerifiedAt,
    };
  },
};
