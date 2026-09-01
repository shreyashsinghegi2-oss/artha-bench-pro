import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Building2, ExternalLink, RefreshCw, Search, ShieldCheck, Star } from 'lucide-react';
import { INDIA_MARKET_SECTORS, INDIA_MARKET_UNIVERSE, IndiaMarketCompany } from '../../data/indiaMarketUniverse';
import { getWatchlist, saveWatchlist } from '../../services/learningStorage';
import {
  fetchIndiaMarketHistory,
  fetchIndiaMarketQuotes,
  fetchIndiaMarketStatus,
  type IndiaMarketQuoteResult,
  type IndiaMarketStatus,
} from '../../services/indiaMarketApi';
import type { EvidenceReference } from '../../services/marketAssistantApi';
import type { MarketDataState } from '../../services/providerContracts';
import type { MarketHistoryPoint, NormalizedMarketQuote } from '../../types';
import { MarketPerformanceChart } from '../dashboard/DashboardCharts';
import { ArthaMindMarketExplainer, MarketDataBadge, MarketSourcePanel } from './MarketProShell';

const PAGE_SIZE = 12;
type Sort = 'curated' | 'az' | 'move-desc' | 'move-asc' | 'price-desc' | 'price-asc';
type Movement = 'all' | 'gainers' | 'losers' | 'unchanged';
type StateFilter = 'all' | MarketDataState;
type ExchangeFilter = 'all' | 'NSE' | 'BSE';

function formatPrice(quote?: NormalizedMarketQuote | null) {
  if (!quote || !Number.isFinite(quote.price)) return 'Unavailable';
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: quote.currency || 'INR', maximumFractionDigits: 2 }).format(quote.price); }
  catch { return `${quote.currency || 'INR'} ${quote.price.toFixed(2)}`; }
}

function currentDetailSymbol(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/finance\/markets\/india\/([^/]+)\/?$/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function stateLabel(state?: MarketDataState) {
  if (state === 'live_verified') return 'Live verified feed';
  if (state === 'recently_refreshed') return 'Recently refreshed';
  if (state === 'delayed') return 'Delayed quote';
  if (state === 'end_of_day') return 'End-of-day reference';
  if (state === 'cached') return 'Cached reference';
  if (state === 'stale') return 'Stale data';
  if (state === 'demo') return 'Demo data';
  return 'Unavailable';
}

function timestamp(value?: string | null) {
  if (!value) return 'Unavailable';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('en-IN');
}

export const IndiaMarketExplorerView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sector, setSector] = useState('all');
  const [exchange, setExchange] = useState<ExchangeFilter>('all');
  const [movement, setMovement] = useState<Movement>('all');
  const [dataState, setDataState] = useState<StateFilter>('all');
  const [sort, setSort] = useState<Sort>('curated');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<Record<string, IndiaMarketQuoteResult>>({});
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [status, setStatus] = useState<IndiaMarketStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [watchlist, setWatchlist] = useState<string[]>(getWatchlist());
  const [detailSymbol, setDetailSymbol] = useState<string | null>(currentDetailSymbol);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    setStatusLoading(true);
    fetchIndiaMarketStatus().then((next) => { if (active) setStatus(next); }).catch(() => { if (active) setStatus(null); }).finally(() => { if (active) setStatusLoading(false); });
    return () => { active = false; };
  }, [refreshNonce]);

  const identityFiltered = useMemo(() => INDIA_MARKET_UNIVERSE.filter((company) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || [company.officialName, company.displayName, company.providerSymbol, company.sector, company.industry].some((value) => value.toLowerCase().includes(needle));
    const matchesSector = sector === 'all' || company.sector === sector;
    const matchesExchange = exchange === 'all' || company.exchange === exchange;
    return matchesQuery && matchesSector && matchesExchange;
  }), [query, sector, exchange]);

  const identitySorted = useMemo(() => [...identityFiltered].sort((a, b) => {
    if (sort === 'az') return a.displayName.localeCompare(b.displayName);
    const qa = results[a.id]?.quote; const qb = results[b.id]?.quote;
    if (sort === 'move-desc') return (qb?.changePercent ?? -Infinity) - (qa?.changePercent ?? -Infinity);
    if (sort === 'move-asc') return (qa?.changePercent ?? Infinity) - (qb?.changePercent ?? Infinity);
    if (sort === 'price-desc') return (qb?.price ?? -Infinity) - (qa?.price ?? -Infinity);
    if (sort === 'price-asc') return (qa?.price ?? Infinity) - (qb?.price ?? Infinity);
    return INDIA_MARKET_UNIVERSE.indexOf(a) - INDIA_MARKET_UNIVERSE.indexOf(b);
  }), [identityFiltered, results, sort]);

  const totalPages = Math.max(1, Math.ceil(identitySorted.length / PAGE_SIZE));
  const pageCandidates = identitySorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const visible = useMemo(() => pageCandidates.filter((company) => {
    const row = results[company.id];
    const quote = row?.quote;
    if (movement !== 'all') {
      if (!quote || quote.changePercent == null) return false;
      if (movement === 'gainers' && quote.changePercent <= 0) return false;
      if (movement === 'losers' && quote.changePercent >= 0) return false;
      if (movement === 'unchanged' && Math.abs(quote.changePercent) >= 0.0001) return false;
    }
    if (dataState !== 'all' && row?.attribution.state !== dataState) return false;
    return true;
  }), [pageCandidates, results, movement, dataState]);

  useEffect(() => { setPage(1); }, [query, sector, exchange, movement, dataState, sort]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  useEffect(() => {
    if (!pageCandidates.length) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetchIndiaMarketQuotes(pageCandidates.map((company) => company.id)).then((received) => {
      if (!active) return;
      setResults((current) => ({ ...current, ...Object.fromEntries(received.map((row) => [row.assetId, row])) }));
      setLastRefresh(new Date().toISOString());
    }).catch(() => {
      if (active) setError('Market data could not be refreshed right now. Existing tracked identities remain available.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, debouncedQuery, sector, exchange, refreshNonce]);

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
  if (detailCompany) return <IndiaCompanyDetail company={detailCompany} initialResult={results[detailCompany.id]} watchlisted={watchlist.includes(detailCompany.providerSymbol)} onToggleWatch={() => toggleWatch(detailCompany.providerSymbol)} onBack={closeDetail} />;

  const availableOnPage = pageCandidates.filter((company) => Boolean(results[company.id]?.quote)).length;
  const unavailableOnPage = pageCandidates.length - availableOnPage;

  return <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-7 sm:px-6">
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[.14em] text-interactive">Indian public-market references</div><h1 className="mt-2 text-3xl font-black text-ink sm:text-4xl">India Market Explorer</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">Search all tracked identities immediately, while verified quotes are requested only for the visible page through a bounded server-side batch endpoint.</p></div><button type="button" disabled={loading} onClick={() => setRefreshNonce((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-line bg-canvas px-4 py-2.5 text-xs font-black text-ink disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh visible quotes</button></div>
      <div className="mt-5 flex flex-wrap gap-2 text-[9px] text-secondary"><span className="rounded-full border border-line bg-canvas px-3 py-1.5">Tracked universe: {INDIA_MARKET_UNIVERSE.length}</span><span className="rounded-full border border-line bg-canvas px-3 py-1.5">Provider: {statusLoading ? 'Checking…' : status?.provider || 'Unavailable'}</span><span className="rounded-full border border-line bg-canvas px-3 py-1.5">Verified mapping coverage: {status ? `${status.verifiedMappings}/${status.totalTrackedAssets}` : 'Unavailable'}</span><span className="rounded-full border border-line bg-canvas px-3 py-1.5">{lastRefresh ? `Retrieved ${timestamp(lastRefresh)}` : 'No quote batch completed yet'}</span></div>
      {status && <details className="mt-4 rounded-2xl border border-line bg-canvas p-4 text-[10px] text-secondary"><summary className="cursor-pointer font-black text-ink">Open connection diagnostics</summary><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Diagnostic label="Configured provider" value={status.provider}/><Diagnostic label="Configured" value={status.configured ? 'Yes' : 'No'}/><Diagnostic label="API key present" value={status.apiKeyPresent ? 'Yes' : 'No'}/><Diagnostic label="Coverage" value={`${status.verifiedMappings}/${status.totalTrackedAssets} verified`}/><Diagnostic label="Last successful fetch" value={status.lastSuccessfulQuoteFetch ? timestamp(status.lastSuccessfulQuoteFetch) : 'Unavailable'}/><Diagnostic label="Last failure" value={status.lastFailureCategory || 'None recorded'}/><Diagnostic label="Rate limit" value={status.rateLimitState}/><Diagnostic label="Freshness config" value={`cache ${status.cache.ttlSeconds}s · stale ${status.cache.staleThresholdMinutes}m`}/></div></details>}
      {status && !status.configured && <div className="mt-4 rounded-xl border border-warning-fill/25 bg-warning-soft p-3 text-[10px] leading-5 text-warning">India market provider is not configured in this deployment. An administrator must add a valid server-side provider key and verified symbol mappings.</div>}
      {error && <div className="mt-4 rounded-xl border border-danger/20 bg-danger-soft p-3 text-[10px] text-danger">{error} Use Refresh visible quotes to retry.</div>}
    </section>

    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-secondary" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Indian companies, ticker symbols, sectors or industries" className="w-full rounded-xl border border-line-strong bg-canvas py-2.5 pl-10 pr-3 text-xs text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/15" /></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select value={sector} onChange={(event) => setSector(event.target.value)} className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-xs text-ink"><option value="all">All sectors</option>{INDIA_MARKET_SECTORS.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={exchange} onChange={(event) => setExchange(event.target.value as ExchangeFilter)} className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-xs text-ink"><option value="all">All exchanges</option><option value="NSE">NSE</option><option value="BSE">BSE</option></select>
        <select value={movement} onChange={(event) => setMovement(event.target.value as Movement)} className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-xs text-ink"><option value="all">All movement states</option><option value="gainers">Gainers among loaded quotes</option><option value="losers">Losers among loaded quotes</option><option value="unchanged">Unchanged among loaded quotes</option></select>
        <select value={dataState} onChange={(event) => setDataState(event.target.value as StateFilter)} className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-xs text-ink"><option value="all">All data states</option><option value="live_verified">Live verified</option><option value="recently_refreshed">Recently refreshed</option><option value="delayed">Delayed</option><option value="end_of_day">End of day</option><option value="cached">Cached</option><option value="stale">Stale</option><option value="unavailable">Unavailable</option></select>
        <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-xs text-ink"><option value="curated">Curated tracked list</option><option value="az">Alphabetical A–Z</option><option value="move-desc">Percentage move: gainers first</option><option value="move-asc">Percentage move: losers first</option><option value="price-desc">Price: high to low</option><option value="price-asc">Price: low to high</option></select>
      </div>
      <p className="mt-3 text-[9px] leading-4 text-secondary">Search uses identity metadata immediately. Quote requests wait 300 ms after search changes and request only the visible page. Tracked identity is separate from provider-backed quote availability.</p>
    </section>

    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Visible page identities" value={String(pageCandidates.length)}/><Metric label="Provider-backed quotes" value={loading ? 'Refreshing…' : String(availableOnPage)}/><Metric label="Unavailable / pending" value={loading ? 'Refreshing…' : String(unavailableOnPage)}/></div>

    {identitySorted.length === 0 ? <EmptyState /> : visible.length === 0 && !loading ? <section className="rounded-3xl border border-dashed border-line-strong bg-canvas p-10 text-center"><Building2 className="mx-auto h-8 w-8 text-secondary" /><h2 className="mt-3 text-sm font-black text-ink">No loaded quote matches the selected quote filters.</h2><p className="mt-2 text-xs text-secondary">The tracked identities still exist. Clear movement/data-state filters or navigate pages to inspect other companies.</p></section> : <>
      <section className="hidden overflow-hidden rounded-3xl border border-line bg-surface shadow-sm md:block"><div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-left text-[10px]"><thead className="bg-canvas text-secondary"><tr><th className="px-4 py-3">Company</th><th className="px-4 py-3">Symbol</th><th className="px-4 py-3">Sector</th><th className="px-4 py-3 text-right">Last price</th><th className="px-4 py-3 text-right">Movement</th><th className="px-4 py-3">Data state</th><th className="px-4 py-3">Source / time</th><th className="px-4 py-3">Actions</th></tr></thead><tbody>{visible.map((company) => <CompanyRow key={company.id} company={company} result={results[company.id]} loading={loading && !results[company.id]} watchlisted={watchlist.includes(company.providerSymbol)} onWatch={() => toggleWatch(company.providerSymbol)} onDetails={() => openDetail(company)} />)}</tbody></table></div></section>
      <section className="grid gap-3 md:hidden">{visible.map((company) => <CompanyCard key={company.id} company={company} result={results[company.id]} loading={loading && !results[company.id]} watchlisted={watchlist.includes(company.providerSymbol)} onWatch={() => toggleWatch(company.providerSymbol)} onDetails={() => openDetail(company)} />)}</section>
    </>}

    <div className="flex items-center justify-between gap-3"><div className="text-[10px] text-secondary">Page {page} of {totalPages} · {identitySorted.length} matching tracked identities</div><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-line px-3 py-2 text-xs font-bold text-ink disabled:opacity-35">Previous</button><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-xl border border-line px-3 py-2 text-xs font-bold text-ink disabled:opacity-35">Next</button></div></div>

    <section className="rounded-3xl border border-line bg-canvas p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /><div><div className="text-xs font-black text-ink">Market-data truthfulness</div><p className="mt-2 text-[10px] leading-5 text-secondary">No price comes from identity metadata. Unsupported mappings remain searchable. Missing values stay missing. Delayed, end-of-day, cached, stale and unavailable references are never relabelled as live. Educational analysis only — not investment advice.</p></div></div></section>
  </div>;
};

const CompanyRow: React.FC<{ company: IndiaMarketCompany; result?: IndiaMarketQuoteResult; loading: boolean; watchlisted: boolean; onWatch: () => void; onDetails: () => void }> = ({ company, result, loading, watchlisted, onWatch, onDetails }) => {
  const quote = result?.quote; const move = quote?.changePercent ?? null;
  return <tr className="border-t border-line"><td className="px-4 py-4"><Identity company={company} /></td><td className="px-4 py-4"><div className="font-black text-ink">{company.providerSymbol}</div><div className="mt-1 text-[8px] text-secondary">Tracked identity</div></td><td className="px-4 py-4 text-secondary">{company.sector}</td><td className="px-4 py-4 text-right font-black text-ink">{loading ? 'Loading…' : formatPrice(quote)}</td><td className={`px-4 py-4 text-right font-black ${move == null ? 'text-secondary' : move >= 0 ? 'text-success' : 'text-danger'}`}>{move == null ? '—' : <span className="inline-flex items-center gap-1">{move >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{move >= 0 ? '+' : ''}{move.toFixed(2)}%</span>}</td><td className="px-4 py-4"><MarketDataBadge quote={quote} stateOverride={result?.attribution.state} /></td><td className="max-w-[260px] px-4 py-4 text-secondary">{quote ? <><div>{result?.attribution.providerName}</div><div className="mt-1 text-[8px]">Quote {timestamp(result?.attribution.quoteTimestamp)} · Retrieved {timestamp(result?.attribution.retrievedAt)}</div></> : <span>{result?.reason || 'Provider coverage pending. This tracked company does not yet have a verified quote.'}</span>}</td><td className="px-4 py-4"><div className="flex gap-2"><button type="button" onClick={onDetails} className="font-black text-interactive">View details</button><button type="button" onClick={onWatch} aria-label={`${watchlisted ? 'Remove' : 'Add'} ${company.displayName} ${watchlisted ? 'from' : 'to'} watchlist`}><Star className={`h-4 w-4 ${watchlisted ? 'fill-current text-warning' : 'text-secondary'}`} /></button></div></td></tr>;
};

const CompanyCard: React.FC<{ company: IndiaMarketCompany; result?: IndiaMarketQuoteResult; loading: boolean; watchlisted: boolean; onWatch: () => void; onDetails: () => void }> = ({ company, result, loading, watchlisted, onWatch, onDetails }) => {
  const quote = result?.quote; const move = quote?.changePercent ?? null;
  return <article className="rounded-2xl border border-line bg-surface p-4"><div className="flex items-start justify-between gap-3"><Identity company={company} /><button type="button" onClick={onWatch} aria-label={`${watchlisted ? 'Remove' : 'Add'} from watchlist`}><Star className={`h-4 w-4 ${watchlisted ? 'fill-current text-warning' : 'text-secondary'}`} /></button></div><div className="mt-4 flex items-end justify-between gap-3"><div><div className="text-xl font-black text-ink">{loading ? 'Loading…' : formatPrice(quote)}</div><div className={`mt-1 text-xs font-black ${move == null ? 'text-secondary' : move >= 0 ? 'text-success' : 'text-danger'}`}>{move == null ? 'Movement unavailable' : `${move >= 0 ? '+' : ''}${move.toFixed(2)}%`}</div></div><MarketDataBadge quote={quote} stateOverride={result?.attribution.state} /></div><p className="mt-3 text-[9px] leading-4 text-secondary">{quote ? `${result?.attribution.providerName} · quote ${timestamp(result?.attribution.quoteTimestamp)} · retrieved ${timestamp(result?.attribution.retrievedAt)}` : result?.reason || 'Provider coverage pending.'}</p><button type="button" onClick={onDetails} className="mt-3 text-xs font-black text-interactive">View details →</button></article>;
};

const Identity: React.FC<{ company: IndiaMarketCompany }> = ({ company }) => <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-canvas text-[9px] font-black text-interactive" role="img" aria-label={`${company.displayName} fallback identity`}>{company.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div><div className="min-w-0"><div className="truncate text-[10px] font-black text-ink">{company.displayName}</div><div className="truncate text-[8px] text-secondary">{company.industry} · {company.exchange}</div></div></div>;

const IndiaCompanyDetail: React.FC<{ company: IndiaMarketCompany; initialResult?: IndiaMarketQuoteResult; watchlisted: boolean; onToggleWatch: () => void; onBack: () => void }> = ({ company, initialResult, watchlisted, onToggleWatch, onBack }) => {
  const [result, setResult] = useState<IndiaMarketQuoteResult | undefined>(initialResult);
  const [history, setHistory] = useState<MarketHistoryPoint[]>([]);
  const [historyState, setHistoryState] = useState<MarketDataState>('unavailable');
  const [historyReason, setHistoryReason] = useState<string | undefined>();
  const [range, setRange] = useState('1m');
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true; setLoading(true);
    Promise.allSettled([fetchIndiaMarketQuotes([company.id]), fetchIndiaMarketHistory(company.id, range)]).then(([quoteResult, historyResult]) => {
      if (!active) return;
      if (quoteResult.status === 'fulfilled') setResult(quoteResult.value[0]);
      if (historyResult.status === 'fulfilled') {
        setHistory(historyResult.value.points || []);
        setHistoryState(historyResult.value.attribution.state);
        setHistoryReason(historyResult.value.reason || historyResult.value.attribution.reason);
      } else {
        setHistory([]); setHistoryState('unavailable'); setHistoryReason('Historical data is unavailable from the active provider for this range.');
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [company.id, range, nonce]);

  const quote = result?.quote;
  const rangeReturn = useMemo(() => history.length > 1 && history[0].price !== 0 ? ((history.at(-1)!.price / history[0].price) - 1) * 100 : null, [history]);
  const evidence = useMemo<EvidenceReference[]>(() => {
    const rows: EvidenceReference[] = [];
    if (quote) rows.push({ id: 'india-quote', label: `${company.displayName} visible quote`, sourceType: 'market_quote', providerName: result?.attribution.providerName, timestamp: result?.attribution.quoteTimestamp, retrievedAt: result?.attribution.retrievedAt, freshnessState: result?.attribution.state, valueSummary: `${formatPrice(quote)}${quote.changePercent == null ? '' : ` · ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%`}` });
    if (history.length) rows.push({ id: 'india-history', label: `${range} visible price history`, sourceType: 'market_history', providerName: result?.attribution.providerName, retrievedAt: new Date().toISOString(), freshnessState: historyState, valueSummary: `${history.length} observations · period return ${rangeReturn == null ? 'unavailable' : `${rangeReturn.toFixed(2)}%`}` });
    rows.push({ id: 'india-identity', label: 'Tracked company identity', sourceType: 'company_profile', sourceUrl: company.officialWebsite, valueSummary: `${company.officialName} · ${company.providerSymbol} · ${company.exchange} · ${company.sector}` });
    return rows;
  }, [quote, result, company, history, historyState, range, rangeReturn]);

  return <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-7 sm:px-6">
    <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-black text-interactive"><ArrowLeft className="h-4 w-4" /> India Market Explorer</button>
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><Identity company={company} /><div className="flex flex-wrap gap-2"><button type="button" onClick={onToggleWatch} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-black text-ink"><Star className={`h-4 w-4 ${watchlisted ? 'fill-current text-warning' : ''}`} />{watchlisted ? 'In watchlist' : 'Add to watchlist'}</button><button type="button" disabled={loading} onClick={() => setNonce((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-black text-ink disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Retry data</button><a href={company.officialWebsite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-black text-ink">Official website <ExternalLink className="h-3.5 w-3.5" /></a></div></div><div className="mt-5 grid gap-3 sm:grid-cols-4"><Metric label="Last price" value={formatPrice(quote)} /><Metric label="Movement" value={quote?.changePercent == null ? 'Unavailable' : `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%`} /><Metric label="Data state" value={stateLabel(result?.attribution.state)} /><Metric label="Provider" value={result?.attribution.providerName ?? 'Unavailable'} /></div><div className="mt-4"><MarketSourcePanel quote={quote} stateOverride={result?.attribution.state} reason={result?.reason} /></div></section>

    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-black text-ink">Professional price history</h2><p className="mt-1 text-[10px] text-secondary">History is displayed only when returned by the active provider for the verified asset mapping. No synthetic chart is generated.</p></div><div className="flex flex-wrap gap-1">{(['1w','1m','3m','6m','1y'] as const).map((item) => <button type="button" key={item} onClick={() => setRange(item)} className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase ${range === item ? 'bg-interactive-soft text-interactive' : 'text-secondary'}`}>{item}</button>)}</div></div><div className="mt-4 h-[380px]">{loading ? <div className="flex h-full items-center justify-center text-xs text-secondary"><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading verified provider data…</div> : history.length ? <MarketPerformanceChart data={history} currency={quote?.currency || 'INR'} rangeReturn={rangeReturn} /> : <div className="flex h-full items-center justify-center px-6 text-center text-xs text-secondary">{historyReason || 'History is unavailable from the current provider for this selected range.'}</div>}</div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Range return" value={rangeReturn == null ? 'Unavailable' : `${rangeReturn >= 0 ? '+' : ''}${rangeReturn.toFixed(2)}%`} /><Metric label="Period high" value={history.length ? formatNumericPrice(Math.max(...history.map((item) => item.price)), quote?.currency || 'INR') : 'Unavailable'} /><Metric label="Period low" value={history.length ? formatNumericPrice(Math.min(...history.map((item) => item.price)), quote?.currency || 'INR') : 'Unavailable'} /><Metric label="Observations" value={String(history.length)} /></div></section>

    <ArthaMindMarketExplainer page="India Market Explorer company detail" visibleData={{ company: { name: company.officialName, symbol: company.providerSymbol, exchange: company.exchange, sector: company.sector, industry: company.industry }, quote, historySummary: { range, observations: history.length, rangeReturn, high: history.length ? Math.max(...history.map((item) => item.price)) : null, low: history.length ? Math.min(...history.map((item) => item.price)) : null }, dataState: result?.attribution.state || 'unavailable' }} sourceLabels={[result?.attribution.providerName || 'No verified provider response', stateLabel(result?.attribution.state)]} evidence={evidence} suggestions={['Explain what the visible data shows.','What does the source timestamp and freshness mean?','Explain the visible chart range without predicting the future.','What data limitations should I notice?']} />
  </div>;
};

function formatNumericPrice(value: number, currency: string) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}

const Metric = ({ label, value }: { label: string; value: string }) => <div className="rounded-xl border border-line bg-canvas p-3"><div className="text-[8px] font-black uppercase tracking-wider text-secondary">{label}</div><div className="mt-1 text-[10px] font-black text-ink">{value}</div></div>;
const Diagnostic = ({ label, value }: { label: string; value: string }) => <div className="rounded-xl border border-line bg-surface p-3"><div className="text-[8px] font-black uppercase text-secondary">{label}</div><div className="mt-1 break-words font-bold text-ink">{value}</div></div>;
const EmptyState = () => <section className="rounded-3xl border border-dashed border-line-strong bg-canvas p-10 text-center"><Building2 className="mx-auto h-8 w-8 text-secondary" /><h2 className="mt-3 text-sm font-black text-ink">No tracked company matches these identity filters.</h2><p className="mt-2 text-xs text-secondary">Clear a search, exchange or sector filter. Quote availability never removes a tracked identity from search.</p></section>;
