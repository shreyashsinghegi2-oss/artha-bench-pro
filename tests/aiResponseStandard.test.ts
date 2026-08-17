import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFallbackStructuredFinancialAnswer,
  sanitizeStructuredFinancialAnswer,
  STRUCTURED_FINANCIAL_ANSWER_JSON_SCHEMA,
  structuredFinancialAnswerSchema,
} from '../server/aiResponseStandard';
import { callGroqStructuredFinancialAnswer } from '../server/groqService';
import { explainNewsArticle } from '../server/businessNewsService';
import { generateLessonContent } from '../server/learningService';
import { StructuredFinancialAnswer } from '../src/types';

const originalGroqApiKey = process.env.GROQ_API_KEY;

const validAnswer: StructuredFinancialAnswer = {
  title: 'Compound Interest',
  directAnswer: 'Compound interest earns interest on both principal and prior interest.',
  steps: [
    { title: 'Set the inputs', explanation: 'Record principal, rate, frequency, and time.' },
    { title: 'Substitute', explanation: 'Put the verified values into the formula.' },
    { title: 'Interpret', explanation: 'Compare the final amount with principal.' },
  ],
  formula: {
    expression: 'A = P × (1 + r/n)^(n × t)',
    variables: [{ symbol: 'P', meaning: 'principal' }],
    whenToUse: 'Use for periodic compounding.',
  },
  example: {
    title: 'Illustrative savings example',
    dataStatus: 'illustrative',
    dataAsOf: '',
    inputs: ['P = 10,000', 'r = 8%'],
    calculation: ['A = 10,000 × (1.08)^5'],
    result: 'A = 14,693.28.',
  },
  interpretation: ['Compounding increases the balance nonlinearly.'],
  risks: ['Actual account rates and fees may differ.'],
  keyTakeaways: ['Confirm the compounding frequency.'],
  sources: [
    { name: 'ArthaBench educational framework', dataDate: '', freshness: 'Illustrative' },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalGroqApiKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqApiKey;
});

describe('Artha structured financial-answer standard', () => {
  it('validates the complete answer contract', () => {
    expect(structuredFinancialAnswerSchema.parse(validAnswer)).toEqual(validAnswer);
    expect(STRUCTURED_FINANCIAL_ANSWER_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(STRUCTURED_FINANCIAL_ANSWER_JSON_SCHEMA.required).toContain('formula');
    expect(STRUCTURED_FINANCIAL_ANSWER_JSON_SCHEMA.required).toContain('example');
    expect(STRUCTURED_FINANCIAL_ANSWER_JSON_SCHEMA.required).toContain('sources');
  });

  it('removes raw Markdown and HTML tokens from structured fields', () => {
    const sanitized = sanitizeStructuredFinancialAnswer({
      ...validAnswer,
      title: '**Compound Interest**',
      directAnswer: 'Line one<br>Line two with `code`.',
    });

    expect(sanitized.title).toBe('Compound Interest');
    expect(sanitized.directAnswer).toBe('Line one\nLine two with code.');
    expect(JSON.stringify(sanitized)).not.toContain('<br>');
    expect(JSON.stringify(sanitized)).not.toContain('**');
  });

  it('creates a complete worked fallback instead of exposing raw model formatting', () => {
    const fallback = createFallbackStructuredFinancialAnswer(
      'Explain compound interest with a formula.',
      '### Raw answer<br>Compound interest grows over time.',
    );

    expect(fallback.formula.expression).toContain('A = P');
    expect(fallback.example.calculation.length).toBeGreaterThan(0);
    expect(fallback.example.dataStatus).toBe('illustrative');
    expect(fallback.directAnswer).not.toContain('<br>');
  });

  it('extracts a safe direct answer from malformed JSON without showing raw JSON', () => {
    const fallback = createFallbackStructuredFinancialAnswer(
      'Explain valuation ratios. Verified context: {"peRatio":34.36,"price":304.95,"dataRetrievedAt":"2026-08-17T14:18:29.210Z","freshness":"delayed","dataProviders":["Finnhub"]}',
      '{"directAnswer":"P/E compares the share price with earnings per share.","steps":[{"title":"Identify"',
    );

    expect(fallback.directAnswer).toBe('P/E compares the share price with earnings per share.');
    expect(fallback.directAnswer).not.toContain('{');
    expect(fallback.formula.expression).toContain('Valuation multiple');
    expect(fallback.formula.expression).not.toContain('Range return');
    expect(fallback.example.dataStatus).toBe('delayed');
    expect(fallback.sources[0].name).toContain('Finnhub');
  });

  it('requests strict Groq JSON Schema output for the active GPT-OSS tutor', async () => {
    process.env.GROQ_API_KEY = 'structured-test-key';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(validAnswer) } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callGroqStructuredFinancialAnswer(
      'Teach finance clearly.',
      'Explain compound interest.',
      { fallbackQuestion: 'Explain compound interest.' },
    );

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { strict: true, name: 'artha_structured_financial_answer' },
    });
    expect(result.title).toBe('Compound Interest');
    expect(JSON.stringify(result)).not.toContain('structured-test-key');
  });

  it('retries with JSON Object mode when the provider rejects strict schema mode', async () => {
    process.env.GROQ_API_KEY = 'structured-test-key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('unsupported schema', { status: 400 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(validAnswer) } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callGroqStructuredFinancialAnswer(
      'Teach finance clearly.',
      'Explain compound interest.',
      { fallbackQuestion: 'Explain compound interest.' },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(retryRequest.response_format).toEqual({ type: 'json_object' });
    expect(retryRequest.messages[0].content).toContain('exactly this contract');
    expect(result.title).toBe('Compound Interest');
  });

  it('returns the same structured contract for AI news analysis', async () => {
    delete process.env.GROQ_API_KEY;
    const result = await explainNewsArticle({
      articleId: 'news-1',
      title: 'Company revenue increased from 100 to 108',
      summary: 'The company reported a year-over-year revenue increase.',
      sourceName: 'Example Business Desk',
      sourceUrl: 'https://example.com/news-1',
      publishedAt: '2026-08-17T00:00:00.000Z',
    });

    expect(structuredFinancialAnswerSchema.parse(result.structuredAnswer)).toBeTruthy();
    expect(result.keyTakeaways).toEqual(result.structuredAnswer.keyTakeaways);
    expect(JSON.stringify(result.structuredAnswer)).not.toContain('<br>');
  });

  it('returns a structured answer inside every generated AI lesson', async () => {
    delete process.env.GROQ_API_KEY;
    const result = await generateLessonContent({
      trackId: 'personal-finance',
      moduleId: 'test-module',
      lessonId: 'test-lesson',
      objective: 'Explain compound interest with a formula and a worked example.',
      learnerLevel: 'beginner',
      language: 'english',
      learningMode: 'step-by-step',
    });

    expect(structuredFinancialAnswerSchema.parse(result.lesson.structuredAnswer)).toBeTruthy();
    expect(result.lesson.stepByStepLesson.length).toBeGreaterThan(0);
    expect(result.lesson.formula).toContain('A = P');
  });
});
