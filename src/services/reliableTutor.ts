import type { StructuredFinancialAnswer, TutorPreferences } from '../types';

export type ReliableTutorResponse = {
  answer: string;
  suggestedFollowUps: string[];
  fallbackMode: boolean;
  providerStatus: 'ai' | 'grounded_fallback';
};

const DEFAULT_CONTEXT: TutorPreferences = {
  country: 'Global',
  currency: 'USD',
  language: 'english',
  level: 'advanced',
  mode: 'explain',
  detail: 'detailed',
  useOfficialSources: false,
};

const UNSAFE_TRADING = /\b(buy|sell|hold|short|long|entry|exit|target(?:\s+price)?|stop[- ]?loss|leverage|guarantee(?:d)?|sure[- ]?shot|what\s+should\s+i\s+invest|how\s+much\s+should\s+i\s+trade)\b/i;

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value).slice(0, 5500);
  } catch {
    return '{}';
  }
}

function collectFacts(value: unknown, path = '', output: string[] = []): string[] {
  if (output.length >= 14 || value == null) return output;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const label = path.split('.').at(-1) || 'value';
    const readable = label.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
    output.push(`${readable}: ${String(value)}`);
    return output;
  }
  if (Array.isArray(value)) {
    if (value.length && typeof value[0] === 'object') output.push(`${path || 'observations'}: ${value.length} item(s)`);
    for (const item of value.slice(0, 3)) collectFacts(item, path, output);
    return output;
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (/raw|token|secret|api.?key/i.test(key)) continue;
      collectFacts(nested, path ? `${path}.${key}` : key, output);
      if (output.length >= 14) break;
    }
  }
  return output;
}

export function buildGroundedFallbackAnswer(question: string, visibleData?: unknown): string {
  if (UNSAFE_TRADING.test(question)) {
    return 'I can explain the visible market data, source timestamps, chart ranges, volatility and risk concepts, but I cannot provide personalised buy/sell instructions, entries, exits, targets, stop-loss levels, leverage guidance or guaranteed-return claims.';
  }

  const facts = collectFacts(visibleData).filter(Boolean);
  const evidenceBlock = facts.length
    ? facts.map((fact) => `- ${fact}`).join('\n')
    : '- No verified page evidence was available for this request.';

  return [
    'ArthaMind grounded fallback mode',
    '',
    'The external AI provider did not return a usable response, so I am answering only from the verified information already visible on this page.',
    '',
    'Visible evidence',
    evidenceBlock,
    '',
    'Interpretation',
    'Use the values above as observations, not predictions. Check source timestamps and freshness labels before relying on time-sensitive values. A missing value is unavailable rather than zero.',
    '',
    'Limitations',
    '- No new market fact, forecast, bid/ask value, indicator, news item, personal record or company fundamental has been invented in fallback mode.',
    '- This response is educational and does not provide personalised trading, investment, tax, legal, lending or credit instructions.',
    '',
    `Question received: ${question}`,
  ].join('\n');
}

export function buildFallbackStructuredAnswer(input: {
  title: string;
  question: string;
  answer: string;
  sourceLabels?: string[];
  dataAsOf?: string;
}): StructuredFinancialAnswer {
  const sources = (input.sourceLabels || []).filter(Boolean).slice(0, 8);
  return {
    title: input.title,
    directAnswer: input.answer,
    steps: [
      { title: 'Evidence boundary', explanation: 'This fallback uses only the visible data supplied by the current page. It does not fetch or invent additional facts.' },
      { title: 'Review freshness', explanation: 'Check timestamps, provider labels, selected periods and missing-data states before interpreting the visible values.' },
    ],
    formula: {
      expression: 'Not applicable',
      variables: [],
      whenToUse: 'No new formula is introduced by the grounded fallback unless a deterministic calculation is already visible on the page.',
    },
    example: {
      title: 'Visible page evidence only',
      dataStatus: 'latest_available',
      dataAsOf: input.dataAsOf || new Date().toISOString(),
      inputs: [`Question: ${input.question}`],
      calculation: ['No hidden or model-generated numerical calculation was substituted.'],
      result: 'The explanation is restricted to supplied page evidence.',
    },
    interpretation: ['Provider/model fallback mode is active. Treat observations as descriptive, not predictive.'],
    risks: [
      'External AI generation is unavailable or did not return a usable response.',
      'Missing values remain unavailable rather than being inferred as zero.',
    ],
    keyTakeaways: [
      'The assistant remains responsive without inventing unsupported evidence.',
      'Retry later for a full external-model explanation if desired.',
    ],
    sources: sources.map((name) => ({
      name,
      dataDate: input.dataAsOf || new Date().toISOString(),
      freshness: 'Visible page context / grounded fallback',
    })),
  };
}

export async function askReliableTutor(
  question: string,
  options: {
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    context?: TutorPreferences;
    visibleData?: unknown;
  } = {},
): Promise<ReliableTutorResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch('/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        userPrompt: question,
        message: question,
        history: options.history || [],
        context: options.context || DEFAULT_CONTEXT,
        visibleContext: safeJson(options.visibleData),
      }),
    });
    const body = await response.json().catch(() => null);
    const answer = typeof body?.answer === 'string' && body.answer.trim()
      ? body.answer.trim()
      : typeof body?.response === 'string' && body.response.trim()
        ? body.response.trim()
        : '';
    if (response.ok && answer && !/could not reach the configured ai provider|ai response unavailable/i.test(answer)) {
      return {
        answer,
        suggestedFollowUps: Array.isArray(body?.suggestedFollowUps) ? body.suggestedFollowUps.filter((item: unknown): item is string => typeof item === 'string') : [],
        fallbackMode: false,
        providerStatus: 'ai',
      };
    }
  } catch {
    // Grounded fallback below intentionally keeps the assistant responsive.
  } finally {
    clearTimeout(timeout);
  }

  return {
    answer: buildGroundedFallbackAnswer(question, options.visibleData),
    suggestedFollowUps: [
      'Explain the source timestamp and freshness.',
      'Summarise the visible range without predicting the next move.',
      'What data is missing from this page?',
    ],
    fallbackMode: true,
    providerStatus: 'grounded_fallback',
  };
}
