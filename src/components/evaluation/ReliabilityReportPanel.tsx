import React from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  CircleHelp,
  Lightbulb,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export interface EvaluationDimension {
  id: string;
  name: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
  reason: string;
  evidence: string[];
  pass: boolean;
  limitations?: string;
}

export interface EvaluationGroundTruth {
  hasNumericalCheck: boolean;
  expectedResult?: number;
  aiResult?: number;
  numericalErrorPercent?: number;
  allowedTolerancePercent: number;
  formulaCorrectness: boolean;
  pass: boolean;
  explanation: string;
}

export interface EvaluationReport {
  id?: string;
  verificationCode?: string;
  createdAt?: string;
  query?: string;
  primaryResponse?: string;
  secondaryResponse?: string;
  overallScore?: number;
  verdict?: string;
  dimensions?: EvaluationDimension[];
  groundTruth?: EvaluationGroundTruth;
  riskFlags?: string[];
  executionDurationMs?: number;
  demoMode?: boolean;
  metrics?: {
    formulaAccuracyScore?: number;
    dualModelConsensusScore?: number;
    evidenceVerificationScore?: number;
    safetyComplianceScore?: number;
    overallReliabilityScore?: number;
  };
}

const clampScore = (value: number | undefined) => Math.max(0, Math.min(100, Number(value) || 0));

function scoreTone(score: number) {
  if (score >= 80) return 'text-success bg-success-soft border-success-fill/30';
  if (score >= 60) return 'text-warning bg-warning-soft border-warning-fill/30';
  return 'text-danger bg-danger-soft border-danger/30';
}

function verdictLabel(verdict: string | undefined) {
  if (!verdict) return 'Evaluation complete';
  return verdict.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const ReliabilityRadar: React.FC<{
  primary: EvaluationDimension[];
  secondary?: EvaluationDimension[];
  primaryLabel?: string;
  secondaryLabel?: string;
}> = ({ primary, secondary, primaryLabel = 'Response', secondaryLabel = 'Comparison' }) => {
  const secondaryMap = new Map((secondary || []).map((dimension) => [dimension.id, dimension]));
  const data = primary.map((dimension) => ({
    dimension: dimension.name,
    primary: clampScore(dimension.rawScore),
    secondary: clampScore(secondaryMap.get(dimension.id)?.rawScore),
  }));

  if (!data.length) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-line bg-canvas p-6 text-center text-xs text-secondary">
        Seven-dimension scores are not available for this older result.
      </div>
    );
  }

  return (
    <div className="h-[330px] w-full" aria-label="Seven-dimension reliability radar chart">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="68%">
          <PolarGrid stroke="var(--chart-grid)" />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tickCount={5} tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} />
          <Tooltip
            contentStyle={{
              background: 'var(--chart-tooltip)',
              color: 'var(--chart-tooltip-foreground)',
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              fontSize: 11,
            }}
          />
          <Radar name={primaryLabel} dataKey="primary" stroke="var(--chart-primary)" fill="var(--chart-primary)" fillOpacity={0.22} strokeWidth={2} />
          {secondary && secondary.length > 0 && (
            <Radar name={secondaryLabel} dataKey="secondary" stroke="var(--chart-comparison)" fill="var(--chart-comparison)" fillOpacity={0.12} strokeWidth={2} />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ReliabilityReportPanel: React.FC<{
  report: EvaluationReport;
  title?: string;
  responseLabel?: string;
  showResponses?: boolean;
}> = ({ report, title = 'Systematic Reliability Evaluation', responseLabel = 'Evaluated response', showResponses = true }) => {
  const dimensions = Array.isArray(report.dimensions) ? report.dimensions : [];
  const score = clampScore(report.overallScore ?? report.metrics?.overallReliabilityScore);
  const strengths = dimensions.filter((dimension) => dimension.rawScore >= 80).sort((a, b) => b.rawScore - a.rawScore);
  const issues = dimensions.filter((dimension) => dimension.rawScore < 70).sort((a, b) => a.rawScore - b.rawScore);
  const suggestions = [...dimensions].sort((a, b) => a.rawScore - b.rawScore).filter((dimension) => dimension.rawScore < 85).slice(0, 4);
  const risks = Array.isArray(report.riskFlags) ? report.riskFlags : [];

  return (
    <section className="space-y-5 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6" aria-label={title}>
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-interactive">Artha Bench reliability framework</div>
          <h2 className="mt-1 text-lg font-black tracking-tight text-ink">{title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-secondary">
            {report.verificationCode && <span className="font-mono">{report.verificationCode}</span>}
            {report.createdAt && <span>· {new Date(report.createdAt).toLocaleString()}</span>}
            {report.executionDurationMs !== undefined && <span>· {report.executionDurationMs} ms</span>}
            {report.demoMode && <span className="rounded-full border border-warning-fill/30 bg-warning-soft px-2 py-0.5 font-bold text-warning">Demo / fallback model mode</span>}
          </div>
        </div>
        <div className={`min-w-36 rounded-2xl border px-4 py-3 text-right ${scoreTone(score)}`}>
          <div className="text-[10px] font-black uppercase tracking-wider">Overall score</div>
          <div className="mt-0.5 text-2xl font-black tabular-nums">{score} / 100</div>
          <div className="mt-0.5 text-[10px] font-bold">{verdictLabel(report.verdict)}</div>
        </div>
      </div>

      {dimensions.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-2xl border border-line bg-canvas p-3">
            <div className="flex items-center justify-between px-2 pt-1">
              <div>
                <h3 className="text-xs font-black text-ink">Seven-dimension spider chart</h3>
                <p className="mt-0.5 text-[10px] text-secondary">Scores come from the centralized reliability engine.</p>
              </div>
              <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
            </div>
            <ReliabilityRadar primary={dimensions} />
          </div>

          <div className="space-y-2">
            {dimensions.map((dimension) => {
              const currentScore = clampScore(dimension.rawScore);
              return (
                <details key={dimension.id} className="group rounded-xl border border-line bg-canvas px-3.5 py-3 open:border-interactive/30">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span className="min-w-0 text-xs font-bold text-ink">{dimension.name}</span>
                    <span className={`shrink-0 rounded-lg border px-2 py-1 font-mono text-[11px] font-black ${scoreTone(currentScore)}`}>{currentScore} / 100</span>
                  </summary>
                  <div className="mt-3 border-t border-line pt-3 text-[10px] leading-5 text-secondary">
                    <p>{dimension.reason}</p>
                    <p className="mt-1 font-semibold text-ink">Weight: {Math.round(dimension.weight * 100)}%</p>
                    {dimension.limitations && <p className="mt-1 text-warning">Limitation: {dimension.limitations}</p>}
                    {dimension.evidence?.length > 0 && <p className="mt-1">Evidence: {dimension.evidence.slice(0, 3).join(' · ')}</p>}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-success-fill/25 bg-success-soft/60 p-4">
          <h3 className="flex items-center gap-2 text-xs font-black text-success"><CheckCircle2 className="h-4 w-4" /> Key strengths</h3>
          <div className="mt-3 space-y-2 text-[11px] leading-5 text-secondary">
            {strengths.length ? strengths.slice(0, 4).map((dimension) => <p key={dimension.id}><span className="font-bold text-ink">{dimension.name}:</span> {dimension.rawScore}/100 — {dimension.reason}</p>) : <p>No dimension reached the strong-score threshold yet.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-warning-fill/25 bg-warning-soft/50 p-4">
          <h3 className="flex items-center gap-2 text-xs font-black text-warning"><CircleHelp className="h-4 w-4" /> Needs review</h3>
          <div className="mt-3 space-y-2 text-[11px] leading-5 text-secondary">
            {issues.length ? issues.slice(0, 4).map((dimension) => <p key={dimension.id}><span className="font-bold text-ink">{dimension.name}:</span> {dimension.reason}</p>) : <p>No dimension is below the review threshold.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-interactive/25 bg-interactive-soft/70 p-4">
          <h3 className="flex items-center gap-2 text-xs font-black text-interactive"><Lightbulb className="h-4 w-4" /> Suggested improvements</h3>
          <div className="mt-3 space-y-2 text-[11px] leading-5 text-secondary">
            {suggestions.length ? suggestions.map((dimension) => <p key={dimension.id}>Improve <span className="font-bold text-ink">{dimension.name}</span>: {dimension.limitations || dimension.reason}</p>) : <p>The evaluated response is strong across all seven measured dimensions.</p>}
          </div>
        </div>
      </div>

      {report.groundTruth && (
        <div className="rounded-2xl border border-line bg-canvas p-4">
          <h3 className="flex items-center gap-2 text-xs font-black text-ink"><Calculator className="h-4 w-4 text-interactive" /> Deterministic calculation check</h3>
          {report.groundTruth.hasNumericalCheck ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <Metric label="Status" value={report.groundTruth.pass ? 'Verified' : 'Needs review'} tone={report.groundTruth.pass ? 'success' : 'danger'} />
              <Metric label="Expected result" value={report.groundTruth.expectedResult ?? '—'} />
              <Metric label="Response result" value={report.groundTruth.aiResult ?? 'Not detected'} />
              <Metric label="Error / tolerance" value={`${report.groundTruth.numericalErrorPercent ?? '—'}% / ${report.groundTruth.allowedTolerancePercent}%`} />
              <p className="sm:col-span-4 text-[11px] leading-5 text-secondary">{report.groundTruth.explanation}</p>
            </div>
          ) : (
            <p className="mt-2 text-[11px] leading-5 text-secondary">{report.groundTruth.explanation}</p>
          )}
        </div>
      )}

      {risks.length > 0 && (
        <div className="rounded-2xl border border-danger/25 bg-danger-soft p-4">
          <h3 className="flex items-center gap-2 text-xs font-black text-danger"><AlertTriangle className="h-4 w-4" /> Risk & reliability flags</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-secondary">
            {risks.map((risk, index) => <li key={`${risk}-${index}`}>• {risk}</li>)}
          </ul>
        </div>
      )}

      {showResponses && report.primaryResponse && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-interactive/25 bg-interactive-soft/35 p-4">
            <h3 className="flex items-center gap-2 text-xs font-black text-interactive"><Sparkles className="h-4 w-4" /> {responseLabel}</h3>
            <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-ink">{report.primaryResponse}</div>
          </div>
          {report.secondaryResponse && (
            <div className="rounded-2xl border border-line bg-canvas p-4">
              <h3 className="text-xs font-black text-secondary">Independent comparison / verifier response</h3>
              <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-secondary">{report.secondaryResponse}</div>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] leading-5 text-secondary">Educational and research evaluation only. Scores describe the supplied response under the Artha Bench methodology; they are not financial, investment, tax, or legal advice.</p>
    </section>
  );
};

const Metric: React.FC<{ label: string; value: React.ReactNode; tone?: 'success' | 'danger' }> = ({ label, value, tone }) => (
  <div className="rounded-xl border border-line bg-surface p-3">
    <div className="text-[9px] font-black uppercase tracking-wider text-secondary">{label}</div>
    <div className={`mt-1 break-words text-sm font-black ${tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{value}</div>
  </div>
);
