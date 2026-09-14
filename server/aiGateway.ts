import { callGroqStructuredFinancialAnswer, getGroqModels } from './groqService';
import { callNvidiaNemotron, DEFAULT_NVIDIA_MODEL } from './nvidiaService';
import { StructuredFinancialAnswer } from '../src/types';
import { structuredFinancialAnswerSchema, createFallbackStructuredFinancialAnswer } from './aiResponseStandard';

export type AiTask = 'education' | 'calculation' | 'live_data' | 'quiz' | 'scenario' | 'evaluation' | 'report' | 'general';
export type AiModel = 'artha' | 'nemotron';

export interface AiContext {
  country?: 'India' | 'US' | 'Global';
  currency?: 'INR' | 'USD' | 'EUR' | 'GBP';
  language?: 'english' | 'hindi' | 'hinglish';
  level?: 'beginner' | 'intermediate' | 'advanced';
  mode?: 'explain' | 'quiz' | 'calc';
  detail?: 'short' | 'detailed';
  useOfficialSources?: boolean;
}

export interface AiGatewayRequest {
  prompt: string;
  requestedModel?: AiModel;
  task?: AiTask;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: AiContext;
}

function requestId() {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function systemPrompt(task: AiTask, context: AiContext) {
  return `You are ArthaBench, a professional financial-learning and AI-evaluation assistant. Task=${task}. Context: country=${context.country || 'Global'}, currency=${context.currency || 'USD'}, language=${context.language || 'english'}, level=${context.level || 'beginner'}, mode=${context.mode || 'explain'}, detail=${context.detail || 'detailed'}.
Return one structured financial answer. Never invent live prices, sources, dates, regulations or calculations. Deterministic calculations and verified external data are authoritative; explain them rather than replacing them. Never give personalized buy/sell/hold instructions or guaranteed returns. Avoid robotic phrases and repeated disclaimers. For quiz mode ask one question at a time. For guided calculation, ask only for missing inputs and calculate only after they are supplied.`;
}

function sanitizeText(text: string) {
  return text
    .replace(/```(?:json|markdown|text)?/gi, '')
    .replace(/```/g, '')
    .replace(/^\s*(JSON|Answer):\s*/i, '')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\%/g, '%')
    .replace(/\\#/g, '#')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1) / ($2)')
    .replace(/\\\[|\\\]/g, '')
    .trim();
}

function presentationFromText(text: string, task: AiTask, model: string): StructuredFinancialAnswer {
  const clean = sanitizeText(text);
  return {
    title: task === 'calculation' ? 'Verified financial calculation' : task === 'quiz' ? 'Financial learning check' : 'ArthaBench financial explanation',
    directAnswer: clean,
    steps: [],
    formula: { expression: 'Shown only when relevant to the question.', variables: [], whenToUse: 'Use a formula when a financial calculation is required.' },
    example: { title: 'Learning context', dataStatus: 'not_applicable', dataAsOf: new Date().toISOString(), inputs: [], calculation: [], result: clean, },
    interpretation: [],
    risks: ['AI-generated explanations should be verified when they affect consequential financial decisions.'],
    keyTakeaways: [],
    sources: [],
  } as StructuredFinancialAnswer;
}

export async function runAiGateway(request: AiGatewayRequest) {
  const id = requestId();
  const started = Date.now();
  const context = request.context || {};
  const task = request.task || 'general';
  const preferred = request.requestedModel || 'artha';
  const candidates: AiModel[] = preferred === 'nemotron' ? ['nemotron', 'artha'] : ['artha', 'nemotron'];
  let lastError = 'No configured AI provider responded.';

  for (const model of candidates) {
    try {
      if (model === 'nemotron') {
        if (!process.env.NVIDIA_API_KEY?.trim()) throw new Error('NVIDIA is not configured.');
        const result = await callNvidiaNemotron(
          request.prompt,
          request.history,
          systemPrompt(task, context),
          DEFAULT_NVIDIA_MODEL,
        );
        const structured = presentationFromText(result.text, task, result.model);
        return { ok: true, requestId: id, answer: sanitizeText(result.text), structuredAnswer: structured, provider: 'NVIDIA NIM', model: result.model, fallbackUsed: model !== preferred, latencyMs: Date.now() - started };
      }

      const models = getGroqModels();
      const structured = await callGroqStructuredFinancialAnswer(
        systemPrompt(task, context),
        request.prompt,
        { modelName: models.tutorModel, history: request.history, fallbackQuestion: request.prompt },
      );
      const parsed = structuredFinancialAnswerSchema.safeParse(structured);
      if (!parsed.success) throw new Error('AI structured response failed validation.');
      const answer = sanitizeText(parsed.data.directAnswer || parsed.data.example?.result || '');
      return { ok: true, requestId: id, answer, structuredAnswer: parsed.data, provider: 'Groq', model: models.tutorModel, fallbackUsed: model !== preferred, latencyMs: Date.now() - started };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Provider request failed.';
    }
  }

  const fallback = createFallbackStructuredFinancialAnswer(request.prompt, `The live AI providers are temporarily unavailable. I can still help explain this topic, but I will not invent an unsupported answer.`);
  return { ok: false, requestId: id, answer: fallback.directAnswer, structuredAnswer: fallback, provider: 'Local fallback', model: 'ArthaBench', fallbackUsed: true, latencyMs: Date.now() - started, error: 'AI providers temporarily unavailable', sanitizedProviderError: lastError.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]') };
}
