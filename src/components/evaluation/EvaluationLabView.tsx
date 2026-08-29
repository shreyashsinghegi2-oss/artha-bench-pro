import React, { ChangeEvent, useRef, useState } from 'react';
import { AlertTriangle, FileText, FileUp, FlaskConical, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { EvaluationReport, ReliabilityReportPanel } from './ReliabilityReportPanel';

type EvaluationMode = 'dual' | 'response' | 'upload';
const MAX_UPLOAD_BYTES = 128 * 1024;

export const EvaluationLabView: React.FC = () => {
  const [query, setQuery] = useState('What is the compound interest formula for a $10,000 investment at 7% annual interest for 5 years?');
  const [suppliedResponse, setSuppliedResponse] = useState('');
  const [mode, setMode] = useState<EvaluationMode>('dual');
  const [profile, setProfile] = useState<'India' | 'US' | 'Global'>('US');
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const handleEvaluate = async () => {
    if (!query.trim()) return;
    if (mode !== 'dual' && !suppliedResponse.trim()) {
      setError(mode === 'upload' ? 'Upload a supported text file before running the evaluation.' : 'Paste or enter the AI response you want to evaluate.');
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const endpoint = mode === 'dual' ? '/api/groq/evaluate' : '/api/evaluate-response';
      const body = mode === 'dual'
        ? { query, profile }
        : { query, response: suppliedResponse, profile };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Evaluation failed.');
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation request failed.');
    } finally {
      setLoading(false);
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
      if (!['txt', 'md', 'csv', 'json'].includes(extension || '')) {
        throw new Error('Use a text-based TXT, Markdown, CSV, or JSON file. PDF/DOC parsing is not enabled in this evaluator yet.');
      }
      const text = (await file.text()).trim();
      if (!text) throw new Error('The uploaded file does not contain readable text.');
      setSuppliedResponse(text.slice(0, 12000));
      setUploadName(file.name);
      setReport(null);
    } catch (err) {
      setUploadName(null);
      setError(err instanceof Error ? err.message : 'Could not read the uploaded file.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <section className="space-y-6 rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-success-fill bg-success-soft p-3 text-success"><FlaskConical className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold text-ink">Multi-Model Evaluation Lab</h1>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-secondary">Evaluate generated model outputs, a response you paste, or text you upload. Every completed reliability run exposes the centralized seven-dimension scoring breakdown, deterministic math check, risks, strengths and improvement suggestions.</p>
            </div>
          </div>
          <label className="space-y-1 text-[10px] font-bold text-secondary">
            <span className="block uppercase tracking-wider">Evaluation profile</span>
            <select value={profile} onChange={(event) => { setProfile(event.target.value as typeof profile); setReport(null); }} className="h-10 rounded-xl border border-line-strong bg-canvas px-3 text-xs font-bold text-ink outline-none focus:border-interactive">
              <option value="India">India</option><option value="US">United States</option><option value="Global">Global</option>
            </select>
          </label>
        </div>

        <div className="grid gap-2 rounded-2xl border border-line bg-canvas p-2 sm:grid-cols-3" role="tablist" aria-label="Evaluation input mode">
          <ModeButton active={mode === 'dual'} onClick={() => { setMode('dual'); setReport(null); setError(null); }} icon={<ShieldCheck className="h-4 w-4" />} title="Dual-model prompt" description="Generate and audit two evaluator outputs" />
          <ModeButton active={mode === 'response'} onClick={() => { setMode('response'); setReport(null); setError(null); }} icon={<FileText className="h-4 w-4" />} title="Evaluate a response" description="Paste an existing AI answer" />
          <ModeButton active={mode === 'upload'} onClick={() => { setMode('upload'); setReport(null); setError(null); }} icon={<FileUp className="h-4 w-4" />} title="Evaluate uploaded text" description="Load TXT, MD, CSV or JSON" />
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-secondary" htmlFor="evaluation-query">Financial question / claim / evaluation instruction</label>
          <textarea id="evaluation-query" value={query} onChange={(event) => { setQuery(event.target.value.slice(0, 4000)); setReport(null); }} rows={4} maxLength={4000} className="w-full resize-y rounded-xl border border-line bg-canvas p-4 text-xs leading-6 text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/20" placeholder="Enter the financial question or claim the response should be judged against..." />
          <div className="text-right font-mono text-[9px] text-secondary">{query.length.toLocaleString()} / 4,000</div>
        </div>

        {mode === 'response' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-secondary" htmlFor="supplied-evaluation-response">AI-generated or external response to evaluate</label>
            <textarea id="supplied-evaluation-response" value={suppliedResponse} onChange={(event) => { setSuppliedResponse(event.target.value.slice(0, 12000)); setReport(null); }} rows={9} maxLength={12000} className="w-full resize-y rounded-xl border border-line bg-canvas p-4 text-xs leading-6 text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/20" placeholder="Paste the response exactly as produced. Artha Bench will score this supplied text rather than generating a replacement." />
            <div className="text-right font-mono text-[9px] text-secondary">{suppliedResponse.length.toLocaleString()} / 12,000</div>
          </div>
        )}

        {mode === 'upload' && (
          <div className="rounded-2xl border border-dashed border-line-strong bg-canvas p-5">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-xs font-black text-ink">Upload text for reliability evaluation</h3>
                <p className="mt-1 text-[10px] leading-5 text-secondary">Supported: .txt, .md, .csv, .json · maximum 128 KB. The extracted text is shown below before you evaluate it.</p>
              </div>
              <button type="button" onClick={() => uploadRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-xs font-black text-ink transition hover:border-interactive/40 hover:bg-subtle"><FileUp className="h-4 w-4 text-interactive" /> Choose file</button>
              <input ref={uploadRef} type="file" className="hidden" accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json" onChange={(event) => void handleUpload(event)} />
            </div>
            {uploadName && <div className="mt-3 rounded-xl border border-success-fill/25 bg-success-soft px-3 py-2 text-[10px] font-bold text-success">Loaded: {uploadName}</div>}
            {suppliedResponse && <textarea aria-label="Extracted uploaded text" value={suppliedResponse} onChange={(event) => setSuppliedResponse(event.target.value.slice(0, 12000))} rows={8} className="mt-3 w-full resize-y rounded-xl border border-line bg-surface p-3 text-xs leading-6 text-ink outline-none focus:border-interactive" />}
            <p className="mt-3 text-[9px] leading-4 text-secondary">Do not upload passwords, bank/card numbers, Aadhaar/PAN, OTPs, identity documents, or confidential financial records. Unsupported binary documents are rejected rather than silently misread.</p>
          </div>
        )}

        <button type="button" onClick={() => void handleEvaluate()} disabled={loading || !query.trim() || (mode !== 'dual' && !suppliedResponse.trim())} className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-xs font-black text-brand-foreground transition hover:bg-brand-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Running seven-dimension evaluation…' : mode === 'dual' ? 'Run dual-model evaluation' : 'Evaluate supplied content'}
        </button>
      </section>

      {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-xs leading-5 text-danger"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      {report && <ReliabilityReportPanel report={report} title={mode === 'dual' ? 'Dual-Model Reliability Report' : 'Supplied Content Reliability Report'} responseLabel={mode === 'dual' ? 'Primary model response' : 'Evaluated supplied response'} />}
    </div>
  );
};

const ModeButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; title: string; description: string }> = ({ active, onClick, icon, title, description }) => (
  <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`rounded-xl border px-3 py-3 text-left transition ${active ? 'border-interactive/35 bg-interactive-soft' : 'border-transparent hover:border-line hover:bg-subtle'}`}>
    <span className={`flex items-center gap-2 text-xs font-black ${active ? 'text-interactive' : 'text-ink'}`}>{icon}{title}</span>
    <span className="mt-1 block text-[9px] leading-4 text-secondary">{description}</span>
  </button>
);
