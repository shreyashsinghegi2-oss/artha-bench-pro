import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, FileSpreadsheet, FileText, RefreshCw, Search } from 'lucide-react';
import { EvaluationReport, ReliabilityReportPanel } from './ReliabilityReportPanel';

type StoredEnvelope = {
  reportId?: string;
  timestamp?: string;
  query?: string;
  evaluation?: EvaluationReport;
};

type DisplayReport = EvaluationReport & { displayId: string; timestamp: string };

function normalizeReport(record: StoredEnvelope & EvaluationReport): DisplayReport {
  const evaluation = record.evaluation && typeof record.evaluation === 'object' ? record.evaluation : record;
  const timestamp = evaluation.createdAt || record.timestamp || new Date().toISOString();
  const displayId = evaluation.verificationCode || record.reportId || evaluation.id || `report-${timestamp}`;
  return {
    ...evaluation,
    query: evaluation.query || record.query || '',
    createdAt: evaluation.createdAt || timestamp,
    verificationCode: evaluation.verificationCode || record.reportId || displayId,
    displayId,
    timestamp,
  };
}

export const ReportsView: React.FC = () => {
  const [reports, setReports] = useState<DisplayReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState<DisplayReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load evaluation reports.');
      const normalized = Array.isArray(data.reports) ? data.reports.map((record: StoredEnvelope & EvaluationReport) => normalizeReport(record)) : [];
      setReports(normalized);
      setSelectedReport((current) => current ? normalized.find((item: DisplayReport) => item.displayId === current.displayId) || null : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load evaluation reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchReports(); }, []);

  const filteredReports = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return reports;
    return reports.filter((report) => [report.verificationCode, report.query, report.verdict].some((value) => (value || '').toLowerCase().includes(normalized)));
  }, [reports, search]);

  const handleExportCSV = () => window.open('/api/reports/export?format=csv', '_blank', 'noopener,noreferrer');
  const handleExportJSON = () => window.open('/api/reports/export?format=json', '_blank', 'noopener,noreferrer');

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <section className="space-y-6 rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-interactive/40 bg-interactive/20 p-3 text-interactive"><FileSpreadsheet className="h-6 w-6" /></div>
            <div><h1 className="text-2xl font-bold text-ink">Evaluation Reports & Verification History</h1><p className="text-xs text-secondary">Audit saved multi-model evaluations, deterministic checks, evidence, risks and all seven scoring dimensions.</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void fetchReports()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-canvas px-3.5 py-2 text-xs font-bold text-ink transition hover:bg-subtle disabled:opacity-50"><RefreshCw className={`h-4 w-4 text-interactive ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
            <button type="button" onClick={handleExportCSV} className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-canvas px-3.5 py-2 text-xs font-bold text-ink transition hover:bg-subtle"><FileSpreadsheet className="h-4 w-4 text-success" /> Export All CSV</button>
            <button type="button" onClick={handleExportJSON} className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-canvas px-3.5 py-2 text-xs font-bold text-ink transition hover:bg-subtle"><FileText className="h-4 w-4 text-interactive" /> Export All JSON</button>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-line bg-canvas px-4 py-2.5"><Search className="h-4 w-4 text-secondary" /><span className="sr-only">Search evaluation reports</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by verification code, query keyword, or verdict..." className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-secondary" /></label>

        {error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs text-danger">{error}</div>}

        {loading && reports.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-secondary"><RefreshCw className="h-4 w-4 animate-spin text-interactive" /> Loading verification audit logs…</div>
        ) : filteredReports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center text-xs text-secondary">No matching verification report. Run an evaluation in Quick Check, Evaluation Lab, Comparison, or Batch Benchmark.</div>
        ) : (
          <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
            {filteredReports.map((item) => {
              const score = Math.round(item.overallScore ?? item.metrics?.overallReliabilityScore ?? 0);
              const active = selectedReport?.displayId === item.displayId;
              return (
                <button type="button" key={item.displayId} onClick={() => setSelectedReport(item)} className={`flex w-full flex-col justify-between gap-3 rounded-2xl border p-4 text-left transition sm:flex-row sm:items-center ${active ? 'border-interactive/40 bg-interactive-soft' : 'border-line bg-canvas hover:border-interactive/30 hover:bg-subtle'}`}>
                  <div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-interactive">{item.verificationCode || item.displayId}</span><span className="text-[10px] text-secondary">{new Date(item.timestamp).toLocaleString()}</span></div><p className="line-clamp-2 text-xs font-medium text-ink">{item.query || 'Evaluation query not recorded'}</p></div>
                  <div className="flex shrink-0 items-center gap-3"><span className={`rounded-full border px-3 py-1 text-[10px] font-black ${score >= 80 ? 'border-success-fill/30 bg-success-soft text-success' : score >= 60 ? 'border-warning-fill/30 bg-warning-soft text-warning' : 'border-danger/30 bg-danger-soft text-danger'}`}>{score}/100 · {(item.verdict || 'EVALUATED').replaceAll('_', ' ')}</span><ChevronRight className="h-4 w-4 text-secondary" /></div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedReport && <ReliabilityReportPanel report={selectedReport} title="Stored Evaluation Audit" responseLabel="Primary evaluated response" />}
    </div>
  );
};
