import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Clock3, Newspaper } from 'lucide-react';
import { fetchBusinessNews } from '../../services/learningApi';
import type { NormalizedNewsItem } from '../../types';

type Props = { onOpenFeed: () => void };

function formatDate(value: string | null) {
  if (!value) return 'Publication time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
  } catch {
    return value.trim().toLowerCase();
  }
}

function isRelevant(item: NormalizedNewsItem) {
  return /(business|market|markets|finance|financial|company|companies|earnings|economy|economic|rbi|central bank|rate|rates|inflation|technology|technology business|energy|commodity|commodities|policy|stocks|investment|macro)/i.test(`${item.category} ${item.title} ${item.summary}`);
}

function dedupeAndFilter(items: NormalizedNewsItem[]) {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const unique = items.filter((item) => {
    const id = item.id.trim().toLowerCase();
    const url = canonicalUrl(item.sourceUrl);
    const title = normalizeTitle(item.title);
    if (id && seenIds.has(id)) return false;
    if (url && seenUrls.has(url)) return false;
    if (title && seenTitles.has(title)) return false;
    if (id) seenIds.add(id);
    if (url) seenUrls.add(url);
    if (title) seenTitles.add(title);
    return true;
  });
  const relevant = unique.filter(isRelevant);
  return (relevant.length ? relevant : unique).slice(0, 5);
}

function sameStory(a: NormalizedNewsItem | undefined, b: NormalizedNewsItem) {
  if (!a) return false;
  return Boolean(
    (a.id && b.id && a.id === b.id) ||
    (a.sourceUrl && b.sourceUrl && canonicalUrl(a.sourceUrl) === canonicalUrl(b.sourceUrl)) ||
    normalizeTitle(a.title) === normalizeTitle(b.title),
  );
}

export const BusinessNewsSection: React.FC<Props> = ({ onOpenFeed }) => {
  const [items, setItems] = useState<NormalizedNewsItem[]>([]);
  const [activeKey, setActiveKeyState] = useState<string | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [imageFailedFor, setImageFailedFor] = useState<string | null>(null);

  const setActiveKey = useCallback((key: string | null) => {
    activeKeyRef.current = key;
    setActiveKeyState(key);
    setImageFailedFor(null);
  }, []);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    setFailed(false);
    try {
      const next = dedupeAndFilter(await fetchBusinessNews('business'));
      setItems((previous) => {
        const current = previous.find((item) => item.id === activeKeyRef.current);
        const preserved = current ? next.find((item) => sameStory(current, item)) : undefined;
        const currentStillPresent = activeKeyRef.current && next.some((item) => item.id === activeKeyRef.current);
        const first = next.find((item) => item.imageUrl) ?? next[0];
        const nextKey = preserved?.id ?? (currentStillPresent ? activeKeyRef.current : first?.id ?? null);
        activeKeyRef.current = nextKey;
        setActiveKeyState(nextKey);
        return next;
      });
      setUpdatedAt(next[0]?.retrievedAt ?? null);
      if (!next.length) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    let lastRefresh = Date.now();
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefresh < 120000) return;
      lastRefresh = Date.now();
      void load(false);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [load]);

  const featured = useMemo(
    () => items.find((item) => item.id === activeKey) ?? items.find((item) => item.imageUrl) ?? items[0],
    [activeKey, items],
  );

  const visibleItems = useMemo(() => items.slice(0, 5), [items]);
  const imageIsBroken = Boolean(featured && imageFailedFor === featured.id);

  return (
    <section className="border-y border-slate-200 bg-white" aria-labelledby="landing-business-brief">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.15em] text-teal-700"><Newspaper className="h-3.5 w-3.5" aria-hidden="true" />Connected business news</div>
            <h2 id="landing-business-brief" className="mt-2 text-3xl font-black text-[#172033] sm:text-4xl">Business Brief</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">Provider-backed business and market headlines, clearly sourced and time-stamped.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-semibold text-slate-400">Updated {updatedAt ? formatDate(updatedAt) : '—'}</span>
            <button type="button" onClick={onOpenFeed} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">View all headlines <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]" aria-label="Loading business headlines">
            <div className="min-h-[340px] animate-pulse rounded-3xl bg-slate-100" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"><div className="h-36 animate-pulse rounded-2xl bg-slate-100" /><div className="h-36 animate-pulse rounded-2xl bg-slate-100" /></div>
          </div>
        ) : failed ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-10 text-center">
            <p className="text-sm font-bold text-slate-700">Business headlines are temporarily unavailable.</p>
            <p className="mt-2 text-xs text-slate-500">The connected news provider did not return usable relevant articles. No synthetic headlines are shown.</p>
          </div>
        ) : featured ? (
          <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
            <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-sm">
              <div className="relative min-h-[340px] overflow-hidden" aria-live="polite">
                {featured.imageUrl && !imageIsBroken ? (
                  <img
                    src={featured.imageUrl}
                    alt={`News image for ${featured.title} from ${featured.sourceName}`}
                    loading="eager"
                    className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
                    referrerPolicy="no-referrer"
                    onError={() => setImageFailedFor(featured.id)}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_35%_20%,rgba(20,184,166,.2),transparent_35%),linear-gradient(135deg,#172033,#0f172a)]">
                    <div className="text-center"><Newspaper className="mx-auto h-10 w-10 text-teal-300/70" aria-hidden="true" /><p className="mt-3 text-[10px] font-black uppercase tracking-[.16em] text-slate-400">ArthaMind editorial fallback</p><p className="mt-1 text-xs text-slate-500">No usable provider image supplied</p></div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[.12em] text-teal-200"><span>{featured.sourceName}</span><span className="text-slate-400">·</span><span>{featured.category || 'Business'}</span></div>
                  <h3 className="max-w-3xl text-2xl font-black leading-tight text-white sm:text-3xl">{featured.title}</h3>
                  {featured.summary && <p className="mt-3 max-w-2xl line-clamp-2 text-xs leading-5 text-slate-300">{featured.summary}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-slate-300"><span className="inline-flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{formatDate(featured.publishedAt)}</span><a href={featured.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-black text-teal-200 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300">Read original <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></a></div>
                </div>
              </div>
            </article>

            <div role="listbox" aria-label="Business headlines" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={item.id === activeKey}
                  onClick={() => setActiveKey(item.id)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveKey(item.id); } }}
                  className={`group grid min-h-[118px] grid-cols-[112px_1fr] overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${item.id === activeKey ? 'border-teal-400 ring-1 ring-teal-200' : 'border-slate-200'}`}
                >
                  <div className="relative overflow-hidden bg-slate-100">
                    {item.imageUrl ? <img src={item.imageUrl} alt={`News image for ${item.title}`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <div className="flex h-full min-h-[118px] items-center justify-center text-slate-400"><Newspaper className="h-7 w-7" aria-hidden="true" /></div>}
                  </div>
                  <div className="p-4"><div className="text-[9px] font-black uppercase tracking-[.12em] text-teal-700">{item.sourceName}</div><h3 className="mt-2 line-clamp-3 text-sm font-black leading-5 text-[#172033]">{item.title}</h3><p className="mt-2 text-[10px] text-slate-500">{formatDate(item.publishedAt)}</p></div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-5 text-[10px] leading-5 text-slate-500">Provider/freshness follows the connected workspace news service. Headlines are informational; they are not verified investment signals.</p>
      </div>
    </section>
  );
};
