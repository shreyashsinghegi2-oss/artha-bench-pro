import React, { useEffect, useState } from 'react';
import { fetchMarketHistory, fetchMarketOverview } from '../../services/learningApi';
import type { NormalizedMarketQuote } from '../../types';

const SYMBOLS = ['^NSEI', '^BSESN', 'RELIANCE.NS', 'HDFCBANK.NS', 'TCS.NS', 'INFY.NS', 'ICICIBANK.NS', 'GC=F', 'INR=X', 'BTC-USD'];
export const QUOTE_NAMES: Record<string, string> = {
  '^NSEI': 'NIFTY 50', '^BSESN': 'SENSEX', 'RELIANCE.NS': 'RELIANCE', 'HDFCBANK.NS': 'HDFC BANK', 'TCS.NS': 'TCS',
  'INFY.NS': 'INFOSYS', 'ICICIBANK.NS': 'ICICI BANK', 'GC=F': 'GOLD', 'INR=X': 'USD/INR', 'BTC-USD': 'BITCOIN',
};

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
        const ordered = SYMBOLS.map((s) => real.find((q) => q.symbol.toUpperCase() === s)).filter(Boolean) as NormalizedMarketQuote[];
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
export const Tick: React.FC<{ q: NormalizedMarketQuote; hidden?: boolean }> = ({ q, hidden }) => {
  const cp = Number(q.changePercent ?? 0);
  const up = cp >= 0;
  return (
    <span className="hc-tick" aria-hidden={hidden || undefined}>
      <b>{QUOTE_NAMES[q.symbol] ?? q.symbol}</b>
      <span>{formatPrice(q)}</span>
      <span className={up ? 'hc-up' : 'hc-down'}>{up ? '▲' : '▼'} {Math.abs(cp).toFixed(2)}%</span>
    </span>
  );
};

/** A thin, light ticker across the top of the hero. Hidden when no real quotes loaded. */
export const HeroTicker: React.FC<{ quotes: NormalizedMarketQuote[] }> = ({ quotes }) => {
  if (!quotes.length) return null;
  return (
    <div className="hc-ticker" aria-label="Market prices">
      <div className="hc-ticker-track">
        {[...quotes, ...quotes].map((q, i) => <Tick key={`${q.symbol}-${i}`} q={q} hidden={i >= quotes.length} />)}
      </div>
    </div>
  );
};
