/**
 * Groq LLM for Layer F. A large model writes the explanation; src/advisor/explainer.ts post-checks every number.
 * Override the model with GROQ_EXPLAINER_MODEL.
 */
import type { Llm } from '../../src/advisor/explainer';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_EXPLAINER_MODEL = 'llama-3.3-70b-versatile';

export function createGroqExplainer(opts: { apiKey?: string; model?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Llm | undefined {
  const apiKey = opts.apiKey ?? process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return undefined;
  const model = opts.model ?? (process.env.GROQ_EXPLAINER_MODEL?.trim() || DEFAULT_EXPLAINER_MODEL);
  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 12_000;
  return async (system: string, user: string): Promise<string> => {
    const res = await doFetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 600,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq explainer HTTP ${res.status}`);
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Groq explainer returned no content');
    return content;
  };
}
