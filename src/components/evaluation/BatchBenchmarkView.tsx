import React, { useState, useEffect } from 'react';
import { Boxes, Play, RefreshCw, CheckCircle2, AlertTriangle, Download, FileText, FileSpreadsheet, Globe } from 'lucide-react';
import { BatchProgress, BenchmarkScenario } from '../../types';

export const BatchBenchmarkView: React.FC = () => {
  const [scenarios, setScenarios] = useState<BenchmarkScenario[]>([]);
  const [regionProfile, setRegionProfile] = useState<'India' | 'US' | 'Global'>('India');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScenarios();
  }, [regionProfile]);

  const fetchScenarios = async () => {
    try {
      const res = await fetch(`/api/batch/scenarios?region=${regionProfile}`);
      const data = await res.json();
      if (res.ok && data.scenarios) {
        setScenarios(data.scenarios);
      }
    } catch {
      // Fallback
    }
  };

  const handleRunBatch = async () => {
    setRunning(true);
    setError(null);
    setProgress({
      status: 'RUNNING',
      totalScenarios: scenarios.length || 10,
      completedScenarios: 0,
      currentScenarioId: scenarios[0]?.scenarioId,
      results: [],
    });

    try {
      const scenarioIds = scenarios.map((s) => s.scenarioId);
      const res = await fetch('/api/batch/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioIds, regionProfile }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Batch execution failed');

      setProgress(data.progress);
    } catch (err: any) {
      setError(err.message || 'Batch benchmark execution failed');
    } finally {
      setRunning(false);
    }
  };

  const handleExportJSON = () => {
    if (!progress || !progress.aggregateStats) return;
    const jsonStr = JSON.stringify(progress, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arthabench_batch_report_${Date.now()}.json`;
    a.click();
  };

  const handleExportCSV = () => {
    if (!progress || !progress.results) return;
    const headers = 'Scenario ID,Category,Passed,Overall Score,Numerical Score,Consensus Score,Safety Score,Primary Model,Secondary Model\n';
    const rows = progress.results
      .map(
        (r) =>
          `"${r.scenarioId}","${r.category}",${r.passed},${r.overallScore},${r.groundTruthPassed ? 100 : 0},${r.consensusScore},${r.safetyScore},"${r.primaryModel}","${r.secondaryModel}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arthabench_batch_report_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-surface border border-line rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-interactive/20 border border-interactive/40 rounded-2xl text-interactive">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink">Batch Benchmark Suite V2.0</h1>
              <p className="text-xs text-secondary">
                Execute real deterministic financial test scenarios across dual AI models without hardcoded values.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Globe className="w-4 h-4 text-interactive" />
            <select
              value={regionProfile}
              onChange={(e) => setRegionProfile(e.target.value as any)}
              className="bg-surface border border-line-strong text-xs text-ink px-3 py-1.5 rounded-xl focus:outline-none"
            >
              <option value="India">India Profile (INR, RBI, SEBI)</option>
              <option value="US">US Profile (USD, SEC, FINRA)</option>
              <option value="Global">Global Profile (Universal)</option>
            </select>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-ink">
            <span>Benchmark Scenarios ({scenarios.length} Ready)</span>
            <span className="text-[10px] text-secondary">Dataset: ARTHA-V1-BENCHMARK</span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {scenarios.map((s) => (
              <div
                key={s.scenarioId}
                className="p-3 bg-canvas border border-line rounded-xl text-xs text-secondary flex items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-interactive font-bold">{s.scenarioId}</span>
                    <span className="text-[10px] bg-subtle text-ink px-1.5 py-0.5 rounded font-mono">
                      {s.category}
                    </span>
                  </div>
                  <p className="text-ink text-xs line-clamp-1">{s.query}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-subtle text-success font-mono shrink-0">
                  EXPECTED: {s.expectedNumericalAnswer ?? 'Deterministic'}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleRunBatch}
            disabled={running}
            className="px-6 py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-brand-foreground hover:text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas"
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{running ? `Executing Real Batch (${progress?.completedScenarios}/${progress?.totalScenarios})...` : 'Run Real Batch Benchmark'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-2xl text-xs text-danger flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {progress && progress.status === 'COMPLETED' && progress.aggregateStats && (
        <div className="bg-surface border border-line rounded-3xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>Real Execution Aggregates</span>
              </h3>
              <p className="text-[10px] text-secondary">
                Execution Time: {progress.executionDurationMs}ms | Primary: {progress.aggregateStats.primaryModel} | Secondary: {progress.aggregateStats.secondaryModel}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-subtle hover:bg-hover text-ink text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-line-strong transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-success" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={handleExportJSON}
                className="px-3 py-1.5 bg-subtle hover:bg-hover text-ink text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-line-strong transition-all"
              >
                <FileText className="w-3.5 h-3.5 text-interactive" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-canvas border border-line rounded-2xl">
              <span className="text-[10px] text-secondary block">Pass Rate</span>
              <span className="text-xl font-extrabold text-success">
                {progress.aggregateStats.passedCount}/{progress.aggregateStats.totalCount} ({progress.aggregateStats.passRatePercent}%)
              </span>
            </div>
            <div className="p-4 bg-canvas border border-line rounded-2xl">
              <span className="text-[10px] text-secondary block">Avg Reliability Score</span>
              <span className="text-xl font-extrabold text-interactive">
                {progress.aggregateStats.overallAverageScore}%
              </span>
            </div>
            <div className="p-4 bg-canvas border border-line rounded-2xl">
              <span className="text-[10px] text-secondary block">Avg Numerical Accuracy</span>
              <span className="text-xl font-extrabold text-success">
                {progress.aggregateStats.averageNumericalAccuracy}%
              </span>
            </div>
            <div className="p-4 bg-canvas border border-line rounded-2xl">
              <span className="text-[10px] text-secondary block">Safety Compliance</span>
              <span className="text-xl font-extrabold text-success">
                {progress.aggregateStats.averageSafetyScore}%
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-ink">Individual Scenario Results</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {progress.results.map((res) => (
                <div
                  key={res.scenarioId}
                  className="p-3 bg-canvas border border-line rounded-xl flex items-center justify-between text-xs text-secondary"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-interactive">{res.scenarioId}</span>
                      <span className="text-[10px] bg-subtle text-ink px-1.5 py-0.5 rounded font-mono">
                        {res.category}
                      </span>
                    </div>
                    <p className="text-ink text-xs">{res.query}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <div>
                      <span className="block text-[10px] text-secondary">Score</span>
                      <span className="font-bold text-ink">{res.overallScore}%</span>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        res.passed
                          ? 'bg-success-fill/10 text-success border-success-fill/30'
                          : 'bg-danger/10 text-danger border-danger/30'
                      }`}
                    >
                      {res.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
