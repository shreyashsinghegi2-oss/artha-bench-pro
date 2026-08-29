import React, { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Command, Search, X } from 'lucide-react';
import { AppNavigationDestination } from '../navigationTypes';

type Props = {
  onNavigate: (destination: AppNavigationDestination) => void;
};

type SearchItem = {
  title: string;
  description: string;
  destination: AppNavigationDestination;
  keywords: string[];
};

const SEARCH_ITEMS: SearchItem[] = [
  { title: 'Overview', description: 'ArthaMind Pro Analytics and provider-backed dashboard context.', destination: 'overview', keywords: ['dashboard', 'home', 'intelligence'] },
  { title: 'Income', description: 'Private income sources and recurring income workspace.', destination: 'income', keywords: ['salary', 'earnings', 'personal finance'] },
  { title: 'Expenses', description: 'Private spending, categories and transaction records.', destination: 'expenses', keywords: ['spending', 'transactions', 'personal finance'] },
  { title: 'Budgeting', description: 'Private budget plans, limits and recorded spending comparison.', destination: 'budgeting', keywords: ['budget', 'plan', 'limits'] },
  { title: 'Reports', description: 'Private personal-finance reports and period analysis.', destination: 'finance-reports', keywords: ['finance reports', 'spending report', 'budget report'] },
  { title: 'EMI Manager', description: 'Private EMI commitments, schedules and repayment tracking.', destination: 'emi-manager', keywords: ['loan', 'instalment', 'repayment'] },
  { title: 'Full Market Lab', description: 'Market and company intelligence workspace.', destination: 'markets', keywords: ['market lab', 'market data', 'company intelligence', 'stocks'] },
  { title: 'Crypto Markets', description: 'Crypto market data, candles and source diagnostics.', destination: 'crypto', keywords: ['bitcoin', 'btc', 'ethereum', 'binance'] },
  { title: 'Evaluation Laboratory', description: 'Run financial-AI reliability evaluations.', destination: 'evaluation-lab', keywords: ['evaluation', 'reliability', 'benchmark', 'run evaluation'] },
  { title: 'Structured Learning', description: 'Financial lessons, quizzes and learning progress.', destination: 'learning', keywords: ['learning', 'lessons', 'education', 'course'] },
  { title: 'Verified Reports', description: 'Review evaluation evidence, scores, flags and saved reports.', destination: 'reports', keywords: ['evaluation reports', 'history', 'evidence'] },
  { title: 'Financial Tutor', description: 'Open the full financial tutor workspace.', destination: 'tutor', keywords: ['tutor', 'ask', 'learn', 'open full tutor'] },
  { title: 'Provider Health', description: 'Connection diagnostics, source status and provider timestamps.', destination: 'connections', keywords: ['provider health', 'connection diagnostics', 'source status', 'freshness', 'trust'] },
  { title: 'Business News', description: 'Current business and financial headlines from connected sources.', destination: 'news', keywords: ['news', 'headlines', 'business brief'] },
  { title: 'Economic Data', description: 'US and India economic indicators and source dates.', destination: 'economy', keywords: ['economy', 'macro', 'fred', 'world bank'] },
  { title: 'Methodology', description: 'Evaluation methodology, evidence rules and limitations.', destination: 'methodology', keywords: ['methodology', 'trust', 'limitations', 'evidence'] },
  { title: 'Settings', description: 'Platform settings and configuration.', destination: 'settings', keywords: ['settings', 'configuration', 'controls'] },
];

export const AppSearch: React.FC<Props> = ({ onNavigate }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (event.key === 'Escape' && open) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return SEARCH_ITEMS.slice(0, 8);
    return SEARCH_ITEMS.filter((item) => {
      const haystack = [item.title, item.description, ...item.keywords].join(' ').toLowerCase();
      return haystack.includes(normalized);
    }).slice(0, 10);
  }, [query]);

  useEffect(() => setActiveIndex(0), [query]);

  const choose = (item: SearchItem) => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    onNavigate(item.destination);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && open && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="group relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleInputKeyDown}
          role="combobox"
          aria-label="Search Artha Bench modules"
          aria-expanded={open}
          aria-controls="artha-app-search-results"
          aria-activedescendant={open && results[activeIndex] ? `artha-search-result-${activeIndex}` : undefined}
          placeholder="Search workspace…"
          className="h-10 w-full rounded-xl border border-line bg-canvas pl-9 pr-16 text-xs font-medium text-ink outline-none transition focus:border-interactive/50 focus:ring-2 focus:ring-interactive/15"
        />
        {query ? (
          <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-secondary hover:bg-subtle hover:text-ink" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>
        ) : (
          <span className="pointer-events-none absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[9px] font-bold text-secondary">
            <Command className="h-3 w-3" aria-hidden="true" />{isMac ? 'K' : 'Ctrl K'}
          </span>
        )}
      </div>

      {open && (
        <div id="artha-app-search-results" role="listbox" className="absolute left-0 right-0 top-[calc(100%+8px)] z-[80] max-h-[min(420px,70vh)] overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-2xl">
          {results.length ? results.map((item, index) => (
            <button
              id={`artha-search-result-${index}`}
              key={`${item.title}-${item.destination}`}
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(item)}
              className={`w-full rounded-xl px-3 py-2.5 text-left transition ${activeIndex === index ? 'bg-interactive-soft' : 'hover:bg-subtle'}`}
            >
              <div className="text-xs font-black text-ink">{item.title}</div>
              <div className="mt-0.5 text-[10px] leading-4 text-secondary">{item.description}</div>
            </button>
          )) : (
            <div className="px-3 py-7 text-center text-xs text-secondary">No matching workspace found.</div>
          )}
          <div className="mt-1 border-t border-line px-3 py-2 text-[9px] text-secondary">↑ ↓ navigate · Enter open · Esc close</div>
        </div>
      )}
    </div>
  );
};
