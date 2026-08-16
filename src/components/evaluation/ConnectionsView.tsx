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
      <div className="bg-[#08080E] border border-[#1A1A23] rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#4F32FF]/20 border border-[#4F32FF]/40 rounded-2xl text-[#665CFF]">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#F7F7FB]">AI Connections & Health Diagnostics</h1>
              <p className="text-xs text-[#9A9AAA]">
                Real server-side checks for Groq, NewsData.io, and Twelve Data. Secrets never reach the browser.
              </p>
            </div>
          </div>

          <button
            onClick={fetchDiagnostics}
            disabled={loading}
            className="p-2.5 bg-[#1A1A23] hover:bg-[#4F32FF]/20 text-[#F7F7FB] rounded-xl border border-[#1A1A23] transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-3 pt-2">
          {diagnostics.length > 0 ? (
            diagnostics.map((diag) => (
              <div
                key={diag.id}
                className="p-4 bg-[#030303] border border-[#1A1A23] rounded-2xl flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <Cpu className="w-5 h-5 text-[#665CFF]" />
                  <div>
                    <h3 className="text-xs font-bold text-[#F7F7FB]">{diag.name}</h3>
                    <p className="text-[10px] text-[#9A9AAA]">{diag.message}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {diag.latencyMs !== undefined && (
                    <span className="text-[10px] font-mono text-[#9A9AAA]">{diag.latencyMs}ms</span>
                  )}
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
                      diag.status === 'connected'
                        ? 'bg-[#00D68F]/10 text-[#00D68F] border-[#00D68F]/30'
                        : 'bg-[#F5B800]/10 text-[#F5B800] border-[#F5B800]/30'
                    }`}
                  >
                    {diag.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 bg-[#030303] border border-[#1A1A23] rounded-2xl text-center text-xs text-[#9A9AAA]">
              Loading AI connection telemetry...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
