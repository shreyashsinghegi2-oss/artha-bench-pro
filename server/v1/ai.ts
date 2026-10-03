/**
 * API-key endpoints that call the AI gateway (Groq → NVIDIA NIM → offline fallback).
 *
 * AI reliability score (never 100, because model output is not deterministic):
 *   offline fallback 15; otherwise 50 + 5 per linked source (max +20) + 15 if a number was certified by the
 *   precision engine (+10 if only app-calculated) − 10 if invalid citations had to be removed − 10 if the
 *   preferred model failed and a fallback model answered. Capped at 95.
 */
import { z } from 'zod';
import { runAiGateway } from '../aiGateway';
import { clampScore, envelope, type ApiEnvelope } from './envelope';

export const cfoBodySchema = z.object({
  query: z.string().trim().min(3).max(2000),
  context: z
    .object({
      country: z.enum(['India', 'US', 'Global']).optional(),
      language: z.enum(['english', 'hindi', 'hinglish']).optional(),
      detail: z.enum(['short', 'standard', 'detailed']).optional(),
    })
    .optional(),
});

interface GatewayResult {
  ok: boolean;
  answer: string;
  provider: string;
  model: string;
  fallbackUsed: boolean;
  latencyMs: number;
  structuredAnswer: {
    sources: Array<{ name: string; dataDate: string; freshness: string; url?: string }>;
    verifiedNumbers?: Array<{ label: string; display: string; certified: boolean; method: string }>;
  };
  grounding?: { invalidCitationsRemoved: number[] } | null;
}

export function aiReliability(r: GatewayResult): number {
  if (!r.ok) return 15;
  const linked = r.structuredAnswer.sources.filter((s) => Boolean(s.url)).length;
  const nums = r.structuredAnswer.verifiedNumbers ?? [];
  let score = 50 + Math.min(20, linked * 5);
  if (nums.some((x) => x.certified)) score += 15;
  else if (nums.length) score += 10;
  if ((r.grounding?.invalidCitationsRemoved.length ?? 0) > 0) score -= 10;
  if (r.fallbackUsed) score -= 10;
  return clampScore(Math.min(95, score));
}

export interface CfoData {
  brief: string;
  sources: GatewayResult['structuredAnswer']['sources'];
  verified_numbers: NonNullable<GatewayResult['structuredAnswer']['verifiedNumbers']>;
  model_used: string;
  fallback_used: boolean;
  latency_ms: number;
  structured: unknown;
}

export async function cfoBrief(
  body: z.infer<typeof cfoBodySchema>,
  gateway: (req: Parameters<typeof runAiGateway>[0]) => Promise<unknown> = runAiGateway,
): Promise<ApiEnvelope<CfoData>> {
  const r = (await gateway({ prompt: body.query, task: 'cfo', context: { country: 'India', currency: 'INR', ...body.context } })) as GatewayResult;
  return envelope(
    {
      brief: r.answer,
      sources: r.structuredAnswer.sources,
      verified_numbers: r.structuredAnswer.verifiedNumbers ?? [],
      model_used: `${r.provider}/${r.model}`,
      fallback_used: r.fallbackUsed,
      latency_ms: r.latencyMs,
      structured: r.structuredAnswer,
    },
    r.ok ? `ArthaBench AI gateway · ${r.provider}` : 'ArthaBench offline fallback (no AI model answered)',
    aiReliability(r),
    false,
  );
}

/* ---------------- Benchmark: score an AI model on numeric questions ---------------- */

export const benchmarkBodySchema = z.object({
  model: z.enum(['artha', 'nemotron']).default('artha'),
  tolerance_pct: z.number().min(0).max(20).default(1),
  items: z
    .array(z.object({ question: z.string().trim().min(5).max(1000), expected: z.number().finite() }))
    .min(1)
    .max(10),
});

/** Every number in the text (Indian and Western grouping, decimals, negatives). */
export function numbersIn(text: string): number[] {
  return [...text.matchAll(/-?\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, ''))).filter(Number.isFinite);
}

/** Correct when any number in the answer is within tolerance of the expected value. */
export function scoreAnswer(answer: string, expected: number, tolerancePct: number): { correct: boolean; closest: number | null; error_pct: number | null } {
  const nums = numbersIn(answer);
  if (!nums.length) return { correct: false, closest: null, error_pct: null };
  const closest = nums.reduce((a, b) => (Math.abs(b - expected) < Math.abs(a - expected) ? b : a));
  const errorPct = expected === 0 ? Math.abs(closest) * 100 : (Math.abs(closest - expected) / Math.abs(expected)) * 100;
  return { correct: errorPct <= tolerancePct, closest, error_pct: Math.round(errorPct * 10_000) / 10_000 };
}

export async function runBenchmark(
  body: z.infer<typeof benchmarkBodySchema>,
  gateway: (req: Parameters<typeof runAiGateway>[0]) => Promise<unknown> = runAiGateway,
) {
  const results = [];
  for (const item of body.items) {
    const started = Date.now();
    const r = (await gateway({ prompt: item.question, requestedModel: body.model, task: 'calculation' })) as GatewayResult;
    const score = r.ok ? scoreAnswer(r.answer, item.expected, body.tolerance_pct) : { correct: false, closest: null, error_pct: null };
    results.push({
      question: item.question,
      expected: item.expected,
      answer: r.answer,
      model_used: `${r.provider}/${r.model}`,
      answered_by_ai: r.ok,
      latency_ms: Date.now() - started,
      ...score,
    });
  }
  const correct = results.filter((x) => x.correct).length;
  const latencies = results.map((x) => x.latency_ms).sort((a, b) => a - b);
  return envelope(
    {
      model_requested: body.model,
      tolerance_pct: body.tolerance_pct,
      accuracy_pct: Math.round((correct / results.length) * 10_000) / 100,
      correct,
      total: results.length,
      latency_ms_p50: latencies[Math.floor((latencies.length - 1) / 2)] ?? 0,
      results,
      scoring: 'An answer is correct when any number in it is within tolerance_pct of the expected value. Scoring is deterministic; the answers are not.',
    },
    'ArthaBench benchmark runner · AI gateway',
    results.every((x) => x.answered_by_ai) ? 90 : 50,
    false,
  );
}
