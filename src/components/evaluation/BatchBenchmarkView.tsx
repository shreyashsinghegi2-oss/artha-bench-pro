import React, { useEffect, useState } from 'react';
import { AlertTriangle, Boxes, CheckCircle2, FileSpreadsheet, FileText, Globe, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { BenchmarkScenario } from '../../types';
import { EvaluationDimension, ReliabilityRadar } from './ReliabilityReportPanel';

type BatchScenario = BenchmarkScenario & { prompt?: string };

type BatchResult = {
  scenarioId: string;
  category: string;
  query: string;
  passed: boolean;
  overallScore: number;
  groundTruthPassed: boolean;
  consensusScore: number;
  safetyScore: number;
  primaryModel: string;
  secondaryModel: string;
  verdict: string;
  durationMs: number;
  dimensions: EvaluationDimension[];
};

type BatchAggregateStats = {
  totalCount: number;
  passedCount: number;
  failedCount: number;
  passRatePercent: number;
  overallAverageScore: number;
  averageNumericalAccuracy: number;
  averageConsensusScore: number;
  averageSafetyScore: number;
  primaryModel: string;
  secondaryModel: string;
  regionProfile: 'India' | 'US' | 'Global';
  averageDimensions: EvaluationDimension[];
  totalDurationMs: number;
  datasetVersion: string;
};

type BatchProgress = {
  runId?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalScenarios: number;
  completedScenarios: number;
  currentScenarioId?: string;
  results: BatchResult[];
  aggregateStats?: BatchAggregateStats;
};

function scoreTone(score: number) {
  if (score >= 80) return 'text-success bg-success-soft border-success-fill/30';
  if (score >= 60) return 'text-warning bg-warning-soft border-warning-fill/30';
  return 'text-danger bg-danger-soft border-danger/30';
}

export const BatchBenchmarkView: React.FC = () => {
  const [scenarios, setScenarios] = useState<BatchScenario[]>([]);
  const [regionProfile, setRegionProfile] = useState<'India' | 'US' | 'Global'>('India');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchScenarios();
  }, []);

  const fetchScenarios = async () => {
    try {
      const res = await fetch('/api/batch/scenarios');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Benchmark scenarios are unavailable.');
      const normalized: BatchScenario[] = (data.scenarios || []).map((scenario: any) => ({
        ...scenario,
        query: scenario.query || scenario.prompt || '',
      }));
      setScenarios(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benchmark scenarios are unavailable.');
    }
  };

  const handleRunBatch = async () => {
    if (!scenarios.length || running) return;
    setRunning(true);
    setError(null);
    setProgress({
      status: 'RUNNING',
      totalScenarios: scenarios.length,
      completedScenarios: 0,
      currentScenarioId: scenarios[0]?.scenarioId,
      results: [],
    });

    try {
      const scenarioIds = scenarios.map((scenario) => scenario.scenarioId);
      const res = await fetch('/api/batch/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioIds, profile: regionProfile }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Batch execution failed.');
      const run = data.run || data.progress;
      if (!run) throw new Error('Batch execution completed without a readable result payload.');
      setProgress(run);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch benchmark execution failed.');
      setProgress(null);
    } finally {
      setRunning(false);
    }
  };

  const handleExportJSON = () => {
    if (!progress?.aggregateStats) return;
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `arthabench_batch_report_${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!progress?.results.length) return;
    const headers = 'Scenario ID,Category,Passed,Overall Score,Numerical Score,Consensus Score,Safety Score,Primary Model,Secondary Model\n';
    const rows = progress.results
      .map((result) => `"${result.scenarioId}","${result.category}",${result.passed},${result.overallScore},${result.groundTruthPassed ? 100 : 0},${result.consensusScore},${result.safetyScore},"${result.primaryModel}","${result.secondaryModel}"`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `arthabench_batch_report_${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const stats = progress?.aggregateStats;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <section className="space-y-6 rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-interactive/40 bg-interactive/20 p-3 text-interactive"><Boxes className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold text-ink">Batch Benchmark Suite V2.0</h1>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-secondary">Run the benchmark dataset through the same centralized seven-dimension reliability engine used by Evaluation Lab, Quick Check and Response Comparison.</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-secondary">
            <Globe className="h-4 w-4 text-interactive" />
            <select value={regionProfile} onChange={(event) => setRegionProfile(event.target.value as typeof regionProfile)} disabled={running} className="rounded-xl border border-line-strong bg-canvas px-3 py-2 text-xs font-bold text-ink outline-none focus:border-interactive">
              <option value="India">India Profile</option>
              <option value="US">US Profile</option>
              <option value="Global">Global Profile</option>
            </select>
          </label>
        </div>

        <div className="space-y-3 border-t border-line pt-5">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-ink">
            <span>Benchmark Scenarios ({scenarios.length} ready)</span>
            <span className="text-[10px] text-secondary">Dataset: ARTHA-V1-BENCHMARK</span>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {scenarios.map((scenario) => (
              <div key={scenario.scenarioId} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas p-3 text-xs text-secondary">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-interactive">{scenario.scenarioId}</span>
                    <span className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink">{scenario.category}</span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-5 text-ink">{scenario.query}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-success-soft px-2 py-1 font-mono text-[9px] font-bold text-success">{scenario.expectedNumericalAnswer ?? 'Deterministic / qualitative'}</span>
              </div>
            ))}
          </div>

          <button onClick={() => void handleRunBatch()} disabled={running || !scenarios.length} className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-xs font-bold text-brand-foreground shadow-sm transition hover:bg-brand-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas">
            {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
            <span>{running ? 'Executing benchmark evaluations…' : 'Run Seven-Dimension Batch Benchmark'}</span>
          </button>
        </div>
      </section>

      {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-xs leading-5 text-danger"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      {progress?.status === 'COMPLETED' && stats && (
        <section className="space-y-6 rounded-3xl border border-line bg-surface p-6 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-black text-ink"><CheckCircle2 className="h-4 w-4 text-success" />Systematic Batch Evaluation</h2>
              <p className="mt-1 text-[10px] leading-5 text-secondary">{stats.totalCount} scenarios · {stats.totalDurationMs} ms · {stats.primaryModel} / {stats.secondaryModel} · {stats.regionProfile} profile</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleExportCSV} className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-subtle px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-hover"><FileSpreadsheet className="h-3.5 w-3.5 text-success" />Export CSV</button>
              <button onClick={handleExportJSON} className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-subtle px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-hover"><FileText className="h-3.5 w-3.5 text-interactive" />Export JSON</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Pass Rate" value={`${stats.passedCount}/${stats.totalCount} (${stats.passRatePercent}%)`} tone="success" />
            <Metric label="Avg Reliability" value={`${stats.overallAverageScore}%`} tone="interactive" />
            <Metric label="Avg Numerical Accuracy" value={`${stats.averageNumericalAccuracy}%`} tone="success" />
            <Metric label="Avg Safety Compliance" value={`${stats.averageSafetyScore}%`} tone="success" />
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-2xl border border-line bg-canvas p-3">
              <div className="flex items-center justify-between px-2 pt-1">
                <div>
                  <h3 className="text-xs font-black text-ink">Seven-dimension batch spider chart</h3>
                  <p className="mt-0.5 text-[10px] text-secondary">Average of the real reliability score from every completed scenario.</p>
                </div>
                <ShieldCheck className="h-4 w-4 text-success" />
              </div>
              <ReliabilityRadar primary={stats.averageDimensions || []} primaryLabel="Batch average" />
            </div>

            <div className="space-y-2">
              {(stats.averageDimensions || []).map((dimension) => (
                <div key={dimension.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-ink">{dimension.name}</div>
                    <div className="mt-0.5 text-[10px] leading-4 text-secondary">Average across the completed benchmark run.</div>
                  </div>
                  <span className={`shrink-0 rounded-lg border px-2 py-1 font-mono text-[11px] font-black ${scoreTone(dimension.rawScore)}`}>{dimension.rawScore} / 100</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-black text-ink">Individual Scenario Results</h3>
              <p className="mt-1 text-[10px] text-secondary">Open any scenario to inspect all seven reliability dimensions. Full evidence remains available in Verified Reports.</p>
            </div>
            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {progress.results.map((result) => (
                <details key={result.scenarioId} className="group rounded-xl border border-line bg-canvas p-3 open:border-interactive/30">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-interactive">{result.scenarioId}</span>
                        <span className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink">{result.category}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${result.passed ? 'border-success-fill/30 bg-success-soft text-success' : 'border-danger/30 bg-danger-soft text-danger'}`}>{result.passed ? 'PASSED' : 'FAILED'}</span>
                      </div>
                      <p className="line-clamp-2 text-xs leading-5 text-ink">{result.query}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block text-[9px] uppercase tracking-wider text-secondary">Overall</span>
                      <span className={`font-mono text-sm font-black ${result.overallScore >= 80 ? 'text-success' : result.overallScore >= 60 ? 'text-warning' : 'text-danger'}`}>{result.overallScore}%</span>
                    </div>
                  </summary>
                  <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-4">
                    {(result.dimensions || []).map((dimension) => (
                      <div key={dimension.id} className="rounded-lg border border-line bg-surface px-3 py-2">
                        <div className="text-[9px] font-bold text-secondary">{dimension.name}</div>
                        <div className={`mt-0.5 font-mono text-xs font-black ${dimension.rawScore >= 80 ? 'text-success' : dimension.rawScore >= 60 ? 'text-warning' : 'text-danger'}`}>{dimension.rawScore} / 100</div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; tone: 'success' | 'interactive' }> = ({ label, value, tone }) => (
  <div className="rounded-2xl border border-line bg-canvas p-4 text-center">
    <span className="block text-[10px] text-secondary">{label}</span>
    <span className={`mt-1 block text-lg font-extrabold ${tone === 'success' ? 'text-success' : 'text-interactive'}`}>{value}</span>
  </div>
);
