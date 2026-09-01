import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Building2, RefreshCw } from 'lucide-react';
import { AppNavigationDestination } from '../../navigationTypes';
import { INDIA_MARKET_UNIVERSE } from '../../data/indiaMarketUniverse';
import { fetchIndiaMarketQuotes, fetchIndiaMarketStatus, type IndiaMarketQuoteResult, type IndiaMarketStatus } from '../../services/indiaMarketApi';

type Props = { onNavigate: (destination: AppNavigationDestination) => void };
const preview = INDIA_MARKET_UNIVERSE.slice(0, 8);

const stateLabel = (result?: IndiaMarketQuoteResult) => {
  const state = result?.attribution.state;
  if (state === 'live_verified') return 'Live verified feed';
  if (state === 'recently_refreshed') return 'Recently refreshed';
  if (state === 'delayed') return 'Delayed quote';
  if (state === 'end_of_day') return 'End-of-day reference';
  if (state === 'cached') return 'Cached reference';
  if (state === 'stale') return 'Stale data';
  if (state === 'demo') return 'Demo data';
  return 'Unavailable';
};

export const IndiaMarketExplorerPreview: React.FC<Props> = ({ onNavigate }) => {
  const [results, setResults] = useState<Record<string, IndiaMarketQuoteResult>>({});
  const [status, setStatus] = useState<IndiaMarketStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.allSettled([
      fetchIndiaMarketQuotes(preview.map((item) => item.id)),
      fetchIndiaMarketStatus(),
    ]).then(([quoteResult, statusResult]) => {
      if (!active) return;
      if (quoteResult.status === 'fulfilled') {
        setResults(Object.fromEntries(quoteResult.value.map((row) => [row.assetId, row])));
      } else {
        setResults({});
        setError('India market data could not be refreshed right now.');
      }
      if (statusResult.status === 'fulfilled') setStatus(statusResult.value);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshNonce]);

  const available = useMemo(() => Object.values(results).filter((row) => row.quote).length, [results]);
  const partial = available > 0 && available < preview.length;

  return <section className="mx-auto max-w-[1700px] px-4 pt-7 sm:px-6">
    <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-interactive"><Building2 className="h-4 w-4" /> India Market Explorer</div>
          <h2 className="mt-2 text-xl font-black text-ink">Top Indian stocks preview</h2>
          <p className="mt-1 text-[10px] leading-5 text-secondary">A bounded 8-company preview loaded through one India-market batch request. The full searchable directory keeps all {INDIA_MARKET_UNIVERSE.length} tracked identities visible even when quote coverage is unavailable.</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[9px] text-secondary">
            <span className="rounded-full border border-line bg-canvas px-2.5 py-1">Provider: {status?.provider || 'Checking configuration…'}</span>
            <span className="rounded-full border border-line bg-canvas px-2.5 py-1">Coverage: {status ? `${status.verifiedMappings}/${status.totalTrackedAssets} verified mappings` : 'Checking…'}</span>
            {partial && <span className="rounded-full border border-warning-fill/25 bg-warning-soft px-2.5 py-1 text-warning">Partial quote coverage</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={loading} onClick={() => setRefreshNonce((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2.5 text-xs font-black text-ink disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
          <button type="button" onClick={() => onNavigate('india-markets')} className="inline-flex items-center gap-2 rounded-xl border border-interactive/30 bg-interactive-soft px-4 py-2.5 text-xs font-black text-interactive">Explore Indian markets <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-danger/20 bg-danger-soft p-3 text-[10px] text-danger">{error} Retry when the provider connection is available.</div>}
      {!status?.configured && status && <div className="mt-4 rounded-xl border border-warning-fill/25 bg-warning-soft p-3 text-[10px] leading-5 text-warning">India market provider is not configured in this deployment. Add the server-side provider key and verified symbol mappings to enable verified quotes.</div>}

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {preview.map((company) => {
          const result = results[company.id];
          const quote = result?.quote;
          const move = quote?.changePercent ?? null;
          return <button key={company.id} type="button" onClick={() => onNavigate('india-markets')} className="min-h-[150px] rounded-2xl border border-line bg-canvas p-3 text-left hover:border-interactive/30">
            <div className="flex items-start justify-between gap-2"><div><div className="text-[10px] font-black text-ink">{company.displayName}</div><div className="mt-0.5 text-[8px] text-secondary">{company.providerSymbol} · tracked identity</div></div>{move != null && <span className={`inline-flex items-center gap-0.5 text-[9px] font-black ${move >= 0 ? 'text-success' : 'text-danger'}`}>{move >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{move >= 0 ? '+' : ''}{move.toFixed(2)}%</span>}</div>
            {loading && !result ? <div className="mt-4 h-5 w-24 animate-pulse rounded bg-line" /> : <div className="mt-3 text-xs font-black text-ink">{quote ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: quote.currency || 'INR', maximumFractionDigits: 2 }).format(quote.price) : 'Quote unavailable'}</div>}
            <div className="mt-2 text-[8px] font-bold text-secondary">{stateLabel(result)}</div>
            <div className="mt-1 text-[8px] leading-4 text-secondary">{quote ? `Source: ${result.attribution.providerName} · Quote: ${result.attribution.quoteTimestamp || 'unavailable'} · Retrieved: ${result.attribution.retrievedAt}` : result?.reason || 'Current provider has not returned a verified quote for this symbol.'}</div>
            <div className="mt-2 text-[8px] font-black text-interactive">View in India Market Explorer →</div>
          </button>;
        })}
      </div>
    </div>
  </section>;
};
