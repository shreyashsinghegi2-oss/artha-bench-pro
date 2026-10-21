import { describe, expect, it } from 'vitest';
import { freedomConflict, freedomPromptLines, type VerifiedFreedom } from '../src/services/verifiedFreedom';
import { safeAnswerText } from '../server/aiGateway';
import { cfoPlanPrompt } from '../src/services/cfoAnalysis';

const verified: VerifiedFreedom = { freedomAge: 34, corpus: 36800000, preRetirementReturn: 0.1, inflation: 0.06 };

describe('freedom figures match the dashboard', () => {
  it('flags an age that differs from the verified freedom age', () => {
    const note = freedomConflict('You reach your freedom target around age 51.', verified);
    expect(note).toContain('34');
  });

  it('flags a growth rate that differs from the platform assumption', () => {
    expect(freedomConflict('Assuming 11% a year returns, you will get there sooner.', verified)).toContain('10%');
  });

  it('stays silent when the answer agrees with the verified figures', () => {
    expect(freedomConflict('You reach freedom at age 34 with 10% a year growth.', verified)).toBeNull();
  });

  it('stays silent when there is no verified plan to compare with', () => {
    expect(freedomConflict('You reach freedom at age 51.', null)).toBeNull();
  });

  it('tells the model to quote the verified figures and never invent them', () => {
    const line = freedomPromptLines(verified);
    expect(line).toContain('age 34');
    expect(line).toContain('never recalculate');
    expect(freedomPromptLines(null)).toContain('Do not state a financial-freedom age');
  });

  it('puts the verified freedom line into the CFO plan prompt', () => {
    const prompt = cfoPlanPrompt(
      { name: '', age: 34, work: 'Salaried', monthlyIncome: 100000, monthlyExpenses: 20000, monthlyEmi: 10000, savings: 300000, dependents: 0, insurance: 'None', goal: 'Retire early', goalYears: '10 years' } as never,
      { surplus: 70000, metrics: [], score: 80 } as never,
      freedomPromptLines(verified),
    );
    expect(prompt).toContain('Verified freedom plan');
  });
});

describe('raw model output never reaches the screen', () => {
  it('shows the plain direct answer when the model returned JSON', () => {
    expect(safeAnswerText('{"directAnswer":"Your surplus is ₹70,000 a month.","lens":"Risk"}')).toBe('Your surplus is ₹70,000 a month.');
  });

  it('shows a safe line instead of unreadable JSON', () => {
    expect(safeAnswerText('{"lens": "Risk", "detail": "..."}')).toMatch(/could not present/);
  });

  it('leaves ordinary text unchanged', () => {
    expect(safeAnswerText('Your emergency fund covers 10 months.')).toBe('Your emergency fund covers 10 months.');
  });
});
