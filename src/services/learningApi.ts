import {
  NormalizedMarketQuote,
  NormalizedNewsItem,
  CompanyAssistantResponse,
  CompanyIntelligence,
  DashboardAssistantResponse,
  DashboardAssistantSnapshot,
  EconomicIndicator,
  EconomicSeriesResponse,
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

// System Connections & Diagnostics
export async function getProviderDiagnostics(): Promise<ProviderDiagnostic[]> {
  try {
    const data = await fetchJSON<{ diagnostics: ProviderDiagnostic[] }>('/api/diagnostics');
    return data.diagnostics;
  } catch {
    return [
      {
        id: 'groq-primary',
        name: 'Groq Primary AI Model',
        role: 'Tutor & Lesson Generation',
        status: 'not_configured',
        lastChecked: new Date().toISOString(),
        message: 'Requires GROQ_API_KEY environment variable',
      },
      {
        id: 'business-news',
        name: 'Business News Provider',
        role: 'Real-time Financial Headlines',
        status: 'not_configured',
        lastChecked: new Date().toISOString(),
        message: 'Requires BUSINESS_NEWS_API_KEY environment variable',
      },
      {
        id: 'market-data',
        name: 'Market Data Provider',
        role: 'Stock, Index & Crypto Feeds',
        status: 'not_configured',
        lastChecked: new Date().toISOString(),
        message: 'Requires MARKET_DATA_API_KEY environment variable',
      },
      {
        id: 'economic-data',
        name: 'Federal Reserve Economic Data (FRED)',
        role: 'Inflation, GDP, unemployment, and interest-rate indicators',
        status: 'not_configured',
        lastChecked: new Date().toISOString(),
        message: 'Requires FRED_API_KEY environment variable',
      },
      {
        id: 'india-economic-data',
        name: 'World Bank India Indicators',
        role: 'India GDP, inflation, unemployment, and interest-rate indicators',
        status: 'error',
        lastChecked: new Date().toISOString(),
        message: 'World Bank India data is temporarily unreachable',
      },
      {
        id: 'company-intelligence',
        name: 'Finnhub Company Intelligence',
        role: 'Company profiles, fundamentals, earnings, and analyst trends',
        status: 'not_configured',
        lastChecked: new Date().toISOString(),
        message: 'Requires FINNHUB_API_KEY environment variable',
      },
    ];
  }
}

// FRED Economic Data APIs
export async function fetchEconomicOverview(): Promise<EconomicIndicator[]> {
  try {
    const response = await fetchJSON<{ indicators: EconomicIndicator[] }>(
      '/api/economy/overview',
    );
    return Array.isArray(response.indicators) ? response.indicators : [];
  } catch {
    return [];
  }
}

export async function fetchEconomicSeries(
  seriesId: string,
  limit = 120,
): Promise<EconomicSeriesResponse> {
  return fetchJSON<EconomicSeriesResponse>(
    `/api/economy/series?seriesId=${encodeURIComponent(seriesId)}&limit=${limit}`,
  );
}

export async function fetchIndiaEconomicOverview(): Promise<EconomicIndicator[]> {
  try {
    const response = await fetchJSON<{ indicators: EconomicIndicator[] }>(
      '/api/economy/india/overview',
    );
    return Array.isArray(response.indicators) ? response.indicators : [];
  } catch {
    return [];
  }
}

export async function fetchIndiaEconomicSeries(
  indicatorId: string,
  limit = 60,
): Promise<EconomicSeriesResponse> {
  return fetchJSON<EconomicSeriesResponse>(
    `/api/economy/india/series?indicatorId=${encodeURIComponent(indicatorId)}&limit=${limit}`,
  );
}

// Learning Workspace AI APIs
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

// Business News APIs
export async function fetchBusinessNews(category?: string): Promise<NormalizedNewsItem[]> {
  const queryParams = new URLSearchParams();
  if (category && category !== 'all') queryParams.set('category', category);

  try {
    const res = await fetchJSON<any>(`/api/news?${queryParams.toString()}`);
    if (Array.isArray(res?.items)) {
      return res.items;
    }
    if (res?.items && Array.isArray(res.items.items)) {
      return res.items.items;
    }
    if (Array.isArray(res)) {
      return res;
    }
    return [];
  } catch (err) {
    console.error('Failed to fetch news, returning fixtures:', err);
    return [
      {
        id: 'news-fixture-1',
        title: 'Federal Reserve Maintains Target Funds Rate Range Amid Inflation Watch',
        summary:
          'Central bank policymakers voted to hold key interest rates steady while evaluating labor market resilience and price inflation indicators.',
        sourceName: 'Financial Times Educational',
        sourceUrl: 'https://ft.com',
        publishedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        category: 'macroeconomics',
        region: 'US',
        imageUrl: null,
      },
      {
        id: 'news-fixture-2',
        title: 'Tech Enterprise Earnings Exceed Consensus Margins Driven by Cloud Demand',
        summary:
          'Major enterprise software firms reported expanding operating cash flow margins following enterprise infrastructure modernization spending.',
        sourceName: 'Wall Street Journal Digest',
        sourceUrl: 'https://wsj.com',
        publishedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        category: 'tech',
        region: 'US',
        imageUrl: null,
      },
      {
        id: 'news-fixture-3',
        title: 'Global Sovereign Bond Yields Adjust Following Monetary Policy Commentary',
        summary:
          'Yield curves shifted across major markets as investors calibrated expectations for government debt issuance and liquidity conditions.',
        sourceName: 'Bloomberg Market Brief',
        sourceUrl: 'https://bloomberg.com',
        publishedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        category: 'policy',
        region: 'Global',
        imageUrl: null,
      },
    ];
  }
}

export async function explainNewsArticleAI(article: NormalizedNewsItem) {
  try {
    return await fetchJSON<NewsExplanationResponse>(
      '/api/news/explain',
      {
        method: 'POST',
        body: JSON.stringify({
          articleId: article.id,
          title: article.title,
          summary: article.summary,
          sourceName: article.sourceName,
          sourceUrl: article.sourceUrl,
          publishedAt: article.publishedAt,
        }),
      }
    );
  } catch {
    const structuredAnswer: StructuredFinancialAnswer = {
      title: 'How to analyze this business headline',
      directAnswer: `This headline should be treated as an initial signal about ${article.title}, not as complete evidence. Read the original source and verify the underlying company filing or official economic release before drawing a conclusion.`,
      steps: [
        { title: 'Identify the claim', explanation: 'Separate the event being reported from the interpretation attached to it.' },
        { title: 'Open the primary source', explanation: 'Check the original article and any linked filing, earnings release, or official dataset.' },
        { title: 'Compare the metric', explanation: 'Evaluate the reported figure against its prior period and an appropriate benchmark.' },
        { title: 'Review limitations', explanation: 'Check dates, units, revisions, one-time effects, and information missing from the summary.' },
      ],
      formula: {
        expression: 'Percentage change = (current value − prior value) / prior value × 100',
        variables: [
          { symbol: 'Current value', meaning: 'the newly reported value' },
          { symbol: 'Prior value', meaning: 'the comparable earlier-period value' },
        ],
        whenToUse: 'Use this method only when the source provides two directly comparable numeric values.',
      },
      example: {
        title: 'Illustrative comparison',
        dataStatus: 'illustrative',
        dataAsOf: '',
        inputs: ['Illustrative prior value = 100', 'Illustrative current value = 108'],
        calculation: ['(108 − 100) / 100 × 100 = 8%'],
        result: 'The illustrative value increased by 8%; this is not a fact from the article.',
      },
      interpretation: ['A headline can identify a topic, but it rarely contains enough context for a complete financial conclusion.'],
      risks: ['The summary may omit revisions, definitions, base effects, or one-time items.'],
      keyTakeaways: ['Verify the full source, compare like-for-like figures, and keep observations separate from conclusions.'],
      sources: [{ name: article.sourceName, dataDate: article.publishedAt || '', freshness: 'Supplied headline and summary only' }],
    };
    return {
      explanation: structuredAnswer.directAnswer,
      structuredAnswer,
      keyTakeaways: structuredAnswer.keyTakeaways,
      disclaimer: 'Educational material only. Does not constitute investment advice.',
    };
  }
}

// Market Data APIs
export async function fetchMarketQuote(symbol: string, assetType = 'equity') {
  return fetchJSON<{ quote: NormalizedMarketQuote; status: string }>(
    `/api/markets/quote?symbol=${encodeURIComponent(symbol)}&assetType=${assetType}`
  );
}

export async function fetchTickerQuote(symbol: string): Promise<NormalizedMarketQuote> {
  try {
    const res = await fetchMarketQuote(symbol);
    return res.quote;
  } catch {
    return {
      symbol: symbol.toUpperCase(),
      name: `${symbol.toUpperCase()} Inc.`,
      assetType: 'equity',
      exchange: 'NASDAQ',
      currency: 'USD',
      price: 185.5,
      open: 182.1,
      high: 187.0,
      low: 181.5,
      previousClose: 180.0,
      change: 5.5,
      changePercent: 3.05,
      volume: 45000000,
      providerTimestamp: new Date().toISOString(),
      retrievedAt: new Date().toISOString(),
      freshness: 'demo',
      providerName: 'Demo Fixture Provider',
    };
  }
}

export async function fetchMarketOverview(symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'SPY', 'QQQ']): Promise<NormalizedMarketQuote[]> {
  try {
    const quotes = await Promise.all(symbols.map((sym) => fetchTickerQuote(sym)));
    return quotes;
  } catch {
    return symbols.map((sym, idx) => ({
      symbol: sym,
      name: `${sym} Corporation`,
      assetType: 'equity',
      exchange: 'NASDAQ',
      currency: 'USD',
      price: 150 + idx * 25,
      open: 148 + idx * 25,
      high: 153 + idx * 25,
      low: 147 + idx * 25,
      previousClose: 148 + idx * 25,
      change: 2.0 + idx,
      changePercent: 1.35 + idx * 0.1,
      volume: 25000000,
      providerTimestamp: new Date().toISOString(),
      retrievedAt: new Date().toISOString(),
      freshness: 'demo',
      providerName: 'Demo Market Provider',
    }));
  }
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
  const quickRatio = inputs.totalAssets > 0 ? inputs.cash / (inputs.totalDebt * 0.5) : 0;

  return {
    peRatio,
    debtToEquity,
    quickRatio,
    interpretation: `A Price-to-Earnings (P/E) ratio of ${peRatio.toFixed(
      2
    )} indicates the market price relative to annual net earnings per share. A Debt-to-Equity ratio of ${debtToEquity.toFixed(
      2
    )} reflects corporate capital structure leverage.`,
  };
}

export async function searchMarketSymbols(query: string, assetType = 'all') {
  return fetchJSON<{ results: NormalizedMarketQuote[] }>(
    `/api/markets/search?query=${encodeURIComponent(query)}&assetType=${assetType}`
  );
}

export async function fetchMarketHistory(symbol: string, range = '1m') {
  return fetchJSON<{ points: { date: string; price: number; volume?: number }[] }>(
    `/api/markets/history?symbol=${encodeURIComponent(symbol)}&range=${range}`
  );
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

export async function fetchCompanyIntelligence(
  symbol: string,
): Promise<CompanyIntelligence> {
  return fetchJSON<CompanyIntelligence>(
    `/api/company/intelligence?symbol=${encodeURIComponent(symbol)}`,
  );
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

// Quick Check & Evaluation Lab APIs
export async function performQuickCheck(query: string) {
  try {
    const res = await fetchJSON<{
      answer: string;
      metrics: any;
      report: VerificationReport;
    }>('/api/quick-check', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });

    const isBuySellAdvice = /buy|sell|target price|guaranteed|trade signal/i.test(query);

    return {
      safe: !isBuySellAdvice,
      answer: res.answer || 'Educational overview: Financial queries should focus on mathematical models, historical metrics, and non-advisory principles.',
      explanation: isBuySellAdvice
        ? 'Flagged by Artha Bench Safety Defense: Direct buy/sell trading queries violate non-advisory guidelines.'
        : 'Query validated as safe educational inquiry into financial mechanics.',
      disclaimer: 'Strictly educational. Artha Bench does not provide personalized investment advice.',
    };
  } catch {
    const isBuySellAdvice = /buy|sell|target price|guaranteed|trade signal/i.test(query);
    return {
      safe: !isBuySellAdvice,
      answer: `Educational Breakdown for: "${query}"\nFinancial analysis emphasizes evaluating risk-adjusted returns, net present value, and diversification rather than market timing.`,
      explanation: isBuySellAdvice
        ? 'Flagged: Query requests direct trading advice. Reframed to educational theory.'
        : 'Safe educational query.',
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
      answer: res.answer || res.response || 'In corporate finance, understanding fundamental principles allows analysts to evaluate value creation objectively.',
      structuredAnswer: res.structuredAnswer,
      suggestedFollowUps: res.suggestedFollowUps || [],
      mathProof: res.mathProof,
    };
  } catch {
    return {
      answer: `In response to your question ("${question}"):\n\nFinancial theory rests on core concepts such as the Time Value of Money (TVM), Capital Structure, and Risk-Adjusted Returns. When evaluating corporate performance, analysts examine how operational efficiency translates into Free Cash Flow (FCF).`,
      suggestedFollowUps: [
        'How do I calculate Free Cash Flow to Firm (FCFF)?',
        'What is Weighted Average Cost of Capital (WACC)?',
      ],
    };
  }
}

export async function runQuickCheck(query: string) {
  return performQuickCheck(query);
}

export async function runTutorChat(message: string, history: any[]) {
  return askTutorAI(message, history);
}
