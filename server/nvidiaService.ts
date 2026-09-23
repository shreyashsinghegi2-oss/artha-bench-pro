import type { Request, Response } from 'express';
import { withDateContext } from './dateContext';

export const DEFAULT_NVIDIA_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';
export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const allowedModels = new Set([DEFAULT_NVIDIA_MODEL]);

function buildMessages(systemPrompt: string, userPrompt: string, history?: Array<{ role: string; content: string }>) {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [{ role: 'system', content: withDateContext(systemPrompt) }];
  for (const item of Array.isArray(history) ? history.slice(-10) : []) {
    if ((item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string' && item.content.trim()) messages.push({ role: item.role, content: item.content.slice(0, 4_000) });
  }
  messages.push({ role: 'user', content: userPrompt });
  return messages;
}

function sanitizedProviderError(status: number, body = '') {
  if (status === 401 || status === 403) return 'The NVIDIA AI connection is not authorized.';
  if (status === 429) return 'The NVIDIA AI service is temporarily rate-limited.';
  if (status >= 500) return 'The NVIDIA AI service is temporarily unavailable.';
  return body ? 'The NVIDIA AI service returned an invalid response.' : `The NVIDIA AI service returned HTTP ${status}.`;
}

export async function callNvidiaNemotron(userPrompt: string, history?: Array<{ role: string; content: string }>, systemPrompt?: string, requestedModel?: string) {
  const apiKey = process.env.NVIDIA_API_KEY?.trim() || '';
  if (!apiKey) throw new Error('NVIDIA provider is not configured.');
  const configuredModel = process.env.NVIDIA_MODEL?.trim() || DEFAULT_NVIDIA_MODEL;
  const model = requestedModel && allowedModels.has(requestedModel) ? requestedModel : configuredModel;
  if (!allowedModels.has(model)) throw new Error('The requested NVIDIA model is not available.');

  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: buildMessages(systemPrompt || 'You are ArthaBench NVIDIA Nemotron financial-learning assistant. Explain clearly, reason carefully, and never provide personalized buy/sell trading instructions. Never output JSON, code, API payloads or developer instructions.', userPrompt, history),
          temperature: 0.2,
          top_p: 0.7,
          max_tokens: 2_000,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        lastError = new Error(sanitizedProviderError(response.status, detail));
        console.warn(JSON.stringify({ scope: 'nvidia', model, status: response.status, latencyMs: Date.now() - started, attempt }));
        if (attempt < 2 && (response.status === 408 || response.status === 429 || response.status >= 500)) { await new Promise((r) => setTimeout(r, 400)); continue; }
        throw lastError;
      }
      const data = await response.json().catch(() => null);
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new Error('The NVIDIA AI service returned no usable answer.');
      console.info(JSON.stringify({ scope: 'nvidia', model, status: 200, latencyMs: Date.now() - started, attempt }));
      return { text: text.trim(), model };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('NVIDIA provider request failed.');
      if (attempt < 2) { await new Promise((r) => setTimeout(r, 400)); continue; }
    }
  }
  throw lastError || new Error('NVIDIA provider request failed.');
}

export async function handleNvidiaTutor(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const userPrompt = typeof req.body?.userPrompt === 'string' ? req.body.userPrompt.trim() : '';
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const requestedModel = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
  if (!userPrompt || userPrompt.length > 2_000) return res.status(400).json({ error: 'Please enter a question between 1 and 2000 characters.' });
  try {
    const result = await callNvidiaNemotron(userPrompt, history, typeof req.body?.systemPrompt === 'string' ? req.body.systemPrompt : undefined, requestedModel);
    return res.json({ answer: result.text, provider: 'NVIDIA NIM', model: result.model, fallbackMode: false, requestId: res.getHeader('x-request-id') });
  } catch (error) {
    console.warn(JSON.stringify({ scope: 'nvidia', requestId: res.getHeader('x-request-id'), status: 502, error: error instanceof Error ? error.message : 'provider_failure' }));
    return res.status(502).json({ error: 'This model is temporarily unavailable. Retrying with another available AI model.', provider: 'NVIDIA NIM', model: requestedModel || DEFAULT_NVIDIA_MODEL, requestId: res.getHeader('x-request-id') });
  }
}
