import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import { ProviderDiagnostic } from '../../types';

export const ConnectionsView: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<ProviderDiagnostic[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDiagnostics = () => {
    setLoading(true);
    fetch('/api/diagnostics')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.diagnostics)) {
          setDiagnostics(data.diagnostics);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-surface border border-line rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-interactive/20 border border-interactive/40 rounded-2xl text-interactive">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink">AI Connections & Health Diagnostics</h1>
              <p className="text-xs text-secondary">
                Live server-side checks for Groq, NewsData.io, Twelve Data, Finnhub, FRED, and World Bank India data. Secrets never reach the browser.
              </p>
            </div>
          </div>

          <button
            onClick={fetchDiagnostics}
            disabled={loading}
            className="p-2.5 bg-subtle hover:bg-interactive/20 text-ink rounded-xl border border-line transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-3 pt-2">
          {diagnostics.length > 0 ? (
            diagnostics.map((diag) => (
              <div
                key={diag.id}
                className="p-4 bg-canvas border border-line rounded-2xl flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <Cpu className="w-5 h-5 text-interactive" />
                  <div>
                    <h3 className="text-xs font-bold text-ink">{diag.name}</h3>
                    <p className="text-[10px] text-secondary">{diag.message}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {diag.latencyMs !== undefined && (
                    <span className="text-[10px] font-mono text-secondary">{diag.latencyMs}ms</span>
                  )}
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
                      diag.status === 'connected'
                        ? 'bg-success-fill/10 text-success border-success-fill/30'
                        : 'bg-warning-fill/10 text-warning border-warning-fill/30'
                    }`}
                  >
                    {diag.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 bg-canvas border border-line rounded-2xl text-center text-xs text-secondary">
              Loading AI connection telemetry...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
