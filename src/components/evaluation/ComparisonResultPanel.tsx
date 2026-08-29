import React from 'react';
import { ArrowRight, CheckCircle2, Lightbulb, Scale, Sparkles } from 'lucide-react';
import { EvaluationReport, ReliabilityRadar } from './ReliabilityReportPanel';

export interface StructuredComparison {
  winner: 'A' | 'B' | 'tie';
  scoreA: number;
  scoreB: number;
  whyBetter: string[];
  suggestionsA: string[];
  suggestionsB: string[];
}

export const ComparisonResultPanel: React.FC<{
  reportA: EvaluationReport;
  reportB: EvaluationReport;
  comparison: StructuredComparison;
}> = ({ reportA, reportB, comparison }) => {
  const winnerLabel = comparison.winner === 'tie' ? 'No clear winner' : `Response ${comparison.winner} performs better`;
  const winnerScore = comparison.winner === 'A' ? comparison.scoreA : comparison.winner === 'B' ? comparison.scoreB : Math.max(comparison.scoreA, comparison.scoreB);

  return (
    <section className="space-y-5 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6" aria-label="Structured model comparison result">
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-interactive"><Scale className="h-3.5 w-3.5" /> Comparison verdict</div>
          <h2 className="mt-1 text-xl font-black tracking-tight text-ink">{winnerLabel}</h2>
          <p className="mt-1 text-[11px] leading-5 text-secondary">The verdict is derived from the same seven-dimension reliability engine used across Artha Bench, including deterministic math where applicable.</p>
        </div>
        <div className="flex gap-2">
          <ScoreBadge label="A" score={comparison.scoreA} active={comparison.winner === 'A'} />
          <ScoreBadge label="B" score={comparison.scoreB} active={comparison.winner === 'B'} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-line bg-canvas p-3">
          <div className="px-2 pt-1">
            <h3 className="text-xs font-black text-ink">Seven-dimension comparison</h3>
            <p className="mt-0.5 text-[10px] text-secondary">Response A and B are plotted on the same scale.</p>
          </div>
          <ReliabilityRadar
            primary={reportA.dimensions || []}
            secondary={reportB.dimensions || []}
            primaryLabel="Response A"
            secondaryLabel="Response B"
          />
          <div className="flex flex-wrap justify-center gap-4 pb-2 text-[10px] font-bold text-secondary">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-chart-primary" /> Response A</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-chart-comparison" /> Response B</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-success-fill/25 bg-success-soft/60 p-4">
            <h3 className="flex items-center gap-2 text-xs font-black text-success"><CheckCircle2 className="h-4 w-4" /> Why {comparison.winner === 'tie' ? 'the responses are close' : `Response ${comparison.winner} is better`}</h3>
            <div className="mt-3 space-y-2 text-[11px] leading-5 text-secondary">
              {comparison.whyBetter.length ? comparison.whyBetter.map((reason, index) => <p key={index}>• {reason}</p>) : <p>The measured scores are too close to claim a meaningful advantage. Review the dimension-level evidence before choosing a response.</p>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SuggestionCard label="Response A suggestions" suggestions={comparison.suggestionsA} />
            <SuggestionCard label="Response B suggestions" suggestions={comparison.suggestionsB} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResponseCard label="Response A" text={reportA.primaryResponse || ''} score={comparison.scoreA} preferred={comparison.winner === 'A'} />
        <ResponseCard label="Response B" text={reportB.primaryResponse || ''} score={comparison.scoreB} preferred={comparison.winner === 'B'} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[680px] border-collapse text-left text-[11px]">
          <thead className="bg-subtle text-secondary">
            <tr>
              <th className="px-4 py-3 font-black uppercase tracking-wider">Dimension</th>
              <th className="px-4 py-3 font-black uppercase tracking-wider">Response A</th>
              <th className="px-4 py-3 font-black uppercase tracking-wider">Response B</th>
              <th className="px-4 py-3 font-black uppercase tracking-wider">Difference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-canvas">
            {(reportA.dimensions || []).map((dimensionA) => {
              const dimensionB = (reportB.dimensions || []).find((item) => item.id === dimensionA.id);
              const a = Math.round(dimensionA.rawScore);
              const b = Math.round(dimensionB?.rawScore ?? 0);
              const difference = a - b;
              return (
                <tr key={dimensionA.id}>
                  <td className="px-4 py-3 font-bold text-ink">{dimensionA.name}</td>
                  <td className="px-4 py-3 font-mono font-bold text-interactive">{a}/100</td>
                  <td className="px-4 py-3 font-mono font-bold text-success">{b}/100</td>
                  <td className={`px-4 py-3 font-mono font-bold ${difference > 0 ? 'text-interactive' : difference < 0 ? 'text-success' : 'text-secondary'}`}>{difference > 0 ? `A +${difference}` : difference < 0 ? `B +${Math.abs(difference)}` : 'Equal'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(reportA.groundTruth?.hasNumericalCheck || reportB.groundTruth?.hasNumericalCheck) && (
        <div className="rounded-2xl border border-line bg-canvas p-4">
          <h3 className="text-xs font-black text-ink">Deterministic calculation comparison</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <GroundTruthRow label="Response A" report={reportA} />
            <GroundTruthRow label="Response B" report={reportB} />
          </div>
        </div>
      )}

      <p className="text-[10px] leading-5 text-secondary">Educational and research evaluation only. A higher reliability score does not make a response personalized financial, investment, legal, or tax advice.</p>
    </section>
  );
};

const ScoreBadge: React.FC<{ label: string; score: number; active: boolean }> = ({ label, score, active }) => (
  <div className={`min-w-24 rounded-2xl border px-3 py-2 text-right ${active ? 'border-interactive/35 bg-interactive-soft text-interactive' : 'border-line bg-canvas text-ink'}`}>
    <div className="text-[9px] font-black uppercase tracking-wider">Response {label}</div>
    <div className="font-mono text-lg font-black">{Math.round(score)}/100</div>
  </div>
);

const SuggestionCard: React.FC<{ label: string; suggestions: string[] }> = ({ label, suggestions }) => (
  <div className="rounded-2xl border border-interactive/20 bg-interactive-soft/45 p-4">
    <h4 className="flex items-center gap-2 text-[11px] font-black text-interactive"><Lightbulb className="h-3.5 w-3.5" /> {label}</h4>
    <div className="mt-2 space-y-1.5 text-[10px] leading-5 text-secondary">
      {suggestions.length ? suggestions.map((suggestion, index) => <p key={index}>• {suggestion}</p>) : <p>No major improvement was identified by the current scoring dimensions.</p>}
    </div>
  </div>
);

const ResponseCard: React.FC<{ label: string; text: string; score: number; preferred: boolean }> = ({ label, text, score, preferred }) => (
  <div className={`rounded-2xl border p-4 ${preferred ? 'border-success-fill/30 bg-success-soft/45' : 'border-line bg-canvas'}`}>
    <div className="flex items-center justify-between gap-3">
      <h3 className={`flex items-center gap-2 text-xs font-black ${preferred ? 'text-success' : 'text-ink'}`}><Sparkles className="h-4 w-4" /> {label}</h3>
      <span className="rounded-lg border border-line bg-surface px-2 py-1 font-mono text-[10px] font-black text-ink">{Math.round(score)}/100</span>
    </div>
    <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap pr-1 text-xs leading-6 text-secondary scrollbar-thin">{text}</div>
    {preferred && <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-success-fill/25 bg-surface px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-success">Preferred by measured reliability <ArrowRight className="h-3 w-3" /></div>}
  </div>
);

const GroundTruthRow: React.FC<{ label: string; report: EvaluationReport }> = ({ label, report }) => {
  const check = report.groundTruth;
  if (!check?.hasNumericalCheck) return <div className="rounded-xl border border-line bg-surface p-3 text-[10px] text-secondary"><span className="font-bold text-ink">{label}:</span> no deterministic equation matched.</div>;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 text-[10px] leading-5 text-secondary">
      <div className="flex items-center justify-between gap-3"><span className="font-black text-ink">{label}</span><span className={`font-bold ${check.pass ? 'text-success' : 'text-danger'}`}>{check.pass ? 'Verified' : 'Mismatch'}</span></div>
      <div className="mt-1">Expected: <span className="font-mono text-ink">{check.expectedResult ?? '—'}</span> · Response: <span className="font-mono text-ink">{check.aiResult ?? 'not detected'}</span></div>
      <div>Error: {check.numericalErrorPercent ?? '—'}% · tolerance {check.allowedTolerancePercent}%</div>
    </div>
  );
};
