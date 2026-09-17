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

type IntradaySummary = { symbol: string; points: number; first?: number; latest?: number };

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

const fmt = (quote: NormalizedMarketQuote) => Number(quote.price).toLocaleString(undefined, { minimumFractionDigits: Number(quote.price) < 10 ? 4 : 2, maximumFractionDigits: Number(quote.price) < 10 ? 4 : 2 });
const normalizeTitle = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const isNearDuplicate = (title: string, seenTitles: string[]) => {
  const words = new Set(normalizeTitle(title).split(' ').filter((word) => word.length > 2));
  return words.size > 0 && seenTitles.some((seen) => {
    const other = new Set(normalizeTitle(seen).split(' ').filter((word) => word.length > 2));
    const intersection = [...words].filter((word) => other.has(word)).length;
    return new Set([...words, ...other]).size > 0 && intersection / new Set([...words, ...other]).size >= 0.82;
  });
};

const normalizeNews = (items: NormalizedNewsItem[]): BusinessBriefArticle[] => {
  const seenUrls = new Set<string>();
  const seenTitles: string[] = [];
  return items.map((item) => ({
    title: item.title?.trim() || '', source: item.sourceName?.trim() || 'Business News', publishedAt: item.publishedAt || '',
    url: item.sourceUrl || '', description: item.summary?.trim() || '', imageUrl: item.imageUrl || '', category: item.category?.trim() || 'Business',
  })).filter((item) => item.title && item.url).filter((item) => {
    const key = item.url.toLowerCase();
    if (seenUrls.has(key) || isNearDuplicate(item.title, seenTitles)) return false;
    seenUrls.add(key); seenTitles.push(item.title); return true;
  }).sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0)).slice(0, 10);
};

const timeLabel = (value?: string) => {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hr ago`;
  if (diffMinutes < 2880) return 'Yesterday';
  return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};
const sourceMark = (source: string) => source.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'NEWS';
const safeExternalUrl = (value: string) => { try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '#'; } catch { return '#'; } };

export const TopMarketTicker: React.FC = () => {
  const [quotes, setQuotes] = useState<NormalizedMarketQuote[]>([]); const [intraday, setIntraday] = useState<IntradaySummary[]>([]); const [updatedAt, setUpdatedAt] = useState(''); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const load = async () => { setRefreshing(true); try { const [data, ...history] = await Promise.all([fetchMarketOverview(QUOTE_SYMBOLS), ...INTRADAY_SYMBOLS.map((symbol) => fetchMarketHistory(symbol, '1d'))]); setQuotes(data.filter((quote) => quote && quote.freshness !== 'demo')); setIntraday(history.map((result, index) => ({ symbol: INTRADAY_SYMBOLS[index], points: result.points?.length || 0, first: result.points?.[0]?.close, latest: result.points?.at(-1)?.close })).filter((item) => item.points > 0)); setUpdatedAt(new Date().toISOString()); } catch { setQuotes([]); setIntraday([]); } finally { setLoading(false); setRefreshing(false); } };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 60_000); return () => window.clearInterval(timer); }, []);
  const ordered = useMemo(() => QUOTE_SYMBOLS.map((symbol) => quotes.find((quote) => quote.symbol.toUpperCase() === symbol)).filter(Boolean) as NormalizedMarketQuote[], [quotes]);
  const tape = [...ordered, ...ordered];
  return <section className="w-full overflow-hidden rounded-lg border-y border-[#292929] bg-[#050505] text-white" aria-label="Unified live markets, forex and intraday ticker">
    <style>{`@keyframes artha-unified-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}.artha-unified-ticker-track{animation:artha-unified-ticker 52s linear infinite}@media(prefers-reduced-motion:reduce){.artha-unified-ticker-track{animation:none}.artha-unified-ticker-viewport{overflow-x:auto}}`}</style>
    <div className="flex h-7 items-center justify-between gap-2 border-b border-white/10 bg-[#070707] px-3"><div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[.16em]"><span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]"/>Live Markets</div><div className="flex items-center gap-2 text-[8px] text-white/40"><span className="hidden sm:inline">Markets · Forex · Intraday</span><span>{updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Connecting…'}</span><button type="button" onClick={() => void load()} disabled={refreshing} className="p-0.5" aria-label="Refresh live market ticker"><RefreshCw className={`h-2.5 w-2.5 ${refreshing ? 'animate-spin' : ''}`}/></button></div></div>
    <div className="artha-unified-ticker-viewport overflow-hidden" tabIndex={0}><div className="artha-unified-ticker-track flex w-max min-w-full">{tape.length ? tape.map((quote, index) => { const positive = Number(quote.changePercent ?? 0) >= 0; const Icon = positive ? ArrowUpRight : ArrowDownRight; return <a key={`${quote.symbol}-${index}`} href={WORKSPACE_FOR[quote.symbol] || '/workspace/markets'} className="flex h-9 min-w-[225px] items-center gap-2 whitespace-nowrap border-r border-white/10 px-3 focus-visible:bg-white/10"><span className="max-w-[130px] truncate text-[12px] font-black text-white/90">{NAMES[quote.symbol] || quote.name || quote.symbol}</span><span className="text-[12px] font-bold">{fmt(quote)}</span><span className={`inline-flex items-center gap-0.5 text-[12px] font-black ${positive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}><Icon className="h-3 w-3"/>{positive ? '+' : ''}{Number(quote.change ?? 0).toFixed(3)} ({positive ? '+' : ''}{Number(quote.changePercent ?? 0).toFixed(2)}%)</span></a>; }) : <div className="px-3 py-2 text-[9px] text-white/45">{loading ? 'Loading provider-backed market data…' : 'Live provider data unavailable.'}</div>}</div></div>
    <div className="flex h-5 items-center gap-2 overflow-hidden border-t border-white/10 px-3 text-[7px] text-white/35"><span className="font-black uppercase tracking-[.12em]">Intraday</span>{intraday.length ? intraday.map((item) => { const change = item.first ? ((Number(item.latest) / Number(item.first)) - 1) * 100 : 0; return <span key={item.symbol} className="shrink-0">{NAMES[item.symbol]} {item.points} pts · <b className={change >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</b></span>; }) : <span>{loading ? 'Loading…' : 'Unavailable'}</span>}</div>
  </section>;
};

const ImageOrFallback: React.FC<{ article: BusinessBriefArticle; className?: string; featured?: boolean }> = ({ article, className = '', featured = false }) => {
  const [failed, setFailed] = useState(false); const src = safeExternalUrl(article.imageUrl);
  if (!src || src === '#' || failed) return <div className={`${className} relative flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,.28),transparent_32%),linear-gradient(135deg,#0b1220,#172033_55%,#0f766e)] text-white`}><div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:28px_28px]"/><div className="relative flex flex-col items-center gap-2 text-center"><span className="text-2xl font-black tracking-[.18em]">ARTHA</span><span className="text-[9px] font-bold uppercase tracking-[.22em] text-teal-200">Business Brief · {article.category}</span></div></div>;
  return <img src={src} alt={`${article.source}: ${article.title}`} loading={featured ? 'eager' : 'lazy'} onError={() => setFailed(true)} className={className}/>;
};

const ExternalArticleLink: React.FC<{ article: BusinessBriefArticle; className?: string; children: React.ReactNode }> = ({ article, className = '', children }) => { const href = safeExternalUrl(article.url); return href === '#' ? null : <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>; };
const SourceBadge: React.FC<{ source: string; dark?: boolean }> = ({ source, dark = false }) => <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.1em] ${dark ? 'border-white/15 bg-black/35 text-white backdrop-blur' : 'border-slate-200 bg-slate-50 text-slate-700'}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[8px] ${dark ? 'bg-white/10 text-teal-200' : 'bg-[#172033] text-teal-200'}`}>{sourceMark(source)}</span>{source}</span>;

export const FeaturedNewsCard: React.FC<{ article: BusinessBriefArticle }> = ({ article }) => <ExternalArticleLink article={article} className="group block overflow-hidden rounded-[26px] border border-white/10 bg-[#0c1322] shadow-[0_28px_80px_rgba(15,23,42,.28)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_34px_90px_rgba(15,23,42,.38)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300" aria-label={`Read full story: ${article.title}`}>
  <article><div className="relative h-[310px] overflow-hidden sm:h-[360px] lg:h-[390px]"><ImageOrFallback article={article} featured className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"/><div className="absolute inset-0 bg-gradient-to-t from-[#0a1020] via-[#0a1020]/35 to-transparent"/><div className="absolute left-5 top-5 flex flex-wrap items-center gap-2 sm:left-6 sm:top-6"><SourceBadge source={article.source} dark/><span className="rounded-full border border-teal-300/25 bg-teal-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-teal-200">{article.category}</span></div><div className="absolute inset-x-0 bottom-0 p-5 sm:p-7"><h3 className="max-w-4xl text-2xl font-black leading-[1.05] tracking-[-.025em] text-white sm:text-3xl lg:text-[2.25rem]">{article.title}</h3>{article.description && <p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-200/80">{article.description}</p>}<div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] font-bold text-white/65"><span>{timeLabel(article.publishedAt)}</span><span>•</span><span>{article.source}</span><span className="inline-flex items-center gap-1 font-black text-teal-200">Read full story ↗ <ExternalLink className="h-3 w-3"/></span></div></div></div></article>
</ExternalArticleLink>;

export const NewsListCard: React.FC<{ article: BusinessBriefArticle }> = ({ article }) => <ExternalArticleLink article={article} className="group block rounded-2xl border border-slate-200/90 bg-white p-3 transition duration-300 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_16px_36px_rgba(15,23,42,.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600" aria-label={`Read full story: ${article.title}`}>
  <article className="flex gap-3.5"><div className="h-[104px] w-[142px] shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-[116px] sm:w-[160px]"><ImageOrFallback article={article} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"/></div><div className="min-w-0 py-0.5"><div className="flex flex-wrap items-center gap-1.5"><span className="text-[8px] font-black uppercase tracking-[.12em] text-teal-700">{article.category}</span><span className="text-[8px] text-slate-300">•</span><span className="truncate text-[8px] font-bold uppercase tracking-[.08em] text-slate-500">{article.source}</span></div><h4 className="mt-1.5 line-clamp-3 text-[13px] font-black leading-[1.35] text-slate-950 sm:text-sm">{article.title}</h4><div className="mt-2 flex items-center gap-2 text-[9px] font-semibold text-slate-400"><span>{timeLabel(article.publishedAt)}</span><span>·</span><span className="font-black text-slate-600">Read ↗</span></div></div></article>
</ExternalArticleLink>;

const NewsTicker: React.FC<{ articles: BusinessBriefArticle[] }> = ({ articles }) => {
  const tickerItems = articles.slice(0, 10); if (!tickerItems.length) return null;
  const renderItems = (duplicate = false) => tickerItems.map((article, index) => <ExternalArticleLink key={`${duplicate ? 'dup-' : ''}${article.url}-${index}`} article={article} className="flex shrink-0 items-center gap-2 border-r border-white/10 px-5 py-3 text-left focus-visible:bg-white/10 focus-visible:outline-none" tabIndex={duplicate ? -1 : 0} aria-hidden={duplicate || undefined}><span className="text-[9px] font-black uppercase tracking-[.1em] text-teal-300">{article.source}</span><span className="text-[9px] text-white/25">•</span><span className="max-w-[420px] truncate text-[10px] font-semibold text-white/90 sm:text-[11px]">{article.title}</span></ExternalArticleLink>);
  return <div className="business-brief-ticker group flex overflow-hidden rounded-2xl border border-white/10 bg-[#070d18] shadow-[0_12px_40px_rgba(2,8,23,.22)]" aria-label="Latest business headlines"><div className="relative z-10 flex shrink-0 items-center gap-2 border-r border-white/10 bg-[#0b1220] px-4 text-[9px] font-black uppercase tracking-[.14em] text-white"><span className="h-2 w-2 rounded-full bg-[#f97316] shadow-[0_0_12px_rgba(249,115,22,.7)]"/>LIVE NEWS</div><div className="business-brief-ticker-viewport min-w-0 flex-1 overflow-hidden" tabIndex={0}><div className="business-brief-ticker-track flex w-max min-w-full group-hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]" style={{ animation: 'artha-business-brief-ticker 48s linear infinite' }}>{renderItems()} {renderItems(true)}</div></div><style>{`@keyframes artha-business-brief-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}@media(prefers-reduced-motion:reduce){.business-brief-ticker-track{animation:none!important}.business-brief-ticker-viewport{overflow-x:auto}.business-brief-ticker-viewport::-webkit-scrollbar{height:5px}}`}</style></div>;
};

const NewsSkeleton: React.FC = () => <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]" aria-hidden="true"><div className="h-[540px] animate-pulse rounded-[26px] bg-slate-200"/><div className="grid gap-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3"><div className="h-[104px] w-[142px] shrink-0 animate-pulse rounded-xl bg-slate-200"/><div className="flex-1 space-y-3 py-2"><div className="h-2.5 w-24 animate-pulse rounded bg-slate-200"/><div className="h-3 w-full animate-pulse rounded bg-slate-200"/><div className="h-3 w-4/5 animate-pulse rounded bg-slate-200"/><div className="h-2 w-16 animate-pulse rounded bg-slate-200"/></div></div>)}</div></div>;

export const BusinessBrief: React.FC = () => {
  const [articles, setArticles] = useState<BusinessBriefArticle[]>([]); const [updatedAt, setUpdatedAt] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; const load = async () => { try { const data = normalizeNews(await fetchBusinessNews()); if (!active) return; setArticles(data); setUpdatedAt(new Date().toISOString()); } catch { if (!active) return; setArticles([]); setUpdatedAt(''); } finally { if (active) setLoading(false); } }; void load(); const timer = window.setInterval(() => void load(), 60_000); return () => { active = false; window.clearInterval(timer); }; }, []);
  const featured = articles[0]; const remaining = articles.slice(1, 7);
  return <section id="business-brief" className="border-y border-slate-200 bg-[#f7f9fc]" aria-labelledby="business-brief-title"><div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24"><NewsTicker articles={articles}/><div className="mb-8 mt-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-teal-700">CONNECTED BUSINESS NEWS</div><h2 id="business-brief-title" className="mt-2 text-4xl font-black tracking-[-.035em] text-slate-950 sm:text-5xl">Business Brief</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Provider-backed business and market headlines, with visible source and freshness.</p></div><div className="flex flex-wrap items-center gap-3"><span className="text-[10px] font-bold text-slate-400">Updated {updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span><a href="/workspace/business-news" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[10px] font-black text-slate-800 shadow-sm transition hover:border-teal-300 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600">View all headlines <ArrowUpRight className="h-3.5 w-3.5"/></a></div></div>{loading ? <NewsSkeleton/> : featured ? <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]"><FeaturedNewsCard article={featured}/><div className="grid gap-3" aria-label="More business stories">{remaining.map((article) => <NewsListCard key={article.url || article.title} article={article}/>)}</div></div> : <div className="rounded-[26px] border border-slate-200 bg-white px-6 py-16 text-center shadow-sm"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><RefreshCw className="h-5 w-5"/></div><h3 className="mt-4 text-base font-black text-slate-900">Business headlines are temporarily unavailable.</h3><p className="mt-1 text-xs text-slate-500">Please refresh shortly.</p></div>}<p className="mt-5 text-[9px] font-semibold leading-5 text-slate-400">News is displayed for informational and educational/research purposes only. Source, publication time and article links are provided by the connected provider. This content is not investment advice.</p></div></section>;
};
