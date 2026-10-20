/**
 * Shares one in-flight request and keeps its answer for a short time. Pages that show the same market
 * numbers (the feature strip, the dashboard) then reuse one call instead of fetching again on every visit.
 */
const memo = new Map<string, { at: number; value: Promise<unknown> }>();

export function cachedGet<T>(url: string, ttlMs: number): Promise<T> {
  const hit = memo.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(`Request failed with ${response.status}`);
    return response.json() as Promise<T>;
  });
  memo.set(url, { at: Date.now(), value });
  // A failed request is not kept, so the next visit tries again.
  value.catch(() => memo.delete(url));
  return value;
}
