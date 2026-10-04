import { describe, expect, it } from 'vitest';
import { CASES, scoreAnswer, summarise, type Row } from '../scripts/eval-grounding';

describe('grounding evaluation scoring', () => {
  it('has 30 unique questions across topics', () => {
    expect(CASES).toHaveLength(30);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(30);
    expect(new Set(CASES.map((c) => c.topic))).toEqual(new Set(['calc', 'tax', 'regulation', 'market', 'mf', 'concept', 'news']));
  });

  it('measures citation coverage over sentences that state figures, counting verified numbers as supported', () => {
    const text = 'The repo rate is 5.50% [1]. Your EMI is ₹43,391.16. Inflation was 3.1% last month. Loans help.';
    const r = scoreAnswer(text, 'repo rate unchanged at 5.50 per cent … 5.50%', ['₹43,391.16']);
    expect(r.coverage).toBeCloseTo(2 / 3);
    expect(r.unsupported).toEqual(['3.1%']);
  });

  it('does not judge unsupported figures without the fetched context', () => {
    expect(scoreAnswer('Rate 9% [1].', null, []).unsupported).toEqual([]);
  });

  it('summarises percentiles and totals', () => {
    const row = (over: Partial<Row>): Row => ({
      id: 'x',
      topic: 'calc',
      fetchMs: 100,
      sources: 2,
      officialSources: 1,
      contextChars: 400,
      answerMs: 1000,
      status: 200,
      provider: 'Groq',
      fallback: false,
      citationCoverage: 1,
      unsupportedFigures: [],
      expectedFactsMet: 1,
      estTokens: 300,
      verifiedNumbers: 1,
      certified: 0,
      invalidCitationsRemoved: 0,
      ...over,
    });
    const s = summarise([row({}), row({ answerMs: 3000, unsupportedFigures: ['1%'], status: 500, fallback: true })]);
    expect(s).toMatchObject({ questions: 2, errors: 1, fallbacks: 1, unsupportedFiguresTotal: 1, answerMsP50: 3000 });
  });
});
