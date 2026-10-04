import { describe, expect, it } from 'vitest';
import { matchProfile } from '../src/advisor/profile-matcher';
import { parseDeterministic } from '../src/advisor/query-parser';
import type { ParsedQuery } from '../src/advisor/types';

const parse = (q: string): ParsedQuery => {
  const r = parseDeterministic(q);
  return {
    intent: r.intent,
    entities: r.entities,
    amounts: r.amounts,
    time_horizon: r.time_horizon,
    is_time_sensitive: r.is_time_sensitive,
    is_novel: true,
    user_id: 'u',
  };
};

describe('Layer E: profile matcher', () => {
  it('without a profile, says the answer is general and lists what would help', () => {
    const m = matchProfile(parse('Should I buy bitcoin?'), null);
    expect(m).toMatchObject({ available: false, suitability: 'unknown' });
    expect(m.missing).toContain('annual income');
  });

  it('computes emergency fund months with the user numbers', () => {
    const m = matchProfile(parse('Should I invest 1 lakh in nifty?'), { monthly_expenses: 50_000, liquid_savings: 100_000 });
    const ef = m.checks.find((c) => c.id === 'emergency_fund')!;
    expect(ef).toMatchObject({ value: 2, status: 'gap', relevant: true });
    expect(ef.detail).toContain('₹1,00,000');
    expect(m.suitability).toBe('caution');
  });

  it('flags a mismatch between low risk comfort and crypto', () => {
    const m = matchProfile(parse('Should I put 2 lakh in bitcoin?'), { risk_tolerance: 'low' });
    expect(m.suitability).toBe('mismatch');
    expect(m.suitability_reason).toMatch(/risk comfort is low/);
  });

  it('term cover gap and tax headroom, relevant checks first', () => {
    const m = matchProfile(parse('How can I save income tax under 80C?'), {
      annual_income: 1_200_000,
      term_cover: 5_000_000,
      dependants: 2,
      section_80c_used: 100_000,
    });
    expect(m.checks[0]!.id).toBe('80c_room');
    expect(m.checks[0]!.value).toBe(50_000);
    const term = m.checks.find((c) => c.id === 'term_cover')!;
    expect(term).toMatchObject({ status: 'gap', benchmark: 12_000_000 });
  });

  it('EMI share and savings rate', () => {
    const m = matchProfile(parse('Can I take a car loan?'), { annual_income: 1_200_000, monthly_expenses: 40_000, monthly_emi: 45_000 });
    expect(m.checks.find((c) => c.id === 'emi_share')).toMatchObject({ value: 45, status: 'gap', relevant: true });
    expect(m.checks.find((c) => c.id === 'savings_rate')).toMatchObject({ value: 15, status: 'attention' });
  });
});
