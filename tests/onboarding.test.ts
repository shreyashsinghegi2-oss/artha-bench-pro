import { describe, expect, it } from 'vitest';
import { checkAnswers, looksMadeUp, scoreMindset, toMoneyProfile, incomeBand, type OnboardingAnswers } from '../src/services/onboarding';
import { parseAmount, STEPS } from '../src/components/onboarding/RequiredOnboarding';
import { formatMoney, moneyInWords } from '../src/services/userPrefs';

const base: OnboardingAnswers = { name: 'Asha', level: 'beginner', country: 'India', currency: 'INR', age: 28, work: 'salaried', jobYears: 3, totalYears: 5, monthlyIncome: 80_000, steadiness: 'fixed', monthlyExpenses: 35_000, monthlyEmi: 10_000, liquidSavings: 2e5, investments: 3e5, dependants: 1 };
const fields = (a: OnboardingAnswers, kind?: 'error' | 'confirm') => checkAnswers(a).filter((i) => !kind || i.kind === kind).map((i) => i.field);

describe('sign-up number checks', () => {
  it('passes a normal, consistent profile', () => {
    expect(checkAnswers(base)).toEqual([]);
  });
  it('blocks years of work that cannot fit the age', () => {
    expect(fields({ ...base, age: 20, jobYears: 10 }, 'error')).toContain('jobYears');
    expect(fields({ ...base, totalYears: 2, jobYears: 3 }, 'error')).toContain('totalYears');
    expect(fields({ ...base, age: 15 }, 'error')).toContain('age');
  });
  it('asks to confirm spending far above income and very high EMIs', () => {
    expect(fields({ ...base, monthlyExpenses: 150_000 }, 'confirm')).toContain('monthlyExpenses');
    expect(fields({ ...base, monthlyEmi: 70_000 }, 'confirm')).toContain('monthlyEmi');
  });
  it('asks to confirm savings far above lifetime earnings', () => {
    expect(fields({ ...base, investments: 5e7 }, 'confirm')).toContain('investments');
    expect(fields({ ...base, investments: 9e5 })).not.toContain('investments');
  });
  it('flags typed-in guesses and student incomes that look wrong', () => {
    expect(looksMadeUp(99_999)).toBe(true);
    expect(looksMadeUp(123_456)).toBe(true);
    expect(looksMadeUp(85_000)).toBe(false);
    expect(fields({ ...base, work: 'student', jobYears: undefined, totalYears: undefined, monthlyIncome: 3e5 }, 'confirm')).toContain('monthlyIncome');
  });
  it('checks loans against the EMI', () => {
    expect(fields({ ...base, loanOutstanding: 5e6 }, 'confirm')).toContain('loanOutstanding'); // 500 EMIs of 10,000
    expect(fields({ ...base, loanOutstanding: 6e5 })).not.toContain('loanOutstanding');
  });
  it('scales the checks for other currencies', () => {
    const us: OnboardingAnswers = { ...base, country: 'United States', currency: 'USD', monthlyIncome: 6000, monthlyExpenses: 3000, monthlyEmi: 500, liquidSavings: 10_000, investments: 40_000 };
    expect(checkAnswers(us)).toEqual([]);
  });
});

describe('money mindset', () => {
  it('scores careful and bold answers, and planners vs spenders', () => {
    expect(scoreMindset({ ...base, scenarios: { crash: 0, choice: 0 } }).risk).toBe('careful');
    expect(scoreMindset({ ...base, scenarios: { crash: 3, choice: 2 } }).risk).toBe('bold');
    expect(scoreMindset({ ...base, scenarios: { bonus: 2, surprise: 0 } }).habit).toBe('planner');
    expect(scoreMindset({ ...base, scenarios: { bonus: 0, surprise: 2 } }).habit).toBe('spender');
    expect(scoreMindset(base).answered).toBe(0);
  });
});

describe('answers become the money profile', () => {
  it('turns monthly income into yearly salary and keeps the rest', () => {
    const p = toMoneyProfile({ ...base, goal: 'home', goalAmount: 2e6, goalYears: 5 }, new Date('2026-10-19'));
    expect(p.annualSalary).toBe(960_000);
    expect(p.monthlyExpenses).toBe(35_000);
    expect(p.goalAmountToday).toBe(2e6);
    expect(p.retireAge).toBe(60);
    expect(incomeBand(80_000, 'INR')).toBe('₹50,000 – ₹1,00,000 a month');
  });
});

describe('typing amounts', () => {
  it('reads lakh, k and million', () => {
    expect(parseAmount('1.5 lakh')).toBe(150_000);
    expect(parseAmount('₹12,00,000')).toBe(1_200_000);
    expect(parseAmount('45k')).toBe(45_000);
    expect(parseAmount('$1.2 million')).toBe(1_200_000);
    expect(parseAmount('abc')).toBeNull();
  });
  it('shows amounts with the right grouping and words', () => {
    expect(formatMoney(1_200_000, 'INR')).toBe('₹12,00,000');
    expect(formatMoney(1_200_000, 'USD')).toBe('$1,200,000');
    expect(moneyInWords(2.5e7, 'INR')).toBe('2.5 crore');
    expect(moneyInWords(1.2e6, 'USD')).toBe('1.2 million');
  });
  it('asks the age with chips from 16 upward and explains every question', () => {
    const age = STEPS.find((s) => s.id === 'age')!;
    expect(age.chips!({}).slice(0, 4).map((c) => c.value)).toEqual([16, 17, 18, 19]);
    for (const s of STEPS.filter((x) => x.field)) expect(s.why.length).toBeGreaterThan(20);
  });
});

import { buildPath, monthlySaving, totalSpend } from '../src/services/onboarding';

describe('new questions: spending split, loans, tax and the plan', () => {
  const fmt = (n: number) => formatMoney(n, 'INR');
  it('adds fixed and day-to-day spending and checks the total against income', () => {
    expect(totalSpend({ fixedExpenses: 20_000, variableExpenses: 15_000 })).toBe(35_000);
    expect(fields({ ...base, monthlyExpenses: undefined, fixedExpenses: 90_000, variableExpenses: 40_000 }, 'confirm')).toContain('variableExpenses');
    expect(fields({ ...base, monthlyExpenses: undefined, fixedExpenses: 20_000, variableExpenses: 15_000 })).toEqual([]);
  });
  it('checks worst month, interest rate, retirement age and the 80C limit', () => {
    expect(fields({ ...base, worstMonthIncome: 90_000 }, 'error')).toContain('worstMonthIncome');
    expect(fields({ ...base, highestRate: 75 }, 'error')).toContain('highestRate');
    expect(fields({ ...base, highestRate: 36 }, 'confirm')).toContain('highestRate');
    expect(fields({ ...base, retireAge: 25 }, 'error')).toContain('retireAge');
    expect(fields({ ...base, section80C: 2e5 }, 'confirm')).toContain('section80C');
  });
  it('works out the monthly saving with the standard formula', () => {
    // ₹10,00,000 in 5 years at 10% a year, saving at the start of each month ≈ ₹12,807 (₹12,914 if saved at month end)
    expect(Math.round(monthlySaving(1e6, 60, 0.1))).toBe(12_807);
    expect(monthlySaving(12_000, 12, 0)).toBe(1000);
  });
  it('orders the plan: gap, card debt, safety fund, insurance, family cover', () => {
    const p = buildPath({ ...base, monthlyIncome: 50_000, monthlyExpenses: 50_000, monthlyEmi: 5_000, creditCardDue: 30_000, liquidSavings: 10_000, dependants: 2 }, fmt);
    expect(p.steps.map((s) => s.title).slice(0, 5)).toEqual(['Stop spending more than you earn', 'Clear your credit card bill first', 'Build a safety fund', 'Get health insurance', 'Protect your family with a term plan']);
    expect(p.surplus).toBe(-5_000);
    expect(p.runwayMonths).toBeCloseTo(10_000 / 55_000);
  });
  it('gives a growth step and a goal amount when things are in order', () => {
    const p = buildPath({ ...base, liquidSavings: 4e5, healthCover: 5e5, termCover: 1.2e7, goal: 'home', goalAmount: 1e6, goalYears: 5 }, fmt);
    expect(p.steps.some((s) => s.title === 'Save for your goal every month')).toBe(true);
    expect(p.steps.at(-1)?.title).toBe('Grow what is left');
  });
});

import { pdfMoney } from '../src/services/financialReport';
describe('report amounts', () => {
  it('writes rupees in a font-safe way with Indian grouping', () => {
    expect(pdfMoney(1_200_000)).toBe('Rs 12,00,000');
    expect(pdfMoney(-5000)).toBe('-Rs 5,000');
    expect(pdfMoney(1_200_000, 'USD')).toBe('USD 1,200,000');
  });
});
