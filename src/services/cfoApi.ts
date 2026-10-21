import type { StructuredFinancialAnswer } from '../types';
import { freedomAnswerText, isFreedomQuestion, verifiedFreedomFromStorage, withVerifiedFigures } from './verifiedFreedom';

export type CfoLanguage = 'english' | 'hindi' | 'hinglish';
export interface CfoTurn { role: 'user' | 'assistant'; content: string }

export interface CfoReply {
  answer: string;
  structured: StructuredFinancialAnswer | null;
  provider: string;
  model: string;
  /** True when the live model did not answer and a safe fallback was returned. */
  fallback: boolean;
}

const MAX_HISTORY = 8;
const TIMEOUT_MS = 45_000;

/** Asks the ArthaMind AI CFO (server task "cfo") with the recent conversation for context. */
export async function askAiCfo(prompt: string, history: CfoTurn[] = [], language: CfoLanguage = 'english', options: { replyLanguage?: string; voice?: boolean; displayText?: string } = {}): Promise<CfoReply> {
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error('Type a question for your ArthaMind CFO.');
  const verified = verifiedFreedomFromStorage();
  // Freedom questions are answered from the verified figures, so they match the dashboard and never depend on the model.
  if (verified && isFreedomQuestion(options.displayText ?? trimmed)) {
    const answer = freedomAnswerText(verified);
    return { answer, structured: null, provider: 'verified', model: 'platform-calculator', fallback: false };
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        prompt: withVerifiedFigures(trimmed, verified).slice(0, 4000),
        task: 'cfo',
        history: history.slice(-MAX_HISTORY).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 4000) })).filter((turn) => turn.content.trim()),
        context: { country: 'India', currency: 'INR', language, detail: options.voice ? 'short' : 'detailed', replyLanguage: options.replyLanguage, voice: options.voice },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 429) throw new Error(data.error || 'You are asking quickly. Please wait a minute and try again.');
    if (!response.ok) throw new Error(data.error || 'The ArthaMind CFO could not answer right now. Please try again.');
    return {
      answer: String(data.answer || data.structuredAnswer?.directAnswer || ''),
      structured: data.structuredAnswer ?? null,
      provider: String(data.provider || 'ArthaMind'),
      model: String(data.model || ''),
      fallback: data.ok === false || Boolean(data.fallbackUsed && data.provider === 'Local fallback'),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('The ArthaMind CFO took too long to respond. Please try again.');
    if (error instanceof TypeError) throw new Error('Network problem: check your connection and try again.');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}
