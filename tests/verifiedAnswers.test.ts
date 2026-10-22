import { describe, expect, it } from 'vitest';
import { buildCompleteDashboard, type CompleteDashboard } from '../src/services/completeDashboard';
import type { MoneyProfile } from '../src/services/moneyProfile';
import { emi } from '../src/services/calculators';
import { sipFutureValue } from '../src/services/moneyCheck';
import { dashboardAnswer, formatRupees, mathAnswer, parseFigures } from '../src/services/verifiedAnswers';

const base: MoneyProfile = {
  age: 30, annualSalary: 1_800_000, monthlyExpenses: 50_000, monthlyEmi: 12_000, liquidSavings: 300_000, investments: 900_000,
  dependants: 1, loanOutstanding: 400_000, section80C: 150_000, section80D: 25_000, updatedAt: '2026-09-01T00:00:00Z', source: 'questions',
};

/** Profiles the people using the platform actually have: a typical salaried person, a debt-heavy one, and a late starter. */
const profiles: Array<[string, MoneyProfile]> = [
  ['salaried, invested', base],
  ['debt-heavy, no investments', { ...base, monthlyEmi: 45_000, loanOutstanding: 3_000_000, investments: 0, liquidSavings: 40_000 }],
  ['late starter, age 52', { ...base, age: 52, investments: 200_000, liquidSavings: 90_000 }],
];

const now = new Date('2026-10-22');
const dash = (p: MoneyProfile): CompleteDashboard => buildCompleteDashboard({ profile: p, now });

describe('chat answers match the dashboard for every profile', () => {
  it.each(profiles)('%s: net worth, surplus, runway, health and freedom are the dashboard figures', (_name, p) => {
    const d = dash(p);
    expect(dashboardAnswer('What is my net worth?', d)).toContain(formatRupees(d.netWorth.value));
    expect(dashboardAnswer('What is my monthly surplus?', d)).toContain(formatRupees(d.monthlySurplus.value));
    expect(dashboardAnswer('If I lose my job, how long can I cover spending?', d)).toContain('cover about');
    expect(dashboardAnswer('What is my money health score?', d)).toContain(`${d.report.health.score}/100`);
    const freedom = dashboardAnswer('Till which age I will be financially free?', d) ?? '';
    if (d.report.freedom.freedomAge === null) expect(freedom).toContain('do not reach');
    else expect(freedom).toContain(`age ${d.report.freedom.freedomAge}`);
  });

  it('leaves questions outside the dashboard to the model', () => {
    expect(dashboardAnswer('Explain what a debt fund is', dash(base))).toBeNull();
  });
});

describe('maths answers work without the model', () => {
  it('computes an EMI with the working shown', () => {
    const answer = mathAnswer('What is the EMI on a ₹10 lakh loan at 8.5% for 20 years?') ?? '';
    expect(answer).toContain(formatRupees(emi(1_000_000, 0.085, 240)));
    expect(answer).toContain('n = 240');
  });

  it('computes a SIP future value', () => {
    const answer = mathAnswer('If I invest ₹10,000 a month at 12% for 10 years, what will I get?') ?? '';
    expect(answer).toContain(formatRupees(sipFutureValue(10_000, 0.12, 120)));
  });

  it('computes lump-sum growth from a compound question', () => {
    const answer = mathAnswer('What will ₹5 lakh grow to at 10% for 5 years with compound interest?') ?? '';
    expect(answer).toContain(formatRupees(500_000 * 1.1 ** 5));
  });

  it('reads amounts in lakh, crore and thousands and periods in months', () => {
    expect(parseFigures('₹1.5 crore at 9% for 240 months')).toEqual({ amounts: [15_000_000], rate: 9, years: 20 });
    expect(parseFigures('₹50k a month, 12%, 5 years').amounts).toEqual([50_000]);
  });

  it('sends decisions and incomplete questions to the model', () => {
    expect(mathAnswer('Should I take a 10 lakh loan at 8% for 20 years or wait?')).toBeNull();
    expect(mathAnswer('What is the EMI on my loan?')).toBeNull();
  });
});
