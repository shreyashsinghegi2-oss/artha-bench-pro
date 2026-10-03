/**
 * The advisory pipeline, layer by layer:
 *   A parse → B gather data → C historical pattern → D math → E profile match → F explain
 * Each layer reports its status and time (for the UI's progress and the audit trail). A failing layer never
 * stops the pipeline: C and F fall back, B marks sources unavailable.
 */
import type { ContextBundle, UserProfile } from './context';
import { gatherContext, sourceSummary, type Fetchers } from './data-gathering';
import { explain, type Explanation, type Llm } from './explainer';
import { runMath, type MathResult } from './math-engine';
import { matchPatterns, type PatternResult } from './pattern-matcher';
import { matchProfile, type ProfileMatch } from './profile-matcher';
import { parseQuery } from './query-parser';
import type { MarketState } from './context';
import type { AiExtractor, ParsedQuery, ParseMeta } from './types';

export const LAYERS = ['parse', 'data', 'pattern', 'math', 'profile', 'explain'] as const;
export type Layer = (typeof LAYERS)[number];

export interface LayerEvent {
  layer: Layer;
  status: 'done' | 'skipped' | 'failed';
  ms: number;
  note?: string;
}

export interface AdvisorAnswer {
  question: string;
  parsed: ParsedQuery;
  parse_meta: ParseMeta;
  context: ContextBundle;
  sources: ReturnType<typeof sourceSummary>;
  pattern: PatternResult | null;
  math: MathResult;
  profile: ProfileMatch;
  explanation: Explanation;
  layers: LayerEvent[];
  created_at: string;
  total_ms: number;
}

export interface PipelineDeps {
  userId: string;
  profile?: UserProfile | null;
  extractor?: AiExtractor;
  fetchers: Partial<Fetchers>;
  /** Daily feature history for the pattern matcher (Layer C). */
  history?: () => Promise<MarketState[]>;
  llm?: Llm;
  onLayer?: (e: LayerEvent) => void;
  now?: () => number;
}

const PATTERN_ENTITIES = ['NIFTY', 'SENSEX', 'BANKNIFTY', 'INDEX_FUND', 'MUTUAL_FUND', 'STOCK', 'SIP', 'LUMP_SUM', 'ELSS', 'FII_DII'];

export function wantsPattern(parsed: ParsedQuery): boolean {
  return parsed.entities.some((e) => PATTERN_ENTITIES.includes(e));
}

export async function runPipeline(question: string, deps: PipelineDeps): Promise<AdvisorAnswer> {
  const now = deps.now ?? Date.now;
  const started = now();
  const layers: LayerEvent[] = [];
  const emit = (e: LayerEvent) => {
    layers.push(e);
    deps.onLayer?.(e);
  };
  const time = async <T>(fn: () => Promise<T> | T): Promise<[T, number]> => {
    const t0 = now();
    const v = await fn();
    return [v, now() - t0];
  };

  const [{ parsed, meta }, parseMs] = await time(() => parseQuery(question, { userId: deps.userId, ai: deps.extractor }));
  emit({ layer: 'parse', status: 'done', ms: parseMs, note: meta.method });

  const [context, dataMs] = await time(() => gatherContext({ question, parsed, profile: deps.profile ?? null, fetchers: deps.fetchers }));
  const sources = sourceSummary(context);
  const okCount = sources.filter((s) => s.status === 'ok').length;
  emit({ layer: 'data', status: 'done', ms: dataMs, note: `${okCount} of ${sources.length} sources` });

  let pattern: PatternResult | null = null;
  if (wantsPattern(parsed) && deps.history) {
    const t0 = now();
    try {
      const history = await deps.history();
      pattern = matchPatterns(history);
      emit({ layer: 'pattern', status: 'done', ms: now() - t0, note: `${pattern.matches.length} similar days` });
    } catch (e) {
      emit({ layer: 'pattern', status: 'failed', ms: now() - t0, note: e instanceof Error ? e.message.slice(0, 160) : 'failed' });
    }
  } else {
    emit({ layer: 'pattern', status: 'skipped', ms: 0, note: 'not a market question' });
  }

  const [math, mathMs] = await time(() => runMath(parsed, context));
  emit({
    layer: 'math',
    status: math.calculations.length ? 'done' : 'skipped',
    ms: mathMs,
    note: `${math.calculations.length} calculations, ${math.guardrails.length} checks`,
  });

  const [profile, profMs] = await time(() => matchProfile(parsed, context.profile.status === 'ok' ? context.profile.data : null));
  emit({ layer: 'profile', status: profile.available ? 'done' : 'skipped', ms: profMs, note: profile.suitability });

  const [explanation, explMs] = await time(() => explain({ question, parsed, context, pattern, math, profile }, deps.llm));
  emit({ layer: 'explain', status: explanation.mode === 'raw' && explanation.error ? 'failed' : 'done', ms: explMs, note: explanation.mode });

  return {
    question,
    parsed,
    parse_meta: meta,
    context,
    sources,
    pattern,
    math,
    profile,
    explanation,
    layers,
    created_at: new Date(started).toISOString(),
    total_ms: now() - started,
  };
}
