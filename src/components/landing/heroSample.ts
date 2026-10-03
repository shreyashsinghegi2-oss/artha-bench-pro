/**
 * The labelled sample profile shown in the hero phone, and the Money Check figures for it.
 * The figures are a snapshot so the landing page does not have to download the tax engine;
 * tests/heroSample.test.ts recomputes them with buildMoneyCheck and fails if they ever drift.
 */
import type { MoneyCheckInputs } from '../../services/moneyCheck';

export const HERO_SAMPLE: MoneyCheckInputs = { age: 28, annualSalary: 1_200_000, monthlyExpenses: 45_000, monthlyEmi: 8_000, liquidSavings: 200_000, investments: 650_000, dependants: 0, section80C: 150_000, section80D: 25_000, retireAge: 60 };

export interface HeroReport {
  netWorth: number;
  cashflow: { surplus: number };
  emergency: { months: number };
  freedom: { freedomAge: number | null };
  health: { score: number; status: string };
  tax: { better: 'old' | 'new' | 'same'; monthlyTakeHome: number; newRegimeTax: number; oldRegimeTax: number; saving: number };
}

export const HERO_REPORT: HeroReport = {
  netWorth: 850_000,
  cashflow: { surplus: 47_000 },
  emergency: { months: 3.7735849056603774 },
  freedom: { freedomAge: 53 },
  health: { score: 87, status: 'Strong' },
  tax: { better: 'new', monthlyTakeHome: 100_000, newRegimeTax: 0, oldRegimeTax: 111_800, saving: 111_800 },
};
