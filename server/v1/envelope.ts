/**
 * The public API response envelope. Every /api/v1 response has the same shape:
 *
 *   { data, source, timestamp, reliability_score, is_deterministic }
 *
 * reliability_score (0-100) combines how trustworthy the source is with how fresh the data is:
 *   - Deterministic calculators: 100 when every rate is statutory or supplied by the caller, 90 when a
 *     default scheme rate is used (governments reset those rates, so the default may be out of date).
 *   - Market data: source confidence (official exchange 95, Binance 90, Yahoo Finance 85, other 70) minus a
 *     freshness penalty (≤1 min: 0, ≤15 min: 10, ≤1 day: 25, ≤7 days: 40, older or unknown: 60).
 *   - AI answers: scored from grounding evidence in server/v1/ai.ts.
 */

export interface ApiEnvelope<T> {
  data: T;
  source: string;
  timestamp: string;
  reliability_score: number;
  is_deterministic: boolean;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, string> };
  timestamp: string;
}

export function envelope<T>(data: T, source: string, reliability: number, deterministic: boolean, timestamp = new Date().toISOString()): ApiEnvelope<T> {
  return { data, source, timestamp, reliability_score: clampScore(reliability), is_deterministic: deterministic };
}

export function errorBody(code: string, message: string, details?: Record<string, string>): ApiErrorBody {
  return { error: { code, message, ...(details ? { details } : {}) }, timestamp: new Date().toISOString() };
}

export const clampScore = (n: number): number => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

export type SourceKind = 'exchange' | 'binance' | 'yahoo' | 'other';
const SOURCE_CONFIDENCE: Record<SourceKind, number> = { exchange: 95, binance: 90, yahoo: 85, other: 70 };

/** Freshness penalty from the age of the data point. */
export function freshnessPenalty(asOf: string | null | undefined, now = Date.now()): number {
  const t = asOf ? Date.parse(asOf) : Number.NaN;
  if (!Number.isFinite(t)) return 60;
  const age = Math.max(0, now - t);
  if (age <= 60_000) return 0;
  if (age <= 15 * 60_000) return 10;
  if (age <= 86_400_000) return 25;
  if (age <= 7 * 86_400_000) return 40;
  return 60;
}

export function marketReliability(kind: SourceKind, asOf: string | null | undefined, now = Date.now()): number {
  return clampScore(SOURCE_CONFIDENCE[kind] - freshnessPenalty(asOf, now));
}

/** Money rounded to paise/cents; rates rounded to 4 decimals. Keeps JSON readable and stable. */
export const money = (n: number): number => Math.round(n * 100) / 100;
export const pct = (n: number): number => Math.round(n * 10_000) / 10_000;
