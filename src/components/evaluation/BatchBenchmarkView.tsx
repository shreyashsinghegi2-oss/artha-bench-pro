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
      <div className="bg-[#08080E] border border-[#1A1A23] rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#4F32FF]/20 border border-[#4F32FF]/40 rounded-2xl text-[#665CFF]">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#F7F7FB]">Batch Benchmark Suite V2.0</h1>
              <p className="text-xs text-[#9A9AAA]">
                Execute real deterministic financial test scenarios across dual AI models without hardcoded values.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Globe className="w-4 h-4 text-[#665CFF]" />
            <select
              value={regionProfile}
              onChange={(e) => setRegionProfile(e.target.value as any)}
              className="bg-[#1A1A23] border border-[#2A2A38] text-xs text-[#F7F7FB] px-3 py-1.5 rounded-xl focus:outline-none"
            >
              <option value="India">India Profile (INR, RBI, SEBI)</option>
              <option value="US">US Profile (USD, SEC, FINRA)</option>
              <option value="Global">Global Profile (Universal)</option>
            </select>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#F7F7FB]">
            <span>Benchmark Scenarios ({scenarios.length} Ready)</span>
            <span className="text-[10px] text-[#9A9AAA]">Dataset: ARTHA-V1-BENCHMARK</span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {scenarios.map((s) => (
              <div
                key={s.scenarioId}
                className="p-3 bg-[#030303] border border-[#1A1A23] rounded-xl text-xs text-[#9A9AAA] flex items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#665CFF] font-bold">{s.scenarioId}</span>
                    <span className="text-[10px] bg-[#1A1A23] text-[#F7F7FB] px-1.5 py-0.5 rounded font-mono">
                      {s.category}
                    </span>
                  </div>
                  <p className="text-[#F7F7FB] text-xs line-clamp-1">{s.query}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#1A1A23] text-[#00D68F] font-mono shrink-0">
                  EXPECTED: {s.expectedNumericalAnswer ?? 'Deterministic'}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleRunBatch}
            disabled={running}
            className="px-6 py-2.5 bg-[#4F32FF] hover:bg-[#7137F2] disabled:opacity-50 text-[#F7F7FB] font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-[#4F32FF]/20"
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{running ? `Executing Real Batch (${progress?.completedScenarios}/${progress?.totalScenarios})...` : 'Run Real Batch Benchmark'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[#FF3B65]/10 border border-[#FF3B65]/30 rounded-2xl text-xs text-[#FF3B65] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {progress && progress.status === 'COMPLETED' && progress.aggregateStats && (
        <div className="bg-[#08080E] border border-[#1A1A23] rounded-3xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1A1A23] pb-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#F7F7FB] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#00D68F]" />
                <span>Real Execution Aggregates</span>
              </h3>
              <p className="text-[10px] text-[#9A9AAA]">
                Execution Time: {progress.executionDurationMs}ms | Primary: {progress.aggregateStats.primaryModel} | Secondary: {progress.aggregateStats.secondaryModel}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-[#1A1A23] hover:bg-[#2A2A38] text-[#F7F7FB] text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-[#2A2A38] transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#00D68F]" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={handleExportJSON}
                className="px-3 py-1.5 bg-[#1A1A23] hover:bg-[#2A2A38] text-[#F7F7FB] text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-[#2A2A38] transition-all"
              >
                <FileText className="w-3.5 h-3.5 text-[#665CFF]" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-[#030303] border border-[#1A1A23] rounded-2xl">
              <span className="text-[10px] text-[#9A9AAA] block">Pass Rate</span>
              <span className="text-xl font-extrabold text-[#00D68F]">
                {progress.aggregateStats.passedCount}/{progress.aggregateStats.totalCount} ({progress.aggregateStats.passRatePercent}%)
              </span>
            </div>
            <div className="p-4 bg-[#030303] border border-[#1A1A23] rounded-2xl">
              <span className="text-[10px] text-[#9A9AAA] block">Avg Reliability Score</span>
              <span className="text-xl font-extrabold text-[#665CFF]">
                {progress.aggregateStats.overallAverageScore}%
              </span>
            </div>
            <div className="p-4 bg-[#030303] border border-[#1A1A23] rounded-2xl">
              <span className="text-[10px] text-[#9A9AAA] block">Avg Numerical Accuracy</span>
              <span className="text-xl font-extrabold text-[#00D68F]">
                {progress.aggregateStats.averageNumericalAccuracy}%
              </span>
            </div>
            <div className="p-4 bg-[#030303] border border-[#1A1A23] rounded-2xl">
              <span className="text-[10px] text-[#9A9AAA] block">Safety Compliance</span>
              <span className="text-xl font-extrabold text-[#00D68F]">
                {progress.aggregateStats.averageSafetyScore}%
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#F7F7FB]">Individual Scenario Results</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {progress.results.map((res) => (
                <div
                  key={res.scenarioId}
                  className="p-3 bg-[#030303] border border-[#1A1A23] rounded-xl flex items-center justify-between text-xs text-[#9A9AAA]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-[#665CFF]">{res.scenarioId}</span>
                      <span className="text-[10px] bg-[#1A1A23] text-[#F7F7FB] px-1.5 py-0.5 rounded font-mono">
                        {res.category}
                      </span>
                    </div>
                    <p className="text-[#F7F7FB] text-xs">{res.query}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <div>
                      <span className="block text-[10px] text-[#9A9AAA]">Score</span>
                      <span className="font-bold text-[#F7F7FB]">{res.overallScore}%</span>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        res.passed
                          ? 'bg-[#00D68F]/10 text-[#00D68F] border-[#00D68F]/30'
                          : 'bg-[#FF3B65]/10 text-[#FF3B65] border-[#FF3B65]/30'
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
