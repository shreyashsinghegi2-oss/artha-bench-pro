import React, { ChangeEvent, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, RefreshCw, Send, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { performQuickCheck } from '../../services/learningApi';
import { QuickCheckResponse } from '../../types';
import { SafetyBanner } from '../SafetyBanner';
import { EvaluationReport, ReliabilityReportPanel } from '../evaluation/ReliabilityReportPanel';

type QuickCheckMode = 'prompt-safety' | 'response-reliability';
const MAX_UPLOAD_BYTES = 128 * 1024;

export const QuickCheckView: React.FC = () => {
  const [mode, setMode] = useState<QuickCheckMode>('prompt-safety');
  const [prompt, setPrompt] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [profile, setProfile] = useState<'India' | 'US' | 'Global'>('India');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<QuickCheckResponse | null>(null);
  const [reliabilityReport, setReliabilityReport] = useState<EvaluationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const samplePrompts = [
    'Should I buy TSLA stock right now?',
    'What is the difference between ROI and IRR?',
    'How do central bank interest rates affect inflation?',
    'Give me a guaranteed strategy to double my crypto portfolio.',
  ];

  const switchMode = (nextMode: QuickCheckMode) => {
    setMode(nextMode);
    setResult(null);
    setReliabilityReport(null);
    setError(null);
  };

  const handleSafetySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || isChecking) return;
    setIsChecking(true);
    setError(null);
    setResult(null);
    try {
      const response = await performQuickCheck(prompt);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quick safety check failed.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleReliabilitySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || !aiAnswer.trim() || isChecking) return;
    setIsChecking(true);
    setError(null);
    setReliabilityReport(null);
    try {
      const response = await fetch('/api/evaluate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt, response: aiAnswer, profile }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Response reliability check failed.');
      setReliabilityReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Response reliability check failed.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    try {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error('Upload must be 128 KB or smaller.');
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!['txt', 'md', 'csv', 'json'].includes(extension || '')) throw new Error('Use a TXT, Markdown, CSV, or JSON file. PDF/DOC parsing is not enabled in Quick Check yet.');
      const text = (await file.text()).trim();
      if (!text) throw new Error('The uploaded file does not contain readable text.');
      setAiAnswer(text.slice(0, 12000));
      setReliabilityReport(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the uploaded file.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-md border border-success-fill/60 bg-success-soft/60 px-2.5 py-1 text-xs font-medium text-success"><ShieldCheck className="h-3.5 w-3.5" /><span>Financial Safety & Reliability Quick Check</span></div>
        <div>
          <h1 className="text-2xl font-bold text-ink">AI Quick Check Evaluation</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-secondary">Keep the original fast prompt-safety validator, or evaluate a supplied AI answer against all seven Artha Bench reliability dimensions and deterministic math where applicable.</p>
        </div>
        <div className="grid gap-2 rounded-xl border border-line bg-canvas p-2 sm:grid-cols-2" role="tablist" aria-label="Quick Check mode">
          <button type="button" role="tab" aria-selected={mode === 'prompt-safety'} onClick={() => switchMode('prompt-safety')} className={`rounded-lg px-4 py-3 text-left transition ${mode === 'prompt-safety' ? 'bg-interactive-soft text-interactive' : 'hover:bg-subtle text-ink'}`}><span className="block text-xs font-black">Prompt Safety</span><span className="mt-0.5 block text-[9px] text-secondary">Check advisory, guarantee and prompt-injection risks.</span></button>
          <button type="button" role="tab" aria-selected={mode === 'response-reliability'} onClick={() => switchMode('response-reliability')} className={`rounded-lg px-4 py-3 text-left transition ${mode === 'response-reliability' ? 'bg-interactive-soft text-interactive' : 'hover:bg-subtle text-ink'}`}><span className="block text-xs font-black">Response Reliability</span><span className="mt-0.5 block text-[9px] text-secondary">Score question + AI answer across seven dimensions.</span></button>
        </div>
      </section>

      <SafetyBanner />

      {mode === 'prompt-safety' ? (
        <section className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <form onSubmit={handleSafetySubmit} className="space-y-3">
            <label className="block text-xs font-semibold text-secondary" htmlFor="quick-safety-prompt">Enter financial prompt or question</label>
            <div className="relative">
              <textarea id="quick-safety-prompt" rows={4} maxLength={4000} placeholder="e.g., Should I buy stock X? Or explain how PE ratios work..." value={prompt} onChange={(event) => { setPrompt(event.target.value); setResult(null); }} className="w-full resize-y rounded-xl border border-line bg-canvas p-4 pb-14 text-xs text-ink outline-none placeholder:text-secondary focus:border-interactive focus:ring-2 focus:ring-interactive/20" />
              <button type="submit" disabled={isChecking || !prompt.trim()} className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-brand-foreground transition hover:bg-brand-hover hover:text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas"><Send className="h-3.5 w-3.5" />{isChecking ? 'Checking…' : 'Run Quick Check'}</button>
            </div>
          </form>
          <div className="space-y-2 border-t border-line pt-3"><span className="block text-[10px] font-semibold uppercase tracking-wider text-secondary">Try sample prompts</span><div className="flex flex-wrap gap-2">{samplePrompts.map((sample) => <button type="button" key={sample} onClick={() => { setPrompt(sample); setResult(null); }} className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-left text-[11px] text-secondary transition hover:bg-hover">“{sample}”</button>)}</div></div>
        </section>
      ) : (
        <section className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <form onSubmit={handleReliabilitySubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div><label className="mb-1.5 block text-xs font-semibold text-secondary" htmlFor="quick-reliability-question">Financial question</label><textarea id="quick-reliability-question" value={prompt} onChange={(event) => { setPrompt(event.target.value.slice(0, 4000)); setReliabilityReport(null); }} rows={4} maxLength={4000} className="w-full resize-y rounded-xl border border-line bg-canvas p-4 text-xs leading-6 text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/20" placeholder="What question was the AI answer trying to solve?" /></div>
              <label className="space-y-1 text-[10px] font-bold text-secondary"><span className="block uppercase tracking-wider">Profile</span><select value={profile} onChange={(event) => { setProfile(event.target.value as typeof profile); setReliabilityReport(null); }} className="h-11 rounded-xl border border-line-strong bg-canvas px-3 text-xs font-bold text-ink outline-none"><option value="India">India</option><option value="US">United States</option><option value="Global">Global</option></select></label>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3"><label className="text-xs font-semibold text-secondary" htmlFor="quick-ai-answer">AI-generated answer</label><button type="button" onClick={() => uploadRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[10px] font-bold text-secondary hover:border-interactive/40 hover:text-ink"><FileUp className="h-3.5 w-3.5" /> Upload text</button><input ref={uploadRef} type="file" className="hidden" accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json" onChange={(event) => void handleUpload(event)} /></div>
              <textarea id="quick-ai-answer" value={aiAnswer} onChange={(event) => { setAiAnswer(event.target.value.slice(0, 12000)); setReliabilityReport(null); }} rows={9} maxLength={12000} className="w-full resize-y rounded-xl border border-line bg-canvas p-4 text-xs leading-6 text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/20" placeholder="Paste the AI answer exactly as generated, or upload a supported text file..." />
              <div className="mt-1 flex items-center justify-between text-[9px] text-secondary"><span>TXT, MD, CSV, JSON up to 128 KB. Avoid sensitive personal or account data.</span><span className="font-mono">{aiAnswer.length.toLocaleString()} / 12,000</span></div>
            </div>
            <button type="submit" disabled={isChecking || !prompt.trim() || !aiAnswer.trim()} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-xs font-black text-brand-foreground transition hover:bg-brand-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-50">{isChecking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isChecking ? 'Evaluating response…' : 'Run seven-dimension evaluation'}</button>
          </form>
        </section>
      )}

      {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-xs leading-5 text-danger"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      {mode === 'prompt-safety' && result && (
        <section className="space-y-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles className="h-4 w-4 text-success" /> Safety & Educational Evaluation</h2>{result.safe ? <span className="inline-flex items-center gap-1.5 rounded-full border border-success-fill bg-success-soft px-3 py-1 text-xs font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Safe Educational Query</span> : <span className="inline-flex items-center gap-1.5 rounded-full border border-danger bg-danger-soft px-3 py-1 text-xs font-semibold text-danger"><ShieldAlert className="h-3.5 w-3.5" /> Non-Advisory / Advisory Flagged</span>}</div>
          <div className="space-y-4 text-xs"><div><span className="mb-1 block font-semibold text-ink">Response</span><div className="whitespace-pre-line rounded-xl border border-line bg-canvas p-4 leading-relaxed text-secondary">{result.answer}</div></div><div><span className="mb-1 block font-semibold text-ink">Safety breakdown</span><p className="leading-relaxed text-secondary">{result.explanation}</p></div><div className="flex items-start gap-2 rounded-xl border border-warning-fill/50 bg-warning-soft/40 p-3 text-[11px] text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{result.disclaimer}</div></div>
        </section>
      )}

      {mode === 'response-reliability' && reliabilityReport && <ReliabilityReportPanel report={reliabilityReport} title="Quick Check Reliability Report" responseLabel="Evaluated AI answer" />}
    </div>
  );
};
