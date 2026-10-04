/** Types shared by the advisory pipeline (Layer A: query parsing). */

export const INTENTS = ['COMPARE', 'CALCULATE', 'EXPLAIN', 'PLAN', 'ALERT'] as const;
export type Intent = (typeof INTENTS)[number];

/** Closed vocabulary: anything outside it (from the AI or anywhere else) is dropped. */
export const ENTITIES = [
  'NIFTY',
  'SENSEX',
  'BANKNIFTY',
  'SP500',
  'NASDAQ',
  'USDINR',
  'FII_DII',
  'REPO_RATE',
  'INFLATION',
  'SIP',
  'LUMP_SUM',
  'FD',
  'RD',
  'PPF',
  'NPS',
  'EPF',
  'SSY',
  'ELSS',
  'MUTUAL_FUND',
  'INDEX_FUND',
  'DEBT_FUND',
  'STOCK',
  'GOLD',
  'SGB',
  'BTC',
  'ETH',
  'CRYPTO',
  'REAL_ESTATE',
  'HOME_LOAN',
  'CAR_LOAN',
  'PERSONAL_LOAN',
  'EDUCATION_LOAN',
  'EMI',
  'CREDIT_CARD',
  'INCOME_TAX',
  '80C',
  '80D',
  'HRA',
  'LTCG',
  'STCG',
  'GST',
  'TERM_INSURANCE',
  'HEALTH_INSURANCE',
  'INSURANCE',
  'EMERGENCY_FUND',
  'RETIREMENT',
  'EDUCATION',
  'HOUSE_PURCHASE',
] as const;
export type Entity = (typeof ENTITIES)[number];

export const AMOUNT_TYPES = ['lump_sum', 'monthly', 'yearly', 'income', 'expense', 'target', 'unknown'] as const;
export type AmountType = (typeof AMOUNT_TYPES)[number];

export interface ParsedAmount {
  value: number;
  currency: 'INR' | 'USD';
  type: AmountType;
  /** The exact text the value was read from: every amount is traceable to the user's words. */
  raw: string;
}

/** Whole years ("10y") or, below a year, months ("6m"). */
export type TimeHorizon = `${number}y` | `${number}m`;

export interface ParsedQuery {
  intent: Intent;
  entities: Entity[];
  amounts: ParsedAmount[];
  time_horizon: TimeHorizon | null;
  is_time_sensitive: boolean;
  is_novel: boolean;
  user_id: string;
}

export type QueryLanguage = 'en' | 'hi' | 'hinglish';

export interface ParseMeta {
  /** 'ai+rules' when the AI step succeeded and was merged; 'rules' when only the deterministic parser ran. */
  method: 'ai+rules' | 'rules';
  ai_error: string | null;
  /** What the merge step changed or refused from the AI output (audit trail). */
  corrections: string[];
  /** The deterministic parser's own intent, kept for audit even when the AI's intent is used. */
  rules_intent: Intent;
  language: QueryLanguage;
  /** Stable key for the answer cache (normalised question + amounts + horizon). */
  fingerprint: string;
  latency_ms: number;
}

export interface ParseResult {
  parsed: ParsedQuery;
  meta: ParseMeta;
}

/** What the AI extractor may return. Values are hints; the merge step validates every field. */
export interface AiExtraction {
  intent?: unknown;
  entities?: unknown;
  amounts?: unknown;
  time_horizon?: unknown;
  is_time_sensitive?: unknown;
}

export type AiExtractor = (question: string) => Promise<AiExtraction>;
