import {
  NormalizedMarketQuote,
  NormalizedNewsItem,
  CompanyAssistantResponse,
  CompanyIntelligence,
  DashboardAssistantResponse,
  DashboardAssistantSnapshot,
  EconomicIndicator,
  EconomicSeriesResponse,
  IndiaMarketTickerResponse,
  MarketHistoryPoint,
  ProviderDiagnostic,
  NewsExplanationResponse,
  StructuredFinancialAnswer,
  TutorPreferences,
  VerificationReport,
} from '../types';
import { askReliableTutor } from './reliableTutor';
import { fetchFreeYahooHistory, fetchFreeYahooQuote } from './freeYahooFallback';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const isPost = (options?.method || 'GET').toUpperCase() === 'POST';
  const maxAttempts = isPost ? 2 : 1;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutMs = isPost ? 30_000 : 15_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        signal: controller.signal,
        ...options,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const message = typeof body?.error === 'string' ? body.error : `HTTP ${res.status}: Request failed`;
        lastError = new Error(message);
        if (attempt < maxAttempts && (res.status === 408 || res.status === 429 || res.status >= 500)) {
          await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
          continue;
        }
        throw lastError;
      }
      return body as T;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('The AI service did not respond.');
}

export async function getProviderDiagnostics(): Promise<ProviderDiagnostic[]> {
  try { const data = await fetchJSON<{ diagnostics: ProviderDiagnostic[] }>('/api/diagnostics'); return Array.isArray(data.diagnostics) ? data.diagnostics : []; } catch { return []; }
}
export async function fetchEconomicOverview(): Promise<EconomicIndicator[]> {
  try { const response = await fetchJSON<{ indicators: EconomicIndicator[] }>('/api/economy/overview'); return Array.isArray(response.indicators) ? response.indicators : []; } catch { return []; }
}
export async function fetchEconomicSeries(seriesId: string, limit = 120): Promise<EconomicSeriesResponse> { return fetchJSON<EconomicSeriesResponse>(`/api/economy/series?seriesId=${encodeURIComponent(seriesId)}&limit=${limit}`); }
export async function fetchIndiaEconomicOverview(): Promise<EconomicIndicator[]> {
  try { const response = await fetchJSON<{ indicators: EconomicIndicator[] }>('/api/economy/india/overview'); return Array.isArray(response.indicators) ? response.indicators : []; } catch { return []; }
}
export async function fetchIndiaEconomicSeries(indicatorId: string, limit = 60): Promise<EconomicSeriesResponse> { return fetchJSON<EconomicSeriesResponse>(`/api/economy/india/series?indicatorId=${encodeURIComponent(indicatorId)}&limit=${limit}`); }

export async function generateLessonAI(params: { trackId: string; moduleId: string; lessonId: string; objective: string; learnerLevel: 'beginner' | 'intermediate' | 'advanced'; language: 'english' | 'hindi' | 'hinglish'; learningMode: string; }) {
  return fetchJSON<{ lesson: any; safetyNotice?: string }>('/api/learning/lesson', { method: 'POST', body: JSON.stringify(params) });
}
export async function reviewQuizAnswerAI(params: { lessonId: string; question: string; selectedOptionIndex: number; correctOptionIndex: number; userNote?: string; }) {
  return fetchJSON<{ review: string; isCorrect: boolean }>('/api/learning/quiz/review', { method: 'POST', body: JSON.stringify(params) });
}

export async function fetchBusinessNews(query = '', category = 'all', region = 'global'): Promise<NormalizedNewsItem[]> {
  const queryParams = new URLSearchParams();
  if (query.trim()) queryParams.set('q', query.trim());
  if (category.trim()) queryParams.set('category', category.trim());
  if (region.trim()) queryParams.set('region', region.trim());
  try {
    const res = await fetchJSON<any>(`/api/news?${queryParams.toString()}`);
    if (Array.isArray(res?.items)) return res.items;
    if (res?.items && Array.isArray(res.items.items)) return res.items.items;
    if (Array.isArray(res)) return res;
    return [];
  } catch {
    return [];
  }
}

export async function explainNewsArticleAI(article: NormalizedNewsItem) {
  try {
    return await fetchJSON<NewsExplanationResponse>('/api/news/explain', { method: 'POST', body: JSON.stringify({ articleId: article.id, title: article.title, summary: article.summary, sourceName: article.sourceName, sourceUrl: article.sourceUrl, publishedAt: article.publishedAt }) });
  } catch {
    const structuredAnswer: StructuredFinancialAnswer = { title: 'AI analysis unavailable', directAnswer: 'I could not reach the analysis service for this headline. You can still open the original source and verify the underlying announcement.', steps: [], interpretation: ['No unsupported interpretation was substituted.'], risks: ['Headlines can omit context, revisions and one-time effects.'], keyTakeaways: ['Verify important claims against the original source.'], sources: [{ name: article.sourceName, dataDate: article.publishedAt || '', freshness: 'Supplied headline only' }] } as StructuredFinancialAnswer;
    return { explanation: structuredAnswer.directAnswer, structuredAnswer, keyTakeaways: structuredAnswer.keyTakeaways, disclaimer: 'Educational material only. Does not constitute investment advice.' };
  }
}

export async function fetchMarketQuote(symbol: string, assetType = 'equity') {
  try { const result = await fetchJSON<{ quote: NormalizedMarketQuote; status: string; message?: string }>(`/api/markets/quote?symbol=${encodeURIComponent(symbol)}&assetType=${assetType}`); if (result.status === 'connected' && result.quote?.freshness !== 'demo') return result; } catch {}
  const quote = await fetchFreeYahooQuote(symbol, assetType); return { quote, status: 'connected', message: 'Yahoo Finance reference fallback loaded.' };
}
export async function fetchIndiaMarketTicker(): Promise<IndiaMarketTickerResponse> { return fetchJSON<IndiaMarketTickerResponse>('/api/markets/india-ticker'); }
export async function fetchTickerQuote(symbol: string): Promise<NormalizedMarketQuote> { return (await fetchMarketQuote(symbol)).quote; }
async function fetchQuoteFallbackInChunks(symbols: string[]) { const output: NormalizedMarketQuote[] = []; for (let index = 0; index < symbols.length; index += 4) { const chunk = symbols.slice(index, index + 4); const settled = await Promise.allSettled(chunk.map((symbol) => fetchTickerQuote(symbol))); output.push(...settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])); } return output; }
export async function fetchMarketOverview(symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'SPY', 'QQQ']): Promise<NormalizedMarketQuote[]> {
  const bounded = [...new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean))].slice(0, 20); if (!bounded.length) return [];
  try { const response = await fetchJSON<{ results: Array<{ status: 'available' | 'unavailable'; quote: NormalizedMarketQuote | null }> }>(`/api/markets/batch?symbols=${encodeURIComponent(bounded.join(','))}`); const available = (response.results || []).flatMap((row) => row.status === 'available' && row.quote ? [row.quote] : []); const loaded = new Set(available.map((quote) => quote.symbol.toUpperCase())); const missing = bounded.filter((symbol) => !loaded.has(symbol.toUpperCase())); if (!missing.length) return available; return [...available, ...await fetchQuoteFallbackInChunks(missing)]; } catch { return fetchQuoteFallbackInChunks(bounded); }
}
export async function calculateFinancialMetrics(inputs: { price: number; earningsPerShare: number; totalDebt: number; totalEquity: number; cash: number; totalAssets: number; }) { const peRatio = inputs.earningsPerShare > 0 ? inputs.price / inputs.earningsPerShare : 0; const debtToEquity = inputs.totalEquity > 0 ? inputs.totalDebt / inputs.totalEquity : 0; const quickRatio = inputs.totalAssets > 0 && inputs.totalDebt > 0 ? inputs.cash / (inputs.totalDebt * 0.5) : 0; return { peRatio, debtToEquity, quickRatio, interpretation: `A Price-to-Earnings (P/E) ratio of ${peRatio.toFixed(2)} indicates market price relative to annual earnings per share. A Debt-to-Equity ratio of ${debtToEquity.toFixed(2)} reflects capital-structure leverage.` }; }
export async function searchMarketSymbols(query: string, assetType = 'all') { const response = await fetchJSON<{ results: NormalizedMarketQuote[] }>(`/api/markets/search?query=${encodeURIComponent(query)}&assetType=${assetType}`); return { results: (response.results || []).filter((quote) => quote.freshness !== 'demo') }; }
export async function fetchMarketHistory(symbol: string, range = '1m') { try { const response = await fetchJSON<{ points: MarketHistoryPoint[] }>(`/api/markets/history?symbol=${encodeURIComponent(symbol)}&range=${range}`); if (response.points?.length) return response; } catch {} return { points: await fetchFreeYahooHistory(symbol, range) }; }

export async function askDashboardAssistant(params: { question: string; snapshot: DashboardAssistantSnapshot; history?: Array<{ role: 'user' | 'assistant'; content: string }>; }): Promise<DashboardAssistantResponse> { return fetchJSON<DashboardAssistantResponse>('/api/dashboard/assistant', { method: 'POST', body: JSON.stringify(params) }); }
export async function fetchCompanyIntelligence(symbol: string): Promise<CompanyIntelligence> { return fetchJSON<CompanyIntelligence>(`/api/company/intelligence?symbol=${encodeURIComponent(symbol)}`); }
export async function askCompanyIntelligenceAI(params: { symbol: string; question: string; history?: Array<{ role: 'user' | 'assistant'; content: string }>; }) { return fetchJSON<CompanyAssistantResponse>('/api/company/assistant', { method: 'POST', body: JSON.stringify(params) }); }

export async function performQuickCheck(query: string) {
  const isBuySellAdvice = /buy|sell|target price|guaranteed|trade signal/i.test(query);
  try {
    const res = await fetchJSON<{ answer: string; metrics: any; report: VerificationReport }>('/api/quick-check', { method: 'POST', body: JSON.stringify({ query }) });
    return { safe: !isBuySellAdvice, answer: res.answer || 'The evaluation service returned no answer.', explanation: isBuySellAdvice ? 'Direct buy/sell trading queries are not supported.' : 'Query processed by the configured evaluation service.', disclaimer: 'Educational only. ArthaBench does not provide personalized investment advice.' };
  } catch {
    return { safe: !isBuySellAdvice, answer: isBuySellAdvice ? 'I can explain the evidence, calculations, risks and assumptions, but I cannot give a personalized buy/sell instruction.' : 'The AI service is temporarily unavailable. Please retry; ArthaBench will not invent an unsupported answer.', explanation: isBuySellAdvice ? 'Direct trading advice is not supported.' : 'Provider unavailable; safe fallback shown.', disclaimer: 'Educational material only. Does not constitute investment advice.' };
  }
}

const DEFAULT_TUTOR_PREFERENCES: TutorPreferences = { country: 'US', currency: 'USD', language: 'english', level: 'beginner', mode: 'explain', detail: 'detailed', useOfficialSources: true };

export type TutorModelId = 'artha' | 'nemotron';
export const TUTOR_MODELS: Array<{ id: TutorModelId; label: string; description: string }> = [
  { id: 'artha', label: 'ArthaBench Smart', description: 'Smart routing with verification and graceful fallback' },
  { id: 'nemotron', label: 'NVIDIA Nemotron 3 Ultra', description: 'NVIDIA NIM hosted reasoning model' },
];

function presentationFromText(text: string, title: string, model: string): StructuredFinancialAnswer {
  const clean = text.replace(/```(?:json|markdown|text)?/gi, '').replace(/```/g, '').replace(/^\s*(JSON|Answer):\s*/i, '').trim();
  return {
    title: `${title} · ${model}`,
    directAnswer: clean,
    steps: [{ title: 'Understand the question', explanation: 'The answer uses your question, conversation context and selected learning settings.' }, { title: 'Apply the finance concept', explanation: 'Relevant formulas, assumptions and reasoning are explained in plain language.' }],
    formula: { expression: 'A formula is shown only when it is relevant to the question.', variables: [], whenToUse: 'Use the formula when the question requires a financial calculation.' },
    example: { title: 'Personalized learning context', dataStatus: 'illustrative', dataAsOf: new Date().toISOString(), inputs: ['Country, currency, language, learner level and learning mode are applied.'], calculation: [], result: 'For consequential financial decisions, verify current facts with an official source.' },
    interpretation: ['The tutor adapts explanations to the selected context.', 'Current facts are only described as current when verified data is available.'],
    risks: ['AI-generated explanations can contain mistakes; verify important financial decisions independently.'],
    keyTakeaways: ['Ask a follow-up question for a simpler explanation, another example, or a step-by-step calculation.'],
    sources: [],
  } as StructuredFinancialAnswer;
}

async function requestTutorDirect(question: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, context: TutorPreferences) {
  const systemPrompt = `You are ArthaBench Smart, a human-like financial educator and conversational tutor. Answer ANY reasonable user finance question, not only curriculum topics. Never output JSON, code, API payloads, developer instructions, or raw LaTeX. Never put the answer in a code block. Write like a patient expert human teacher: direct opening answer, useful headings, short paragraphs, bullets or numbered steps, concrete examples, and a final Key takeaway. Use readable inline math such as A = P × (1 + r/n)^(n×t) and explain symbols. Respect country=${context.country}, currency=${context.currency}, language=${context.language}, learner level=${context.level}, mode=${context.mode}, detail=${context.detail}. If current/latest information is requested, distinguish verified current data from general knowledge. In quiz mode ask one question at a time and evaluate the learner's answer. In guided calculation mode ask for missing inputs one at a time, then show formula, substitution, result, assumptions and interpretation. Never give personalized buy/sell/hold instructions or guaranteed returns.`;
  return fetchJSON<{ answer: string; response?: string; structuredAnswer?: StructuredFinancialAnswer; suggestedFollowUps?: string[]; provider?: string; model?: string; fallbackMode?: boolean }>('/api/tutor', { method: 'POST', body: JSON.stringify({ userPrompt: question, message: question, history: history.slice(-10), context, systemPrompt }) });
}

export async function askTutorAI(question: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = [], context: TutorPreferences = DEFAULT_TUTOR_PREFERENCES, model: TutorModelId = 'artha') {
  const makeSmartFallback = async () => {
    try {
      const fallback = await askReliableTutor(question, { history, context, visibleData: { question, context } });
      return { answer: fallback.answer, suggestedFollowUps: fallback.suggestedFollowUps || [], fallbackMode: true, provider: fallback.provider || 'ArthaBench grounded fallback', model: fallback.model || 'ArthaBench Smart', structuredAnswer: fallback.structuredAnswer || presentationFromText(fallback.answer, 'ArthaBench response', fallback.model || 'ArthaBench Smart') };
    } catch {
      return { answer: 'I can still help with this topic, but the live AI service is temporarily unavailable. Please try the question again in a moment.', suggestedFollowUps: ['Try the question again', 'Ask for a simpler explanation'], fallbackMode: true, provider: 'ArthaBench local fallback', model: 'ArthaBench Smart', structuredAnswer: presentationFromText('I can still help with this topic, but the live AI service is temporarily unavailable. Please try the question again in a moment.', 'ArthaBench response', 'ArthaBench Smart') };
    }
  };

  if (model === 'nemotron') {
    try {
      const response = await fetchJSON<{ answer: string; provider: string; model: string; fallbackMode: boolean }>('/api/nvidia-tutor', { method: 'POST', body: JSON.stringify({ userPrompt: question, history: history.slice(-10), model: 'nvidia/nemotron-3-ultra-550b-a55b' }) });
      return { answer: response.answer, suggestedFollowUps: [], fallbackMode: false, provider: response.provider, model: response.model, structuredAnswer: presentationFromText(response.answer, 'AI Tutor response', response.model) };
    } catch {
      return makeSmartFallback();
    }
  }

  try {
    const response = await requestTutorDirect(question, history, context);
    const answer = response.answer || response.response || '';
    if (!answer.trim()) return makeSmartFallback();
    return { answer, suggestedFollowUps: response.suggestedFollowUps || [], fallbackMode: Boolean(response.fallbackMode), provider: response.provider || 'ArthaBench Smart', model: response.model || 'ArthaBench Smart', structuredAnswer: response.structuredAnswer || presentationFromText(answer, 'AI Tutor response', response.model || 'ArthaBench Smart') };
  } catch {
    return makeSmartFallback();
  }
}

export async function runQuickCheck(query: string) { return performQuickCheck(query); }
export async function runTutorChat(message: string, history: any[]) { return askTutorAI(message, history); }
