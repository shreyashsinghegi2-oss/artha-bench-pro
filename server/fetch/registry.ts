/**
 * Runs the enabled sources in parallel under one time budget.
 *
 * - Per-source timeout, and an overall budget (default 4 s) after which unfinished sources are dropped.
 * - Cache per (source, normalised question) with each source's TTL.
 * - Per-host back-off: a 403/429 from a host pauses every source that uses it (60 s, doubling to 15 min).
 * - Metrics per source (runs, successes, failures, timeouts, cache hits, latency, bytes) for /api/grounding/status.
 * A failing source never fails the answer.
 */
import { HostThrottledError, type FetchContext, type FetchItem, type Source, type SourceRun } from './types';

const cache = new Map<string, { at: number; items: FetchItem[] }>();
const backoff = new Map<string, { until: number; delayMs: number }>();

interface Metric {
  runs: number;
  ok: number;
  failed: number;
  timeouts: number;
  cacheHits: number;
  skipped: number;
  totalLatencyMs: number;
  lastLatencyMs: number;
  bytes: number;
  lastError?: string;
  lastRunAt?: string;
}
const metrics = new Map<string, Metric>();
const metric = (id: string) => {
  let m = metrics.get(id);
  if (!m) metrics.set(id, (m = { runs: 0, ok: 0, failed: 0, timeouts: 0, cacheHits: 0, skipped: 0, totalLatencyMs: 0, lastLatencyMs: 0, bytes: 0 }));
  return m;
};

export const normaliseQuery = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%₹. ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const BACKOFF_START_MS = 60_000;
const BACKOFF_MAX_MS = 15 * 60_000;

export function noteThrottled(host: string, now = Date.now()) {
  const prev = backoff.get(host);
  const delayMs = prev && prev.until > now - BACKOFF_MAX_MS ? Math.min(prev.delayMs * 2, BACKOFF_MAX_MS) : BACKOFF_START_MS;
  backoff.set(host, { until: now + delayMs, delayMs });
}
export const isBackedOff = (host: string, now = Date.now()) => (backoff.get(host)?.until ?? 0) > now;

const TIMEOUT = Symbol('timeout');

export async function runSources(sources: Source[], ctx: FetchContext, opts: { budgetMs?: number; now?: () => number } = {}): Promise<SourceRun[]> {
  const now = opts.now ?? Date.now;
  const budgetMs = opts.budgetMs ?? 4_000;
  const key = normaliseQuery(`${ctx.question} ${ctx.instruments.map((i) => i.symbol).join(' ')}`);
  const deadline = new Promise<typeof TIMEOUT>((r) => setTimeout(() => r(TIMEOUT), budgetMs));

  return Promise.all(
    sources.map(async (source): Promise<SourceRun> => {
      const m = metric(source.id);
      if (!source.enabled(ctx)) return { id: source.id, ok: false, cached: false, skipped: 'disabled', items: [], latencyMs: 0, bytes: 0 };
      if (source.hosts?.some((h) => isBackedOff(h, now()))) {
        m.skipped++;
        return { id: source.id, ok: false, cached: false, skipped: 'backoff', items: [], latencyMs: 0, bytes: 0 };
      }
      const cacheKey = `${source.id}|${key}`;
      const hit = cache.get(cacheKey);
      if (hit && now() - hit.at < source.cacheTtlMs) {
        m.cacheHits++;
        return { id: source.id, ok: true, cached: true, items: hit.items, latencyMs: 0, bytes: bytesOf(hit.items) };
      }

      const started = now();
      m.runs++;
      m.lastRunAt = new Date(started).toISOString();
      const own = new Promise<typeof TIMEOUT>((r) => setTimeout(() => r(TIMEOUT), source.timeoutMs));
      try {
        const result = await Promise.race([source.fetch(ctx), own, deadline]);
        const latencyMs = now() - started;
        m.lastLatencyMs = latencyMs;
        m.totalLatencyMs += latencyMs;
        if (result === TIMEOUT) {
          m.timeouts++;
          return {
            id: source.id,
            ok: false,
            cached: false,
            skipped: latencyMs >= budgetMs ? 'budget' : undefined,
            items: [],
            latencyMs,
            bytes: 0,
            error: 'timeout',
          };
        }
        const items = result.filter((i) => i.text.trim());
        const bytes = bytesOf(items);
        m.ok++;
        m.bytes += bytes;
        cache.set(cacheKey, { at: now(), items });
        if (cache.size > 800) cache.delete(cache.keys().next().value as string);
        return { id: source.id, ok: true, cached: false, items, latencyMs, bytes };
      } catch (error) {
        const latencyMs = now() - started;
        m.failed++;
        m.lastLatencyMs = latencyMs;
        m.totalLatencyMs += latencyMs;
        if (error instanceof HostThrottledError) noteThrottled(error.host, now());
        m.lastError = error instanceof Error ? error.message.slice(0, 160) : 'error';
        return { id: source.id, ok: false, cached: false, items: [], latencyMs, bytes: 0, error: m.lastError };
      }
    }),
  );
}

const bytesOf = (items: FetchItem[]) => items.reduce((n, i) => n + Buffer.byteLength(i.text, 'utf8'), 0);

/** Per-source counters (no secrets), for the status endpoint. */
export function fetchMetrics() {
  return [...metrics.entries()].map(([id, m]) => ({
    id,
    runs: m.runs,
    ok: m.ok,
    failed: m.failed,
    timeouts: m.timeouts,
    cacheHits: m.cacheHits,
    skippedForBackoff: m.skipped,
    avgLatencyMs: m.runs ? Math.round(m.totalLatencyMs / m.runs) : 0,
    lastLatencyMs: m.lastLatencyMs,
    bytes: m.bytes,
    lastError: m.lastError,
    lastRunAt: m.lastRunAt,
    backedOffHosts: [...backoff.entries()].filter(([, b]) => b.until > Date.now()).map(([h]) => h),
  }));
}

/** Test helper. */
export function resetFetchState() {
  cache.clear();
  backoff.clear();
  metrics.clear();
}
