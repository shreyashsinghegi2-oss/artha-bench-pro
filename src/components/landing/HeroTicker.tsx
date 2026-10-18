import React, { useEffect, useState } from 'react';
import { fetchMarketOverview } from '../../services/learningApi';
import type { NormalizedMarketQuote } from '../../types';

const SYMBOLS = ['^NSEI', '^BSESN', 'RELIANCE.NS', 'HDFCBANK.NS', 'TCS.NS', 'INFY.NS', 'ICICIBANK.NS', 'GC=F', 'INR=X', 'BTC-USD'];
const NAMES: Record<string, string> = {
  '^NSEI': 'NIFTY 50', '^BSESN': 'SENSEX', 'RELIANCE.NS': 'RELIANCE', 'HDFCBANK.NS': 'HDFC BANK', 'TCS.NS': 'TCS',
  'INFY.NS': 'INFOSYS', 'ICICIBANK.NS': 'ICICI BANK', 'GC=F': 'GOLD', 'INR=X': 'USD/INR', 'BTC-USD': 'BITCOIN',
};

const price = (q: NormalizedMarketQuote) =>
  Number(q.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * A thin, light ticker of Indian indices and stocks across the top of the hero. Only real provider data
 * is shown; demo or missing quotes are dropped, and the strip hides itself when nothing loaded.
 */
export const HeroTicker: React.FC = () => {
  const [quotes, setQuotes] = useState<NormalizedMarketQuote[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await fetchMarketOverview(SYMBOLS);
        const real = data.filter((q) => q && q.freshness !== 'demo' && Number.isFinite(Number(q.price)));
        const ordered = SYMBOLS.map((s) => real.find((q) => q.symbol.toUpperCase() === s)).filter(Boolean) as NormalizedMarketQuote[];
        if (alive) setQuotes(ordered);
      } catch { /* keep the last good quotes */ }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  if (!quotes.length) return null;
  const tape = [...quotes, ...quotes];
  return (
    <div className="hc-ticker" aria-label="Market prices">
      <div className="hc-ticker-track">
        {tape.map((q, i) => {
          const cp = Number(q.changePercent ?? 0);
          const up = cp >= 0;
          return (
            <span className="hc-tick" key={`${q.symbol}-${i}`} aria-hidden={i >= quotes.length ? true : undefined}>
              <b>{NAMES[q.symbol] ?? q.symbol}</b>
              <span>{price(q)}</span>
              <span className={up ? 'hc-up' : 'hc-down'}>{up ? '▲' : '▼'} {Math.abs(cp).toFixed(2)}%</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
