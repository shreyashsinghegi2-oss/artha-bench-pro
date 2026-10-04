/** Layer B types: the ContextBundle every later layer reads. */

export type SourceStatus = 'ok' | 'unavailable' | 'skipped';

export interface SourceResult<T> {
  status: SourceStatus;
  data: T | null;
  /** Human-readable origin, e.g. "Yahoo Finance (^NSEI)". */
  source: string;
  /** When the data itself is from (market close, publication time), not when we fetched it. */
  as_of: string | null;
  /** 0-100, same scale as the public API envelope. */
  reliability: number;
  latency_ms: number;
  /** Why it is unavailable or skipped. */
  note?: string;
  /** Set when as_of is more than an hour old: "Data from <timestamp>". */
  stale_warning?: string;
}

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change_percent: number | null;
  currency: string;
  as_of: string | null;
}

export interface MarketSnapshot {
  nifty: Quote | null;
  sp500: Quote | null;
  btc: Quote | null;
  usdinr: Quote | null;
  gold: Quote | null;
}

/** Current NIFTY state used by the pattern matcher (Layer C). Returns are fractions (0.05 = 5%). */
export interface MarketState {
  date: string;
  close: number;
  return_5d: number;
  return_20d: number;
  volatility_20d: number;
  rsi_14: number;
  dist_ma50: number;
  dist_ma200: number;
}

export interface RbiData {
  repo_rate_pct: number | null;
  repo_rate_statement: string | null;
  recent: Array<{ title: string; url: string; date: string | null }>;
}

export interface FiiDiiData {
  date: string;
  fii_net_cr: number;
  dii_net_cr: number;
  history_30d: Array<{ date: string; fii_net_cr: number; dii_net_cr: number }> | null;
}

export interface SectorRow {
  name: string;
  symbol: string;
  return_1d: number | null;
  return_20d: number | null;
}

export interface SectorData {
  sectors: SectorRow[];
  leaders: SectorRow[];
  laggards: SectorRow[];
}

/** What the user told us about themselves (all optional; amounts in ₹). */
export interface UserProfile {
  age?: number;
  annual_income?: number;
  monthly_expenses?: number;
  monthly_emi?: number;
  liquid_savings?: number;
  investments?: number;
  dependants?: number;
  risk_tolerance?: 'low' | 'medium' | 'high';
  income_stability?: 'stable' | 'variable';
  equity_share?: number;
  term_cover?: number;
  health_cover?: number;
  section_80c_used?: number;
  nps_extra_used?: number;
  retire_age?: number;
  goals?: Array<{ name: string; target_amount: number; years: number }>;
}

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  published_at: string | null;
}

export interface WebItem {
  title: string;
  url: string;
  snippet: string;
}

export interface ContextBundle {
  market: SourceResult<MarketSnapshot>;
  market_state: SourceResult<MarketState>;
  rbi: SourceResult<RbiData>;
  fii_dii: SourceResult<FiiDiiData>;
  sectors: SourceResult<SectorData>;
  profile: SourceResult<UserProfile>;
  news: SourceResult<NewsItem[]>;
  web: SourceResult<WebItem[]>;
  gathered_at: string;
  total_ms: number;
}

export type ContextKey = Exclude<keyof ContextBundle, 'gathered_at' | 'total_ms'>;
