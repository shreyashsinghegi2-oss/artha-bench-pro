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

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `HTTP ${res.status}: Request failed`);
  }

  return res.json() as Promise<T>;
}

export async function getProviderDiagnostics(): Promise<ProviderDiagnostic[]> {
  try {
    const data = await fetchJSON<{ diagnostics: ProviderDiagnostic[] }>('/api/diagnostics');
    return Array.isArray(data.diagnostics) ? data.diagnostics : [];
  } catch {
    return [];
  }
}

export async function fetchEconomicOverview(): Promise<EconomicIndicator[]> {
  try {
    const response = await fetchJSON<{ indicators: EconomicIndicator[] }>('/api/economy/overview');
    return Array.isArray(response.indicators) ? response.indicators : [];
  } catch {
    return [];
  }
}

export async function fetchEconomicSeries(seriesId: string, limit = 120): Promise<EconomicSeriesResponse> {
  return fetchJSON<EconomicSeriesResponse>(`/api/economy/series?seriesId=${encodeURIComponent(seriesId)}&limit=${limit}`);
}

export async function fetchIndiaEconomicOverview(): Promise<EconomicIndicator[]> {
  try {
    const response = await fetchJSON<{ indicators: EconomicIndicator[] }>('/api/economy/india/overview');
    return Array.isArray(response.indicators) ? response.indicators : [];
  } catch {
    return [];
  }
}

export async function fetchIndiaEconomicSeries(indicatorId: string, limit = 60): Promise<EconomicSeriesResponse> {
  return fetchJSON<EconomicSeriesResponse>(`/api/economy/india/series?indicatorId=${encodeURIComponent(indicatorId)}&limit=${limit}`);
}

export async function generateLessonAI(params: {
  trackId: string;
  moduleId: string;
  lessonId: string;
  objective: string;
  learnerLevel: 'beginner' | 'intermediate' | 'advanced';
  language: 'english' | 'hindi' | 'hinglish';
  learningMode: string;
}) {
  return fetchJSON<{ lesson: any; safetyNotice?: string }>('/api/learning/lesson', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function reviewQuizAnswerAI(params: {
  lessonId: string;
  question: string;
  selectedOptionIndex: number;
  correctOptionIndex: number;
  userNote?: string;
}) {
  return fetchJSON<{ review: string; isCorrect: boolean }>('/api/learning/quiz/review', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function fetchBusinessNews(category?: string): Promise<NormalizedNewsItem[]> {
  const queryParams = new URLSearchParams();
  if (category && category !== 'all') queryParams.set('category', category);
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
    return await fetchJSON<NewsExplanationResponse>('/api/news/explain', {
      method: 'POST',
      body: JSON.stringify({
        articleId: article.id,
        title: article.title,
        summary: article.summary,
        sourceName: article.sourceName,
        sourceUrl: article.sourceUrl,
        publishedAt: article.publishedAt,
      }),
    });
  } catch {
    const structuredAnswer: StructuredFinancialAnswer = {
      title: 'AI analysis unavailable',
      directAnswer: 'ArthaMind could not reach the configured AI provider for this headline. Open the original source and verify the underlying filing or official release directly.',
      steps: [],
      interpretation: ['No AI-generated interpretation was substituted while the provider was unavailable.'],
      risks: ['A headline can omit revisions, definitions, base effects, or one-time items.'],
      keyTakeaways: ['Verify the full source before drawing a financial conclusion.'],
      sources: [{ name: article.sourceName, dataDate: article.publishedAt || '', freshness: 'Supplied headline only' }],
    } as StructuredFinancialAnswer;
    return {
      explanation: structuredAnswer.directAnswer,
      structuredAnswer,
      keyTakeaways: structuredAnswer.keyTakeaways,
      disclaimer: 'Educational material only. Does not constitute investment advice.',
    };
  }
}

export async function fetchMarketQuote(symbol: string, assetType = 'equity') {
  const result = await fetchJSON<{ quote: NormalizedMarketQuote; status: string; message?: string }>(
    `/api/markets/quote?symbol=${encodeURIComponent(symbol)}&assetType=${assetType}`,
  );
  if (result.status !== 'connected' || result.quote?.freshness === 'demo') {
    throw new Error(result.message || 'Market quote is unavailable from a real provider.');
  }
  return result;
}

export async function fetchIndiaMarketTicker(): Promise<IndiaMarketTickerResponse> {
  return fetchJSON<IndiaMarketTickerResponse>('/api/markets/india-ticker');
}

export async function fetchTickerQuote(symbol: string): Promise<NormalizedMarketQuote> {
  const result = await fetchMarketQuote(symbol);
  return result.quote;
}

export async function fetchMarketOverview(symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'SPY', 'QQQ']): Promise<NormalizedMarketQuote[]> {
  const settled = await Promise.allSettled(symbols.map((symbol) => fetchTickerQuote(symbol)));
  return settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
}

export async function calculateFinancialMetrics(inputs: {
  price: number;
  earningsPerShare: number;
  totalDebt: number;
  totalEquity: number;
  cash: number;
  totalAssets: number;
}) {
  const peRatio = inputs.earningsPerShare > 0 ? inputs.price / inputs.earningsPerShare : 0;
  const debtToEquity = inputs.totalEquity > 0 ? inputs.totalDebt / inputs.totalEquity : 0;
  const quickRatio = inputs.totalAssets > 0 && inputs.totalDebt > 0 ? inputs.cash / (inputs.totalDebt * 0.5) : 0;
  return {
    peRatio,
    debtToEquity,
    quickRatio,
    interpretation: `A Price-to-Earnings (P/E) ratio of ${peRatio.toFixed(2)} indicates the market price relative to annual net earnings per share. A Debt-to-Equity ratio of ${debtToEquity.toFixed(2)} reflects corporate capital structure leverage.`,
  };
}

export async function searchMarketSymbols(query: string, assetType = 'all') {
  const response = await fetchJSON<{ results: NormalizedMarketQuote[] }>(
    `/api/markets/search?query=${encodeURIComponent(query)}&assetType=${assetType}`,
  );
  return { results: (response.results || []).filter((quote) => quote.freshness !== 'demo') };
}

export async function fetchMarketHistory(symbol: string, range = '1m') {
  return fetchJSON<{ points: MarketHistoryPoint[] }>(`/api/markets/history?symbol=${encodeURIComponent(symbol)}&range=${range}`);
}

export async function askDashboardAssistant(params: {
  question: string;
  snapshot: DashboardAssistantSnapshot;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<DashboardAssistantResponse> {
  return fetchJSON<DashboardAssistantResponse>('/api/dashboard/assistant', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function fetchCompanyIntelligence(symbol: string): Promise<CompanyIntelligence> {
  return fetchJSON<CompanyIntelligence>(`/api/company/intelligence?symbol=${encodeURIComponent(symbol)}`);
}

export async function askCompanyIntelligenceAI(params: {
  symbol: string;
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  return fetchJSON<CompanyAssistantResponse>('/api/company/assistant', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function performQuickCheck(query: string) {
  const isBuySellAdvice = /buy|sell|target price|guaranteed|trade signal/i.test(query);
  try {
    const res = await fetchJSON<{ answer: string; metrics: any; report: VerificationReport }>('/api/quick-check', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
    return {
      safe: !isBuySellAdvice,
      answer: res.answer || 'AI response unavailable.',
      explanation: isBuySellAdvice
        ? 'Flagged by Artha Bench Safety Defense: Direct buy/sell trading queries violate non-advisory guidelines.'
        : 'Query processed by the configured evaluation service.',
      disclaimer: 'Strictly educational. Artha Bench does not provide personalized investment advice.',
    };
  } catch {
    return {
      safe: !isBuySellAdvice,
      answer: 'The AI/evaluation provider is currently unavailable. No substitute answer was generated.',
      explanation: isBuySellAdvice ? 'Direct trading advice is not supported.' : 'Provider unavailable.',
      disclaimer: 'Educational material only. Does not constitute investment advice.',
    };
  }
}

const DEFAULT_TUTOR_PREFERENCES: TutorPreferences = {
  country: 'US',
  currency: 'USD',
  language: 'english',
  level: 'beginner',
  mode: 'explain',
  detail: 'detailed',
  useOfficialSources: true,
};

export async function askTutorAI(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  context: TutorPreferences = DEFAULT_TUTOR_PREFERENCES,
) {
  try {
    const res = await fetchJSON<{
      answer?: string;
      response?: string;
      structuredAnswer?: StructuredFinancialAnswer;
      suggestedFollowUps: string[];
      mathProof?: string;
    }>('/api/tutor', {
      method: 'POST',
      body: JSON.stringify({ userPrompt: question, message: question, history, context }),
    });
    return {
      answer: res.answer || res.response || 'AI response unavailable.',
      structuredAnswer: res.structuredAnswer,
      suggestedFollowUps: res.suggestedFollowUps || [],
      mathProof: res.mathProof,
    };
  } catch {
    return {
      answer: 'ArthaMind could not reach the configured AI provider. Please retry after provider connectivity is restored.',
      suggestedFollowUps: [],
    };
  }
}

export async function runQuickCheck(query: string) {
  return performQuickCheck(query);
}

export async function runTutorChat(message: string, history: any[]) {
  return askTutorAI(message, history);
}
