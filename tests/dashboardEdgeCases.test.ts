import { it, expect } from 'vitest';
import { buildCompleteDashboard } from '../src/services/completeDashboard';
import { toMoneyProfile } from '../src/services/onboarding';
const bad = (o: unknown, path = ''): string[] => { if (typeof o === 'number') return Number.isFinite(o) || path.endsWith('months') || path.endsWith('runwayMonths') ? [] : [path]; if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => bad(v, `${path}.${k}`)); return []; };
it.each([
  ['student 16 no income', { age: 16, work: 'student' as const, monthlyIncome: 0, fixedExpenses: 2000, variableExpenses: 1000, monthlyEmi: 0, liquidSavings: 5000, investments: 0, dependants: 0 }],
  ['homemaker 40 no income', { age: 40, monthlyIncome: 0, fixedExpenses: 0, variableExpenses: 0, monthlyEmi: 0, liquidSavings: 0, investments: 0, dependants: 2 }],
  ['retired 68', { age: 68, work: 'retired' as const, monthlyIncome: 40000, fixedExpenses: 20000, variableExpenses: 10000, monthlyEmi: 0, liquidSavings: 500000, investments: 3000000, dependants: 1 }],
  ['old 90', { age: 90, monthlyIncome: 10000, fixedExpenses: 8000, variableExpenses: 2000, monthlyEmi: 0, liquidSavings: 100000, investments: 0, dependants: 0 }],
])('%s builds a full dashboard with finite numbers', (_n, a) => {
  const d = buildCompleteDashboard({ profile: toMoneyProfile(a), loans: [], income: [], expenses: [] });
  expect(bad(d)).toEqual([]);
});
