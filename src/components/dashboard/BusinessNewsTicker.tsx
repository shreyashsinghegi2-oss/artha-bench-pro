import React from 'react';
import { Newspaper } from 'lucide-react';
import { NormalizedNewsItem } from '../../types';

function formatDate(value: string | null) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function NewsGroup({ items, onOpenFeed, duplicate = false }: { items: NormalizedNewsItem[]; onOpenFeed: () => void; duplicate?: boolean }) {
  return (
    <div className={`business-news-ticker-group flex shrink-0 items-center ${duplicate ? 'business-news-ticker-duplicate' : ''}`} aria-hidden={duplicate || undefined}>
      {items.map((item) => (
        <button
          key={`${duplicate ? 'dup-' : ''}${item.id}`}
          type="button"
          onClick={onOpenFeed}
          className="group flex h-10 max-w-[520px] shrink-0 items-center gap-2 border-r border-slate-700/80 px-5 text-left text-[10px] text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-300"
          aria-label={`Open business news feed for ${item.title}`}
          tabIndex={duplicate ? -1 : 0}
        >
          <span className="shrink-0 font-black uppercase tracking-wide text-emerald-300">{item.sourceName}</span>
          <span className="truncate font-medium text-white group-hover:text-emerald-100">{item.title}</span>
          <span className="shrink-0 text-slate-400">· {formatDate(item.publishedAt)}</span>
        </button>
      ))}
    </div>
  );
}

export const BusinessNewsTicker: React.FC<{ items: NormalizedNewsItem[]; onOpenFeed: () => void }> = ({ items, onOpenFeed }) => {
  return (
    <section className="business-news-ticker-shell flex min-h-10 overflow-hidden rounded-xl bg-[#101A2E] shadow-sm ring-1 ring-slate-900/10" aria-label="Latest business headlines">
      <button
        type="button"
        onClick={onOpenFeed}
        className="relative z-10 flex shrink-0 items-center gap-2 border-r border-slate-700 bg-[#101A2E] px-3 text-left sm:px-4"
        aria-label="Open full business news feed"
      >
        <Newspaper className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
        <div className="leading-tight">
          <p className="text-[10px] font-bold tracking-[0.13em] text-white">BUSINESS BRIEF</p>
          <p className="hidden text-[9px] text-slate-300 sm:block">Connected news sources · View feed</p>
        </div>
      </button>

      <div className="business-news-ticker-viewport min-w-0 flex-1 overflow-hidden" tabIndex={items.length ? 0 : -1}>
        {items.length ? (
          <div className="business-news-ticker-track flex w-max items-center">
            <NewsGroup items={items} onOpenFeed={onOpenFeed} />
            <NewsGroup items={items} onOpenFeed={onOpenFeed} duplicate />
          </div>
        ) : (
          <div className="flex h-10 items-center px-5 text-xs text-slate-300">Current business headlines are unavailable.</div>
        )}
      </div>
    </section>
  );
};
