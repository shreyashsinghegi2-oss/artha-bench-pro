/**
 * Groq extractor for Layer A. Asks a small, fast model for STRUCTURE only (intent, entities, amount labels,
 * horizon, time-sensitivity) in JSON mode. It is told never to answer. Its output is validated and merged by
 * src/advisor/query-parser.ts, which refuses any number that is not in the user's question.
 */
import { ENTITIES, INTENTS, AMOUNT_TYPES, type AiExtraction, type AiExtractor } from '../../src/advisor/types';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
/** Small model: extraction needs speed, not reasoning. Override with GROQ_PARSER_MODEL. */
export const DEFAULT_PARSER_MODEL = 'llama-3.1-8b-instant';

export const PARSER_SYSTEM_PROMPT = [
  'You extract structure from a personal-finance question. You NEVER answer it, give advice or add facts.',
  'Return ONLY a JSON object with these keys:',
  `- "intent": one of ${INTENTS.join(', ')}. COMPARE = choosing between options; CALCULATE = a number for given inputs; EXPLAIN = what/why/how something works; PLAN = reaching a goal or allocating money; ALERT = notify me when something happens.`,
  `- "entities": array using ONLY these codes: ${ENTITIES.join(', ')}. Omit anything else.`,
  `- "amounts": array of {"value": number in full units (5 lakh = 500000, 1.2 crore = 12000000, 50k = 50000), "type": one of ${AMOUNT_TYPES.join(', ')}}. Include ONLY amounts written in the question. Do not compute or infer amounts.`,
  '- "time_horizon": "<N>y" or "<N>m" only if the question states a duration or date, else null.',
  '- "is_time_sensitive": true only if the question depends on today\'s market, news or current rates.',
  'The question may be in English, Hindi or Hinglish.',
].join('\n');

export interface GroqExtractorOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

/** Returns an extractor, or undefined when Groq is not configured (the parser then uses rules only). */
export function createGroqExtractor(opts: GroqExtractorOptions = {}): AiExtractor | undefined {
  const apiKey = opts.apiKey ?? process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return undefined;
  const model = opts.model ?? (process.env.GROQ_PARSER_MODEL?.trim() || DEFAULT_PARSER_MODEL);
  const doFetch = opts.fetchImpl ?? fetch;
  return async (question: string): Promise<AiExtraction> => {
    const res = await doFetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PARSER_SYSTEM_PROMPT },
          { role: 'user', content: question },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq parser HTTP ${res.status}`);
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Groq parser returned no content');
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Groq parser returned non-object JSON');
    return parsed as AiExtraction;
  };
}
