import { describe, expect, it } from 'vitest';
import {
  buildStructuredFinancialAnswerInstructions,
  createFallbackStructuredFinancialAnswer,
  serializeStructuredFinancialAnswer,
  structuredFinancialAnswerSchema,
} from '../server/aiResponseStandard';
import { buildCryptoAssistantFallback } from '../server/cryptoService';

describe('ArthaMind financial response contract', () => {
  it('includes modes, assumptions, final-result, localization, verification, and no-fabrication rules', () => {
    const prompt = buildStructuredFinancialAnswerInstructions({ audience: 'tutor', language: 'English', level: 'beginner', detail: 'detailed', hasVerifiedCurrentData: false });
    for (const phrase of ['Quick answer', 'Professional report', 'Assumptions', 'Final result', 'jurisdiction', 'official source', 'Never invent']) {
      expect(prompt).toContain(phrase);
    }
  });

  it('serializes the structured answer in the required section order', () => {
    const answer = createFallbackStructuredFinancialAnswer('What is compound interest on 10000 at 8% for 5 years?', 'The investment grows using compound interest.');
    const parsed = structuredFinancialAnswerSchema.parse(answer);
    const text = serializeStructuredFinancialAnswer(parsed);
    const headings = ['## Direct answer', '## Assumptions and context', '## Formula or rule', '## Step-by-step calculation or reasoning', '## Final result and interpretation', '## Limitations and verification'];
    const indices = headings.map((heading) => text.indexOf(heading));
    expect(indices.every((index) => index >= 0)).toBe(true);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(parsed.directAnswer.match(/[.!?]/g)?.length).toBe(1);
  });

  it('allows no If-needed variations when they are irrelevant', () => {
    const answer = createFallbackStructuredFinancialAnswer('Explain inflation conceptually.', 'Inflation is a sustained increase in the general price level.');
    expect(structuredFinancialAnswerSchema.parse({ ...answer, keyTakeaways: [] }).keyTakeaways).toEqual([]);
  });

  it('uses the same visible contract for deterministic crypto answers', () => {
    const text = buildCryptoAssistantFallback('What does this candle show?', {
      symbol: 'BTCUSDT', interval: '1m', candleStatus: 'Closed', timeUtc: '2026-08-30 00:00', timeIst: '2026-08-30 05:30',
      open: 100, high: 103, low: 99, close: 102, absoluteChange: 2, percentChange: 2, baseVolume: 10, quoteVolume: 1010, tradeCount: 50,
      provider: 'Binance Public Market Data', streamStatus: 'live', lastUpdatedAt: '2026-08-30T00:00:00Z',
    });
    for (const heading of ['## Direct answer', '## Assumptions and context', '## Formula or rule', '## Step-by-step calculation or reasoning', '## Final result and interpretation', '## If needed', '## Limitations and verification']) {
      expect(text).toContain(heading);
    }
  });
});
