import React, { useEffect, useState } from 'react';
import { fetchMarketHistory, fetchMarketOverview } from '../../services/learningApi';
import type { NormalizedMarketQuote } from '../../types';
import { CompanyLogo } from '../market/CompanyLogo';

const SYMBOLS = ['^NSEI', '^BSESN', 'RELIANCE.NS', 'HDFCBANK.NS', 'TCS.NS', 'INFY.NS', 'ICICIBANK.NS', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'BTC-USD', 'ETH-USD', 'GC=F', 'INR=X'];
export const QUOTE_NAMES: Record<string, string> = {
  '^NSEI': 'NIFTY 50', '^BSESN': 'SENSEX', 'RELIANCE.NS': 'RELIANCE', 'HDFCBANK.NS': 'HDFC BANK', 'TCS.NS': 'TCS',
  'INFY.NS': 'INFOSYS', 'ICICIBANK.NS': 'ICICI BANK', 'GC=F': 'GOLD', 'INR=X': 'USD/INR', 'BTC-USD': 'BITCOIN', 'ETH-USD': 'ETHEREUM',
  AAPL: 'APPLE', MSFT: 'MICROSOFT', NVDA: 'NVIDIA', GOOGL: 'GOOGLE', AMZN: 'AMAZON',
};

const FEED_NAMES: Record<string, string> = { '^NSEI': 'NIFTY:NSE', '^BSESN': 'SENSEX:BSE' };
/** True when a feed symbol is the requested one: exact, a known index alias, or X.NS/X.BO sent back as X:NSE/X:BSE. */
export function sameSymbol(feed: string, wanted: string): boolean {
  const f = feed.toUpperCase(), w = wanted.toUpperCase();
  if (f === w || FEED_NAMES[w] === f) return true;
  const m = /^(.+)\.(NS|BO)$/.exec(w);
  return !!m && f === `${m[1]}:${m[2] === 'NS' ? 'NSE' : 'BSE'}`;
}

export const formatPrice = (q: NormalizedMarketQuote) =>
  Number(q.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Live quotes for the hero (ticker, tower screens, billboard building) and today's NIFTY 50 path.
 * Only real provider data: demo or missing quotes are dropped. Refreshes every minute.
 */
export function useHeroMarket() {
  const [quotes, setQuotes] = useState<NormalizedMarketQuote[]>([]);
  const [nifty, setNifty] = useState<number[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [data, history] = await Promise.all([fetchMarketOverview(SYMBOLS), fetchMarketHistory('^NSEI', '1d').catch(() => ({ points: [] }))]);
        const real = data.filter((q) => q && q.freshness !== 'demo' && Number.isFinite(Number(q.price)));
        // The feed names Indian symbols its own way (^NSEI comes back as NIFTY:NSE), so match either form.
        const ordered = SYMBOLS.flatMap((s) => {
          const q = real.find((r) => sameSymbol(r.symbol, s));
          return q ? [{ ...q, symbol: s }] : [];
        });
        const path = (history.points ?? []).map((p) => Number(p.close ?? p.price)).filter(Number.isFinite);
        if (alive) { setQuotes(ordered); setNifty(path); }
      } catch { /* keep the last good data */ }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  return { quotes, nifty };
}

/** One quote as "NAME price ▲ x.xx%". */
export const Tick: React.FC<{ q: NormalizedMarketQuote; hidden?: boolean; logo?: boolean }> = ({ q, hidden, logo }) => {
  const cp = Number(q.changePercent ?? 0);
  const up = cp >= 0;
  return (
    <span className="hc-tick" aria-hidden={hidden || undefined}>
      {logo && <CompanyLogo symbol={q.symbol} size={20} className="hc-tick-logo" />}
      <b>{QUOTE_NAMES[q.symbol] ?? q.symbol}</b>
      <span>{formatPrice(q)}</span>
      <span className={up ? 'hc-up' : 'hc-down'}>{up ? '▲' : '▼'} {Math.abs(cp).toFixed(2)}%</span>
    </span>
  );
};

/** A thin, muted ticker across the top of the hero that never stops. Hidden when no real quotes loaded. */
export const HeroTicker: React.FC<{ quotes: NormalizedMarketQuote[] }> = ({ quotes }) => {
  if (!quotes.length) return null;
  // Repeat the list so one half always fills even a wide screen; the track scrolls by exactly one half.
  const reps = Math.max(1, Math.ceil(16 / quotes.length));
  const half = Array.from({ length: reps }, () => quotes).flat();
  return (
    <div className="hc-ticker" aria-label="Market prices">
      <div className="hc-ticker-track" style={{ animationDuration: `${half.length * 2.4}s` }}>
        {[...half, ...half].map((q, i) => <Tick key={`${q.symbol}-${i}`} q={q} hidden={i >= quotes.length} logo />)}
      </div>
    </div>
  );
};
