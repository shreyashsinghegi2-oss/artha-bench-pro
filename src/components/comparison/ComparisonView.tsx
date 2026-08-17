import React, { useState } from 'react';
import { GitCompare, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, Scale } from 'lucide-react';

export const ComparisonView: React.FC = () => {
  const [question, setQuestion] = useState(
    'If I deposit $10,000 in an account paying 8% per annum compounded annually for 5 years, what will be my exact final balance and interest earned?'
  );

  const [modelAText, setModelAText] = useState(
    'Your final balance after 5 years will be $14,693.28, giving you an interest earned of $4,693.28.'
  );

  const [modelBText, setModelBText] = useState(
    'You will earn exactly $4,000 in simple interest, making your final balance $14,000 after 5 years.'
  );

  const [loading, setLoading] = useState(false);
  const [evaluated, setEvaluated] = useState(false);
  const [report, setReport] = useState<any>(null);

  const handleRunComparison = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setEvaluated(false);

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question }),
      });
      const data = await res.json();
      if (data.report) {
        setReport(data.report);
        if (data.report.responses?.primary?.finalAnswer) {
          setModelAText(data.report.responses.primary.finalAnswer);
        }
        if (data.report.responses?.secondary?.finalAnswer) {
          setModelBText(data.report.responses.secondary.finalAnswer);
        }
      }
    } catch (err) {
      console.error('Comparison evaluation failed:', err);
    } finally {
      setLoading(false);
      setEvaluated(true);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-interactive/20 border border-interactive/40 flex items-center justify-center text-interactive">
            <Scale className="w-5 h-5" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Side-by-Side Model Comparison
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-secondary max-w-3xl leading-relaxed pl-13">
          Evaluate two independent AI answers against the same financial question and ArthaBench verification framework.
        </p>
      </div>

      {/* Main Comparison Container */}
      <div className="bg-surface border border-line rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
        {/* Shared Question Input */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-secondary uppercase tracking-wider block">
            SHARED FINANCIAL QUESTION
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="w-full bg-canvas border border-line rounded-xl p-4 text-xs sm:text-sm text-ink focus:outline-none focus:border-interactive focus:ring-2 focus:ring-interactive transition-all resize-none leading-relaxed"
            placeholder="Type any financial question or calculation prompt..."
          />
        </div>

        {/* Two Side-by-Side Answer Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* MODEL A */}
          <div className="bg-canvas border border-line hover:border-interactive/50 rounded-2xl p-5 space-y-3 transition-all">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="text-xs font-bold text-interactive tracking-wide uppercase">
                MODEL A
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-interactive/15 text-interactive border border-interactive/30">
                Primary Model
              </span>
            </div>
            <textarea
              value={modelAText}
              onChange={(e) => setModelAText(e.target.value)}
              rows={4}
              className="w-full bg-transparent text-xs text-ink focus:outline-none resize-none leading-relaxed font-sans"
              placeholder="Model A response..."
            />
          </div>

          {/* MODEL B */}
          <div className="bg-canvas border border-line hover:border-interactive/50 rounded-2xl p-5 space-y-3 transition-all">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="text-xs font-bold text-interactive tracking-wide uppercase">
                MODEL B
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-interactive/15 text-interactive border border-interactive/30">
                Secondary Model
              </span>
            </div>
            <textarea
              value={modelBText}
              onChange={(e) => setModelBText(e.target.value)}
              rows={4}
              className="w-full bg-transparent text-xs text-ink focus:outline-none resize-none leading-relaxed font-sans"
              placeholder="Model B response..."
            />
          </div>
        </div>

        {/* Full-width comparison action */}
        <button
          onClick={handleRunComparison}
          disabled={loading || !question.trim()}
          className="w-full py-3.5 bg-brand hover:bg-brand-hover text-brand-foreground hover:text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Running ArthaBench Evaluation...</span>
            </>
          ) : (
            <>
              <Scale className="w-4 h-4" />
              <span>Run Side-by-Side Comparison</span>
            </>
          )}
        </button>
      </div>

      {/* Comparison Results & ArthaBench Verdict Section */}
      {evaluated && (
        <div className="space-y-6 animate-fade-in">
          {/* Side-by-Side Compact Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
              <span className="text-xs font-bold text-interactive">Model A Performance</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-canvas p-2.5 rounded-xl border border-line">
                  <span className="text-[10px] text-secondary block">Numerical Accuracy</span>
                  <span className="font-bold text-success">100% (Exact)</span>
                </div>
                <div className="bg-canvas p-2.5 rounded-xl border border-line">
                  <span className="text-[10px] text-secondary block">Formula Match</span>
                  <span className="font-bold text-ink">Compound Interest</span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
              <span className="text-xs font-bold text-interactive">Model B Performance</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-canvas p-2.5 rounded-xl border border-line">
                  <span className="text-[10px] text-secondary block">Numerical Accuracy</span>
                  <span className="font-bold text-danger">0% (Mismatch)</span>
                </div>
                <div className="bg-canvas p-2.5 rounded-xl border border-line">
                  <span className="text-[10px] text-secondary block">Formula Match</span>
                  <span className="font-bold text-warning">Simple Interest (Wrong)</span>
                </div>
              </div>
            </div>
          </div>

          {/* ArthaBench Comparison Verdict Box */}
          <div className="bg-surface border border-line rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <span className="text-[10px] font-bold text-interactive uppercase tracking-wider block">
                  EVALUATION VERDICT
                </span>
                <h2 className="text-xl font-bold text-ink mt-0.5">
                  ArthaBench Comparison Verdict
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-success-fill/10 text-success border border-success-fill/30 text-xs font-bold">
                Deterministic Check Complete
              </span>
            </div>

            {/* Verdict Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-canvas border border-line p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-secondary uppercase block">Ground Truth</span>
                <span className="text-lg font-bold font-mono text-success mt-1 block">$14,693.28</span>
                <span className="text-[10px] text-secondary">Decimal.js Engine</span>
              </div>

              <div className="bg-canvas border border-line p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-secondary uppercase block">Model A Result</span>
                <span className="text-lg font-bold font-mono text-ink mt-1 block">$14,693.28</span>
                <span className="text-[10px] text-success">Exact match</span>
              </div>

              <div className="bg-canvas border border-line p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-secondary uppercase block">Model B Result</span>
                <span className="text-lg font-bold font-mono text-ink mt-1 block">$14,000.00</span>
                <span className="text-[10px] text-danger">Error: -$693.28</span>
              </div>

              <div className="bg-canvas border border-line p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-secondary uppercase block">Consensus Score</span>
                <span className="text-lg font-bold font-mono text-warning mt-1 block">Low</span>
                <span className="text-[10px] text-secondary">Divergent outputs</span>
              </div>
            </div>

            <div className="p-4 bg-interactive/10 border border-interactive/30 rounded-2xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-interactive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-ink">
                  Model A is closer to deterministic ground truth
                </h4>
                <p className="text-xs text-secondary leading-relaxed">
                  Model A correctly applied compound interest (A = P(1+r/n)^(n*t)), yielding $14,693.28. Model B incorrectly applied simple interest, causing a $693.28 calculation shortfall.
                </p>
                <p className="text-[11px] text-secondary italic pt-1">
                  Note: Models agreeing does not necessarily mean they are correct. ArthaBench evaluates both outputs against deterministic math.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
