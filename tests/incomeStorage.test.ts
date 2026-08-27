import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createIncomeSource,
  INCOME_STORAGE_KEY,
  IncomeSource,
  loadIncomeSources,
  monthlyEquivalent,
  saveIncomeSources,
  summarizeIncomeByCurrency,
} from '../src/services/incomeStorage';

function source(overrides: Partial<IncomeSource>): IncomeSource {
  return {
    id: 'income-1',
    type: 'Salary',
    amount: 90_000,
    currency: 'INR',
    frequency: 'Monthly',
    description: 'Primary salary',
    taxStatus: 'Post-tax',
    startDate: '2026-01-01',
    tags: ['primary'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('income calculations', () => {
  it('normalizes recurring frequencies to a monthly equivalent', () => {
    expect(monthlyEquivalent(source({ amount: 90_000, frequency: 'Monthly' }))).toBe(90_000);
    expect(monthlyEquivalent(source({ amount: 90_000, frequency: 'Quarterly' }))).toBe(30_000);
    expect(monthlyEquivalent(source({ amount: 120_000, frequency: 'Annually' }))).toBe(10_000);
    expect(monthlyEquivalent(source({ amount: 50_000, frequency: 'One-time' }))).toBe(0);
  });

  it('projects recurring income and includes this-year one-time income', () => {
    const result = summarizeIncomeByCurrency(
      [
        source({ id: 'salary', amount: 90_000 }),
        source({ id: 'freelance', type: 'Freelance', amount: 30_000, frequency: 'Quarterly' }),
        source({ id: 'bonus', type: 'Other', amount: 50_000, frequency: 'One-time', startDate: '2026-07-01' }),
      ],
      new Date('2026-08-27T00:00:00.000Z'),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      currency: 'INR',
      monthlyRecurring: 100_000,
      annualProjected: 1_250_000,
      oneTimeThisYear: 50_000,
    });
    expect(result[0].byType).toEqual({
      Salary: 1_080_000,
      Freelance: 120_000,
      Other: 50_000,
    });
  });

  it('keeps different currencies separate instead of applying an invented FX rate', () => {
    const result = summarizeIncomeByCurrency(
      [source({ id: 'inr', currency: 'INR' }), source({ id: 'usd', currency: 'USD', amount: 1_000 })],
      new Date('2026-08-27T00:00:00.000Z'),
    );

    expect(result.map((summary) => summary.currency)).toEqual(['INR', 'USD']);
    expect(result[1].monthlyRecurring).toBe(1_000);
  });

  it('excludes recurring sources that are not active as of the summary date', () => {
    const result = summarizeIncomeByCurrency(
      [source({ endDate: '2026-06-30' })],
      new Date('2026-08-27T00:00:00.000Z'),
    );

    expect(result[0].monthlyRecurring).toBe(0);
    expect(result[0].annualProjected).toBe(0);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('income device storage', () => {
  it('stores a versioned envelope and restores valid sources', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    const saved = source({ id: 'saved-income' });

    saveIncomeSources([saved]);

    expect(JSON.parse(values.get(INCOME_STORAGE_KEY) ?? '{}')).toMatchObject({ version: 1 });
    expect(loadIncomeSources()).toEqual([saved]);
  });

  it('ignores corrupt or unsupported stored data', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => JSON.stringify({ version: 2, sources: [{ amount: 'not-a-number' }] }),
        setItem: () => undefined,
      },
    });

    expect(loadIncomeSources()).toEqual([]);
  });

  it('normalizes currency and deduplicates tags for a new source', () => {
    const created = createIncomeSource({
      type: 'Freelance',
      amount: 25_000,
      currency: 'inr',
      frequency: 'Monthly',
      description: 'Consulting retainer',
      taxStatus: 'Pre-tax',
      startDate: '2026-08-01',
      tags: [' consulting ', 'consulting', 'primary'],
    });

    expect(created.currency).toBe('INR');
    expect(created.tags).toEqual(['consulting', 'primary']);
    expect(created.id).toBeTruthy();
  });
});
