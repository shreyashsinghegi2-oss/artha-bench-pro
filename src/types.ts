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
  dualModelConsensusScore: number;
  evidenceVerificationScore: number;
  safetyComplianceScore: number;
  overallReliabilityScore: number;
}

export interface VerificationReport {
  id: string;
  verificationCode: string;
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
