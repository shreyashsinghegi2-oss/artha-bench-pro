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
  const maxAttempts = options?.method === 'POST' ? 2 : 1;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        signal: controller.signal,
        ...options,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const message = typeof body?.error === 'string' ? body.error : `HTTP ${res.status}: Request failed`;
        const error = new Error(message);
        lastError = error;
        if (attempt < maxAttempts && (res.status === 429 || res.status >= 500)) {
          await new Promise((resolve) => setTimeout(resolve, 450 * attempt));
          continue;
        }
        throw error;
      }
      return body as T;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 450 * attempt));
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed.');
}

export async function getProviderDiagnostics(): Promise<ProviderDiagnostic[]> { try { const data = await fetchJSON<{ diagnostics: ProviderDiagnostic[] }>('/api/diagnostics'); return Array.isArray(data.diagnostics) ? data.diagnostics : []; } catch { return []; } }
export async function fetchEconomicOverview(): Promise<EconomicIndicator[]> { try { const response = await fetchJSON<{ indicators: EconomicIndicator[] }>('/api/economy/overview'); return Array.isArray(response.indicators) ? response.indicators : []; } catch { return []; } }
export async function fetchEconomicSeries(seriesId: string, limit = 120): Promise<EconomicSeriesResponse> { return fetchJSON<EconomicSeriesResponse>(`/api/economy/series?seriesId=${encodeURIComponent(seriesId)}&limit=${limit}`); }
export async function fetchIndiaEconomicOverview(): Promise<EconomicIndicator[]> { try { const response = await fetchJSON<{ indicators: EconomicIndicator[] }>('/api/economy/india/overview'); return Array.isArray(response.indicators) ? response.indicators : []; } catch { return []; } }
export async function fetchIndiaEconomicSeries(indicatorId: string, limit = 60): Promise<EconomicSeriesResponse> { return fetchJSON<EconomicSeriesResponse>(`/api/economy/india/series?indicatorId=${encodeURIComponent(indicatorId)}&limit=${limit}`); }

export async function generateLessonAI(params: { trackId: string; moduleId: string; lessonId: string; objective: string; learnerLevel: 'beginner' | 'intermediate' | 'advanced'; language: 'english' | 'hindi' | 'hinglish'; learningMode: string; }) { return fetchJSON<{ lesson: any; safetyNotice?: string }>('/api/learning/lesson', { method: 'POST', body: JSON.stringify(params) }); }
export async function reviewQuizAnswerAI(params: { lessonId: string; question: string; selectedOptionIndex: number; correctOptionIndex: number; userNote?: string; }) { return fetchJSON<{ review: string; isCorrect: boolean }>('/api/learning/quiz/review', { method: 'POST', body: JSON.stringify(params) }); }

export async function fetchBusinessNews(category?: string): Promise<NormalizedNewsItem[]> { const queryParams = new URLSearchParams(); if (category && category !== 'all') queryParams.set('category', category); try { const res = await fetchJSON<any>(`/api/news?${queryParams.toString()}`); if (Array.isArray(res?.items)) return res.items; if (res?.items && Array.isArray(res.items.items)) return res.items.items; if (Array.isArray(res)) return res; return []; } catch { return []; } }

export async function explainNewsArticleAI(article: NormalizedNewsItem) {
  try { return await fetchJSON<NewsExplanationResponse>('/api/news/explain', { method: 'POST', body: JSON.stringify({ articleId: article.id, title: article.title, summary: article.summary, sourceName: article.sourceName, sourceUrl: article.sourceUrl, publishedAt: article.publishedAt }) }); }
  catch { const structuredAnswer: StructuredFinancialAnswer = { title: 'AI analysis unavailable', directAnswer: 'ArthaMind could not reach the configured AI provider for this headline. Open the original source and verify the underlying filing or official release directly.', steps: [], interpretation: ['No AI-generated interpretation was substituted while the provider was unavailable.'], risks: ['A headline can omit revisions, definitions, base effects, or one-time items.'], keyTakeaways: ['Verify the full source before drawing a financial conclusion.'], sources: [{ name: article.sourceName, dataDate: article.publishedAt || '', freshness: 'Supplied headline only' }] } as StructuredFinancialAnswer; return { explanation: structuredAnswer.directAnswer, structuredAnswer, keyTakeaways: structuredAnswer.keyTakeaways, disclaimer: 'Educational material only. Does not constitute investment advice.' }; }
}

export async function fetchMarketQuote(symbol: string, assetType = 'equity') { try { const result = await fetchJSON<{ quote: NormalizedMarketQuote; status: string; message?: string }>(`/api/markets/quote?symbol=${encodeURIComponent(symbol)}&assetType=${assetType}`); if (result.status === 'connected' && result.quote?.freshness !== 'demo') return result; } catch {} const quote = await fetchFreeYahooQuote(symbol, assetType); return { quote, status: 'connected', message: 'Yahoo Finance experimental/reference fallback loaded through the Netlify proxy.' }; }
export async function fetchIndiaMarketTicker(): Promise<IndiaMarketTickerResponse> { return fetchJSON<IndiaMarketTickerResponse>('/api/markets/india-ticker'); }
export async function fetchTickerQuote(symbol: string): Promise<NormalizedMarketQuote> { const result = await fetchMarketQuote(symbol); return result.quote; }
async function fetchQuoteFallbackInChunks(symbols: string[]) { const output: NormalizedMarketQuote[] = []; for (let index = 0; index < symbols.length; index += 4) { const chunk = symbols.slice(index, index + 4); const settled = await Promise.allSettled(chunk.map((symbol) => fetchTickerQuote(symbol))); output.push(...settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])); } return output; }
export async function fetchMarketOverview(symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'SPY', 'QQQ']): Promise<NormalizedMarketQuote[]> { const bounded = [...new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean))].slice(0, 20); if (!bounded.length) return []; try { const response = await fetchJSON<{ results: Array<{ status: 'available' | 'unavailable'; quote: NormalizedMarketQuote | null }> }>(`/api/markets/batch?symbols=${encodeURIComponent(bounded.join(','))}`); const available = (response.results || []).flatMap((row) => row.status === 'available' && row.quote ? [row.quote] : []); const loaded = new Set(available.map((quote) => quote.symbol.toUpperCase())); const missing = bounded.filter((symbol) => !loaded.has(symbol.toUpperCase())); if (!missing.length) return available; return [...available, ...await fetchQuoteFallbackInChunks(missing)]; } catch { return fetchQuoteFallbackInChunks(bounded); } }
export async function calculateFinancialMetrics(inputs: { price: number; earningsPerShare: number; totalDebt: number; totalEquity: number; cash: number; totalAssets: number; }) { const peRatio = inputs.earningsPerShare > 0 ? inputs.price / inputs.earningsPerShare : 0; const debtToEquity = inputs.totalEquity > 0 ? inputs.totalDebt / inputs.totalEquity : 0; const quickRatio = inputs.totalAssets > 0 && inputs.totalDebt > 0 ? inputs.cash / (inputs.totalDebt * 0.5) : 0; return { peRatio, debtToEquity, quickRatio, interpretation: `A Price-to-Earnings (P/E) ratio of ${peRatio.toFixed(2)} indicates the market price relative to annual net earnings per share. A Debt-to-Equity ratio of ${debtToEquity.toFixed(2)} reflects corporate capital structure leverage.` }; }
export async function searchMarketSymbols(query: string, assetType = 'all') { const response = await fetchJSON<{ results: NormalizedMarketQuote[] }>(`/api/markets/search?query=${encodeURIComponent(query)}&assetType=${assetType}`); return { results: (response.results || []).filter((quote) => quote.freshness !== 'demo') }; }
export async function fetchMarketHistory(symbol: string, range = '1m') { try { const response = await fetchJSON<{ points: MarketHistoryPoint[] }>(`/api/markets/history?symbol=${encodeURIComponent(symbol)}&range=${range}`); if (response.points?.length) return response; } catch {} return { points: await fetchFreeYahooHistory(symbol, range) }; }

export async function askDashboardAssistant(params: { question: string; snapshot: DashboardAssistantSnapshot; history?: Array<{ role: 'user' | 'assistant'; content: string }>; }): Promise<DashboardAssistantResponse> { return fetchJSON<DashboardAssistantResponse>('/api/dashboard/assistant', { method: 'POST', body: JSON.stringify(params) }); }
export async function fetchCompanyIntelligence(symbol: string): Promise<CompanyIntelligence> { return fetchJSON<CompanyIntelligence>(`/api/company/intelligence?symbol=${encodeURIComponent(symbol)}`); }
export async function askCompanyIntelligenceAI(params: { symbol: string; question: string; history?: Array<{ role: 'user' | 'assistant'; content: string }>; }) { return fetchJSON<CompanyAssistantResponse>('/api/company/assistant', { method: 'POST', body: JSON.stringify(params) }); }

export async function performQuickCheck(query: string) {
  const isBuySellAdvice = /buy|sell|target price|guaranteed|trade signal/i.test(query);
  try { const res = await fetchJSON<{ answer: string; metrics: any; report: VerificationReport }>('/api/quick-check', { method: 'POST', body: JSON.stringify({ query }) }); return { safe: !isBuySellAdvice, answer: res.answer || 'AI response unavailable.', explanation: isBuySellAdvice ? 'Flagged by Artha Bench Safety Defense: Direct buy/sell trading queries violate non-advisory guidelines.' : 'Query processed by the configured evaluation service.', disclaimer: 'Strictly educational. Artha Bench does not provide personalized investment advice.' }; }
  catch { return { safe: !isBuySellAdvice, answer: isBuySellAdvice ? 'Direct trading advice is not supported. I can explain the evidence, calculations, risks and assumptions instead.' : 'The AI service is temporarily unavailable. Please retry; ArthaBench will not invent an unsupported answer.', explanation: isBuySellAdvice ? 'Direct trading advice is not supported.' : 'Provider unavailable; safe fallback shown.', disclaimer: 'Educational material only. Does not constitute investment advice.' }; }
}

const DEFAULT_TUTOR_PREFERENCES: TutorPreferences = { country: 'US', currency: 'USD', language: 'english', level: 'beginner', mode: 'explain', detail: 'detailed', useOfficialSources: true };

export type TutorModelId = 'artha' | 'nemotron';
export const TUTOR_MODELS: Array<{ id: TutorModelId; label: string; description: string }> = [
  { id: 'artha', label: 'ArthaBench Smart', description: 'Smart routing with verification and graceful fallback' },
  { id: 'nemotron', label: 'NVIDIA Nemotron 3 Ultra', description: 'NVIDIA NIM hosted reasoning model' },
];

function presentationFromText(text: string, title: string, model: string): StructuredFinancialAnswer {
  const clean = text.replace(/```(?:json|markdown|text)?/gi, '').replace(/```/g, '').trim();
  return {
    title: `${title} · ${model}`,
    directAnswer: clean,
    steps: [
      { title: 'Understand the question', explanation: 'The response is generated from your question, conversation context and the selected learning settings.' },
      { title: 'Apply the relevant finance concept', explanation: 'Where a formula or calculation is needed, the tutor explains the assumptions and reasoning rather than presenting raw code.' },
    ],
    formula: { expression: 'See the explanation above when a formula is relevant.', variables: [], whenToUse: 'Formulas are shown only when they are relevant to the question.' },
    example: { title: 'Learning context', dataStatus: 'illustrative', dataAsOf: new Date().toISOString(), inputs: ['Country, currency, language, learner level and learning mode are applied to the response.'], calculation: [], result: 'Use the answer as educational guidance and verify consequential current financial information against an official source.' },
    interpretation: ['The tutor adapts its explanation to the selected learner context.', 'Current facts are only stated as current when a connected source is available.'],
    risks: ['AI-generated explanations can contain mistakes; verify important financial decisions independently.'],
    keyTakeaways: ['Ask a follow-up question for a simpler explanation, another example, or a step-by-step calculation.'],
    sources: [],
  };
}

async function requestTutorDirect(question: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, context: TutorPreferences) {
  const systemPrompt = `You are ArthaBench Smart, a human-like financial educator. Answer ANY reasonable user finance-learning question, not only library topics. Never output JSON, code, API payloads, or developer instructions. Never wrap the answer in a code block. Use plain, readable language with short headings, bullets and numbered steps when useful. If a formula is needed, write it as readable math such as A = P × (1 + r/n)^(n×t), followed by what each symbol means. Respect country=${context.country}, currency=${context.currency}, language=${context.language}, learner level=${context.level}, mode=${context.mode}, detail=${context.detail}. If the user asks for current/latest information, clearly distinguish verified current data from general knowledge. For quiz mode ask one question at a time and evaluate answers. For guided calculation, ask for missing inputs one at a time and show substitutions and interpretation. Never give personalised buy/sell/hold instructions or guaranteed returns.`;
  return fetchJSON<{ answer: string; response?: string; structuredAnswer?: StructuredFinancialAnswer; suggestedFollowUps?: string[]; provider?: string; model?: string; fallbackMode?: boolean }>('/api/tutor', {
    method: 'POST',
    body: JSON.stringify({ userPrompt: question, message: question, history: history.slice(-10), context, systemPrompt }),
  });
}

export async function askTutorAI(question: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = [], context: TutorPreferences = DEFAULT_TUTOR_PREFERENCES, model: TutorModelId = 'artha') {
  if (model === 'nemotron') {
    try {
      const response = await fetchJSON<{ answer: string; provider: string; model: string; fallbackMode: boolean }>('/api/nvidia-tutor', { method: 'POST', body: JSON.stringify({ userPrompt: question, history, model: 'nvidia/nemotron-3-ultra-550b-a55b' }) });
      return { answer: response.answer, suggestedFollowUps: [], fallbackMode: false, provider: response.provider, model: response.model, structuredAnswer: presentationFromText(response.answer, 'AI Tutor response', response.model) };
    } catch {
      // Automatic model fallback: a failed hosted model must never strand the learner.
      const fallback = await requestTutorDirect(question, history, context);
      return { answer: fallback.answer || fallback.response || 'I could not generate a response.', suggestedFollowUps: fallback.suggestedFollowUps || [], fallbackMode: true, provider: fallback.provider || 'ArthaBench Smart · fallback', model: fallback.model || 'ArthaBench Smart', structuredAnswer: fallback.structuredAnswer || presentationFromText(fallback.answer || fallback.response || '', 'AI Tutor response', fallback.model || 'ArthaBench Smart') };
    }
  }

  try {
    const response = await requestTutorDirect(question, history, context);
    return { answer: response.answer || response.response || '', suggestedFollowUps: response.suggestedFollowUps || [], fallbackMode: Boolean(response.fallbackMode), provider: response.provider || 'ArthaBench Smart', model: response.model || 'ArthaBench Smart', structuredAnswer: response.structuredAnswer || presentationFromText(response.answer || response.response || '', 'AI Tutor response', response.model || 'ArthaBench Smart') };
  } catch {
    const fallback = await askReliableTutor(question, { history, context, visibleData: { question, context } });
    return { answer: fallback.answer, suggestedFollowUps: fallback.suggestedFollowUps, fallbackMode: fallback.fallbackMode, provider: fallback.provider || 'ArthaBench grounded fallback', model: fallback.model || 'ArthaBench Smart', structuredAnswer: fallback.structuredAnswer || presentationFromText(fallback.answer, 'Grounded fallback', fallback.model || 'ArthaBench Smart') };
  }
}

export async function runQuickCheck(query: string) { return performQuickCheck(query); }
export async function runTutorChat(message: string, history: any[]) { return askTutorAI(message, history); }
