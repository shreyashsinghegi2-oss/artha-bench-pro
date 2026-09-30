/**
 * Layer B — data gathering. Runs every source in parallel, each with its own timeout. A failed or slow source
 * becomes status "unavailable" with a note; nothing ever blocks the whole pipeline.
 *
 * Conditional sources:
 *   - news: only when the question is time-sensitive (Layer A's is_time_sensitive).
 *   - web:  only when the question is novel, or when market data came back more than an hour old; one
 *           targeted search, at most 2 results.
 * Any data point older than an hour carries stale_warning "Data from <timestamp>".
 *
 * Fetchers are injected (the server passes real ones), so this module stays pure and testable.
 */
import type { ParsedQuery } from './types';
import type {
  ContextBundle,
  ContextKey,
  FiiDiiData,
  MarketSnapshot,
  MarketState,
  NewsItem,
  RbiData,
  SectorData,
  SourceResult,
  UserProfile,
  WebItem,
} from './context';

export interface Fetched<T> {
  data: T;
  source: string;
  as_of: string | null;
  reliability: number;
}

export interface Fetchers {
  market(): Promise<Fetched<MarketSnapshot>>;
  marketState(): Promise<Fetched<MarketState>>;
  rbi(): Promise<Fetched<RbiData>>;
  fiiDii(): Promise<Fetched<FiiDiiData>>;
  sectors(): Promise<Fetched<SectorData>>;
  news(query: string): Promise<Fetched<NewsItem[]>>;
  web(query: string): Promise<Fetched<WebItem[]>>;
}

export interface GatherOptions {
  question: string;
  parsed: ParsedQuery;
  profile?: UserProfile | null;
  fetchers: Partial<Fetchers>;
  timeoutMs?: Partial<Record<ContextKey, number>>;
  staleAfterMs?: number;
  now?: () => number;
}

export const DEFAULT_TIMEOUT_MS = 5000;
export const STALE_AFTER_MS = 60 * 60 * 1000;
export const MAX_WEB_RESULTS = 2;

function skipped<T>(source: string, note: string): SourceResult<T> {
  return { status: 'skipped', data: null, source, as_of: null, reliability: 0, latency_ms: 0, note };
}

async function run<T>(
  key: ContextKey,
  source: string,
  fn: (() => Promise<Fetched<T>>) | undefined,
  timeoutMs: number,
  now: () => number,
  staleAfterMs: number,
): Promise<SourceResult<T>> {
  if (!fn) return { status: 'unavailable', data: null, source, as_of: null, reliability: 0, latency_ms: 0, note: `${key} source is not configured` };
  const started = now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
    const asOfMs = result.as_of ? Date.parse(result.as_of) : Number.NaN;
    const stale = Number.isFinite(asOfMs) && now() - asOfMs > staleAfterMs;
    return {
      status: 'ok',
      data: result.data,
      source: result.source,
      as_of: result.as_of,
      reliability: Math.max(0, Math.min(100, Math.round(result.reliability))),
      latency_ms: now() - started,
      ...(stale && result.as_of ? { stale_warning: `Data from ${result.as_of}` } : {}),
    };
  } catch (e) {
    return {
      status: 'unavailable',
      data: null,
      source,
      as_of: null,
      reliability: 0,
      latency_ms: now() - started,
      note: e instanceof Error ? e.message.slice(0, 200) : 'failed',
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** A short, targeted search query built from the question and its entities. */
export function searchQuery(question: string, parsed: ParsedQuery): string {
  const base = question.replace(/\s+/g, ' ').trim().slice(0, 160);
  return /india|₹|nifty|sensex|rbi|sebi/i.test(base) || parsed.entities.some((e) => ['USDINR', 'SP500', 'NASDAQ', 'BTC', 'ETH'].includes(e))
    ? base
    : `${base} India`;
}

function hasProfile(p: UserProfile | null | undefined): p is UserProfile {
  return Boolean(p && Object.values(p).some((v) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)));
}

export async function gatherContext(opts: GatherOptions): Promise<ContextBundle> {
  const now = opts.now ?? Date.now;
  const started = now();
  const t = (k: ContextKey) => opts.timeoutMs?.[k] ?? DEFAULT_TIMEOUT_MS;
  const stale = opts.staleAfterMs ?? STALE_AFTER_MS;
  const f = opts.fetchers;
  const query = searchQuery(opts.question, opts.parsed);
  const webFn = f.web
    ? async () => {
        const r = await f.web!(query);
        return { ...r, data: r.data.slice(0, MAX_WEB_RESULTS) };
      }
    : undefined;

  const [market, marketState, rbi, fiiDii, sectors, news, webFirst] = await Promise.all([
    run<MarketSnapshot>('market', 'Market quotes', f.market, t('market'), now, stale),
    run<MarketState>('market_state', 'NIFTY daily history', f.marketState, t('market_state'), now, stale),
    run<RbiData>('rbi', 'RBI press releases', f.rbi, t('rbi'), now, stale),
    run<FiiDiiData>('fii_dii', 'NSE FII/DII activity', f.fiiDii, t('fii_dii'), now, stale),
    run<SectorData>('sectors', 'NSE sector indices', f.sectors, t('sectors'), now, stale),
    opts.parsed.is_time_sensitive
      ? run<NewsItem[]>('news', 'Business news', f.news ? () => f.news!(query) : undefined, t('news'), now, stale)
      : Promise.resolve(skipped<NewsItem[]>('Business news', 'question is not time-sensitive')),
    opts.parsed.is_novel ? run<WebItem[]>('web', 'Web search', webFn, t('web'), now, stale) : Promise.resolve(null),
  ]);

  // Second chance for web search when nothing novel was asked but the market picture is old.
  const marketStale = Boolean(market.stale_warning || marketState.stale_warning);
  const web =
    webFirst ??
    (marketStale
      ? await run<WebItem[]>('web', 'Web search', webFn, t('web'), now, stale)
      : skipped<WebItem[]>('Web search', 'answer is cached and market data is fresh'));

  const profile: SourceResult<UserProfile> = hasProfile(opts.profile)
    ? { status: 'ok', data: opts.profile, source: 'Your saved profile', as_of: null, reliability: 100, latency_ms: 0 }
    : skipped<UserProfile>('Your saved profile', 'no profile shared; answers use general assumptions');

  return {
    market,
    market_state: marketState,
    rbi,
    fii_dii: fiiDii,
    sectors,
    profile,
    news,
    web,
    gathered_at: new Date(started).toISOString(),
    total_ms: now() - started,
  };
}

/** One line per source for the audit trail and the reliability footer. */
export function sourceSummary(
  bundle: ContextBundle,
): Array<{ key: ContextKey; status: string; source: string; as_of: string | null; reliability: number; note?: string }> {
  const keys: ContextKey[] = ['market', 'market_state', 'rbi', 'fii_dii', 'sectors', 'profile', 'news', 'web'];
  return keys.map((key) => {
    const s = bundle[key];
    return { key, status: s.status, source: s.source, as_of: s.as_of, reliability: s.reliability, ...(s.note ? { note: s.note } : {}) };
  });
}
