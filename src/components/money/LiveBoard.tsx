import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Loader2, Newspaper, PieChart, RefreshCw, Search } from 'lucide-react';
import type { AppNavigationDestination } from '../../navigationTypes';
import { loadPortfolio, PORTFOLIO_EVENT, summarise } from '../../services/portfolio';
import './liveBoard.css';

const TILES = [
  { symbol: '^NSEI', label: 'NIFTY 50', kind: 'index' },
  { symbol: '^BSESN', label: 'SENSEX', kind: 'index' },
  { symbol: '^NSEBANK', label: 'BANK NIFTY', kind: 'index' },
  { symbol: 'INR=X', label: 'USD / INR', kind: 'fx' },
  { symbol: 'GC=F', label: 'Gold (US$/oz)', kind: 'usd' },
  { symbol: 'BTC-USD', label: 'Bitcoin (US$)', kind: 'usd' },
] as const;

interface Quote { price: number; changePercent: number | null; providerTimestamp: string | null; freshness: string }
interface Row { symbol: string; status: 'available' | 'unavailable'; quote?: Quote }
interface Fund { code: string; name: string; category: string }
interface FundDetail { scheme: { name: string; category: string; house: string; nav: number; navDate: string } | null; returns: Record<string, number>; history: Array<{ date: string; nav: number }> }
interface News { title: string; sourceName: string; sourceUrl: string; publishedAt: string | null }

const inr = (v: number) => `${v < 0 ? '−' : ''}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`;
const fmt = (v: number, kind: string) => kind === 'fx' ? `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : kind === 'usd' ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`;

const Sparkline: React.FC<{ points: number[] }> = ({ points }) => {
  if (points.length < 2) return null;
  const min = Math.min(...points), max = Math.max(...points), w = 120, h = 34;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * w).toFixed(1)},${(h - ((p - min) / (max - min || 1)) * h).toFixed(1)}`).join(' ');
  const up = points[points.length - 1] >= points[0];
  return <svg className="lv-spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><path d={d} fill="none" stroke={up ? '#059669' : '#dc2626'} strokeWidth="1.8" strokeLinecap="round"/></svg>;
};

/** Live data every visitor sees on the dashboard: markets, their portfolio, a fund check and headlines. */
export const LiveBoard: React.FC<{ onNavigate: (d: AppNavigationDestination) => void }> = ({ onNavigate }) => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [asOf, setAsOf] = useState('');
  const [loading, setLoading] = useState(false);
  const [news, setNews] = useState<News[] | null>(null);
  const [portfolio, setPortfolio] = useState(() => loadPortfolio());
  const pf = useMemo(() => (portfolio.holdings.length ? summarise(portfolio) : null), [portfolio]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/markets/batch?symbols=${encodeURIComponent(TILES.map((t) => t.symbol).join(','))}`);
      const d = await r.json() as { results?: Row[]; items?: Row[] } | Row[];
      const list = Array.isArray(d) ? d : d.results ?? d.items ?? [];
      setRows(list); setAsOf(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    } catch { setRows([]); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    fetch('/api/news?region=india&category=business').then((r) => r.json()).then((d) => setNews((d.items ?? d.articles ?? d.news ?? []).slice(0, 4))).catch(() => setNews([]));
  }, []);
  useEffect(() => { const sync = () => setPortfolio(loadPortfolio()); window.addEventListener(PORTFOLIO_EVENT, sync); return () => window.removeEventListener(PORTFOLIO_EVENT, sync); }, []);

  const bySymbol = new Map<string, Row>((rows ?? []).map((r) => [r.symbol, r]));
  return <section className="lv" aria-label="Live markets and your money">
    <div className="lv-head"><h2>Markets now</h2><span>{asOf ? `Updated ${asOf} · delayed quotes` : 'Loading live quotes…'}</span>
      <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh quotes">{loading ? <Loader2 size={14} className="lv-spin"/> : <RefreshCw size={14}/>}</button></div>
    <div className="lv-tiles">{TILES.map((t) => {
      const q = bySymbol.get(t.symbol)?.quote;
      const ch = q?.changePercent ?? null;
      return <button key={t.symbol} type="button" className="lv-tile" onClick={() => onNavigate(t.symbol === 'BTC-USD' ? 'crypto' : t.kind === 'fx' ? 'forex-markets' : 'markets')}>
        <span>{t.label}</span>
        <b>{q ? fmt(q.price, t.kind) : rows ? '—' : ''}</b>
        {q && ch !== null ? <em className={ch >= 0 ? 'up' : 'down'}>{ch >= 0 ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>}{Math.abs(ch).toFixed(2)}%</em> : <em>{rows ? 'Unavailable' : <Loader2 size={12} className="lv-spin"/>}</em>}
      </button>;
    })}</div>

    <div className="lv-grid">
      <article className="lv-card">
        <header><PieChart size={16}/><b>Your portfolio</b></header>
        {pf ? <>
          <p className="lv-big">{inr(pf.netWorth)}</p>
          <p className="lv-sub">Net worth{pf.gainPct !== null ? ` · gain ${pct(pf.gainPct)}` : ''}{pf.xirr !== null ? ` · XIRR ${pct(pf.xirr)}` : ''}</p>
          <div className="lv-mini">{pf.byClass.slice(0, 4).map((c) => <span key={c.cls}>{c.cls} <b>{Math.round(c.share * 100)}%</b></span>)}</div>
        </> : <p className="lv-sub">Import your mutual fund statement or add stocks, FDs and gold to see your net worth and true returns here.</p>}
        <button type="button" className="lv-link" onClick={() => onNavigate('portfolio')}>{pf ? 'Open portfolio' : 'Add investments'} <ArrowRight size={13}/></button>
      </article>
      <FundCheck/>
      <article className="lv-card">
        <header><Newspaper size={16}/><b>Top business news</b></header>
        {news === null ? <p className="lv-sub"><Loader2 size={13} className="lv-spin"/> Loading headlines…</p>
          : news.length ? <ul className="lv-news">{news.map((n) => <li key={n.sourceUrl || n.title}><a href={n.sourceUrl} target="_blank" rel="noopener noreferrer">{n.title}</a><small>{n.sourceName}{n.publishedAt ? ` · ${new Date(n.publishedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</small></li>)}</ul>
            : <p className="lv-sub">Headlines are unavailable right now.</p>}
        <button type="button" className="lv-link" onClick={() => onNavigate('news')}>All news <ArrowRight size={13}/></button>
      </article>
    </div>
  </section>;
};

/** Search any mutual fund and see its real NAV and returns (AMFI data). */
const FundCheck: React.FC = () => {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Fund[]>([]);
  const [detail, setDetail] = useState<FundDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState('');
  useEffect(() => {
    if (q.trim().length < 3 || q === picked) { setHits([]); return; }
    const t = window.setTimeout(() => {
      fetch(`/api/mf/search?q=${encodeURIComponent(q.trim())}&limit=6`).then((r) => r.json()).then((d) => setHits(d.results ?? [])).catch(() => setHits([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, picked]);
  const open = async (f: Fund) => {
    setBusy(true); setError(''); setHits([]); setPicked(f.name); setQ(f.name);
    try { const r = await fetch(`/api/mf/scheme/${f.code}`); if (!r.ok) throw new Error(); setDetail(await r.json()); }
    catch { setError('This fund could not be loaded right now.'); setDetail(null); }
    finally { setBusy(false); }
  };
  const last = detail?.history[detail.history.length - 1];
  const spark = detail ? detail.history.slice(-260).map((p) => p.nav) : [];
  return <article className="lv-card">
    <header><Search size={16}/><b>Check a mutual fund</b></header>
    <div className="lv-search"><input value={q} onChange={(e) => { setQ(e.target.value); setDetail(null); }} placeholder="e.g. HDFC Flexi Cap, Nifty 50 index" aria-label="Search a mutual fund"/>{busy && <Loader2 size={14} className="lv-spin"/>}</div>
    {hits.length > 0 && <ul className="lv-hits">{hits.map((h) => <li key={h.code}><button type="button" onClick={() => void open(h)}>{h.name}</button></li>)}</ul>}
    {error && <p className="lv-sub">{error}</p>}
    {detail && last && <div className="lv-fund">
      <p className="lv-sub">{detail.scheme?.category || 'Mutual fund'}{detail.scheme?.house ? ` · ${detail.scheme.house}` : ''}</p>
      <div className="lv-fund-row"><div><b className="lv-big">₹{last.nav.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b><small>NAV on {last.date}</small></div><Sparkline points={spark}/></div>
      <div className="lv-mini">{(['1Y', '3Y', '5Y'] as const).map((k) => detail.returns[k] !== undefined && <span key={k} className={detail.returns[k] >= 0 ? 'up' : 'down'}>{k}{k !== '1Y' ? ' a year' : ''} <b>{pct(detail.returns[k])}</b></span>)}</div>
      <p className="lv-fine">Past returns do not guarantee future returns. Source: AMFI NAVs.</p>
    </div>}
    {!detail && !hits.length && !error && <p className="lv-sub">Official NAVs and 1, 3 and 5-year returns for any scheme.</p>}
  </article>;
};
