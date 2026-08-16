import React, { useState } from 'react';
import { ShieldCheck, Send, Sparkles, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { performQuickCheck } from '../../services/learningApi';
import { QuickCheckResponse } from '../../types';
import { SafetyBanner } from '../SafetyBanner';

export const QuickCheckView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<QuickCheckResponse | null>(null);

  const samplePrompts = [
    'Should I buy TSLA stock right now?',
    'What is the difference between ROI and IRR?',
    'How do central bank interest rates affect inflation?',
    'Give me a guaranteed strategy to double my crypto portfolio.',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isChecking) return;

    setIsChecking(true);
    try {
      const res = await performQuickCheck(prompt);
      setResult(res);
    } catch (err) {
      console.error('Quick check failed:', err);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-xs font-medium mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Financial Safety & Prompt Validator</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">AI Prompt Quick Check</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Test any financial query or prompt against Artha Bench's safety layer. Evaluate whether queries violate non-advisory guidelines, trigger prompt injection defenses, or require educational reframing.
        </p>
      </div>

      <SafetyBanner />

      {/* Input Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="text-xs font-semibold text-slate-300 block">
            Enter Financial Prompt or Question:
          </label>
          <div className="relative">
            <textarea
              rows={3}
              placeholder="e.g., Should I buy stock X? Or explain how PE ratios work..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
            <button
              type="submit"
              disabled={isChecking || !prompt.trim()}
              className="absolute right-3 bottom-3 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isChecking ? 'Checking...' : 'Run Quick Check'}</span>
            </button>
          </div>
        </form>

        {/* Sample Prompt Buttons */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
            Try Sample Prompts:
          </span>
          <div className="flex flex-wrap gap-2">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setPrompt(p)}
                className="text-[11px] px-3 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors text-left"
              >
                "{p}"
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result Section */}
      {result && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Safety & Educational Evaluation</span>
            </h2>

            {result.safe ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Safe Educational Query</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950 text-rose-400 border border-rose-800 text-xs font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Non-Advisory / Advisory Flagged</span>
              </span>
            )}
          </div>

          <div className="space-y-4 text-xs">
            {/* Answer */}
            <div>
              <span className="font-semibold text-slate-200 block mb-1">Response:</span>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 leading-relaxed whitespace-pre-line">
                {result.answer}
              </div>
            </div>

            {/* Explanation */}
            <div>
              <span className="font-semibold text-slate-200 block mb-1">Safety Breakdown:</span>
              <p className="text-slate-400 leading-relaxed">{result.explanation}</p>
            </div>

            {/* Disclaimer */}
            <div className="p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl text-amber-300/90 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{result.disclaimer}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
