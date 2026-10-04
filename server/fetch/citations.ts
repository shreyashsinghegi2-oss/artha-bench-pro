/**
 * Post-generation citation check: every [n] in the answer must refer to a numbered source.
 * Invalid markers are removed (the claim stays, the fake citation goes) and reported.
 */
import type { StructuredFinancialAnswer } from '../../src/types';
import type { NumberedSource } from './refineInput';

const CITE = /(\s?)\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g;

export interface CitationCheck {
  cited: number[];
  invalid: number[];
  uncited: boolean;
}

export function checkText(text: string, valid: Set<number>): { text: string; cited: number[]; invalid: number[] } {
  const cited: number[] = [];
  const invalid: number[] = [];
  const out = text.replace(CITE, (_m, space: string, list: string) => {
    const nums = list.split(',').map((x) => Number(x.trim()));
    const good = nums.filter((n) => valid.has(n));
    for (const n of nums) (valid.has(n) ? cited : invalid).push(n);
    return good.length ? `${space}[${good.join(', ')}]` : '';
  });
  return { text: out.replace(/ +([.,;:])/g, '$1').replace(/ {2,}/g, ' '), cited, invalid };
}

/** Applies checkText to every prose field of a structured answer. */
export function validateCitations(answer: StructuredFinancialAnswer, numbered: NumberedSource[]): { answer: StructuredFinancialAnswer; report: CitationCheck } {
  const valid = new Set(numbered.map((s) => s.n));
  const cited = new Set<number>();
  const invalid = new Set<number>();
  const fix = (s: string) => {
    const r = checkText(s, valid);
    r.cited.forEach((n) => cited.add(n));
    r.invalid.forEach((n) => invalid.add(n));
    return r.text;
  };
  const a: StructuredFinancialAnswer = {
    ...answer,
    title: fix(answer.title),
    directAnswer: fix(answer.directAnswer),
    steps: answer.steps.map((s) => ({ ...s, explanation: fix(s.explanation) })),
    example: { ...answer.example, result: fix(answer.example.result), calculation: answer.example.calculation.map(fix) },
    interpretation: answer.interpretation.map(fix),
    risks: answer.risks.map(fix),
    keyTakeaways: answer.keyTakeaways.map(fix),
  };
  return {
    answer: a,
    report: { cited: [...cited].sort((x, y) => x - y), invalid: [...invalid].sort((x, y) => x - y), uncited: cited.size === 0 && numbered.length > 0 },
  };
}
