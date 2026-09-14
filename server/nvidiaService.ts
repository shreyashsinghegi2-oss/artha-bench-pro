import type { Request, Response } from 'express';

export const NVIDIA_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';
export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

function buildMessages(
  systemPrompt: string,
  userPrompt: string,
  history?: Array<{ role: string; content: string }>,
) {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  for (const item of Array.isArray(history) ? history.slice(-10) : []) {
    if ((item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string' && item.content.trim()) {
      messages.push({ role: item.role, content: item.content.slice(0, 4_000) });
    }
  }

  messages.push({ role: 'user', content: userPrompt });
  return messages;
}

export async function callNvidiaNemotron(
  userPrompt: string,
  history?: Array<{ role: string; content: string }>,
  systemPrompt?: string,
) {
  const apiKey = process.env.NVIDIA_API_KEY?.trim() || '';
  if (!apiKey) throw new Error('NVIDIA_API_KEY is not configured.');

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: buildMessages(
        systemPrompt || 'You are ArthaBench NVIDIA Nemotron financial-learning assistant. Explain clearly, reason carefully, show calculations when relevant, and never provide personalised buy/sell trading instructions.',
        userPrompt,
        history,
      ),
      temperature: 0.2,
      top_p: 0.7,
      max_tokens: 2_000,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`NVIDIA request failed with HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
  }

  const data = await response.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('NVIDIA returned an invalid completion response.');
  }

  return text.trim();
}

export async function handleNvidiaTutor(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const userPrompt = typeof req.body?.userPrompt === 'string'
    ? req.body.userPrompt.trim()
    : '';
  const history = Array.isArray(req.body?.history) ? req.body.history : [];

  if (!userPrompt || userPrompt.length > 2_000) {
    return res.status(400).json({ error: 'A userPrompt between 1 and 2000 characters is required.' });
  }

  try {
    const answer = await callNvidiaNemotron(userPrompt, history);
    return res.json({
      answer,
      provider: 'NVIDIA NIM',
      model: NVIDIA_MODEL,
      fallbackMode: false,
    });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'NVIDIA provider request failed.',
      provider: 'NVIDIA NIM',
      model: NVIDIA_MODEL,
    });
  }
}
