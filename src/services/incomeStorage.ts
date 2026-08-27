import Decimal from 'decimal.js';
import { IncomeTaxDetails } from '../types/taxTypes';

export const INCOME_STORAGE_KEY = 'artha_income_sources_v1';

export const INCOME_TYPES = [
  'Salary',
  'Freelance',
  'Rental',
  'Business',
  'Investment Returns',
  'Other',
] as const;

export const INCOME_FREQUENCIES = ['Monthly', 'Quarterly', 'Annually', 'One-time'] as const;
export const INCOME_TAX_STATUSES = ['Pre-tax', 'Post-tax', 'Tax-free'] as const;

export type IncomeType = (typeof INCOME_TYPES)[number];
export type IncomeFrequency = (typeof INCOME_FREQUENCIES)[number];
export type IncomeTaxStatus = (typeof INCOME_TAX_STATUSES)[number];

export interface IncomeSource {
  id: string;
  type: IncomeType;
  amount: number;
  currency: string;
  frequency: IncomeFrequency;
  description: string;
  taxStatus: IncomeTaxStatus;
  startDate: string;
  endDate?: string;
  tags: string[];
  taxDetails?: IncomeTaxDetails;
  createdAt: string;
  updatedAt: string;
}

export type IncomeSourceDraft = Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'>;

interface StoredIncomeEnvelope {
  version: 1;
  sources: IncomeSource[];
}

export interface CurrencyIncomeSummary {
  currency: string;
  monthlyRecurring: number;
  annualProjected: number;
  oneTimeThisYear: number;
  byType: Partial<Record<IncomeType, number>>;
}

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage);

function isIncomeSource(value: unknown): value is IncomeSource {
  if (!value || typeof value !== 'object') return false;
  const source = value as Partial<IncomeSource>;
  return (
    typeof source.id === 'string' &&
    INCOME_TYPES.includes(source.type as IncomeType) &&
    typeof source.amount === 'number' &&
    Number.isFinite(source.amount) &&
    source.amount > 0 &&
    typeof source.currency === 'string' &&
    INCOME_FREQUENCIES.includes(source.frequency as IncomeFrequency) &&
    typeof source.description === 'string' &&
    INCOME_TAX_STATUSES.includes(source.taxStatus as IncomeTaxStatus) &&
    typeof source.startDate === 'string' &&
    Array.isArray(source.tags)
  );
}

export function loadIncomeSources(): IncomeSource[] {
  if (!isBrowser()) return [];

  try {
    const rawValue = window.localStorage.getItem(INCOME_STORAGE_KEY);
    if (!rawValue) return [];
    const envelope = JSON.parse(rawValue) as Partial<StoredIncomeEnvelope>;
    if (envelope.version !== 1 || !Array.isArray(envelope.sources)) return [];
    return envelope.sources.filter(isIncomeSource);
  } catch {
    return [];
  }
}

export function saveIncomeSources(sources: IncomeSource[]): void {
  if (!isBrowser()) return;
  const envelope: StoredIncomeEnvelope = { version: 1, sources };
  window.localStorage.setItem(INCOME_STORAGE_KEY, JSON.stringify(envelope));
}

export function monthlyEquivalent(source: Pick<IncomeSource, 'amount' | 'frequency'>): number {
  const amount = new Decimal(source.amount);
  switch (source.frequency) {
    case 'Monthly':
      return amount.toNumber();
    case 'Quarterly':
      return amount.div(3).toNumber();
    case 'Annually':
      return amount.div(12).toNumber();
    case 'One-time':
      return 0;
  }
}

function isActive(source: IncomeSource, asOf: Date): boolean {
  const asOfDay = asOf.toISOString().slice(0, 10);
  return source.startDate <= asOfDay && (!source.endDate || source.endDate >= asOfDay);
}

function isInYear(isoDate: string, year: number): boolean {
  return isoDate.startsWith(`${year}-`);
}

export function summarizeIncomeByCurrency(
  sources: IncomeSource[],
  asOf = new Date(),
): CurrencyIncomeSummary[] {
  const summaries = new Map<string, CurrencyIncomeSummary>();

  for (const source of sources) {
    const currency = source.currency.toUpperCase();
    const summary = summaries.get(currency) ?? {
      currency,
      monthlyRecurring: 0,
      annualProjected: 0,
      oneTimeThisYear: 0,
      byType: {},
    };

    if (source.frequency === 'One-time') {
      if (isInYear(source.startDate, asOf.getUTCFullYear())) {
        summary.oneTimeThisYear = new Decimal(summary.oneTimeThisYear).plus(source.amount).toNumber();
        summary.annualProjected = new Decimal(summary.annualProjected).plus(source.amount).toNumber();
        summary.byType[source.type] = new Decimal(summary.byType[source.type] ?? 0).plus(source.amount).toNumber();
      }
    } else if (isActive(source, asOf)) {
      const monthly = monthlyEquivalent(source);
      const annual = new Decimal(monthly).times(12);
      summary.monthlyRecurring = new Decimal(summary.monthlyRecurring).plus(monthly).toNumber();
      summary.annualProjected = new Decimal(summary.annualProjected).plus(annual).toNumber();
      summary.byType[source.type] = new Decimal(summary.byType[source.type] ?? 0).plus(annual).toNumber();
    }

    summaries.set(currency, summary);
  }

  return [...summaries.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export function createIncomeSource(draft: IncomeSourceDraft, existingId?: string): IncomeSource {
  const timestamp = new Date().toISOString();
  return {
    ...draft,
    currency: draft.currency.toUpperCase(),
    tags: [...new Set(draft.tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 10),
    id: existingId ?? crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString('en-IN')}`;
  }
}
