export type CacheRead<T> = {
  value: T;
  cachedAt: string;
  state: 'fresh' | 'stale';
};

type CacheEntry<T> = {
  value: T;
  storedAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function marketCacheConfig() {
  const ttlSeconds = positiveInt(process.env.MARKET_DATA_CACHE_TTL_SECONDS, 60);
  const staleMinutes = positiveInt(process.env.MARKET_DATA_STALE_THRESHOLD_MINUTES, 10);
  return {
    ttlMs: ttlSeconds * 1_000,
    staleMs: staleMinutes * 60_000,
  };
}

export function readMarketCache<T>(key: string): CacheRead<T> | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  const { ttlMs, staleMs } = marketCacheConfig();
  const age = Date.now() - entry.storedAt;
  if (age > staleMs) {
    cache.delete(key);
    return null;
  }
  return {
    value: entry.value,
    cachedAt: new Date(entry.storedAt).toISOString(),
    state: age <= ttlMs ? 'fresh' : 'stale',
  };
}

export function writeMarketCache<T>(key: string, value: T) {
  cache.set(key, { value, storedAt: Date.now() });
}

export async function dedupeMarketRequest<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const request = loader().finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

export function clearMarketCacheForTests() {
  cache.clear();
  inflight.clear();
}
