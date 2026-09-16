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

const MARKET_SYMBOLS = ['^NSEI', '^BSESN', 'AAPL', 'MSFT', 'NVDA', 'BTC-USD'];
const FOREX_SYMBOLS = ['INR=X', 'EURINR=X', 'GBPINR=X', 'JPYINR=X', 'EURUSD=X', 'GBPUSD=X'];
const MARKET_NAMES: Record<string, string> = {
  '^NSEI': 'NIFTY 50 Index', '^BSESN': 'BSE SENSEX', AAPL: 'Apple Inc.', MSFT: 'Microsoft Corporation',
  NVDA: 'NVIDIA Corporation', 'BTC-USD': 'Bitcoin USD',
};
const FOREX_NAMES: Record<string, string> = {
  'INR=X': 'USD / INR', 'USDINR=X': 'USD / INR', 'EURINR=X': 'EUR / INR', 'GBPINR=X': 'GBP / INR',
  'JPYINR=X': 'JPY / INR', 'EURUSD=X': 'EUR / USD', 'GBPUSD=X': 'GBP / USD',
};

function movement(quote: NormalizedMarketQuote) {
  const positive = (quote.changePercent ?? 0) >= 0;
  return { positive, Icon: positive ? ArrowUpRight : ArrowDownRight };
}

function price(quote: NormalizedMarketQuote) {
  return Number(quote.price).toLocaleString(undefined, { minimumFractionDigits: quote.price < 10 ? 4 : 2, maximumFractionDigits: quote.price < 10 ? 4 : 2 });
}

function timeLabel(value?: string) {
  if (!value) return 'Time unavailable';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Time unavailable' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function normalizeNews(items: NormalizedNewsItem[]): BusinessBriefArticle[] {
  const seen = new Set<string>();
  return items
    .map((item) => ({
      title: item.title?.trim() || '',
      source: item.sourceName?.trim() || 'Business News',
      publishedAt: item.publishedAt || '',
      url: item.sourceUrl || '',
      description: item.summary?.trim() || '',
      imageUrl: item.imageUrl || '',
      category: item.category || 'Business',
    }))
    .filter((item) => item.title && item.url)
    .filter((item) => {
      const key = item.url || item.title.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
    .slice(0, 12);
}

export const TopMarketTicker: React.FC = () => {
  const [markets, setMarkets] = useState<NormalizedMarketQuote[]>([]);
  const [forex, setForex] = useState<NormalizedMarketQuote[]>([]);
  const [intraday, setIntraday] = useState<Array<{ symbol: string; name: string; latest?: number; first?: number; points: number }>>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [marketData, forexData, ...history] = await Promise.all([
        fetchMarketOverview(MARKET_SYMBOLS),
        fetchMarketOverview(FOREX_SYMBOLS, ),
        fetchMarketHistory('^NSEI', '1d'),
        fetchMarketHistory('^BSESN', '1d'),
        fetchMarketHistory('AAPL', '1d'),
        fetchMarketHistory('BTC-USD', '1d'),
      ]);
      setMarkets(marketData.filter((q) => q && q.freshness !== 'demo'));
      setForex(forexData.filter((q) => q && q.freshness !== 'demo'));
      const symbols = ['^NSEI', '^BSESN', 'AAPL', 'BTC-USD'];
      setIntraday(history.map((response, index) => {
        const points = response?.points || [];
        return { symbol: symbols[index], name: MARKET_NAMES[symbols[index]], latest: points.at(-1)?.close, first: points[0]?.close, points: points.length };
      }).filter((item) => item.points));
      setUpdatedAt(new Date().toISOString());
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

  const orderedMarkets = useMemo(() => MARKET_SYMBOLS.map((symbol) => markets.find((q) => q.symbol.toUpperCase() === symbol)).filter(Boolean) as NormalizedMarketQuote[], [markets]);
  const orderedForex = useMemo(() => FOREX_SYMBOLS.map((symbol) => forex.find((q) => q.symbol.toUpperCase() === symbol)).filter(Boolean) as NormalizedMarketQuote[], [forex]);
  const marketTape = [...orderedMarkets, ...orderedMarkets];
  const forexTape = [...orderedForex, ...orderedForex];

  const QuoteItem = ({ quote, forexItem = false }: { quote: NormalizedMarketQuote; forexItem?: boolean }) => {
    const { positive, Icon } = movement(quote);
    return <div className="flex min-w-[245px] items-center gap-2.5 px-4 whitespace-nowrap sm:min-w-[285px] sm:px-5">
      <span className="max-w-[155px] truncate text-[10px] font-black text-white sm:max-w-[185px] sm:text-[11px]">{forexItem ? (FOREX_NAMES[quote.symbol] || quote.name) : (MARKET_NAMES[quote.symbol] || quote.name || quote.symbol)}</span>
      <span className="text-[10px] font-bold text-white/90 sm:text-[11px]">{price(quote)}</span>
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-black sm:text-[11px] ${positive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
        <Icon className="h-3.5 w-3.5" />{positive ? '+' : ''}{Number(quote.change ?? 0).toFixed(3)} ({positive ? '+' : ''}{Number(quote.changePercent ?? 0).toFixed(2)}%)
      </span>
    </div>;
  };

  return <section className="w-full overflow-hidden bg-[#050505] text-white" aria-label="Live market, forex and intraday ticker">
    <style>{`@keyframes artha-top-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } } .artha-top-ticker-track { animation: artha-top-ticker 40s linear infinite; } .artha-top-ticker-track:hover,.artha-top-ticker-track:focus-within{animation-play-state:paused} @media (prefers-reduced-motion:reduce){.artha-top-ticker-track{animation:none}}`}</style>
    <div className="flex items-center justify-between border-b border-white/10 bg-[#080808] px-3 py-1.5 text-[8px] sm:px-5">
      <div className="flex items-center gap-2 font-black uppercase tracking-[.18em]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22c55e]"/>Live Markets</div>
      <div className="flex items-center gap-2 text-white/40"><span className="hidden sm:inline">Markets · Forex · Intraday</span>{updatedAt && <span>Updated {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}<button type="button" onClick={() => void load()} disabled={refreshing} className="rounded border border-white/10 p-1 hover:text-white"><RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`}/></button></div>
    </div>
    <div className="overflow-hidden border-b border-white/10">
      {marketTape.length ? <div className="artha-top-ticker-track flex w-max min-w-full py-2.5">{marketTape.map((q, i) => <React.Fragment key={`${q.symbol}-${i}`}><QuoteItem quote={q}/><span className="text-white/15">|</span></React.Fragment>)}</div> : <div className="px-4 py-3 text-[10px] text-white/45">{loading ? 'Loading live market data…' : 'Live market data unavailable.'}</div>}
    </div>
    <div className="overflow-hidden border-b border-white/10 bg-[#080808]">
      {forexTape.length ? <div className="artha-top-ticker-track flex w-max min-w-full py-2.5" style={{ animationDuration: '43s' }}>{forexTape.map((q, i) => <React.Fragment key={`${q.symbol}-${i}`}><QuoteItem quote={q} forexItem/><span className="text-white/15">|</span></React.Fragment>)}</div> : <div className="px-4 py-2 text-[9px] text-white/40">{loading ? 'Loading live forex rates…' : 'Live forex rates unavailable.'}</div>}
    </div>
    <div className="flex items-center gap-2 overflow-x-auto border-t border-white/10 bg-[#030303] px-3 py-2 scrollbar-none">
      <span className="shrink-0 text-[8px] font-black uppercase tracking-[.15em] text-white/35">Intraday</span>
      {intraday.length ? intraday.map((item) => {
        const change = item.first ? ((item.latest! / item.first) - 1) * 100 : 0;
        return <div key={item.symbol} className="flex shrink-0 items-center gap-2 rounded-md border border-white/10 px-2.5 py-1.5 text-[9px]"><span className="font-bold text-white">{item.name}</span><span className="text-white/55">{item.points} points</span><span className={change >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span></div>;
      }) : <span className="text-[9px] text-white/35">{loading ? 'Loading intraday data…' : 'Intraday data unavailable.'}</span>}
    </div>
  </section>;
};

export const FeaturedNewsCard: React.FC<{ article: BusinessBriefArticle }> = ({ article }) => <a href={article.url} target="_blank" rel="noopener noreferrer" className="group relative block min-h-[390px] overflow-hidden rounded-[26px] bg-[#111] shadow-[0_24px_60px_rgba(15,23,42,.12)]">
  {article.imageUrl ? <img src={article.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : null}
  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/5"/>
  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8"><div className="mb-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-[.14em] text-white/75"><span>{article.source}</span><span>•</span><span>{article.category}</span></div><h3 className="max-w-3xl text-2xl font-black leading-tight text-white sm:text-3xl">{article.title}</h3>{article.description && <p className="mt-3 line-clamp-2 max-w-2xl text-xs leading-5 text-white/70">{article.description}</p>}<div className="mt-4 flex items-center gap-3 text-[10px] font-bold text-white/65"><span>{timeLabel(article.publishedAt)}</span><span className="text-white/25">•</span><span className="inline-flex items-center gap-1 text-white">Read original <ExternalLink className="h-3 w-3"/></span></div></div>
</a>;

export const NewsListCard: React.FC<{ article: BusinessBriefArticle }> = ({ article }) => <a href={article.url} target="_blank" rel="noopener noreferrer" className="group flex gap-4 rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
  <div className="h-[110px] w-[145px] shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-[116px] sm:w-[160px]">{article.imageUrl ? <img src={article.imageUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <div className="flex h-full items-center justify-center text-[9px] font-black uppercase tracking-[.14em] text-slate-400">Business News</div>}</div>
  <div className="min-w-0 py-1"><div className="text-[9px] font-black uppercase tracking-[.12em] text-teal-700">{article.source}</div><h4 className="mt-1 line-clamp-3 text-sm font-black leading-5 text-slate-900">{article.title}</h4><div className="mt-2 text-[9px] font-semibold text-slate-400">{timeLabel(article.publishedAt)}</div></div>
</a>;

export const BusinessBrief: React.FC = () => {
  const [articles, setArticles] = useState<BusinessBriefArticle[]>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { const load = async () => { try { setArticles(normalizeNews(await fetchBusinessNews())); setUpdatedAt(new Date().toISOString()); } finally { setLoading(false); } }; void load(); const timer = window.setInterval(() => void load(), 60_000); return () => window.clearInterval(timer); }, []);
  const featured = articles[0];
  const side = articles.slice(1, 5);
  return <section className="border-y border-slate-200 bg-white" aria-label="Connected Business News"><div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
    <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[.16em] text-teal-700">CONNECTED BUSINESS NEWS</div><h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Business Brief</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Provider-backed business and market headlines, clearly sourced and time-stamped.</p></div><div className="flex items-center gap-4 text-[10px] font-bold text-slate-400"><span>Updated {updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span><a href="/news" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:border-slate-300">View all headlines ↗</a></div></div>
    {featured ? <div className="grid gap-5 lg:grid-cols-[1.12fr_.88fr]"><FeaturedNewsCard article={featured}/><div className="grid gap-3">{side.map((article) => <NewsListCard key={article.url || article.title} article={article}/>)}</div></div> : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">{loading ? 'Loading connected business news…' : 'Connected business news is temporarily unavailable.'}</div>}
  </div></section>;
};
