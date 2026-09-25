import React, { useEffect, useState } from 'react';
import { BarChart3, ClipboardCheck, FileText, FlaskConical, GitCompare, Layers, ScrollText } from 'lucide-react';
import type { AppNavigationDestination } from '../../navigationTypes';
import type { StoredEvaluationRecord } from '../../types';
import './evaluationHub.css';

const TOOLS: Array<{ id: AppNavigationDestination; label: string; text: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'quick-check', label: 'Quick Check', text: 'Score one AI answer in seconds', icon: ClipboardCheck },
  { id: 'evaluation-lab', label: 'Evaluation Lab', text: 'Deep 7-dimension evaluation', icon: FlaskConical },
  { id: 'comparison', label: 'Multi-model', text: 'Compare models side by side', icon: GitCompare },
  { id: 'batch', label: 'Batch benchmark', text: 'Run a whole scenario set', icon: Layers },
  { id: 'reports', label: 'Reports', text: 'Saved evaluations and exports', icon: FileText },
  { id: 'methodology', label: 'Methodology', text: 'How every score is computed', icon: ScrollText },
];
export const EVALUATION_DESTINATIONS = new Set<AppNavigationDestination>(TOOLS.map((t) => t.id));

const DIMENSIONS: Array<[keyof StoredEvaluationRecord['metrics'], string]> = [
  ['formulaAccuracyScore', 'Formula accuracy'], ['dualModelConsensusScore', 'Model consensus'], ['evidenceVerificationScore', 'Evidence'], ['safetyComplianceScore', 'Safety'],
];
const as100 = (v: number) => (v <= 1 ? v * 100 : v);
const toneOf = (v: number) => (v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad');

/** Top of every evaluation tool: switch tools, see the evaluation dashboard, and the 3-step workflow. */
export const EvaluationHub: React.FC<{ destination: AppNavigationDestination; onNavigate: (d: AppNavigationDestination) => void }> = ({ destination, onNavigate }) => {
  const [reports, setReports] = useState<StoredEvaluationRecord[] | null>(null);
  useEffect(() => { fetch('/api/reports').then((r) => r.json()).then((d) => setReports(Array.isArray(d.reports) ? d.reports : [])).catch(() => setReports([])); }, [destination]);
  const n = reports?.length ?? 0;
  const scores = (reports ?? []).map((r) => as100(r.metrics?.overallReliabilityScore ?? 0));
  const avg = n ? scores.reduce((a, b) => a + b, 0) / n : null;
  const pass = n ? scores.filter((s) => s >= 70).length / n : null;
  const last = n ? [...(reports ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] : null;
  const dims = DIMENSIONS.map(([k, label]) => ({ label, value: n ? (reports ?? []).reduce((a, r) => a + as100(Number(r.metrics?.[k] ?? 0)), 0) / n : null }));

  return <section className="eh" aria-label="Evaluation suite">
    <nav className="eh-tools" aria-label="Evaluation tools">{TOOLS.map((t) => { const Icon = t.icon; return <button key={t.id} type="button" className={t.id === destination ? 'on' : ''} onClick={() => onNavigate(t.id)} aria-current={t.id === destination ? 'page' : undefined}>
      <span className="eh-ico"><Icon size={15}/></span><span><b>{t.label}</b><small>{t.text}</small></span>
    </button>; })}</nav>
    <div className="eh-dash">
      <article className="eh-kpi info"><small>Evaluations saved</small><b>{reports === null ? '…' : n}</b><span>{last ? `Last: ${new Date(last.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Run your first check below'}</span></article>
      <article className={`eh-kpi ${avg == null ? 'info' : toneOf(avg)}`}><small>Average reliability</small><b>{avg == null ? '—' : `${avg.toFixed(0)}/100`}</b><span>{avg == null ? 'No scores yet' : avg >= 80 ? 'Reliable' : avg >= 60 ? 'Needs review' : 'Unreliable'}</span></article>
      <article className={`eh-kpi ${pass == null ? 'info' : pass >= 0.8 ? 'good' : pass >= 0.5 ? 'warn' : 'bad'}`}><small>Pass rate (70+)</small><b>{pass == null ? '—' : `${Math.round(pass * 100)}%`}</b><span>of evaluated answers</span></article>
      <article className="eh-kpi eh-dims"><small>By dimension</small>{dims.map((d) => <div key={d.label} className={`eh-dim ${d.value == null ? '' : toneOf(d.value)}`}><span>{d.label}</span><i><b style={{ width: `${d.value ?? 0}%` }}/></i><em>{d.value == null ? '—' : d.value.toFixed(0)}</em></div>)}</article>
    </div>
    <ol className="eh-steps"><li><b>1</b>Paste the financial question</li><li><b>2</b>Paste the AI's answer (or let two models answer)</li><li><b>3</b>Get a colour-coded score for maths, evidence, consensus and safety</li><li><b><BarChart3 size={12}/></b>Save it to Reports and export CSV</li></ol>
  </section>;
};
