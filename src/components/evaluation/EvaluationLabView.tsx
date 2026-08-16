import React, { useState } from 'react';
import { FlaskConical, Search, ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, FileText } from 'lucide-react';
import { VerificationReport } from '../../types';

export const EvaluationLabView: React.FC = () => {
  const [query, setQuery] = useState('What is the compound interest formula for a $10,000 investment at 7% annual interest for 5 years?');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/groq/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Evaluation failed');
      setReport(data.report);
    } catch (err: any) {
      setError(err.message || 'Evaluation request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-950 border border-emerald-800 rounded-2xl text-emerald-400">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Multi-Model Evaluation Lab</h1>
            <p className="text-xs text-slate-400">
              Run concurrent primary and secondary AI evaluations to measure formula accuracy, consensus, evidence, and safety compliance.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <label className="block text-xs font-medium text-slate-300">Financial Prompt / Claim to Evaluate</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            placeholder="Enter financial calculation, formula claim, or advice prompt..."
          />
          <button
            onClick={handleEvaluate}
            disabled={loading || !query.trim()}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition-all"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>{loading ? 'Evaluating Dual-Model Consensus...' : 'Run Dual-Model Evaluation'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {report && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Verification Code</span>
              <p className="text-sm font-mono text-emerald-400 font-bold">{report.verificationCode}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                report.verdict === 'HIGHLY_RELIABLE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                report.verdict === 'MODERATE_RELIABILITY' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                'bg-rose-950 text-rose-300 border border-rose-800'
              }`}>
                {report.verdict}
              </span>
              {report.demoMode && (
                <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-semibold">
                  Demo Mode
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Formula Accuracy</span>
              <span className="text-lg font-extrabold text-emerald-400">{report.metrics?.formulaAccuracyScore ?? 0}%</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Dual Consensus</span>
              <span className="text-lg font-extrabold text-emerald-400">{report.metrics?.dualModelConsensusScore ?? 0}%</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Evidence Status</span>
              <span className="text-lg font-extrabold text-slate-400">{report.metrics?.evidenceVerificationScore ?? 0}%</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Safety Score</span>
              <span className="text-lg font-extrabold text-emerald-400">{report.metrics?.safetyComplianceScore ?? 0}%</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 block">Overall Score</span>
              <span className="text-lg font-extrabold text-emerald-300">{report.metrics?.overallReliabilityScore ?? 0}%</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-200">Primary Model Answer</h3>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
              {report.primaryResponse}
            </div>
          </div>

          {report.secondaryResponse && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-200">Secondary Evaluator Response</h3>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                {report.secondaryResponse}
              </div>
            </div>
          )}

          {report.riskFlags.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Risk & Warning Flags ({report.riskFlags.length})</span>
              </h4>
              <ul className="space-y-1">
                {report.riskFlags.map((flag, idx) => (
                  <li key={idx} className="text-xs text-amber-300 bg-amber-950/40 border border-amber-900/50 p-2 rounded-lg">
                    • {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
