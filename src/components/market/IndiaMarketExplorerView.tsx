import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Building2, ExternalLink, RefreshCw, Search, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { INDIA_MARKET_SECTORS, INDIA_MARKET_UNIVERSE, IndiaMarketCompany } from '../../data/indiaMarketUniverse';
import { fetchMarketHistory, fetchMarketOverview, askTutorAI } from '../../services/learningApi';
import { getWatchlist, saveWatchlist } from '../../services/learningStorage';
import { MarketHistoryPoint, NormalizedMarketQuote } from '../../types';
import { MarketPerformanceChart } from '../dashboard/DashboardCharts';

const PAGE_SIZE = 12;
type Sort = 'curated' | 'az' | 'move-desc' | 'move-asc' | 'price-desc' | 'price-asc';
type Movement = 'all' | 'gainers' | 'losers' | 'unchanged';

type QuoteState = 'Live verified feed' | 'Recently refreshed' | 'Delayed quote' | 'End-of-day reference' | 'Stale data' | 'Unavailable';

function quoteState(quote?: NormalizedMarketQuote): QuoteState {
  if (!quote) return 'Unavailable';
  if (quote.freshness === 'real_time' && quote.providerTimestamp) return 'Live verified feed';
  if (quote.freshness === 'real_time') return 'Recently refreshed';
  if (quote.freshness === 'delayed') return 'Delayed quote';
  if (quote.freshness === 'end_of_day') return 'End-of-day reference';
  if (quote.freshness === 'stale') return 'Stale data';
  return 'Unavailable';
}

function formatPrice(quote?: NormalizedMarketQuote) {
  if (!quote) return 'Unavailable';
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: quote.currency || 'INR', maximumFractionDigits: 2 }).format(quote.price); }
  catch { return `${quote.currency || 'INR'} ${quote.price.toFixed(2)}`; }
}

function currentDetailSymbol(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/finance\/markets\/india\/([^/]+)\/?$/i);
  return match ? decodeURIComponent(match[1]) : null;
}

export const IndiaMarketExplorerView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('all');
  const [movement, setMovement] = useState<Movement>('all');
  const [sort, setSort] = useState<Sort>('curated');
  const [page, setPage] = useState(1);
  const [quotes, setQuotes] = useState<Record<string, NormalizedMarketQuote>>({});
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(getWatchlist());
  const [detailSymbol, setDetailSymbol] = useState<string | null>(currentDetailSymbol);

  const identityFiltered = useMemo(() => INDIA_MARKET_UNIVERSE.filter((company) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || [company.officialName, company.displayName, company.providerSymbol, company.sector, company.industry].some((value) => value.toLowerCase().includes(needle));
    const matchesSector = sector === 'all' || company.sector === sector;
    return matchesQuery && matchesSector;
  }), [query, sector]);

  const quoteFiltered = useMemo(() => identityFiltered.filter((company) => {
    if (movement === 'all') return true;
    const quote = quotes[company.providerSymbol];
    if (!quote || quote.changePercent == null) return false;
    if (movement === 'gainers') return quote.changePercent > 0;
    if (movement === 'losers') return quote.changePercent < 0;
    return Math.abs(quote.changePercent) < 0.0001;
  }), [identityFiltered, movement, quotes]);

  const sorted = useMemo(() => [...quoteFiltered].sort((a, b) => {
    if (sort === 'az') return a.displayName.localeCompare(b.displayName);
    const qa = quotes[a.providerSymbol]; const qb = quotes[b.providerSymbol];
    if (sort === 'move-desc') return (qb?.changePercent ?? -Infinity) - (qa?.changePercent ?? -Infinity);
    if (sort === 'move-asc') return (qa?.changePercent ?? Infinity) - (qb?.changePercent ?? Infinity);
    if (sort === 'price-desc') return (qb?.price ?? -Infinity) - (qa?.price ?? -Infinity);
    if (sort === 'price-asc') return (qa?.price ?? Infinity) - (qb?.price ?? Infinity);
    return INDIA_MARKET_UNIVERSE.indexOf(a) - INDIA_MARKET_UNIVERSE.indexOf(b);
  }), [quoteFiltered, quotes, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const loadVisibleQuotes = async () => {
    if (!visible.length) return;
    setLoading(true);
    try {
      const received = await fetchMarketOverview(visible.map((company) => company.providerSymbol));
      setQuotes((current) => ({ ...current, ...Object.fromEntries(received.map((quote) => [quote.symbol, quote])) }));
      setLastRefresh(new Date().toISOString());
    } finally { setLoading(false); }
  };

  useEffect(() => { setPage(1); }, [query, sector, movement, sort]);
  useEffect(() => { void loadVisibleQuotes(); }, [page, query, sector]);

  const toggleWatch = (symbol: string) => {
    const next = watchlist.includes(symbol) ? watchlist.filter((item) => item !== symbol) : [...watchlist, symbol];
    setWatchlist(next); saveWatchlist(next);
  };

  const openDetail = (company: IndiaMarketCompany) => {
    setDetailSymbol(company.providerSymbol);
    window.history.pushState({}, '', `/finance/markets/india/${encodeURIComponent(company.providerSymbol)}`);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const closeDetail = () => {
    setDetailSymbol(null);
    window.history.pushState({}, '', '/finance/markets/india');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const detailCompany = detailSymbol ? INDIA_MARKET_UNIVERSE.find((company) => company.providerSymbol === detailSymbol) ?? null : null;
  if (detailCompany) return <IndiaCompanyDetail company={detailCompany} initialQuote={quotes[detailCompany.providerSymbol]} watchlisted={watchlist.includes(detailCompany.providerSymbol)} onToggleWatch={() => toggleWatch(detailCompany.providerSymbol)} onBack={closeDetail} />;

  return <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-7 sm:px-6">
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[.14em] text-interactive">Indian public-market references</div><h1 className="mt-2 text-3xl font-black text-ink sm:text-4xl">India Market Explorer</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">Search and inspect listed Indian market references with transparent source and freshness labels.</p></div><button type="button" disabled={loading} onClick={() => void loadVisibleQuotes()} className="inline-flex items-center gap-2 rounded-xl border border-line bg-canvas px-4 py-2.5 text-xs font-black text-ink disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh visible quotes</button></div>
      <div className="mt-5 flex flex-wrap gap-2 text-[9px] text-secondary"><span className="rounded-full border border-line bg-canvas px-3 py-1.5">Tracked universe: {INDIA_MARKET_UNIVERSE.length} companies</span><span className="rounded-full border border-line bg-canvas px-3 py-1.5">Provider: existing Artha Bench market-data adapter</span><span className="rounded-full border border-line bg-canvas px-3 py-1.5">Session status unavailable</span><span className="rounded-full border border-line bg-canvas px-3 py-1.5">{lastRefresh ? `Retrieved ${new Date(lastRefresh).toLocaleString('en-IN')}` : 'Not refreshed yet'}</span></div>
    </section>

    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-secondary" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Indian companies, ticker symbols, sectors or indices" className="w-full rounded-xl border border-line-strong bg-canvas py-2.5 pl-10 pr-3 text-xs text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/15" /></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <select value={sector} onChange={(event) => setSector(event.target.value)} className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-xs text-ink"><option value="all">All sectors</option>{INDIA_MARKET_SECTORS.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={movement} onChange={(event) => setMovement(event.target.value as Movement)} className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-xs text-ink"><option value="all">All movement states</option><option value="gainers">Gainers among loaded quotes</option><option value="losers">Losers among loaded quotes</option><option value="unchanged">Unchanged among loaded quotes</option></select>
        <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-xs text-ink"><option value="curated">Curated tracked list</option><option value="az">Alphabetical A–Z</option><option value="move-desc">Percentage move: gainers first</option><option value="move-asc">Percentage move: losers first</option><option value="price-desc">Price: high to low</option><option value="price-asc">Price: low to high</option></select>
      </div>
      <p className="mt-3 text-[9px] leading-4 text-secondary">Identity metadata is configured separately from market prices. Quotes are requested only for the visible page in parallel; unsupported symbols remain clearly unavailable rather than receiving placeholder prices.</p>
    </section>

    {sorted.length === 0 ? <section className="rounded-3xl border border-dashed border-line-strong bg-canvas p-10 text-center"><Building2 className="mx-auto h-8 w-8 text-secondary" /><h2 className="mt-3 text-sm font-black text-ink">No tracked company matches these filters.</h2><p className="mt-2 text-xs text-secondary">Clear a filter or search by company, ticker, sector or industry.</p></section> : <>
      <section className="hidden overflow-hidden rounded-3xl border border-line bg-surface shadow-sm md:block"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-[10px]"><thead className="bg-canvas text-secondary"><tr><th className="px-4 py-3">Company</th><th className="px-4 py-3">Symbol</th><th className="px-4 py-3">Sector</th><th className="px-4 py-3 text-right">Last price</th><th className="px-4 py-3 text-right">Movement</th><th className="px-4 py-3">Data state</th><th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">Actions</th></tr></thead><tbody>{visible.map((company) => <CompanyRow key={company.id} company={company} quote={quotes[company.providerSymbol]} watchlisted={watchlist.includes(company.providerSymbol)} onWatch={() => toggleWatch(company.providerSymbol)} onDetails={() => openDetail(company)} />)}</tbody></table></div></section>
      <section className="grid gap-3 md:hidden">{visible.map((company) => <CompanyCard key={company.id} company={company} quote={quotes[company.providerSymbol]} watchlisted={watchlist.includes(company.providerSymbol)} onWatch={() => toggleWatch(company.providerSymbol)} onDetails={() => openDetail(company)} />)}</section>
    </>}

    <div className="flex items-center justify-between gap-3"><div className="text-[10px] text-secondary">Page {page} of {totalPages} · {sorted.length} matching companies</div><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-line px-3 py-2 text-xs font-bold text-ink disabled:opacity-35">Previous</button><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-xl border border-line px-3 py-2 text-xs font-bold text-ink disabled:opacity-35">Next</button></div></div>

    <section className="rounded-3xl border border-line bg-canvas p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /><div><div className="text-xs font-black text-ink">Market-data truthfulness</div><p className="mt-2 text-[10px] leading-5 text-secondary">No price is generated from the directory metadata. “Live verified feed” is shown only when the connected quote response identifies real-time freshness and includes a provider timestamp. Delayed, end-of-day, stale and unavailable states remain visible. Educational analysis only — not investment advice.</p></div></div></section>
  </div>;
};

const CompanyRow: React.FC<{ company: IndiaMarketCompany; quote?: NormalizedMarketQuote; watchlisted: boolean; onWatch: () => void; onDetails: () => void }> = ({ company, quote, watchlisted, onWatch, onDetails }) => { const move = quote?.changePercent ?? null; return <tr className="border-t border-line"><td className="px-4 py-4"><Identity company={company} /></td><td className="px-4 py-4 font-black text-ink">{company.providerSymbol}</td><td className="px-4 py-4 text-secondary">{company.sector}</td><td className="px-4 py-4 text-right font-black text-ink">{formatPrice(quote)}</td><td className={`px-4 py-4 text-right font-black ${move == null ? 'text-secondary' : move >= 0 ? 'text-success' : 'text-danger'}`}>{move == null ? '—' : <span className="inline-flex items-center gap-1">{move >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{move >= 0 ? '+' : ''}{move.toFixed(2)}%</span>}</td><td className="px-4 py-4"><StateBadge state={quoteState(quote)} /></td><td className="px-4 py-4 text-secondary">{quote?.providerTimestamp ? new Date(quote.providerTimestamp).toLocaleString('en-IN') : quote?.retrievedAt ? `Retrieved ${new Date(quote.retrievedAt).toLocaleString('en-IN')}` : 'Unavailable'}</td><td className="px-4 py-4"><div className="flex gap-2"><button onClick={onDetails} className="font-black text-interactive">View details</button><button onClick={onWatch} aria-label={`${watchlisted ? 'Remove' : 'Add'} ${company.displayName} ${watchlisted ? 'from' : 'to'} watchlist`}><Star className={`h-4 w-4 ${watchlisted ? 'fill-current text-warning' : 'text-secondary'}`} /></button></div></td></tr>; };
const CompanyCard: React.FC<{ company: IndiaMarketCompany; quote?: NormalizedMarketQuote; watchlisted: boolean; onWatch: () => void; onDetails: () => void }> = ({ company, quote, watchlisted, onWatch, onDetails }) => <article className="rounded-2xl border border-line bg-surface p-4"><div className="flex items-start justify-between gap-3"><Identity company={company} /><button onClick={onWatch}><Star className={`h-4 w-4 ${watchlisted ? 'fill-current text-warning' : 'text-secondary'}`} /></button></div><div className="mt-4 flex items-end justify-between gap-3"><div><div className="text-lg font-black text-ink">{formatPrice(quote)}</div><div className="mt-1"><StateBadge state={quoteState(quote)} /></div></div><button onClick={onDetails} className="inline-flex items-center gap-1 text-[10px] font-black text-interactive">View details <ArrowRight className="h-3 w-3" /></button></div></article>;
const Identity: React.FC<{ company: IndiaMarketCompany }> = ({ company }) => <div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-canvas text-[10px] font-black text-interactive">{company.displayName.split(/\s+/).slice(0,2).map((part) => part[0]).join('')}</div><div><div className="font-black text-ink">{company.displayName}</div><div className="mt-0.5 text-[9px] text-secondary">{company.exchange} · {company.industry}</div></div></div>;
const StateBadge: React.FC<{ state: QuoteState }> = ({ state }) => <span className={`inline-flex rounded-full border px-2 py-1 text-[8px] font-black ${state === 'Live verified feed' || state === 'Recently refreshed' ? 'border-success-fill/25 bg-success-soft text-success' : state === 'Unavailable' ? 'border-line bg-subtle text-secondary' : 'border-warning-fill/25 bg-warning-soft text-warning'}`}>{state}</span>;

const IndiaCompanyDetail: React.FC<{ company: IndiaMarketCompany; initialQuote?: NormalizedMarketQuote; watchlisted: boolean; onToggleWatch: () => void; onBack: () => void }> = ({ company, initialQuote, watchlisted, onToggleWatch, onBack }) => {
  const [quote, setQuote] = useState<NormalizedMarketQuote | undefined>(initialQuote);
  const [range, setRange] = useState<'1w'|'1m'|'3m'|'6m'|'1y'>('1m');
  const [history, setHistory] = useState<MarketHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  useEffect(() => { let active = true; setLoading(true); Promise.allSettled([fetchMarketOverview([company.providerSymbol]), fetchMarketHistory(company.providerSymbol, range)]).then(([quoteResult, historyResult]) => { if (!active) return; if (quoteResult.status === 'fulfilled') setQuote(quoteResult.value[0]); setHistory(historyResult.status === 'fulfilled' ? historyResult.value.points : []); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [company.providerSymbol, range]);
  const rangeReturn = useMemo(() => history.length > 1 && history[0].price !== 0 ? ((history.at(-1)!.price / history[0].price) - 1) * 100 : null, [history]);
  const ask = async (preset?: string) => { const next = (preset ?? question).trim(); if (!next || aiBusy) return; setQuestion(''); setAiBusy(true); const visibleEvidence = { company: { name: company.officialName, symbol: company.providerSymbol, exchange: company.exchange, sector: company.sector, industry: company.industry }, quote: quote ? { price: quote.price, currency: quote.currency, change: quote.change, changePercent: quote.changePercent, providerName: quote.providerName, providerTimestamp: quote.providerTimestamp, retrievedAt: quote.retrievedAt, freshness: quote.freshness } : null, chart: { range, observations: history.length, rangeReturn, high: history.length ? Math.max(...history.map((item) => item.price)) : null, low: history.length ? Math.min(...history.map((item) => item.price)) : null } }; try { const response = await askTutorAI(`You are ArthaMind Market Context Analyst. Explain ONLY the visible public-market evidence supplied. Do not invent fundamentals, prices, news or analyst opinions. Do not give buy/sell/hold recommendations, price targets, trading signals or personalised investment advice. Clearly state provider freshness and data limitations. Question: ${next}. Visible evidence: ${JSON.stringify(visibleEvidence)}`.slice(0,5500), [], { country:'India', currency:'INR', language:'english', level:'advanced', mode:'explain', detail:'detailed', useOfficialSources:false }); setAnswer(response.answer); } finally { setAiBusy(false); } };
  return <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-7 sm:px-6"><button onClick={onBack} className="inline-flex items-center gap-2 text-xs font-black text-interactive"><ArrowLeft className="h-4 w-4" /> India Market Explorer</button><section className="rounded-3xl border border-line bg-surface p-5 sm:p-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><Identity company={company} /><div className="flex flex-wrap gap-2"><button onClick={onToggleWatch} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-black text-ink"><Star className={`h-4 w-4 ${watchlisted ? 'fill-current text-warning' : ''}`} />{watchlisted ? 'In watchlist' : 'Add to watchlist'}</button><a href={company.officialWebsite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-black text-ink">Official website <ExternalLink className="h-3.5 w-3.5" /></a></div></div><div className="mt-5 grid gap-3 sm:grid-cols-4"><Mini label="Last price" value={formatPrice(quote)} /><Mini label="Movement" value={quote?.changePercent == null ? 'Unavailable' : `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%`} /><Mini label="Data state" value={quoteState(quote)} /><Mini label="Provider" value={quote?.providerName ?? 'Unavailable'} /></div><p className="mt-3 text-[9px] text-secondary">Quote timestamp: {quote?.providerTimestamp ?? 'Unavailable'} · retrieval: {quote?.retrievedAt ?? 'Unavailable'}.</p></section><section className="rounded-3xl border border-line bg-surface p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-black text-ink">Professional price history</h2><p className="mt-1 text-[10px] text-secondary">Intraday history is unavailable from this explorer until the active provider supplies verified intraday observations.</p></div><div className="flex flex-wrap gap-1">{(['1w','1m','3m','6m','1y'] as const).map((item) => <button key={item} onClick={() => setRange(item)} className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase ${range === item ? 'bg-interactive-soft text-interactive' : 'text-secondary'}`}>{item}</button>)}</div></div><div className="mt-4 h-[380px]">{loading ? <div className="flex h-full items-center justify-center text-xs text-secondary"><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading verified provider history…</div> : history.length ? <MarketPerformanceChart data={history} currency={quote?.currency || 'INR'} rangeReturn={rangeReturn} /> : <div className="flex h-full items-center justify-center text-xs text-secondary">Historical data unavailable from the current provider.</div>}</div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Mini label="Range return" value={rangeReturn == null ? 'Unavailable' : `${rangeReturn >= 0 ? '+' : ''}${rangeReturn.toFixed(2)}%`} /><Mini label="Period high" value={history.length ? formatPrice({ ...(quote as NormalizedMarketQuote), price: Math.max(...history.map((item) => item.price)) }) : 'Unavailable'} /><Mini label="Period low" value={history.length ? formatPrice({ ...(quote as NormalizedMarketQuote), price: Math.min(...history.map((item) => item.price)) }) : 'Unavailable'} /><Mini label="Observations" value={String(history.length)} /></div></section><section className="rounded-3xl border border-interactive/20 bg-surface p-5 sm:p-6"><div className="text-[10px] font-black uppercase tracking-wider text-interactive"><Sparkles className="mr-1 inline h-3.5 w-3.5" /> ArthaMind company explainer</div><h2 className="mt-2 text-xl font-black text-ink">Ask about the data visible on this page</h2><div className="mt-3 flex flex-wrap gap-2">{['Explain this price chart in simple language.','What data limitations should I notice?','Summarise the visible public company information.'].map((item) => <button key={item} onClick={() => void ask(item)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-[10px] font-bold text-secondary">{item}</button>)}</div><div className="mt-3 flex gap-2"><input value={question} onChange={(event) => setQuestion(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-xs text-ink" placeholder="Ask ArthaMind about the visible quote or chart…" /><button disabled={aiBusy || !question.trim()} onClick={() => void ask()} className="rounded-xl bg-brand px-4 text-xs font-black text-white disabled:opacity-40">Ask</button></div>{answer && <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-line bg-canvas p-4 text-xs leading-5 text-secondary">{answer}</div>}<p className="mt-3 text-[9px] text-secondary">Educational analysis only — not investment advice.</p></section></div>;
};
const Mini: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-xl border border-line bg-canvas p-3"><div className="text-[8px] font-black uppercase tracking-wider text-secondary">{label}</div><div className="mt-1 text-[10px] font-black text-ink">{value}</div></div>;
