/**
 * Artha Bench - Global TypeScript Type Definitions
 */

// Navigation Destinations
export type NavigationDestination =
  | 'overview'
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

export interface MarketHistoryPoint {
  date: string;
  price: number;
  volume?: number;
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
