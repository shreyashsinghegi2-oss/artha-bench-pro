import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, Cpu, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ProviderDiagnostic } from '../../types';
import { fetchIndiaMarketStatus, type IndiaMarketStatus } from '../../services/indiaMarketApi';

export const ConnectionsView: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<ProviderDiagnostic[]>([]);
  const [indiaStatus, setIndiaStatus] = useState<IndiaMarketStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = () => {
    setLoading(true);
    setError(null);
    Promise.allSettled([
      fetch('/api/diagnostics').then((res) => res.ok ? res.json() : Promise.reject(new Error('Diagnostics unavailable'))),
      fetchIndiaMarketStatus(),
    ]).then(([generalResult, indiaResult]) => {
      if (generalResult.status === 'fulfilled' && Array.isArray(generalResult.value.diagnostics)) {
        setDiagnostics(generalResult.value.diagnostics);
      }
      if (indiaResult.status === 'fulfilled') setIndiaStatus(indiaResult.value);
      if (generalResult.status === 'rejected' && indiaResult.status === 'rejected') {
        setError('Connection diagnostics could not be refreshed right now.');
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchDiagnostics(); }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-surface border border-line rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-interactive/20 border border-interactive/40 rounded-2xl text-interactive"><Radio className="w-6 h-6" /></div>
            <div>
              <h1 className="text-2xl font-bold text-ink">AI Connections & Health Diagnostics</h1>
              <p className="text-xs text-secondary">Server-side checks for configured AI, news, market and economic-data providers. Secret values never reach the browser.</p>
            </div>
          </div>
          <button onClick={fetchDiagnostics} disabled={loading} aria-label="Refresh connection diagnostics" className="p-2.5 bg-subtle hover:bg-interactive/20 text-ink rounded-xl border border-line transition-all disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>

        {error && <div className="rounded-xl border border-danger/20 bg-danger-soft p-3 text-xs text-danger">{error}</div>}

        <section className="rounded-2xl border border-line bg-canvas p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3"><Database className="mt-0.5 h-5 w-5 text-interactive"/><div><h2 className="text-sm font-black text-ink">India Market Quotes</h2><p className="mt-1 text-[10px] text-secondary">Provider-specific symbol coverage, cache and configuration status. API key presence is exposed only as Yes/No.</p></div></div>
            <span className={`rounded-full border px-3 py-1 text-[9px] font-black ${indiaStatus?.status === 'Connected' ? 'border-success-fill/30 bg-success-soft text-success' : 'border-warning-fill/30 bg-warning-soft text-warning'}`}>{indiaStatus?.status || (loading ? 'Checking…' : 'Unavailable')}</span>
          </div>
          {indiaStatus ? <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <HealthMetric label="Provider" value={indiaStatus.provider}/>
            <HealthMetric label="Configured" value={indiaStatus.configured ? 'Yes' : 'No'}/>
            <HealthMetric label="API key present" value={indiaStatus.apiKeyPresent ? 'Yes' : 'No'}/>
            <HealthMetric label="Coverage" value={`${indiaStatus.verifiedMappings} of ${indiaStatus.totalTrackedAssets} verified mappings`}/>
            <HealthMetric label="Last successful response" value={indiaStatus.lastSuccessfulQuoteFetch ? new Date(indiaStatus.lastSuccessfulQuoteFetch).toLocaleString('en-IN') : 'Unavailable'}/>
            <HealthMetric label="Last failure category" value={indiaStatus.lastFailureCategory || 'None recorded'}/>
            <HealthMetric label="Cache" value={`${indiaStatus.cache.ttlSeconds}s TTL · ${indiaStatus.cache.staleThresholdMinutes}m stale threshold`}/>
            <HealthMetric label="Rate-limit state" value={indiaStatus.rateLimitState}/>
          </div> : <div className="mt-4 text-xs text-secondary">{loading ? 'Checking India market provider status…' : 'India market provider status is unavailable.'}</div>}
          {indiaStatus && !indiaStatus.configured && <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning-fill/20 bg-warning-soft p-3 text-[10px] leading-5 text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>India market provider is not configured in this deployment. Add a valid server-side provider key and verified symbol mappings; never expose the key to the client.</div>}
        </section>

        <div className="space-y-3 pt-2">
          {diagnostics.length > 0 ? diagnostics.map((diag) => (
            <div key={diag.id} className="p-4 bg-canvas border border-line rounded-2xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3"><Cpu className="mt-0.5 w-5 h-5 text-interactive"/><div><h3 className="text-xs font-bold text-ink">{diag.name}</h3><p className="mt-1 text-[10px] text-secondary">{diag.role}</p><p className="mt-1 text-[10px] text-secondary">{diag.message || 'No additional provider message.'}</p></div></div>
              <div className="flex items-center gap-3 shrink-0">{diag.latencyMs !== undefined && <span className="text-[10px] font-mono text-secondary">{diag.latencyMs}ms</span>}<span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold border ${diag.status === 'connected' ? 'bg-success-fill/10 text-success border-success-fill/30' : 'bg-warning-fill/10 text-warning border-warning-fill/30'}`}>{diag.status === 'connected' ? <CheckCircle2 className="h-3 w-3"/> : <AlertTriangle className="h-3 w-3"/>}{diag.status.toUpperCase()}</span></div>
            </div>
          )) : <div className="p-6 bg-canvas border border-line rounded-2xl text-center text-xs text-secondary">{loading ? 'Loading connection telemetry…' : 'No provider diagnostics were returned.'}</div>}
        </div>
      </div>
    </div>
  );
};

const HealthMetric = ({ label, value }: { label: string; value: string }) => <div className="rounded-xl border border-line bg-surface p-3"><div className="text-[8px] font-black uppercase tracking-wider text-secondary">{label}</div><div className="mt-1 break-words text-[10px] font-bold text-ink">{value}</div></div>;
