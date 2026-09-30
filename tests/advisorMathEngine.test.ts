import { describe, expect, it } from 'vitest';
import { emi, fdMaturity, inr, lumpSumFutureValue, runMath, sipFutureValue, traceableNumbers } from '../src/advisor/math-engine';
import { parseDeterministic } from '../src/advisor/query-parser';
import type { ContextBundle, UserProfile } from '../src/advisor/context';
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
const withProfile = (p: UserProfile): Pick<ContextBundle, 'profile'> => ({
  profile: { status: 'ok', data: p, source: 'profile', as_of: null, reliability: 100, latency_ms: 0 },
});

describe('Layer D: formulas', () => {
  it('match standard reference values', () => {
    expect(emi(5_000_000, 8.5, 20)).toBeCloseTo(43391.16, 2);
    expect(sipFutureValue(10_000, 12, 10)).toBeCloseTo(2_323_390.76, 0);
    expect(lumpSumFutureValue(100_000, 10, 5)).toBeCloseTo(161_051, 6);
    expect(fdMaturity(100_000, 7, 1)).toBeCloseTo(107_185.9, 1);
    expect(emi(120_000, 0, 1)).toBe(10_000);
    expect(sipFutureValue(1000, 0, 1)).toBe(12_000);
  });

  it('formats in Indian digit grouping', () => {
    expect(inr(1_200_000)).toBe('₹12,00,000');
    expect(inr(43391.16, 2)).toBe('₹43,391.16');
  });
});

describe('Layer D: runMath', () => {
  it('SIP question → SIP projection with three scenarios and labelled assumptions', () => {
    const m = runMath(parse('I want to start a SIP of ₹10,000 per month for 15 years'), null);
    const sip = m.calculations.find((c) => c.id === 'sip')!;
    expect(sip.inputs.find((i) => i.name === 'Monthly SIP')).toMatchObject({ value: 10_000, source: 'your question' });
    expect(sip.inputs.find((i) => i.name === 'Time')).toMatchObject({ value: 15, source: 'your question' });
    expect(sip.steps).toHaveLength(4);
    expect(sip.extras.find((e) => e.label === 'Total invested')?.value).toBe(1_800_000);
    expect(m.assumptions.join(' ')).toMatch(/not forecasts/);
  });

  it('loan question → EMI with assumed rate marked as an assumption', () => {
    const m = runMath(parse('Home loan of 50 lakh for 20 years EMI?'), null);
    const c = m.calculations.find((x) => x.id === 'emi')!;
    expect(c.result.value).toBeCloseTo(43391.16, 2);
    expect(c.inputs.find((i) => i.name === 'Interest rate')?.source).toBe('assumption');
    expect(m.guardrails.some((g) => g.id === 'assumptions')).toBe(true);
  });

  it('goal question → inflation-adjusted target and required SIP', () => {
    const m = runMath(parse('I need ₹50 lakh for my child education in 12 years'), null);
    expect(m.calculations.map((c) => c.id)).toEqual(['inflation', 'required_sip']);
    const req = m.calculations[1]!;
    expect(sipFutureValue(req.result.value, 10, 12)).toBeCloseTo(m.calculations[0]!.result.value, -1);
  });

  it('tax question uses the India engine with percent rates', () => {
    const m = runMath(parse('How much tax on salary of 18 lakh?'), null);
    const t = m.calculations.find((c) => c.id === 'income_tax')!;
    expect(t.result.value).toBeGreaterThan(0);
    expect(t.steps[0]).toMatch(/^New regime: 5% on/);
  });

  it('no projection for crypto; crypto and short-horizon guardrails fire', () => {
    const m = runMath(parse('Buy bitcoin with 50000 for 6 months'), null);
    expect(m.calculations).toHaveLength(0);
    expect(m.guardrails.map((g) => g.id)).toEqual(expect.arrayContaining(['crypto', 'short_horizon']));
    expect(m.assumptions.join(' ')).toMatch(/No return projection/);
  });

  it('profile-based guardrails: EMI burden and emergency fund', () => {
    const emiM = runMath(parse('Home loan of 80 lakh for 20 years'), withProfile({ annual_income: 1_800_000 }));
    expect(emiM.guardrails.find((g) => g.id === 'emi_burden')?.level).toBe('warning');
    const ef = runMath(parse('Should I invest 1 lakh in nifty for 5 years'), withProfile({ monthly_expenses: 50_000, liquid_savings: 100_000 }));
    expect(ef.guardrails.find((g) => g.id === 'emergency_first')?.message).toContain('₹3,00,000');
  });

  it('every result is traceable', () => {
    const m = runMath(parse('I want to start a SIP of ₹10,000 per month for 15 years'), null);
    const nums = traceableNumbers(m);
    for (const c of m.calculations) expect(nums).toContain(c.result.value);
  });
});
