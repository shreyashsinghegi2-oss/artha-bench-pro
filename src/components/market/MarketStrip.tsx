import React from 'react';
import { NormalizedMarketQuote } from '../../types';

export interface MarketStripInstrument {
  symbol: string;
  label: string;
  valuePrefix?: string;
}

interface MarketStripProps {
  instruments: MarketStripInstrument[];
  quotes: NormalizedMarketQuote[];
  loading: boolean;
}

type FeedState = 'LIVE' | 'DELAYED' | 'DEMO' | 'RECONNECTING' | 'MARKET CLOSED';

function getFeedState(freshness: NormalizedMarketQuote['freshness']): FeedState {
  if (freshness === 'real_time') return 'LIVE';
  if (freshness === 'delayed') return 'DELAYED';
  if (freshness === 'demo') return 'DEMO';
  if (freshness === 'stale') return 'RECONNECTING';
  return 'MARKET CLOSED';
}

const stateStyles: Record<FeedState, string> = {
  LIVE: 'border-success-fill/30 bg-success-soft text-success',
  DELAYED: 'border-warning-fill/30 bg-warning-soft text-warning',
  DEMO: 'border-line-strong bg-subtle text-secondary',
  RECONNECTING: 'border-warning-fill/30 bg-warning-soft text-warning',
  'MARKET CLOSED': 'border-line bg-subtle text-secondary',
};

function formatValue(quote: NormalizedMarketQuote, prefix = '') {
  return `${prefix}${quote.price.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const MarketStrip: React.FC<MarketStripProps> = ({
  instruments,
  quotes,
  loading,
}) => {
  const quoteBySymbol = new Map<string, NormalizedMarketQuote>(
    quotes.map((quote) => [quote.symbol, quote]),
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm" aria-label="Market snapshot">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Market snapshot</h2>
          <p className="mt-0.5 text-[11px] text-secondary">
            Provider-labelled India indices, currency, and gold reference
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-line bg-subtle px-2.5 py-1 text-[10px] font-semibold text-secondary">
          Feed state shown per instrument
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-5 divide-x divide-line">
          {instruments.map((instrument) => {
            const quote = quoteBySymbol.get(instrument.symbol);

            if (loading || !quote) {
              return (
                <div key={instrument.symbol} className="min-h-28 px-4 py-3.5">
                  <div className="h-3 w-20 rounded bg-subtle motion-safe:animate-pulse" />
                  <div className="mt-3 h-5 w-24 rounded bg-subtle motion-safe:animate-pulse" />
                  <div className="mt-3 h-4 w-16 rounded bg-subtle motion-safe:animate-pulse" />
                </div>
              );
            }

            const feedState = getFeedState(quote.freshness);
            const changePercent = quote.changePercent ?? 0;
            const isPositive = changePercent >= 0;

            return (
              <article key={instrument.symbol} className="min-h-28 px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-ink">{instrument.label}</p>
                    <p className="mt-0.5 text-[10px] text-secondary">{instrument.symbol}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${stateStyles[feedState]}`}>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        feedState === 'LIVE'
                          ? 'bg-success-fill motion-safe:animate-pulse'
                          : feedState === 'DEMO' || feedState === 'MARKET CLOSED'
                            ? 'bg-secondary'
                            : 'bg-warning-fill'
                      }`}
                    />
                    {feedState}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <p className="text-base font-bold tabular-nums text-ink">
                    {formatValue(quote, instrument.valuePrefix)}
                  </p>
                  <p className={`text-[11px] font-semibold tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`}>
                    {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
