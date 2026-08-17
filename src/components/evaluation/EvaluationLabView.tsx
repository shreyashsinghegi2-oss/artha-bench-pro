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
      <div className="bg-surface border border-line rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-success-soft border border-success-fill rounded-2xl text-success">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">Multi-Model Evaluation Lab</h1>
            <p className="text-xs text-secondary">
              Run concurrent primary and secondary AI evaluations to measure formula accuracy, consensus, evidence, and safety compliance.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <label className="block text-xs font-medium text-secondary">Financial Prompt / Claim to Evaluate</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            className="w-full bg-surface border border-line rounded-xl p-3 text-xs text-ink focus:outline-none focus:border-interactive focus:ring-2 focus:ring-interactive"
            placeholder="Enter financial calculation, formula claim, or advice prompt..."
          />
          <button
            onClick={handleEvaluate}
            disabled={loading || !query.trim()}
            className="px-6 py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-brand-foreground hover:text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>{loading ? 'Evaluating Dual-Model Consensus...' : 'Run Dual-Model Evaluation'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger-soft/80 border border-danger rounded-2xl text-xs text-danger flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {report && (
        <div className="bg-surface border border-line rounded-3xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <span className="text-[10px] font-bold text-secondary uppercase">Verification Code</span>
              <p className="text-sm font-mono text-success font-bold">{report.verificationCode}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                report.verdict === 'HIGHLY_RELIABLE' ? 'bg-success-soft text-success border border-success-fill' :
                report.verdict === 'MODERATE_RELIABILITY' ? 'bg-warning-soft text-warning border border-warning-fill' :
                'bg-danger-soft text-danger border border-danger'
              }`}>
                {report.verdict}
              </span>
              {report.demoMode && (
                <span className="px-2.5 py-0.5 rounded bg-hover text-secondary text-[10px] font-semibold">
                  Demo Mode
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="p-3 bg-surface border border-line rounded-xl">
              <span className="text-[10px] text-secondary block">Formula Accuracy</span>
              <span className="text-lg font-extrabold text-success">{report.metrics?.formulaAccuracyScore ?? 0}%</span>
            </div>
            <div className="p-3 bg-surface border border-line rounded-xl">
              <span className="text-[10px] text-secondary block">Dual Consensus</span>
              <span className="text-lg font-extrabold text-success">{report.metrics?.dualModelConsensusScore ?? 0}%</span>
            </div>
            <div className="p-3 bg-surface border border-line rounded-xl">
              <span className="text-[10px] text-secondary block">Evidence Status</span>
              <span className="text-lg font-extrabold text-secondary">{report.metrics?.evidenceVerificationScore ?? 0}%</span>
            </div>
            <div className="p-3 bg-surface border border-line rounded-xl">
              <span className="text-[10px] text-secondary block">Safety Score</span>
              <span className="text-lg font-extrabold text-success">{report.metrics?.safetyComplianceScore ?? 0}%</span>
            </div>
            <div className="p-3 bg-surface border border-line rounded-xl col-span-2 sm:col-span-1">
              <span className="text-[10px] text-secondary block">Overall Score</span>
              <span className="text-lg font-extrabold text-success">{report.metrics?.overallReliabilityScore ?? 0}%</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-ink">Primary Model Answer</h3>
            <div className="p-4 bg-surface border border-line rounded-2xl text-xs text-secondary whitespace-pre-wrap leading-relaxed">
              {report.primaryResponse}
            </div>
          </div>

          {report.secondaryResponse && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-ink">Secondary Evaluator Response</h3>
              <div className="p-4 bg-surface border border-line rounded-2xl text-xs text-secondary whitespace-pre-wrap leading-relaxed">
                {report.secondaryResponse}
              </div>
            </div>
          )}

          {report.riskFlags.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-warning flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Risk & Warning Flags ({report.riskFlags.length})</span>
              </h4>
              <ul className="space-y-1">
                {report.riskFlags.map((flag, idx) => (
                  <li key={idx} className="text-xs text-warning bg-warning-soft/40 border border-warning-fill/50 p-2 rounded-lg">
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
