import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ExternalLink, RefreshCw } from 'lucide-react';
import { fetchBusinessNews, fetchMarketHistory, fetchMarketOverview } from '../../services/learningApi';
import { NormalizedMarketQuote, NormalizedNewsItem } from '../../types';

export interface BusinessBriefArticle {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  description: string;
  imageUrl: string;
  category: string;
}

type IntradaySummary = {
  symbol: string;
  points: number;
  first?: number;
  latest?: number;
};

const QUOTE_SYMBOLS = ['^NSEI', '^BSESN', '^GSPC', '^DJI', 'AAPL', 'MSFT', 'NVDA', 'BTC-USD', 'ETH-USD', 'GC=F', 'CL=F', 'INR=X', 'EURINR=X', 'GBPINR=X', 'JPYINR=X', 'EURUSD=X', 'GBPUSD=X'];
const INTRADAY_SYMBOLS = ['^NSEI', '^BSESN', 'AAPL', 'BTC-USD'];
const NAMES: Record<string, string> = {
  '^NSEI': 'NIFTY 50 Index', '^BSESN': 'BSE SENSEX', '^GSPC': 'S&P 500 Index', '^DJI': 'Dow Jones Industrial Average',
  AAPL: 'Apple Inc.', MSFT: 'Microsoft Corporation', NVDA: 'NVIDIA Corporation', 'BTC-USD': 'Bitcoin USD', 'ETH-USD': 'Ethereum USD',
  'GC=F': 'Gold', 'CL=F': 'Crude Oil', 'INR=X': 'USD / INR', 'USDINR=X': 'USD / INR', 'EURINR=X': 'EUR / INR',
  'GBPINR=X': 'GBP / INR', 'JPYINR=X': 'JPY / INR', 'EURUSD=X': 'EUR / USD', 'GBPUSD=X': 'GBP / USD',
};
const WORKSPACE_FOR: Record<string, string> = {
  '^NSEI': '/finance/markets/india', '^BSESN': '/finance/markets/india', AAPL: '/workspace/markets', MSFT: '/workspace/markets', NVDA: '/workspace/markets',
  '^GSPC': '/workspace/markets', '^DJI': '/workspace/markets', 'GC=F': '/workspace/markets', 'CL=F': '/workspace/markets',
  'BTC-USD': '/workspace/crypto?symbol=BTCUSDT&focus=chart', 'ETH-USD': '/workspace/crypto?symbol=ETHUSDT&focus=chart',
  'INR=X': '/finance/markets/forex', 'USDINR=X': '/finance/markets/forex', 'EURINR=X': '/finance/markets/forex', 'GBPINR=X': '/finance/markets/forex',
  'JPYINR=X': '/finance/markets/forex', 'EURUSD=X': '/finance/markets/forex', 'GBPUSD=X': '/finance/markets/forex',
};

const fmt = (quote: NormalizedMarketQuote) => Number(quote.price).toLocaleString(undefined, {
  minimumFractionDigits: Number(quote.price) < 10 ? 4 : 2,
  maximumFractionDigits: Number(quote.price) < 10 ? 4 : 2,
});

const normalizeNews = (items: NormalizedNewsItem[]): BusinessBriefArticle[] => {
  const seen = new Set<string>();
  return items
    .map((item) => ({
      title: item.title?.trim() || '', source: item.sourceName?.trim() || 'Business News', publishedAt: item.publishedAt || '',
      url: item.sourceUrl || '', description: item.summary?.trim() || '', imageUrl: item.imageUrl || '', category: item.category || 'Business',
    }))
    .filter((item) => item.title && item.url)
    .filter((item) => { const key = item.url || item.title.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; })
    .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
    .slice(0, 2);
};

const timeLabel = (value?: string) => {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

export const TopMarketTicker: React.FC = () => {
  const [quotes, setQuotes] = useState<NormalizedMarketQuote[]>([]);
  const [intraday, setIntraday] = useState<IntradaySummary[]>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [data, ...history] = await Promise.all([
        fetchMarketOverview(QUOTE_SYMBOLS),
        ...INTRADAY_SYMBOLS.map((symbol) => fetchMarketHistory(symbol, '1d')),
      ]);
      setQuotes(data.filter((quote) => quote && quote.freshness !== 'demo'));
      setIntraday(
        history
          .map((result, index) => ({
            symbol: INTRADAY_SYMBOLS[index],
            points: result.points?.length || 0,
            first: result.points?.[0]?.close,
            latest: result.points?.at(-1)?.close,
          }))
          .filter((item) => item.points > 0),
      );
      setUpdatedAt(new Date().toISOString());
    } catch {
      setQuotes([]);
      setIntraday([]);
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
    () => QUOTE_SYMBOLS.map((symbol) => quotes.find((quote) => quote.symbol.toUpperCase() === symbol)).filter(Boolean) as NormalizedMarketQuote[],
    [quotes],
  );
  const tape = [...ordered, ...ordered];

  return (
    <section className="w-full overflow-hidden rounded-lg border-y border-[#292929] bg-[#050505] text-white" aria-label="Unified live markets, forex and intraday ticker">
      <style>{`@keyframes artha-unified-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}.artha-unified-ticker-track{animation:artha-unified-ticker 52s linear infinite}@media(prefers-reduced-motion:reduce){.artha-unified-ticker-track{animation:none}.artha-unified-ticker-viewport{overflow-x:auto}}`}</style>
      <div className="flex h-7 items-center justify-between gap-2 border-b border-white/10 bg-[#070707] px-3">
        <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[.16em]"><span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />Live Markets</div>
        <div className="flex items-center gap-2 text-[8px] text-white/40">
          <span className="hidden sm:inline">Markets · Forex · Intraday</span>
          <span>{updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Connecting…'}</span>
          <button type="button" onClick={() => void load()} disabled={refreshing} className="p-0.5" aria-label="Refresh live market ticker"><RefreshCw className={`h-2.5 w-2.5 ${refreshing ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>
      <div className="artha-unified-ticker-viewport overflow-hidden" tabIndex={0}>
        <div className="artha-unified-ticker-track flex w-max min-w-full">
          {tape.length ? tape.map((quote, index) => {
            const positive = Number(quote.changePercent ?? 0) >= 0;
            const Icon = positive ? ArrowUpRight : ArrowDownRight;
            return (
              <a key={`${quote.symbol}-${index}`} href={WORKSPACE_FOR[quote.symbol] || '/workspace/markets'} className="flex h-9 min-w-[225px] items-center gap-2 whitespace-nowrap border-r border-white/10 px-3 focus-visible:bg-white/10">
                <span className="max-w-[130px] truncate text-[12px] font-black text-white/90">{NAMES[quote.symbol] || quote.name || quote.symbol}</span>
                <span className="text-[12px] font-bold">{fmt(quote)}</span>
                <span className={`inline-flex items-center gap-0.5 text-[12px] font-black ${positive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  <Icon className="h-3 w-3" />
                  {positive ? '+' : ''}{Number(quote.change ?? 0).toFixed(3)} ({positive ? '+' : ''}{Number(quote.changePercent ?? 0).toFixed(2)}%)
                </span>
              </a>
            );
          }) : <div className="px-3 py-2 text-[9px] text-white/45">{loading ? 'Loading provider-backed market data…' : 'Live provider data unavailable.'}</div>}
        </div>
      </div>
      <div className="flex h-5 items-center gap-2 overflow-hidden border-t border-white/10 px-3 text-[7px] text-white/35">
        <span className="font-black uppercase tracking-[.12em]">Intraday</span>
        {intraday.length ? intraday.map((item) => {
          const change = item.first ? ((Number(item.latest) / Number(item.first)) - 1) * 100 : 0;
          return <span key={item.symbol} className="shrink-0">{NAMES[item.symbol]} {item.points} pts · <b className={change >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</b></span>;
        }) : <span>{loading ? 'Loading…' : 'Unavailable'}</span>}
      </div>
    </section>
  );
};

const ImageOrFallback: React.FC<{ article: BusinessBriefArticle; className?: string; featured?: boolean }> = ({ article, className = '', featured = false }) => {
  const [src, setSrc] = useState(article.imageUrl);
  const [failed, setFailed] = useState(false);
  return src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={className} /> : <div className={`${className} flex items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-teal-50 text-[9px] font-black uppercase tracking-[.14em] text-slate-400`}>{featured ? 'Business News' : 'News'}</div>;
};

export const FeaturedNewsCard: React.FC<{ article: BusinessBriefArticle }> = ({ article }) => (
  <a href="/workspace/business-news" className="group relative block min-h-[390px] overflow-hidden rounded-[26px] bg-[#111] shadow-[0_24px_60px_rgba(15,23,42,.12)]" aria-label={`Open ${article.title} in Business News workspace`}>
    <ImageOrFallback article={article} featured className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/5" />
    <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
      <div className="mb-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-[.14em] text-white/75"><span>{article.source}</span><span>•</span><span>{article.category}</span></div>
      <h3 className="max-w-3xl text-2xl font-black leading-tight text-white sm:text-3xl">{article.title}</h3>
      {article.description && <p className="mt-3 max-w-2xl text-xs leading-5 text-white/70">{article.description}</p>}
      <div className="mt-4 flex items-center gap-3 text-[10px] font-bold text-white/65"><span>{timeLabel(article.publishedAt)}</span><span>•</span><span className="inline-flex items-center gap-1 text-white">Open workspace <ExternalLink className="h-3 w-3" /></span></div>
    </div>
  </a>
);

export const NewsListCard: React.FC<{ article: BusinessBriefArticle }> = ({ article }) => (
  <a href="/workspace/business-news" className="group flex gap-4 rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:-translate-y-0.5 hover:shadow-lg">
    <div className="h-[110px] w-[145px] shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-[116px] sm:w-[160px]"><ImageOrFallback article={article} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /></div>
    <div className="min-w-0 py-1"><div className="text-[9px] font-black uppercase tracking-[.12em] text-teal-700">{article.source}</div><h4 className="mt-1 line-clamp-3 text-sm font-black leading-5 text-slate-900">{article.title}</h4><div className="mt-2 text-[9px] font-semibold text-slate-400">{timeLabel(article.publishedAt)}</div></div>
  </a>
);

export const BusinessBrief: React.FC = () => {
  const [articles, setArticles] = useState<BusinessBriefArticle[]>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = normalizeNews(await fetchBusinessNews());
        setArticles(data);
        setError(data.length ? '' : 'No provider-backed headlines are currently available.');
        setUpdatedAt(new Date().toISOString());
      } catch (errorValue) {
        setArticles([]);
        setError(errorValue instanceof Error ? errorValue.message : 'Business news unavailable.');
      } finally {
        setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const featured = articles[0];
  const side = articles.slice(1, 2);
  return (
    <section className="border-y border-slate-200 bg-white" aria-label="Connected Business News">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="text-[10px] font-black uppercase tracking-[.16em] text-teal-700">CONNECTED BUSINESS NEWS</div><h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Business Brief</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Provider-backed business and market headlines, clearly sourced and time-stamped.</p></div>
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400"><span>Updated {updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span><a href="/workspace/business-news" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-slate-700">View all headlines ↗</a></div>
        </div>
        {featured ? <div className="grid gap-5 lg:grid-cols-[1.12fr_.88fr]"><FeaturedNewsCard article={featured} /><div className="grid gap-3">{side.map((article) => <NewsListCard key={article.url || article.title} article={article} />)}</div></div> : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">{loading ? 'Connecting to business-news provider…' : error}</div>}
      </div>
    </section>
  );
};
