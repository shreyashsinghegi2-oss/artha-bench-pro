import { describe, expect, it } from 'vitest';
import { buildRuleBasedNewsBrief, mergeAiNewsBrief, parseJsonObject } from '../src/services/newsBrief';

const NOW = new Date('2026-09-23T10:00:00Z');
const reliance = {
  title: 'Reliance Industries Q2 profit rises 12% to ₹19,300 crore on strong retail growth',
  summary: 'Reliance Industries reported a 12% rise in consolidated net profit to ₹19,300 crore for the September quarter. Revenue grew 8% year on year as retail and telecom offset weaker refining margins.',
  sourceName: 'Economic Times',
  publishedAt: '2026-09-23T08:00:00Z',
};

describe('rule-based news brief', () => {
  it('finds the company, topic, figures and a positive read from the text alone', () => {
    const brief = buildRuleBasedNewsBrief(reliance, NOW);
    expect(brief.entities[0]).toMatchObject({ name: 'Reliance Industries', symbol: 'RELIANCE', type: 'company' });
    expect(brief.topics).toContain('Earnings');
    expect(brief.sentiment).toBe('positive');
    expect(brief.figures.map((f) => f.value)).toEqual(expect.arrayContaining(['12%', '₹19,300 crore', '8%']));
    expect(brief.figures.find((f) => f.value === '₹19,300 crore')?.label).toMatch(/profit/i);
    expect(brief.generatedBy).toBe('rules');
    expect(brief.asOf).toBe(NOW.toISOString());
  });

  it('only reports figures that appear in the source text', () => {
    const brief = buildRuleBasedNewsBrief(reliance, NOW);
    const text = `${reliance.title} ${reliance.summary}`;
    for (const f of brief.figures) expect(text).toContain(f.value);
  });

  it('reads falls as negative and is low-confidence on a bare headline', () => {
    const brief = buildRuleBasedNewsBrief({ title: 'Nvidia shares fall after new export curbs on AI chips', sourceName: 'CNBC' }, NOW);
    expect(brief.sentiment).toBe('negative');
    expect(brief.confidence).toBe('low');
    expect(brief.coverage).toBe('Headline only');
    expect(brief.entities.some((e) => e.symbol === 'NVDA')).toBe(true);
  });

  it('maps rate news to rates and asks the reader to check the official release', () => {
    const brief = buildRuleBasedNewsBrief({ title: 'RBI holds repo rate at 5.5% as inflation eases', summary: 'The Reserve Bank of India kept the repo rate unchanged at 5.5%. CPI inflation eased to 2.1% in August.', sourceName: 'Reuters' }, NOW);
    expect(brief.topics[0]).toBe('Interest rates');
    expect(brief.entities.some((e) => e.type === 'regulator')).toBe(true);
    expect(brief.verify.join(' ')).toMatch(/official release/);
  });
});

describe('AI brief merge', () => {
  const rules = buildRuleBasedNewsBrief(reliance, NOW);

  it('keeps rule-derived entities, figures and source when merging AI text', () => {
    const merged = mergeAiNewsBrief(rules, {
      summary: 'Reliance grew profit on retail and telecom.', keyPoints: ['Profit up 12%.', 'Revenue up 8%.'], sentiment: 'positive',
      entities: [{ name: 'Invented Corp' }], figures: [{ label: 'Made up', value: '99%' }],
    });
    expect(merged.generatedBy).toBe('ai');
    expect(merged.entities).toEqual(rules.entities);
    expect(merged.figures).toEqual(rules.figures);
    expect(merged.source).toEqual(rules.source);
  });

  it('falls back to the rules brief on malformed AI output', () => {
    expect(mergeAiNewsBrief(rules, null)).toBe(rules);
    expect(mergeAiNewsBrief(rules, { summary: 'Too thin', keyPoints: ['one'] })).toBe(rules);
    expect(mergeAiNewsBrief(rules, parseJsonObject('no json here'))).toBe(rules);
  });

  it('extracts JSON wrapped in prose or code fences', () => {
    expect(parseJsonObject('Here you go:\n```json\n{"summary":"x"}\n```')).toEqual({ summary: 'x' });
  });
});
