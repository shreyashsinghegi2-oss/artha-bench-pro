import React, { ChangeEvent, useRef, useState } from 'react';
import { AlertTriangle, FileUp, RefreshCw, Scale, Sparkles } from 'lucide-react';
import { ComparisonResultPanel, StructuredComparison } from '../evaluation/ComparisonResultPanel';
import { EvaluationReport } from '../evaluation/ReliabilityReportPanel';

const ACCEPTED_TEXT_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'application/json'];
const MAX_UPLOAD_BYTES = 128 * 1024;

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
  const [profile, setProfile] = useState<'India' | 'US' | 'Global'>('US');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reportA: EvaluationReport; reportB: EvaluationReport; comparison: StructuredComparison } | null>(null);
  const uploadARef = useRef<HTMLInputElement | null>(null);
  const uploadBRef = useRef<HTMLInputElement | null>(null);

  const runComparison = async (responseA = modelAText, responseB = modelBText) => {
    if (!question.trim() || !responseA.trim() || !responseB.trim()) {
      setError('Enter the shared question and both responses before comparing them.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/compare-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question, responseA, responseB, profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Comparison evaluation failed.');
      setResult({ reportA: data.reportA, reportB: data.reportB, comparison: data.comparison });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison evaluation failed.');
    } finally {
      setLoading(false);
    }
  };

  const generateDualModelResponses = async () => {
    if (!question.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question, profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate the dual-model pair.');
      const primary = data.report?.primaryResponse;
      const secondary = data.report?.secondaryResponse;
      if (!primary || !secondary) throw new Error('The evaluation provider did not return two comparable responses.');
      setModelAText(primary);
      setModelBText(secondary);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate model responses.');
    } finally {
      setGenerating(false);
    }
  };

  const loadTextFile = async (file: File, target: 'A' | 'B') => {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('Upload must be 128 KB or smaller.');
    const extension = file.name.split('.').pop()?.toLowerCase();
    const supportedExtension = ['txt', 'md', 'csv', 'json'].includes(extension || '');
    if (!ACCEPTED_TEXT_TYPES.includes(file.type) && !supportedExtension) {
      throw new Error('Use a text-based .txt, .md, .csv, or .json file. PDF/DOC parsing is not enabled in this evaluator yet.');
    }
    const text = (await file.text()).trim();
    if (!text) throw new Error('The uploaded file does not contain readable text.');
    const limited = text.slice(0, 12000);
    if (target === 'A') setModelAText(limited);
    else setModelBText(limited);
    setResult(null);
  };

  const handleUpload = (target: 'A' | 'B') => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    try {
      await loadTextFile(file, target);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the uploaded file.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-interactive/40 bg-interactive/20 text-interactive"><Scale className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Side-by-Side Response Comparison</h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-secondary sm:text-sm">Compare the responses you paste, upload, or generate. Artha Bench scores each response independently across the same seven reliability dimensions and explains the measured difference.</p>
          </div>
        </div>
      </div>

      <section className="space-y-6 rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-secondary" htmlFor="comparison-question">Shared financial question / evaluation prompt</label>
            <textarea id="comparison-question" value={question} onChange={(event) => { setQuestion(event.target.value); setResult(null); }} rows={3} className="w-full resize-y rounded-xl border border-line bg-canvas p-4 text-xs leading-relaxed text-ink outline-none transition focus:border-interactive focus:ring-2 focus:ring-interactive/20 sm:text-sm" placeholder="Enter the exact question both responses are answering..." />
          </div>
          <label className="space-y-1 text-[10px] font-bold text-secondary">
            <span className="block uppercase tracking-wider">Evaluation profile</span>
            <select value={profile} onChange={(event) => { setProfile(event.target.value as typeof profile); setResult(null); }} className="h-11 rounded-xl border border-line-strong bg-canvas px-3 text-xs font-bold text-ink outline-none focus:border-interactive">
              <option value="India">India</option><option value="US">United States</option><option value="Global">Global</option>
            </select>
          </label>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <ResponseEditor label="Response A" value={modelAText} onChange={(value) => { setModelAText(value); setResult(null); }} onUpload={() => uploadARef.current?.click()} />
          <ResponseEditor label="Response B" value={modelBText} onChange={(value) => { setModelBText(value); setResult(null); }} onUpload={() => uploadBRef.current?.click()} />
          <input ref={uploadARef} className="hidden" type="file" accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json" onChange={handleUpload('A')} aria-label="Upload response A text" />
          <input ref={uploadBRef} className="hidden" type="file" accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json" onChange={handleUpload('B')} aria-label="Upload response B text" />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => void runComparison()} disabled={loading || generating || !question.trim() || !modelAText.trim() || !modelBText.trim()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-brand-foreground transition hover:bg-brand-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}{loading ? 'Scoring both responses…' : 'Run systematic comparison'}
          </button>
          <button type="button" onClick={() => void generateDualModelResponses()} disabled={loading || generating || !question.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-canvas px-5 py-3 text-xs font-black text-ink transition hover:border-interactive/40 hover:bg-subtle disabled:opacity-50">
            {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-interactive" />}{generating ? 'Generating pair…' : 'Generate dual-model responses'}
          </button>
        </div>
        <p className="text-[10px] leading-5 text-secondary">Uploads are read locally in the browser before evaluation. Supported here: TXT, Markdown, CSV and JSON up to 128 KB. Avoid uploading passwords, bank/card numbers, identity documents, or other sensitive financial records.</p>
      </section>

      {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-xs leading-5 text-danger"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      {result && <ComparisonResultPanel reportA={result.reportA} reportB={result.reportB} comparison={result.comparison} />}
    </div>
  );
};

const ResponseEditor: React.FC<{ label: string; value: string; onChange: (value: string) => void; onUpload: () => void }> = ({ label, value, onChange, onUpload }) => (
  <div className="space-y-3 rounded-2xl border border-line bg-canvas p-5 transition hover:border-interactive/30">
    <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
      <span className="text-xs font-black uppercase tracking-wide text-interactive">{label}</span>
      <button type="button" onClick={onUpload} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[10px] font-bold text-secondary transition hover:border-interactive/40 hover:text-ink"><FileUp className="h-3.5 w-3.5" /> Upload text</button>
    </div>
    <textarea value={value} onChange={(event) => onChange(event.target.value.slice(0, 12000))} rows={9} maxLength={12000} className="w-full resize-y bg-transparent text-xs leading-6 text-ink outline-none" placeholder={`${label} content to evaluate...`} aria-label={`${label} content`} />
    <div className="text-right text-[9px] font-mono text-secondary">{value.length.toLocaleString()} / 12,000</div>
  </div>
);
