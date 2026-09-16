import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { fetchBusinessNews, fetchMarketOverview } from '../../services/learningApi';
import { NormalizedMarketQuote, NormalizedNewsItem } from '../../types';

// Keep the chart in its own browser chunk so a landing-page chart/API problem can never
// prevent the existing workspace from mounting.
const LandingBitcoinChart = lazy(() =>
  import('./LandingBitcoinChart').then((module) => ({ default: module.LandingBitcoinChart })),
);

const MARKET_SYMBOLS = ['^NSEI', '^BSESN', 'AAPL', 'MSFT', 'NVDA', 'BTC-USD'];
const FULL_NAMES: Record<string, string> = {
  '^NSEI': 'NIFTY 50 Index',
  '^BSESN': 'BSE SENSEX Index',
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corporation',
  NVDA: 'NVIDIA Corporation',
  'BTC-USD': 'Bitcoin',
};

function fullName(quote: NormalizedMarketQuote) {
  return quote.name || FULL_NAMES[quote.symbol] || quote.symbol;
}

function formatTime(value?: string) {
  if (!value) return 'Recent';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Recent'
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const MarketTicker: React.FC = () => {
  const [quotes, setQuotes] = useState<NormalizedMarketQuote[]>([]);
  const [news, setNews] = useState<NormalizedNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timestamp, setTimestamp] = useState('');

  const load = async () => {
    setRefreshing(true);
    try {
      const [marketResult, newsResult] = await Promise.all([
        fetchMarketOverview(MARKET_SYMBOLS),
        fetchBusinessNews(),
      ]);
      setQuotes(Array.isArray(marketResult) ? marketResult : []);
      setNews(Array.isArray(newsResult) ? newsResult.filter((item) => item?.title).slice(0, 8) : []);
      setTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // The UI intentionally stays usable when a provider is unavailable.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const ordered = useMemo(
    () => MARKET_SYMBOLS.map((symbol) => quotes.find((quote) => quote.symbol.toUpperCase() === symbol)).filter(Boolean) as NormalizedMarketQuote[],
    [quotes],
  );

  const marketTape = [...ordered, ...ordered];
  const newsTape = [...news, ...news];

  return (
    <section className="mt-6 overflow-hidden rounded-[22px] border border-white/10 bg-[#050505] text-white shadow-[0_20px_60px_rgba(0,0,0,.28)]" aria-label="Live market and financial news ticker">
      <style>{`
        @keyframes artha-market-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes artha-news-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .artha-market-track { animation: artha-market-scroll 40s linear infinite; }
        .artha-news-track { animation: artha-news-scroll 60s linear infinite; }
        .artha-market-track:hover, .artha-news-track:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .artha-market-track, .artha-news-track { animation: none; }
        }
      `}</style>

      <div className="flex items-center justify-between border-b border-white/10 bg-[#0a0a0a] px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#00ff88]" />
          <span className="text-[9px] font-black uppercase tracking-[.18em] text-white">Live Market Data</span>
          <span className="hidden text-[8px] text-white/40 sm:inline">Provider-backed · Auto refresh 60s</span>
        </div>
        <div className="flex items-center gap-2 text-[8px] text-white/40">
          {timestamp && <span>Updated {timestamp}</span>}
          <button type="button" onClick={() => void load()} disabled={refreshing} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 font-bold text-white/60 hover:border-white/25 hover:text-white disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden border-b border-white/10 bg-black">
        {marketTape.length ? (
          <div className="artha-market-track flex w-max min-w-full items-center gap-0 py-3">
            {marketTape.map((quote, index) => {
              const positive = (quote.changePercent ?? 0) >= 0;
              return (
                <React.Fragment key={`${quote.symbol}-${index}`}>
                  <div className="flex min-w-[225px] items-center gap-3 px-5 whitespace-nowrap sm:min-w-[270px]">
                    <span className="max-w-[145px] truncate text-[10px] font-black text-white sm:max-w-[185px] sm:text-[11px]">{fullName(quote)}</span>
                    <span className="text-[11px] font-bold text-white/90 sm:text-xs">
                      {quote.currency === 'USD' ? '$' : ''}{quote.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <span className={`flex items-center gap-1 text-[10px] font-black sm:text-[11px] ${positive ? 'text-[#00ff88]' : 'text-[#ff3b3b]'}`}>
                      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {positive ? '+' : ''}{(quote.change ?? 0).toFixed(2)} ({positive ? '+' : ''}{(quote.changePercent ?? 0).toFixed(2)}%)
                    </span>
                  </div>
                  <span className="text-sm font-light text-white/20">|</span>
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-4 text-[10px] text-white/45">{loading ? 'Loading live market data…' : 'Live market data temporarily unavailable.'}</div>
        )}
      </div>

      <div className="border-b border-white/10 bg-[#080808] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[.18em] text-[#00ff88]">Financial News</span>
          <span className="text-[8px] text-white/30">Live crawl</span>
        </div>
      </div>

      <div className="overflow-hidden bg-[#030303]">
        {newsTape.length ? (
          <div className="artha-news-track flex w-max min-w-full items-stretch py-3">
            {newsTape.map((article, index) => (
              <React.Fragment key={`${article.id}-${index}`}>
                <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="group flex w-[350px] shrink-0 items-center gap-3 px-3 sm:w-[440px] sm:px-5">
                  <div className="h-[76px] w-[112px] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#121212] sm:h-[86px] sm:w-[128px]">
                    {article.imageUrl ? (
                      <img
                        src={article.imageUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                          event.currentTarget.parentElement?.classList.add('bg-[#171717]');
                        }}
                      />
                    ) : null}
                    {!article.imageUrl && <div className="flex h-full w-full items-center justify-center text-[8px] font-black uppercase tracking-wide text-white/25">News</div>}
                  </div>
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-[11px] font-black leading-4 text-white sm:text-xs">{article.title}</div>
                    <div className="mt-2 flex items-center gap-2 text-[8px] font-semibold text-white/45 sm:text-[9px]">
                      <span>{article.sourceName || 'Financial News'}</span>
                      <span className="text-white/20">•</span>
                      <span>{formatTime(article.publishedAt)}</span>
                    </div>
                  </div>
                  <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-white/25 transition group-hover:text-[#00ff88]" />
                </a>
                <span className="my-2 w-px shrink-0 bg-white/10" aria-hidden="true" />
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div className="px-5 py-5 text-[10px] text-white/45">{loading ? 'Loading latest financial news…' : 'Financial news temporarily unavailable.'}</div>
        )}
      </div>

      <Suspense fallback={<div className="m-4 rounded-2xl border border-white/10 bg-[#0d0d0d] p-5 text-xs text-white/45">Loading Bitcoin market chart…</div>}>
        <LandingBitcoinChart />
      </Suspense>
    </section>
  );
};
