import React, { Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  fetchTerminalSnapshot, formatAgo, formatChange, formatIst, formatMarketPrice, FRESHNESS_LABEL, useNow, usePageVisible,
  type TerminalSnapshotItem,
} from '../../services/marketTerminalApi';
import './marketTerminal.css';

const MarketTerminalChart = React.lazy(() => import('./MarketTerminalChart'));
const SNAPSHOT_POLL_MS = 45_000;
const PLACEHOLDERS = [
  { id: 'nifty50', label: 'NIFTY 50', category: 'Index · NSE' },
  { id: 'sensex', label: 'BSE SENSEX', category: 'Index · BSE' },
  { id: 'usdinr', label: 'USD/INR', category: 'Currency · FX' },
  { id: 'gold', label: 'Gold', category: 'Commodity · COMEX futures (USD/oz)' },
];

const Sparkline: React.FC<{ values: number[]; direction: 'up' | 'down' | 'flat' }> = ({ values, direction }) => {
  const id = useId().replace(/:/g, '');
  const path = useMemo(() => {
    if (values.length < 2) return null;
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const points = values.map((value, index) => [(index / (values.length - 1)) * 100, 30 - ((value - min) / span) * 26 - 2] as const);
    const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    return { line, area: `${line} L100,32 L0,32 Z` };
  }, [values]);
  if (!path) return <div className="mk-spark mk-spark-empty">Intraday history unavailable</div>;
  return <svg className={`mk-spark ${direction}`} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".28"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
    <path d={path.area} fill={`url(#g${id})`}/>
    <path d={path.line} className="mk-spark-line" fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" pathLength={1}/>
  </svg>;
};

const MarketCard: React.FC<{ item: TerminalSnapshotItem; retrievedAt: string; now: number; index: number }> = ({ item, retrievedAt, now, index }) => {
  const previous = useRef<number | null>(null);
  const [flash, setFlash] = useState<'' | 'up' | 'down'>('');
  useEffect(() => {
    if (item.price === null) return;
    if (previous.current !== null && item.price !== previous.current) {
      setFlash(item.price > previous.current ? 'up' : 'down');
      const id = window.setTimeout(() => setFlash(''), 1200);
      previous.current = item.price;
      return () => window.clearTimeout(id);
    }
    previous.current = item.price;
  }, [item.price]);
  const change = formatChange(item.change, item.changePercent, item.decimals);

  // Subtle 3-D tilt that follows a fine pointer; disabled for touch and reduced motion via CSS.
  const onMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--rx', `${(((event.clientY - rect.top) / rect.height) - 0.5) * -6}deg`);
    event.currentTarget.style.setProperty('--ry', `${(((event.clientX - rect.left) / rect.width) - 0.5) * 8}deg`);
  };
  const onLeave = (event: React.PointerEvent<HTMLElement>) => { event.currentTarget.style.setProperty('--rx', '0deg'); event.currentTarget.style.setProperty('--ry', '0deg'); };

  if (item.status !== 'ok' || item.price === null) {
    return <article className="mk-card is-error" style={{ '--i': index } as React.CSSProperties}>
      <header><div><h3>{item.label}</h3><span>{item.category}</span></div></header>
      <div className="mk-unavailable"><AlertTriangle size={16} aria-hidden="true"/><p>Live data is unavailable right now. We'll retry automatically.</p></div>
      <footer><span>Source: {item.source}</span></footer>
    </article>;
  }
  return <article className={`mk-card ${change.direction}`} style={{ '--i': index } as React.CSSProperties} onPointerMove={onMove} onPointerLeave={onLeave} aria-label={`${item.label} ${formatMarketPrice(item.price, item.currency, item.decimals)}, ${change.text}`}>
    <header>
      <div><h3>{item.label}</h3><span>{item.category}</span></div>
      <span className="mk-fresh">{FRESHNESS_LABEL[item.freshness ?? ''] ?? 'Latest'}</span>
    </header>
    <strong className={`mk-price ${flash ? `flash-${flash}` : ''}`}>{formatMarketPrice(item.price, item.currency, item.decimals)}</strong>
    <span className={`mk-change ${change.direction}`}>{change.text}</span>
    <Sparkline values={item.sparkline} direction={change.direction}/>
    <footer>
      <span>Updated {formatAgo(retrievedAt, now)}</span>
      <span>Last trade {formatIst(item.providerTimestamp, true)}</span>
      <span>Source: {item.source}</span>
      {item.message && <span className="mk-warn">{item.message}</span>}
    </footer>
  </article>;
};

/** Live macro cards plus the lazily loaded candlestick terminal. */
export const LandingMarketDashboard: React.FC = () => {
  const [snapshot, setSnapshot] = useState<{ items: TerminalSnapshotItem[]; retrievedAt: string } | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const visible = usePageVisible();
  const now = useNow(1000);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setRefreshing(true);
      try {
        const next = await fetchTerminalSnapshot(controller.signal);
        // Keep the last good card when a single instrument fails on this refresh.
        setSnapshot((current) => ({
          retrievedAt: next.retrievedAt,
          items: next.items.map((item) => item.status === 'ok' ? item : current?.items.find((old) => old.id === item.id && old.status === 'ok') ?? item),
        }));
        setError('');
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setError(err instanceof Error ? err.message : 'Market data is unavailable.');
      } finally {
        setRefreshing(false);
      }
    };
    void load();
    const id = visible ? window.setInterval(() => void load(), SNAPSHOT_POLL_MS) : undefined;
    return () => { controller.abort(); if (id) window.clearInterval(id); };
  }, [visible]);

  // Load the chart bundle only when the section approaches the viewport.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || !('IntersectionObserver' in window)) { setShowTerminal(true); return; }
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { setShowTerminal(true); observer.disconnect(); } }, { rootMargin: '400px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <section id="market-data" ref={sectionRef} className="cl-section mk-section cl-reveal-section" aria-labelledby="market-data-title">
    <div className="cl-wrap">
      <div className="mk-heading">
        <div>
          <div className="cl-eyebrow">Market data dashboard</div>
          <h2 id="market-data-title">The macro context behind every decision.</h2>
          <p className="cl-sub">NIFTY 50, SENSEX, USD/INR and gold from a provider-backed feed, refreshed about every 45 seconds while this tab is open.</p>
        </div>
        <span className={`mk-refresh ${refreshing ? 'is-on' : ''}`} aria-live="polite"><RefreshCw size={13} aria-hidden="true"/>{snapshot ? `Updated ${formatAgo(snapshot.retrievedAt, now)}` : 'Connecting…'}</span>
      </div>

      <div className="mk-grid" data-stagger>
        {snapshot
          ? snapshot.items.map((item, index) => <MarketCard key={item.id} item={item} retrievedAt={snapshot.retrievedAt} now={now} index={index}/>)
          : PLACEHOLDERS.map((item) => error
            ? <article key={item.id} className="mk-card is-error"><header><div><h3>{item.label}</h3><span>{item.category}</span></div></header><div className="mk-unavailable"><AlertTriangle size={16} aria-hidden="true"/><p>{error} Retrying automatically.</p></div></article>
            : <article key={item.id} className="mk-card is-loading" aria-busy="true"><header><div><h3>{item.label}</h3><span>{item.category}</span></div></header><i className="mk-sk mk-sk-price"/><i className="mk-sk mk-sk-change"/><i className="mk-sk mk-sk-spark"/><i className="mk-sk mk-sk-foot"/></article>)}
      </div>
      <p className="mk-disclaimer">Market data may be delayed; informational use only. Indian index and FX quotes come from an experimental reference feed and are not exchange-certified.</p>

      <div className="mk-terminal-head" id="market-research">
        <div className="cl-eyebrow">Market research</div>
        <h3>Candlestick terminal</h3>
      </div>
      <div className="mk-terminal-slot">
        {showTerminal
          ? <Suspense fallback={<div className="mt-terminal mt-loading-shell" role="status" aria-label="Loading chart"/>}><MarketTerminalChart/></Suspense>
          : <div className="mt-terminal mt-loading-shell" aria-hidden="true"/>}
      </div>
    </div>
  </section>;
};
