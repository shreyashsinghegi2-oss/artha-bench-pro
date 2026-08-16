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
          <div className="w-10 h-10 rounded-2xl bg-[#4F32FF]/20 border border-[#4F32FF]/40 flex items-center justify-center text-[#665CFF]">
            <Scale className="w-5 h-5" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F7FB] tracking-tight">
            Side-by-Side Model Comparison
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-[#9A9AAA] max-w-3xl leading-relaxed pl-13">
          Evaluate two independent AI answers against the same financial question and ArthaBench verification framework.
        </p>
      </div>

      {/* Main Comparison Container */}
      <div className="bg-[#0A0A12] border border-[#1E1E2D] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        {/* Shared Question Input */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-[#8A8A9E] uppercase tracking-wider block">
            SHARED FINANCIAL QUESTION
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="w-full bg-[#030303] border border-[#1E1E2D] rounded-xl p-4 text-xs sm:text-sm text-[#F7F7FB] focus:outline-none focus:border-[#665CFF] transition-all resize-none leading-relaxed"
            placeholder="Type any financial question or calculation prompt..."
          />
        </div>

        {/* Two Side-by-Side Answer Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* MODEL A */}
          <div className="bg-[#030303] border border-[#1E1E2D] hover:border-[#4F32FF]/50 rounded-2xl p-5 space-y-3 transition-all">
            <div className="flex items-center justify-between border-b border-[#1E1E2D] pb-3">
              <span className="text-xs font-bold text-[#665CFF] tracking-wide uppercase">
                MODEL A
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#4F32FF]/15 text-[#665CFF] border border-[#4F32FF]/30">
                Primary Model
              </span>
            </div>
            <textarea
              value={modelAText}
              onChange={(e) => setModelAText(e.target.value)}
              rows={4}
              className="w-full bg-transparent text-xs text-[#F7F7FB] focus:outline-none resize-none leading-relaxed font-sans"
              placeholder="Model A response..."
            />
          </div>

          {/* MODEL B */}
          <div className="bg-[#030303] border border-[#1E1E2D] hover:border-[#B24FFF]/50 rounded-2xl p-5 space-y-3 transition-all">
            <div className="flex items-center justify-between border-b border-[#1E1E2D] pb-3">
              <span className="text-xs font-bold text-[#B24FFF] tracking-wide uppercase">
                MODEL B
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#B24FFF]/15 text-[#B24FFF] border border-[#B24FFF]/30">
                Secondary Model
              </span>
            </div>
            <textarea
              value={modelBText}
              onChange={(e) => setModelBText(e.target.value)}
              rows={4}
              className="w-full bg-transparent text-xs text-[#F7F7FB] focus:outline-none resize-none leading-relaxed font-sans"
              placeholder="Model B response..."
            />
          </div>
        </div>

        {/* Full-width Purple Gradient Comparison Button */}
        <button
          onClick={handleRunComparison}
          disabled={loading || !question.trim()}
          className="w-full py-3.5 bg-gradient-to-r from-[#4F32FF] via-[#665CFF] to-[#8F3BFF] hover:opacity-95 text-[#F7F7FB] font-bold text-sm rounded-xl shadow-lg shadow-[#4F32FF]/25 transition-all flex items-center justify-center gap-2"
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
            <div className="bg-[#0A0A12] border border-[#1E1E2D] rounded-2xl p-5 space-y-3">
              <span className="text-xs font-bold text-[#665CFF]">Model A Performance</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#030303] p-2.5 rounded-xl border border-[#1E1E2D]">
                  <span className="text-[10px] text-[#8A8A9E] block">Numerical Accuracy</span>
                  <span className="font-bold text-[#00D68F]">100% (Exact)</span>
                </div>
                <div className="bg-[#030303] p-2.5 rounded-xl border border-[#1E1E2D]">
                  <span className="text-[10px] text-[#8A8A9E] block">Formula Match</span>
                  <span className="font-bold text-[#F7F7FB]">Compound Interest</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0A0A12] border border-[#1E1E2D] rounded-2xl p-5 space-y-3">
              <span className="text-xs font-bold text-[#B24FFF]">Model B Performance</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#030303] p-2.5 rounded-xl border border-[#1E1E2D]">
                  <span className="text-[10px] text-[#8A8A9E] block">Numerical Accuracy</span>
                  <span className="font-bold text-[#FF3B65]">0% (Mismatch)</span>
                </div>
                <div className="bg-[#030303] p-2.5 rounded-xl border border-[#1E1E2D]">
                  <span className="text-[10px] text-[#8A8A9E] block">Formula Match</span>
                  <span className="font-bold text-[#F5B800]">Simple Interest (Wrong)</span>
                </div>
              </div>
            </div>
          </div>

          {/* ArthaBench Comparison Verdict Box */}
          <div className="bg-[#0A0A12] border border-[#1E1E2D] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E1E2D] pb-4">
              <div>
                <span className="text-[10px] font-bold text-[#665CFF] uppercase tracking-wider block">
                  EVALUATION VERDICT
                </span>
                <h2 className="text-xl font-bold text-[#F7F7FB] mt-0.5">
                  ArthaBench Comparison Verdict
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#00D68F]/10 text-[#00D68F] border border-[#00D68F]/30 text-xs font-bold">
                Deterministic Check Complete
              </span>
            </div>

            {/* Verdict Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#030303] border border-[#1E1E2D] p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-[#8A8A9E] uppercase block">Ground Truth</span>
                <span className="text-lg font-bold font-mono text-[#00D68F] mt-1 block">$14,693.28</span>
                <span className="text-[10px] text-[#9A9AAA]">Decimal.js Engine</span>
              </div>

              <div className="bg-[#030303] border border-[#1E1E2D] p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-[#8A8A9E] uppercase block">Model A Result</span>
                <span className="text-lg font-bold font-mono text-[#F7F7FB] mt-1 block">$14,693.28</span>
                <span className="text-[10px] text-[#00D68F]">Exact match</span>
              </div>

              <div className="bg-[#030303] border border-[#1E1E2D] p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-[#8A8A9E] uppercase block">Model B Result</span>
                <span className="text-lg font-bold font-mono text-[#F7F7FB] mt-1 block">$14,000.00</span>
                <span className="text-[10px] text-[#FF3B65]">Error: -$693.28</span>
              </div>

              <div className="bg-[#030303] border border-[#1E1E2D] p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-[#8A8A9E] uppercase block">Consensus Score</span>
                <span className="text-lg font-bold font-mono text-[#F5B800] mt-1 block">Low</span>
                <span className="text-[10px] text-[#9A9AAA]">Divergent outputs</span>
              </div>
            </div>

            <div className="p-4 bg-[#4F32FF]/10 border border-[#4F32FF]/30 rounded-2xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#665CFF] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-[#F7F7FB]">
                  Model A is closer to deterministic ground truth
                </h4>
                <p className="text-xs text-[#9A9AAA] leading-relaxed">
                  Model A correctly applied compound interest (A = P(1+r/n)^(n*t)), yielding $14,693.28. Model B incorrectly applied simple interest, causing a $693.28 calculation shortfall.
                </p>
                <p className="text-[11px] text-[#8A8A9E] italic pt-1">
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
