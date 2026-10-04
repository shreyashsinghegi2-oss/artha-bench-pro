/**
 * Layer F — AI explainer. The model only EXPLAINS the facts sheet built here from Layers B-E; it never
 * calculates. Every number in its reply is post-checked against the numbers in the facts sheet and the
 * question. On failure it gets one regeneration with the offending numbers named; if that also fails, the
 * user gets the deterministic raw-data summary instead (mode "raw"). No LLM configured → raw as well.
 */
import type { ContextBundle } from './context';
import type { MathResult } from './math-engine';
import { inr, pctStr } from './math-engine';
import type { PatternResult } from './pattern-matcher';
import type { ProfileMatch } from './profile-matcher';
import type { ParsedQuery } from './types';

export interface ExplainerInput {
  question: string;
  parsed: ParsedQuery;
  context: ContextBundle | null;
  pattern: PatternResult | null;
  math: MathResult;
  profile: ProfileMatch;
}

export type Llm = (system: string, user: string) => Promise<string>;

export interface Explanation {
  text: string;
  mode: 'ai' | 'ai-retry' | 'raw';
  /** Numbers the post-check could not trace (from the last AI attempt), for the audit trail. */
  rejected_numbers: string[];
  attempts: number;
  error: string | null;
}

// ---------------------------------------------------------------------------------------------------------
// Facts sheet

const pct1 = (x: number) => pctStr(x * 100, 1);

export function buildFacts(input: ExplainerInput): string {
  const { context: c, pattern, math, profile } = input;
  const lines: string[] = [];
  if (c) {
    const m = c.market.data;
    if (m) {
      for (const q of [m.nifty, m.sp500, m.usdinr, m.gold, m.btc]) {
        if (q)
          lines.push(
            `MARKET ${q.name}: ${q.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${q.currency}${q.change_percent !== null ? ` (${pctStr(q.change_percent)} today)` : ''}, as of ${q.as_of ?? 'unknown'}`,
          );
      }
    }
    const s = c.market_state.data;
    if (s)
      lines.push(
        `NIFTY STATE ${s.date}: 5-day ${pct1(s.return_5d)}, 20-day ${pct1(s.return_20d)}, volatility ${pct1(s.volatility_20d)}, RSI ${s.rsi_14.toFixed(0)}, vs 200-day average ${pct1(s.dist_ma200)}`,
      );
    const r = c.rbi.data;
    if (r?.repo_rate_pct !== null && r?.repo_rate_pct !== undefined) lines.push(`RBI repo rate: ${r.repo_rate_pct}% (${r.repo_rate_statement ?? 'RBI'})`);
    if (r?.recent.length)
      lines.push(
        `RBI latest: ${r.recent
          .slice(0, 2)
          .map((x) => x.title)
          .join(' | ')}`,
      );
    const f = c.fii_dii.data;
    if (f) lines.push(`FII/DII ${f.date}: FII net ₹${f.fii_net_cr.toLocaleString('en-IN')} crore, DII net ₹${f.dii_net_cr.toLocaleString('en-IN')} crore`);
    const sec = c.sectors.data;
    if (sec)
      lines.push(
        `SECTORS 20-day leaders: ${sec.leaders.map((x) => `${x.name} ${pct1(x.return_20d ?? 0)}`).join(', ')}; laggards: ${sec.laggards.map((x) => `${x.name} ${pct1(x.return_20d ?? 0)}`).join(', ')}`,
      );
    for (const n of c.news.data ?? []) lines.push(`NEWS: ${n.title} (${n.source})`);
    for (const w of c.web.data ?? []) lines.push(`WEB: ${w.title}: ${w.snippet}`);
    const stale = (
      Object.values(c).filter((v) => typeof v === 'object' && v && 'stale_warning' in v && v.stale_warning) as Array<{ source: string; stale_warning: string }>
    ).map((v) => `${v.source}: ${v.stale_warning}`);
    if (stale.length) lines.push(`STALE: ${stale.join('; ')}`);
  }
  if (pattern) {
    const [s20, s60] = pattern.stats;
    const [b20, b60] = pattern.baseline;
    lines.push(
      `PATTERN (${pattern.matches.length} similar past NIFTY days since ${pattern.history_from}, confidence ${pattern.confidence}): next 20 days median ${pct1(s20?.median ?? 0)} (higher in ${pct1(s20?.positive_share ?? 0)} of cases); next 60 days median ${pct1(s60?.median ?? 0)}, middle range ${pct1(s60?.p25 ?? 0)} to ${pct1(s60?.p75 ?? 0)}, worst ${pct1(s60?.worst ?? 0)}. Any-day baseline: 20 days ${pct1(b20?.median ?? 0)}, 60 days ${pct1(b60?.median ?? 0)}. ${pattern.disclaimer}`,
    );
  }
  for (const calc of math.calculations) {
    lines.push(
      `CALC ${calc.title}: ${calc.result.label} = ${calc.result.unit === '₹' ? inr(calc.result.value, calc.id === 'emi' ? 2 : 0) : pctStr(calc.result.value)}`,
    );
    for (const e of calc.extras) lines.push(`  ${e.label} = ${e.unit === '₹' ? inr(e.value) : pctStr(e.value)}`);
    for (const i of calc.inputs)
      lines.push(`  input ${i.name} = ${i.unit === '₹' ? inr(i.value) : i.unit === '%' ? pctStr(i.value) : `${i.value} ${i.unit}`} (${i.source})`);
  }
  for (const a of math.assumptions) lines.push(`ASSUMPTION: ${a}`);
  for (const g of math.guardrails) lines.push(`GUARDRAIL (${g.level}): ${g.message}`);
  lines.push(`PROFILE FIT: ${profile.suitability} — ${profile.suitability_reason}`);
  for (const ch of profile.checks.filter((x) => x.relevant).slice(0, 4))
    lines.push(`PROFILE CHECK ${ch.title} (${ch.status}): ${ch.detail} ${ch.benchmark_note}`);
  if (profile.missing.length) lines.push(`PROFILE MISSING: ${profile.missing.join(', ')}`);
  return lines.join('\n');
}

export const EXPLAINER_SYSTEM_PROMPT = [
  'You are ArthaMind, an Indian personal-finance explainer. You EXPLAIN the FACTS below in plain, warm English for an Indian reader.',
  'Hard rules:',
  '1. Use ONLY numbers that appear in the FACTS or the question, written exactly as they appear there (same ₹ amounts, same percentages). Never calculate, round differently, estimate or add new numbers.',
  '2. Never promise returns. Past patterns are "historical patterns, not predictions".',
  '3. Mention every GUARDRAIL of level warning, and the profile fit if it is caution or mismatch.',
  '4. If a fact is missing, say it is unavailable; do not fill it from memory.',
  '5. Structure: a 1-2 sentence direct answer, then 3-5 short bullet points, then one line "What would change this:".',
  '6. Keep it under 220 words. No headings. Use Indian digit grouping (₹12,00,000).',
].join('\n');

export function buildUserPrompt(question: string, facts: string, feedback?: string): string {
  return `QUESTION: ${question}\n\nFACTS:\n${facts || '(no facts available)'}${feedback ? `\n\nYOUR PREVIOUS DRAFT WAS REJECTED. ${feedback}` : ''}`;
}

// ---------------------------------------------------------------------------------------------------------
// Number post-check

export interface FoundNumber {
  raw: string;
  value: number;
  /** Half of the last written digit's place value, in the same units as value. */
  tolerance: number;
  isPercent: boolean;
}

const SCALE: Record<string, number> = {
  lakh: 1e5,
  lakhs: 1e5,
  lac: 1e5,
  lacs: 1e5,
  l: 1e5,
  crore: 1e7,
  crores: 1e7,
  cr: 1e7,
  k: 1e3,
  thousand: 1e3,
  million: 1e6,
  mn: 1e6,
  billion: 1e9,
  bn: 1e9,
};

const NUM_RE = /(₹\s*)?(-?\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr\b|k\b|thousand|million|mn\b|billion|bn\b|l\b)?\s*(%|per\s*cent)?/gi;

export function extractNumbers(text: string): FoundNumber[] {
  const out: FoundNumber[] = [];
  for (const m of text.matchAll(NUM_RE)) {
    const digits = (m[2] ?? '').replace(/,/g, '');
    if (!digits || digits === '-') continue;
    const base = Number(digits);
    if (!Number.isFinite(base)) continue;
    const scale = m[3] ? (SCALE[m[3].toLowerCase()] ?? 1) : 1;
    const decimals = digits.includes('.') ? (digits.split('.')[1]?.length ?? 0) : 0;
    out.push({ raw: m[0].trim(), value: base * scale, tolerance: 0.5 * 10 ** -decimals * scale, isPercent: Boolean(m[4]) });
  }
  return out;
}

/** Small counting numbers (list items, "3 months", "6 months") are allowed when not money or a percentage. */
function harmless(n: FoundNumber): boolean {
  return !n.isPercent && !n.raw.includes('₹') && Number.isInteger(n.value) && Math.abs(n.value) <= 12 && n.tolerance <= 0.5;
}

export function checkNumbers(text: string, allowedSources: string[]): string[] {
  const allowed = allowedSources.flatMap(extractNumbers).map((n) => n.value);
  const bad: string[] = [];
  for (const n of extractNumbers(text)) {
    if (harmless(n)) continue;
    const ok = allowed.some((a) => Math.abs(Math.abs(a) - Math.abs(n.value)) <= Math.max(n.tolerance, 1e-9) + 1e-9 * Math.abs(a));
    if (!ok) bad.push(n.raw);
  }
  return [...new Set(bad)];
}

// ---------------------------------------------------------------------------------------------------------
// Deterministic fallback

export function rawSummary(input: ExplainerInput): string {
  const lines: string[] = [];
  const { math, profile, pattern } = input;
  for (const c of math.calculations) {
    lines.push(`• ${c.result.label}: ${c.result.unit === '₹' ? inr(c.result.value, c.id === 'emi' ? 2 : 0) : pctStr(c.result.value)} (${c.title}).`);
    for (const e of c.extras.slice(0, 2)) lines.push(`  – ${e.label}: ${e.unit === '₹' ? inr(e.value) : pctStr(e.value)}`);
  }
  if (pattern) {
    const s60 = pattern.stats[1];
    if (s60)
      lines.push(
        `• In ${pattern.matches.length} similar past NIFTY setups, the median move over the next 60 trading days was ${pct1(s60.median)} (middle range ${pct1(s60.p25)} to ${pct1(s60.p75)}). ${pattern.disclaimer}`,
      );
  }
  for (const g of math.guardrails.filter((x) => x.level !== 'info')) lines.push(`• ${g.level === 'warning' ? 'Warning' : 'Note'}: ${g.message}`);
  if (profile.suitability === 'caution' || profile.suitability === 'mismatch') lines.push(`• ${profile.suitability_reason}`);
  for (const ch of profile.checks.filter((x) => x.relevant && x.status !== 'good').slice(0, 3)) lines.push(`• ${ch.title}: ${ch.detail}`);
  if (math.assumptions.length) lines.push(`Assumptions: ${math.assumptions.join('; ')}.`);
  if (!lines.length)
    lines.push(
      'I could not compute anything specific for this question. Add an amount and a time period (for example “₹10,000 a month for 10 years”) for exact numbers.',
    );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------------------

export async function explain(input: ExplainerInput, llm: Llm | undefined): Promise<Explanation> {
  if (!llm) return { text: rawSummary(input), mode: 'raw', rejected_numbers: [], attempts: 0, error: 'AI explainer not configured' };
  const facts = buildFacts(input);
  const sources = [facts, input.question, rawSummary(input)];
  let feedback: string | undefined;
  let rejected: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const text = (await llm(EXPLAINER_SYSTEM_PROMPT, buildUserPrompt(input.question, facts, feedback))).trim();
      if (!text) throw new Error('empty reply');
      rejected = checkNumbers(text, sources);
      if (!rejected.length) return { text, mode: attempt === 1 ? 'ai' : 'ai-retry', rejected_numbers: [], attempts: attempt, error: null };
      feedback = `These numbers are not in the FACTS: ${rejected.join(', ')}. Rewrite using only numbers exactly as written in the FACTS.`;
    } catch (e) {
      return {
        text: rawSummary(input),
        mode: 'raw',
        rejected_numbers: rejected,
        attempts: attempt,
        error: e instanceof Error ? e.message.slice(0, 200) : 'AI failed',
      };
    }
  }
  return { text: rawSummary(input), mode: 'raw', rejected_numbers: rejected, attempts: 2, error: 'AI reply used numbers that could not be traced' };
}
