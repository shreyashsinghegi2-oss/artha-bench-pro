import { describe, expect, it } from 'vitest';
import { buildCfoHealthReport, cfoReviewPrompt, formatInr, formatInrShort, validateCfoInputs } from '../src/services/cfoAnalysis';
import { cfoSystemPrompt } from '../server/aiGateway';

describe('AI CFO health check', () => {
  it('computes surplus, ratios and runway exactly', () => {
    const report = buildCfoHealthReport({ monthlyIncome: 120_000, monthlyExpenses: 62_000, monthlyEmi: 28_000, emergencySavings: 250_000 });
    expect(report.surplus).toBe(30_000);
    const byKey = Object.fromEntries(report.metrics.map((metric) => [metric.key, metric]));
    expect(byKey['savings-rate'].display).toBe('25.0%');
    expect(byKey['emi-load'].display).toBe('23.3%');
    expect(byKey.runway.display).toBe('2.8 months');
    // 35 (savings ≥20%) + 30 (EMI ≤30%) + 35 × 2.78/6
    expect(report.score).toBe(81);
    expect(report.status).toBe('Strong');
  });

  it('prices the emergency-fund gap and how long the surplus takes to close it', () => {
    const report = buildCfoHealthReport({ monthlyIncome: 120_000, monthlyExpenses: 62_000, monthlyEmi: 28_000, emergencySavings: 250_000 });
    const fund = report.actions.find((action) => action.title.includes('emergency fund'));
    expect(fund?.amount).toBe(290_000); // 6 × ₹90,000 − ₹2,50,000
    expect(fund?.detail).toContain('12 months');
  });

  it('flags a deficit and an EMI load above 40% as the first priorities', () => {
    const report = buildCfoHealthReport({ monthlyIncome: 100_000, monthlyExpenses: 60_000, monthlyEmi: 50_000, emergencySavings: 0 });
    expect(report.surplus).toBe(-10_000);
    expect(report.actions[0].title).toBe('Close the monthly deficit');
    expect(report.actions.find((action) => action.title.includes('40%'))?.amount).toBe(10_000);
    expect(report.status).toBe('Critical');
  });

  it('rejects impossible inputs instead of dividing by zero', () => {
    expect(validateCfoInputs({ monthlyIncome: 0, monthlyExpenses: 1, monthlyEmi: 0, emergencySavings: 0 })).toMatch(/greater than zero/);
    expect(validateCfoInputs({ monthlyIncome: 1, monthlyExpenses: -1, monthlyEmi: 0, emergencySavings: 0 })).toMatch(/negative/);
    expect(() => buildCfoHealthReport({ monthlyIncome: Number.NaN, monthlyExpenses: 0, monthlyEmi: 0, emergencySavings: 0 })).toThrow();
  });

  it('formats rupees with Indian grouping, lakh and crore', () => {
    expect(formatInr(1_250_000)).toBe('₹12,50,000');
    expect(formatInr(-5_000)).toBe('−₹5,000');
    expect(formatInrShort(1_250_000)).toBe('₹12.5 lakh');
    expect(formatInrShort(24_000_000)).toBe('₹2.4 crore');
  });

  it('hands verified numbers to the AI CFO prompt', () => {
    const inputs = { monthlyIncome: 120_000, monthlyExpenses: 62_000, monthlyEmi: 28_000, emergencySavings: 250_000 };
    const prompt = cfoReviewPrompt(inputs, buildCfoHealthReport(inputs));
    expect(prompt).toContain('₹1,20,000');
    expect(prompt).toContain('health score 81/100');
  });

  it('uses an India-first CFO system prompt with guardrails', () => {
    const prompt = cfoSystemPrompt({ language: 'hinglish' });
    expect(prompt).toContain('ArthaMind AI CFO');
    expect(prompt).toContain('lakh/crore');
    expect(prompt).toContain('Roman Hindi');
    expect(prompt).toMatch(/Do not give buy\/sell\/hold/);
  });
});
