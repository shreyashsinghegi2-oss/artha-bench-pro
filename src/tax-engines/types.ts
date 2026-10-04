/** Shared types for the pluggable tax engines. */

export interface TaxBracket {
  /** Upper edge of the bracket on taxable income; null = no upper limit. */
  up_to: number | null;
  rate: number;
}

export interface TaxSchedule {
  /** Amount deducted from income before brackets (standard deduction / personal allowance). */
  allowance: number;
  /** Allowance reduced by 1 for every `per` above `start` (UK personal allowance taper). */
  allowance_taper?: { start: number; per: number };
  /** Tax credit subtracted from computed tax, not below zero (Kenya personal relief). */
  credit?: number;
  brackets: TaxBracket[];
}

export interface TaxConfig {
  country: string;
  name: string;
  currency: string;
  year: string;
  year_label: string;
  last_verified: string;
  sources: string[];
  notes: string[];
  /** One schedule per filing status (a single "default" key where there is only one). */
  schedules: Record<string, TaxSchedule>;
}

export interface SlabLine {
  from: number;
  to: number | null;
  rate: number;
  taxable_amount: number;
  tax: number;
}

export interface NamedAmount {
  name: string;
  amount: number;
}

export interface TaxResult {
  country: string;
  year: string;
  year_label: string;
  currency: string;
  income: number;
  taxable_income: number;
  tax: number;
  effective_rate: number;
  marginal_rate: number;
  slab_breakdown: SlabLine[];
  deductions_applied: NamedAmount[];
  credits_applied: NamedAmount[];
  notes: string[];
  sources: string[];
  last_verified: string;
}

export interface TaxOptions {
  filing_status?: string;
  deductions?: number;
}

export interface TaxEngine {
  country: string;
  name: string;
  years: string[];
  filingStatuses: string[];
  calculate(income: number, year?: string, options?: TaxOptions): TaxResult;
}
