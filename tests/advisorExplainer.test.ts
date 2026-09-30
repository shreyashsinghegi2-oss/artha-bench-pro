import { describe, expect, it } from 'vitest';
import { buildFacts, checkNumbers, explain, extractNumbers, rawSummary, type ExplainerInput } from '../src/advisor/explainer';
import { runMath } from '../src/advisor/math-engine';
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
const Q = 'Home loan of 50 lakh for 20 years EMI?';
const input = (): ExplainerInput => {
  const parsed = parse(Q);
  return { question: Q, parsed, context: null, pattern: null, math: runMath(parsed, null), profile: matchProfile(parsed, null) };
};

describe('Layer F: number extraction and post-check', () => {
  it('reads ₹, Indian grouping, lakh/crore and percentages', () => {
    const n = extractNumbers('EMI ₹43,391.16, total ₹1.04 crore, rate 8.5%, 50 lakh');
    expect(n.map((x) => x.value)).toEqual([43391.16, 10_400_000, 8.5, 5_000_000]);
    expect(n[2]!.isPercent).toBe(true);
  });

  it('accepts numbers from the facts (including rounded lakh/crore forms) and small counts', () => {
    const facts = buildFacts(input());
    expect(checkNumbers('Your EMI is ₹43,391.16 at 8.5% for 20 years, about ₹1.04 crore in total. 3 things to know.', [facts, Q])).toEqual([]);
  });

  it('rejects invented numbers', () => {
    const facts = buildFacts(input());
    expect(checkNumbers('Your EMI is ₹45,000 and rates may fall to 7.25%.', [facts, Q])).toEqual(['₹45,000', '7.25%']);
  });
});

describe('Layer F: explain', () => {
  it('uses the AI reply when every number traces', async () => {
    const r = await explain(input(), async () => 'Your EMI would be ₹43,391.16 a month at the assumed 8.5%.');
    expect(r).toMatchObject({ mode: 'ai', attempts: 1 });
  });

  it('regenerates once with feedback naming the bad numbers', async () => {
    const prompts: string[] = [];
    const r = await explain(input(), async (_s, u) => {
      prompts.push(u);
      return prompts.length === 1 ? 'EMI is about ₹44,000.' : 'EMI is ₹43,391.16.';
    });
    expect(r.mode).toBe('ai-retry');
    expect(prompts[1]).toContain('₹44,000');
  });

  it('falls back to raw data after two bad replies, on errors, and with no AI', async () => {
    const bad = await explain(input(), async () => 'EMI is ₹99,999.');
    expect(bad).toMatchObject({ mode: 'raw', attempts: 2, rejected_numbers: ['₹99,999'] });
    expect(bad.text).toContain('₹43,391.16');
    expect(
      (
        await explain(input(), async () => {
          throw new Error('429');
        })
      ).mode,
    ).toBe('raw');
    expect((await explain(input(), undefined)).text).toBe(rawSummary(input()));
  });
});
