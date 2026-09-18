import React from 'react';
import { ArrowUpRight, ExternalLink, RefreshCw } from 'lucide-react';
import { NormalizedNewsItem } from '../../types';

export type NewsFeedMode = 'live' | 'cached' | 'fallback';

export interface BusinessBriefArticle {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  description: string;
  imageUrl: string;
  category: string;
  feedMode?: NewsFeedMode;
  feedUpdatedAt?: string | null;
  feedProvider?: string;
}

export const normalizeBusinessNews = (items: NormalizedNewsItem[]): BusinessBriefArticle[] => {
  const urls = new Set<string>();
  const titles: string[] = [];
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
  const near = (title: string) => {
    const a = new Set(norm(title).split(' ').filter((w) => w.length > 2));
    return titles.some((seen) => {
      const b = new Set(norm(seen).split(' ').filter((w) => w.length > 2));
      const union = new Set([...a, ...b]);
      return union.size > 0 && [...a].filter((w) => b.has(w)).length / union.size >= 0.82;
    });
  };

  return items
    .map((i) => ({
      title: i.title?.trim() || '',
      source: i.sourceName?.trim() || 'Business News',
      publishedAt: i.publishedAt || '',
      url: i.sourceUrl || '',
      description: i.summary?.trim() || '',
      imageUrl:
        (i as NormalizedNewsItem & Partial<Record<'urlToImage' | 'image' | 'thumbnail', string>>).imageUrl ||
        (i as NormalizedNewsItem & Partial<Record<'urlToImage' | 'image' | 'thumbnail', string>>).urlToImage ||
        (i as NormalizedNewsItem & Partial<Record<'urlToImage' | 'image' | 'thumbnail', string>>).image ||
        (i as NormalizedNewsItem & Partial<Record<'urlToImage' | 'image' | 'thumbnail', string>>).thumbnail ||
        '',
      category: i.category?.trim() || 'Business',
    }))
    .filter((i) => {
      if (!i.title || safeUrl(i.url) === '#') return false;
      const key = i.url.toLowerCase();
      if (urls.has(key) || near(i.title)) return false;
      urls.add(key);
      titles.push(i.title);
      return true;
    })
    .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
    .slice(0, 10);
};

const safeUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '#';
  } catch {
    return '#';
  }
};

const hasValidImage = (v: string | null | undefined) => {
  if (typeof v !== 'string' || !v.trim()) return false;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

const timeLabel = (v: string) => {
  const d = new Date(v);
  if (!v || Number.isNaN(d.getTime())) return 'Time unavailable';
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(v)) return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  const m = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} hr ago`;
  if (m < 2880) return 'Yesterday';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};

const feedLabel = (mode: NewsFeedMode | undefined, updatedAt?: string | null) => {
  const updated = updatedAt ? new Date(updatedAt) : null;
  const stamp = updated && !Number.isNaN(updated.getTime()) ? updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  if (mode === 'cached') return `Cached headlines${stamp ? ` · ${stamp}` : ''}`;
  if (mode === 'fallback') return `Fallback headlines${stamp ? ` · ${stamp}` : ''}`;
  return `Live${stamp ? ` · ${stamp}` : ''}`;
};

const feedBadgeClass = (mode: NewsFeedMode | undefined) => {
  if (mode === 'cached') return 'border-amber-300/25 bg-amber-300/10 text-amber-200';
  if (mode === 'fallback') return 'border-orange-300/25 bg-orange-300/10 text-orange-200';
  return 'border-teal-300/25 bg-teal-300/10 text-teal-200';
};

const ArticleLink = ({
  article,
  className,
  children,
  tabIndex,
}: {
  article: BusinessBriefArticle;
  className: string;
  children: React.ReactNode;
  tabIndex?: number;
}) => {
  const href = safeUrl(article.url);
  return href === '#' ? null : (
    <a href={href} target="_blank" rel="noopener noreferrer" tabIndex={tabIndex} className={className}>
      {children}
    </a>
  );
};

const SourceBadge = ({ source }: { source: string }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-white">
    <span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-[8px] text-teal-200">
      {source.split(/\\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'N'}
    </span>
    {source}
  </span>
);

const proxyImageUrl = (article: BusinessBriefArticle) => {
  const source = safeUrl(article.url);
  return source === '#' ? '' : `/api/news/image?url=${encodeURIComponent(source)}&source=${encodeURIComponent(source)}`;
};

const FinanceFallbackVisual = ({ article }: { article: BusinessBriefArticle }) => (
  <div
    className="featured-news-image-fallback relative flex h-full min-h-[180px] items-center justify-center overflow-hidden bg-[#08111f]"
    role="img"
    aria-label={`${article.source} Business Brief fallback for ${article.title}`}
  >
    <div className="absolute inset-0 opacity-60" aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(45,212,191,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(45,212,191,.08)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <svg className="absolute inset-x-0 bottom-8 h-28 w-full text-teal-400/45" viewBox="0 0 600 120" preserveAspectRatio="none">
        <path d="M0 92 L58 76 L105 88 L160 50 L210 64 L260 35 L315 57 L372 23 L420 44 L475 18 L530 34 L600 8" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M0 106 L58 88 L105 98 L160 63 L210 76 L260 50 L315 70 L372 37 L420 56 L475 31 L530 47 L600 22" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".45" />
      </svg>
    </div>
    <div className="relative z-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-teal-300/25 bg-teal-300/10 text-lg font-black text-teal-200">
        {article.source.split(/\\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '₿'}
      </div>
      <div className="mt-3 text-[10px] font-black uppercase tracking-[.18em] text-white">Business Brief</div>
      <div className="mt-1 text-[8px] font-bold uppercase tracking-[.14em] text-slate-400">{article.source}</div>
    </div>
  </div>
);

const NewsImage = ({
  article,
  featured,
  className,
}: {
  article: BusinessBriefArticle;
  featured?: boolean;
  className: string;
}) => {
  const direct = hasValidImage(article.imageUrl) ? article.imageUrl.trim() : '';
  const proxy = proxyImageUrl(article);
  const sources = [direct, proxy].filter(Boolean);
  const [sourceIndex, setSourceIndex] = React.useState(0);
  const src = sources[sourceIndex] || '';

  const advanceSource = () => setSourceIndex((current) => Math.min(current + 1, sources.length));

  if (!src || sourceIndex >= sources.length) return <FinanceFallbackVisual article={article} />;

  return (
    <img
      src={src}
      alt={`${article.source}: ${article.title}`}
      loading={featured ? 'eager' : 'lazy'}
      decoding="async"
      onError={advanceSource}
      onLoad={(event) => {
        const image = event.currentTarget;
        if (image.naturalWidth < 480 || image.naturalHeight < 270) advanceSource();
      }}
      className={className}
    />
  );
};

export const BusinessNewsTicker = ({ articles }: { articles: BusinessBriefArticle[] }) => {
  const items = articles.slice(0, 10);
  const liveMode = items.some((item) => item.feedMode === 'live');
  const mode = liveMode ? 'live' : items[0]?.feedMode || 'fallback';
  const render = (dup = false) =>
    items.map((a, i) => (
      <ArticleLink
        key={`${dup ? 'd-' : ''}${a.url}-${i}`}
        article={a}
        tabIndex={dup ? -1 : 0}
        className="flex shrink-0 items-center gap-2 border-r border-white/15 px-4 py-2.5 focus-visible:bg-white/10 focus-visible:outline-none"
      >
        <span className="rounded-full border border-white/10 bg-white/[.06] px-2 py-0.5 text-[8px] font-black uppercase tracking-[.12em] text-teal-200">{a.source}</span>
        <span className="text-[10px] font-black text-slate-400" aria-hidden="true">•</span>
        <span className="max-w-[420px] truncate text-[12px] font-black text-white">{a.title}</span>
        <span className="whitespace-nowrap text-[9px] font-bold text-slate-300">{timeLabel(a.publishedAt)}</span>
        <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[.08em] ${feedBadgeClass(a.feedMode)}`}>{feedLabel(a.feedMode, a.feedUpdatedAt)}</span>
      </ArticleLink>
    ));

  if (!items.length) {
    return (
      <div className="group relative left-1/2 flex w-[100vw] -translate-x-1/2 overflow-hidden border-y border-white/10 bg-[#08111f]" aria-label="Latest business headlines">
        <div className="flex shrink-0 items-center gap-2 border-r border-white/10 bg-[#0F172A] px-4 py-2.5 text-[10px] font-black uppercase tracking-[.14em] text-white">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          FALLBACK NEWS
        </div>
        <div className="flex min-w-0 flex-1 items-center px-4 py-2.5 text-[11px] font-bold text-slate-300">
          Fallback headlines are unavailable. No unverified or invented headlines are shown.
        </div>
      </div>
    );
  }

  return (
    <div className="group relative left-1/2 flex w-[100vw] -translate-x-1/2 overflow-hidden border-y border-white/10 bg-[#060c17] shadow-[0_12px_40px_rgba(2,8,23,.25)]" aria-label="Latest business headlines">
      <div className="relative z-10 flex shrink-0 items-center gap-2 border-r border-white/20 bg-[#0b1220] px-4 text-[10px] font-black uppercase tracking-[.14em] text-white">
        <span className={`h-2 w-2 rounded-full ${mode === 'live' ? 'bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,.7)]' : mode === 'cached' ? 'bg-amber-400' : 'bg-orange-500'}`} />
        {mode === 'live' ? 'LIVE NEWS' : mode === 'cached' ? 'CACHED NEWS' : 'FALLBACK NEWS'}
      </div>
      <div className="business-news-ticker-viewport min-w-0 flex-1 overflow-hidden" tabIndex={0}>
        <div className="business-news-ticker-track flex w-max min-w-max">
          <div className="ticker-group flex shrink-0">{render()}</div>
          <div className="ticker-group flex shrink-0" aria-hidden="true">{render(true)}</div>
          <div className="ticker-group flex shrink-0" aria-hidden="true">{render(true)}</div>
          <div className="ticker-group flex shrink-0" aria-hidden="true">{render(true)}</div>
        </div>
      </div>
      <style>{`
        @keyframes artha-business-news-ticker {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-25%, 0, 0); }
        }
        .business-news-ticker-track {
          animation: artha-business-news-ticker 42s linear infinite;
          will-change: transform;
          backface-visibility: hidden;
        }
        .business-news-ticker-viewport:hover .business-news-ticker-track,
        .business-news-ticker-viewport:focus-within .business-news-ticker-track {
          animation-play-state: running;
        }
        @media(prefers-reduced-motion:reduce) {
          .business-news-ticker-viewport { overflow-x: auto; }
          .business-news-ticker-track {
            animation: none !important;
            transform: none !important;
            will-change: auto;
          }
        }
      `}</style>
    </div>
  );
};

export const BusinessBrief = ({
  articles,
  tickerArticles = articles,
}: {
  articles: BusinessBriefArticle[];
  tickerArticles?: BusinessBriefArticle[];
}) => {
  const featured = articles[0];
  const remaining = articles.slice(1, 7);

  return (
    <section id="business-brief" className="border-y border-slate-200 bg-[#f7f9fc]" aria-labelledby="business-brief-title">
      <BusinessNewsTicker articles={tickerArticles} />
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[.18em] text-teal-700">CONNECTED BUSINESS NEWS</div>
            <h2 id="business-brief-title" className="mt-2 text-4xl font-black tracking-[-.035em] text-slate-950 sm:text-5xl">Business Brief</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Provider-backed business and market headlines, with visible source and freshness.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-bold text-slate-400">Updated {featured?.publishedAt ? new Date(featured.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            <a href="/workspace/business-news" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[10px] font-black text-slate-800 shadow-sm transition hover:border-teal-300 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600">
              View all headlines <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {featured ? (
          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <ArticleLink
              article={featured}
              className="group block overflow-hidden rounded-[26px] border border-white/10 bg-[#0c1322] shadow-[0_28px_80px_rgba(15,23,42,.28)] transition duration-300 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
            >
              <article>
                <div className="featured-story-media">
                  <NewsImage
                    article={featured}
                    featured
                    className="featured-story-image block h-full w-full object-cover object-center transition duration-700 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a1020] via-[#0a1020]/35 to-transparent" />
                  <div className="absolute left-5 top-5 flex flex-wrap gap-2 sm:left-6 sm:top-6">
                    <SourceBadge source={featured.source} />
                    <span className="rounded-full border border-teal-300/25 bg-teal-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-teal-200">{featured.category}</span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-[.12em]">
                      <span className={`rounded-full border px-2 py-0.5 ${feedBadgeClass(featured.feedMode)}`}>{feedLabel(featured.feedMode, featured.feedUpdatedAt)}</span>
                      <span className="text-white/70">{timeLabel(featured.publishedAt)}</span>
                    </div>
                    <h3 className="max-w-4xl text-2xl font-black leading-[1.05] tracking-[-.025em] text-white sm:text-3xl lg:text-[2.25rem]">{featured.title}</h3>
                    {featured.description && <p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-200/80">{featured.description}</p>}
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] font-bold text-white/70">
                      <span>{featured.source}</span>
                      <span>•</span>
                      <span>{timeLabel(featured.publishedAt)}</span>
                      <span className="inline-flex items-center gap-1 font-black text-teal-200">Read full story ↗ <ExternalLink className="h-3 w-3" /></span>
                    </div>
                  </div>
                </div>
              </article>
            </ArticleLink>

            <div className="grid gap-3" aria-label="More business stories">
              {remaining.map((a) => (
                <ArticleLink
                  key={a.url}
                  article={a}
                  className="group block rounded-2xl border border-slate-200/90 bg-white p-3 transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_16px_36px_rgba(15,23,42,.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                >
                  <article className="flex gap-3.5">
                    <div className="h-[104px] w-[142px] shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-[116px] sm:w-[160px]">
                      <NewsImage article={a} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                    </div>
                    <div className="min-w-0 py-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[8px] font-black uppercase tracking-[.12em] text-teal-700">{a.category}</span>
                        <span className="text-[8px] text-slate-300">•</span>
                        <span className="truncate text-[9px] font-extrabold uppercase tracking-[.1em] text-slate-600">{a.source}</span>
                      </div>
                      <h4 className="mt-1.5 line-clamp-3 text-[13px] font-black leading-[1.35] text-slate-950 sm:text-sm">{a.title}</h4>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] font-semibold text-slate-400">
                        <span>{timeLabel(a.publishedAt)}</span>
                        <span>·</span>
                        <span className={`rounded-full border px-1.5 py-0.5 ${feedBadgeClass(a.feedMode)}`}>{feedLabel(a.feedMode)}</span>
                        <span className="font-black text-slate-700">Read ↗</span>
                      </div>
                    </div>
                  </article>
                </ArticleLink>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[26px] border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <RefreshCw className="mx-auto h-6 w-6 text-slate-400" />
            <h3 className="mt-4 text-base font-black text-slate-900">Business headlines are temporarily unavailable.</h3>
            <p className="mt-1 text-xs text-slate-500">Please refresh shortly.</p>
          </div>
        )}

        <p className="mt-5 text-[9px] font-semibold leading-5 text-slate-400">
          News is displayed for informational and educational/research purposes only. Source, publication time and article links are provided by the connected provider. This content is not investment advice.
        </p>
      </div>
    </section>
  );
};
