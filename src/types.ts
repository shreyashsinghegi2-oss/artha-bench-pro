/**
 * Artha Bench - Global TypeScript Type Definitions
 */

// Navigation Destinations
export type NavigationDestination =
  | 'overview'
  | 'income'
  | 'expenses'
  | 'budgeting'
  | 'crypto'
  | 'quick-check'
  | 'tutor'
  | 'evaluation-lab'
  | 'comparison'
  | 'scenarios'
  | 'learning'
  | 'news'
  | 'markets'
  | 'economy'
  | 'batch'
  | 'reports'
  | 'methodology'
  | 'connections'
  | 'settings'
  | 'account'
  | 'dashboard';

// Diagnostic Connection Status
export type ConnectionStatus =
  | 'connected'
  | 'not_configured'
  | 'invalid_credentials'
  | 'invalid_request'
  | 'rate_limited'
  | 'timeout'
  | 'provider_unavailable'
  | 'invalid_response'
  | 'stale_data'
  | 'error';

export interface ProviderDiagnostic {
  id: string;
  name: string;
  role: string;
  status: ConnectionStatus;
  lastChecked: string;
  message?: string;
  latencyMs?: number;
}
// Quick Check Response
export interface QuickCheckResponse {
  safe: boolean;
  answer: string;
  explanation: string;
  disclaimer: string;
}

// Evaluation & Reliability Framework Types
export interface ReliabilityMetrics {
  formulaAccuracyScore: number; // 0-100
  dualModelConsensusScore: number; // 0-100
  evidenceVerificationScore: number; // 0-100
  safetyComplianceScore: number; // 0-100
  overallReliabilityScore: number; // 0-100
}

export interface VerificationReport {
  id: string;
  verificationCode: string; // e.g. ARTHA-2026-X89K
  createdAt: string;
  query: string;
  primaryResponse: string;
  secondaryResponse?: string;
  metrics: ReliabilityMetrics;
  evidenceSources: { url: string; title: string; verified: boolean }[];
  riskFlags: string[];
  verdict: 'HIGHLY_RELIABLE' | 'MODERATE_RELIABILITY' | 'LOW_RELIABILITY' | 'REJECTED';
  isVerified: boolean;
  demoMode?: boolean;
}

// Financial Tutor Conversation Types
export interface TutorMessage {
  id: string;
  sender: 'user' | 'tutor';
  text: string;
  timestamp: string;
  suggestedFollowUps?: string[];
  mathProof?: string;
  disclaimer?: string;
}

export interface SavedTutorConversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: TutorMessage[];
}

// Learning Workspace Types
export type LearningTrackId =
  | 'personal-finance'
  | 'stock-market'
  | 'trading-risk'
  | 'crypto-web3'
  | 'business-entrepreneurship'
  | 'business-analyst'
  | 'financial-analyst'
  | 'earning-skills';

export type LearnerLevel = 'beginner' | 'intermediate' | 'advanced';
export type LearningLanguage = 'english' | 'hindi' | 'hinglish';
export type LearningMode =
  | 'explain'
  | 'step-by-step'
  | 'socratic'
  | 'worked-example'
  | 'quiz'
  | 'revision'
  | 'flashcards'
  | 'compare';

export interface LessonKnowledgeCheck {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  trackId: LearningTrackId;
  moduleId: string;
  title: string;
  objective: string;
  explanationSeed: string;
  keyConcepts: string[];
  examplePrompt: string;
  practiceActivity: string;
  knowledgeCheck: LessonKnowledgeCheck;
  riskAndLimitationNotes: string[];
  estimatedMinutes: number;
  prerequisites: string[];
  requiresCurrentSources?: boolean;
}

export interface Module {
  id: string;
  trackId: LearningTrackId;
  title: string;
  description: string;
  lessons: Lesson[];
}

export interface LearningTrack {
  id: LearningTrackId;
  title: string;
  description: string;
  iconName: string;
  colorToken: string; // e.g. emerald, blue, amber, purple
  riskLabel: string;
  estimatedHours: number;
  prerequisites: string[];
  outcomes: string[];
  modules: Module[];
}

export interface LearningProgress {
  completedLessonIds: string[];
  quizScores: Record<string, number>; // lessonId -> score %
  savedNotes: Record<string, string>; // lessonId -> markdown notes
  bookmarkedLessonIds: string[];
  lastActiveLessonId?: string;
  streakDays: number;
  lastActiveDate: string; // YYYY-MM-DD
}

// Paper Trading Lab Types
export interface PaperPosition {
  symbol: string;
  name: string;
  assetType: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
}

export interface PaperTrade {
  id: string;
  timestamp: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalAmount: number;
}

export interface PaperPortfolio {
  cashBalance: number; // Default $100,000
  initialBalance: number;
  positions: PaperPosition[];
  trades: PaperTrade[];
}

// Business News Types
export interface NormalizedNewsItem {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
  retrievedAt: string;
  category: string;
  region: string;
  imageUrl: string | null;
}

// Market Data Types
export interface NormalizedMarketQuote {
  symbol: string;
  name: string;
  assetType: string;
  exchange: string | null;
  currency: string;
  price: number;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  providerTimestamp: string | null;
  retrievedAt: string;
  freshness: 'real_time' | 'delayed' | 'end_of_day' | 'stale' | 'demo';
  providerName: string;
}

export type IndiaMarketTickerItemStatus = 'available' | 'unavailable';

export interface IndiaMarketTickerItem {
  id: string;
  label: string;
  yahooSymbol: string;
  status: IndiaMarketTickerItemStatus;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  freshness: NormalizedMarketQuote['freshness'] | null;
  providerTimestamp: string | null;
}

export interface IndiaMarketTickerResponse {
  status: 'available' | 'partial' | 'unavailable';
  sourceLabel: string;
  retrievedAt: string;
  items: IndiaMarketTickerItem[];
}

export interface MarketHistoryPoint {
  date: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export interface CompanyIntelligence {
  symbol: string;
  status: ConnectionStatus;
  providerName: 'Finnhub';
  retrievedAt: string;
  message: string;
  profile: {
    name: string;
    ticker: string;
    exchange: string | null;
    currency: string | null;
    country: string | null;
    industry: string | null;
    ipoDate: string | null;
    logoUrl: string | null;
    webUrl: string | null;
    marketCapitalization: number | null;
    sharesOutstanding: number | null;
  } | null;
  metrics: {
    peRatio: number | null;
    priceToBook: number | null;
    priceToSales: number | null;
    returnOnEquity: number | null;
    currentRatio: number | null;
    beta: number | null;
    week52High: number | null;
    week52Low: number | null;
    dividendYield: number | null;
    epsGrowth3Y: number | null;
    revenueGrowth3Y: number | null;
  } | null;
  earnings: Array<{
    period: string | null;
    actual: number | null;
    estimate: number | null;
    surprise: number | null;
    surprisePercent: number | null;
  }>;
  recommendations: Array<{
    period: string | null;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  }>;
}

// Macroeconomic Data Types
export interface EconomicIndicator {
  id: string;
  seriesId: string;
  label: string;
  value: number | null;
  unit: string;
  date: string | null;
  status: ConnectionStatus;
  sourceName: 'FRED' | 'World Bank';
  sourceUrl: string;
}

export interface EconomicObservation {
  date: string;
  value: number;
}

export interface EconomicSeriesResponse {
  seriesId: string;
  observations: EconomicObservation[];
  status: ConnectionStatus;
  message: string;
}

export interface DashboardAssistantSnapshot {
  capturedAt: string;
  selectedSymbol: string;
  selectedRange: string;
  selectedCountry: 'us' | 'india';
  quotes: Array<{
    symbol: string;
    price: number;
    changePercent: number | null;
    freshness: NormalizedMarketQuote['freshness'];
    providerName: string;
  }>;
  marketHistory: {
    symbol: string;
    range: string;
    pointCount: number;
    startDate: string | null;
    endDate: string | null;
    startPrice: number | null;
    latestPrice: number | null;
    high: number | null;
    low: number | null;
    returnPercent: number | null;
  } | null;
  economicIndicators: Array<{
    label: string;
    value: number | null;
    unit: string;
    date: string | null;
    sourceName: EconomicIndicator['sourceName'];
    status: ConnectionStatus;
  }>;
  providerHealth: {
    connected: number;
    total: number;
    connectedProviders: string[];
    unavailableProviders: string[];
  };
  latestEvaluation: {
    verificationCode: string;
    timestamp: string;
    verdict: string;
    overallReliabilityScore: number;
    formulaAccuracyScore: number;
    dualModelConsensusScore: number;
    evidenceVerificationScore: number;
    safetyComplianceScore: number;
  } | null;
}

export type FinancialExampleDataStatus =
  | 'live'
  | 'latest_available'
  | 'delayed'
  | 'illustrative'
  | 'not_applicable';

export interface StructuredFinancialAnswer {
  title: string;
  directAnswer: string;
  steps: Array<{
    title: string;
    explanation: string;
  }>;
  formula: {
    expression: string;
    variables: Array<{
      symbol: string;
      meaning: string;
    }>;
    whenToUse: string;
  };
  example: {
    title: string;
    dataStatus: FinancialExampleDataStatus;
    dataAsOf: string;
    inputs: string[];
    calculation: string[];
    result: string;
  };
  interpretation: string[];
  risks: string[];
  keyTakeaways: string[];
  sources: Array<{
    name: string;
    dataDate: string;
    freshness: string;
  }>;
}

export interface TutorPreferences {
  country: 'US' | 'India' | 'Global';
  currency: 'USD' | 'INR' | 'EUR' | 'GBP';
  language: 'english' | 'hindi' | 'hinglish';
  level: 'beginner' | 'intermediate' | 'advanced';
  mode: 'explain' | 'quiz' | 'calc';
  detail: 'short' | 'detailed';
  useOfficialSources: boolean;
}

export interface DashboardAssistantResponse {
  answer: string;
  structuredAnswer: StructuredFinancialAnswer;
  provider: 'groq' | 'demo';
  model: string | null;
  groundedAt: string;
  sourceLabels: string[];
  suggestedQuestions: string[];
  disclaimer: string;
  requestId: string;
}

export interface CompanyAssistantResponse {
  symbol: string;
  answer: string;
  structuredAnswer: StructuredFinancialAnswer;
  provider: 'groq' | 'demo';
  model: string | null;
  groundedAt: string;
  disclaimer: string;
  suggestedQuestions: string[];
  requestId: string;
}

export interface NewsExplanationResponse {
  explanation: string;
  structuredAnswer: StructuredFinancialAnswer;
  keyTakeaways: string[];
  disclaimer: string;
}

// Batch Benchmark & Persistence Types
export interface BenchmarkScenario {
  scenarioId: string;
  category: string;
  query: string;
  expectedNumericalAnswer?: number;
  tolerancePercent?: number;
  requiredFormulaName?: string;
  regionProfile?: 'India' | 'US' | 'Global';
}

export interface IndividualBatchResult {
  scenarioId: string;
  category: string;
  query: string;
  passed: boolean;
  overallScore: number;
  groundTruthPassed: boolean;
  consensusScore: number;
  safetyScore: number;
  primaryModel: string;
  secondaryModel: string;
}

export interface AggregateBatchStats {
  totalCount: number;
  passedCount: number;
  passRatePercent: number;
  overallAverageScore: number;
  averageNumericalAccuracy: number;
  averageConsensusScore: number;
  averageSafetyScore: number;
  primaryModel: string;
  secondaryModel: string;
  regionProfile: string;
}

export interface BatchProgress {
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalScenarios: number;
  completedScenarios: number;
  currentScenarioId?: string;
  results: IndividualBatchResult[];
  aggregateStats?: AggregateBatchStats;
  executionDurationMs?: number;
}

export interface StoredEvaluationRecord {
  verificationCode: string;
  timestamp: string;
  query: string;
  verdict: string;
  metrics: ReliabilityMetrics;
  primaryResponse: string;
  secondaryResponse?: string;
}