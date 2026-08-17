/**
 * Artha Bench - Real Batch Benchmark Execution Engine
 * Runs benchmark scenarios against real dual models and computes real aggregate stats.
 */

import { BENCHMARK_DATASET_V1, BenchmarkScenario } from './data/benchmarks/v1/scenarios';
import { getGroqModels, runMultiModelEvaluation } from './groqService';
import { saveReportRecord, StoredReportRecord } from './reportStorage';

export interface BatchRunProgress {
  runId: string;
  totalScenarios: number;
  completedScenarios: number;
  currentScenarioId?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  results: Array<{
    scenarioId: string;
    prompt: string;
    overallScore: number;
    verdict: string;
    pass: boolean;
    durationMs: number;
  }>;
  aggregateStats?: {
    totalCount: number;
    passedCount: number;
    failedCount: number;
    averageAccuracy: number;
    averageConsensus: number;
    safetyComplianceRate: number;
    overallAverageScore: number;
    totalDurationMs: number;
    modelVersion: string;
    datasetVersion: string;
  };
}

const activeRuns = new Map<string, BatchRunProgress>();

export function getBatchRunProgress(runId: string): BatchRunProgress | undefined {
  return activeRuns.get(runId);
}

/**
 * Executes a batch benchmark run across dataset scenarios.
 */
export async function executeBatchBenchmark(
  scenarioIds?: string[],
  profile: 'India' | 'US' | 'Global' = 'US'
): Promise<BatchRunProgress> {
  const runId = `batch-${Date.now()}`;
  let scenariosToRun = BENCHMARK_DATASET_V1;

  if (scenarioIds && scenarioIds.length > 0) {
    scenariosToRun = BENCHMARK_DATASET_V1.filter((s) => scenarioIds.includes(s.scenarioId));
  }

  const runProgress: BatchRunProgress = {
    runId,
    totalScenarios: scenariosToRun.length,
    completedScenarios: 0,
    status: 'RUNNING',
    results: [],
  };

  activeRuns.set(runId, runProgress);

  const startTime = Date.now();
  const models = getGroqModels();
  let totalAccuracySum = 0;
  let totalConsensusSum = 0;
  let totalSafetySum = 0;
  let totalOverallSum = 0;
  let passedCount = 0;

  for (let i = 0; i < scenariosToRun.length; i++) {
    const scenario = scenariosToRun[i];
    runProgress.currentScenarioId = scenario.scenarioId;

    const evalReport = await runMultiModelEvaluation(scenario.prompt, {
      type: scenario.category === 'savings' ? 'COMPOUND_INTEREST' : scenario.category === 'ratios' ? 'QUICK_RATIO' : undefined,
      expectedAnswer: scenario.expectedNumericalAnswer,
      tolerancePercent: scenario.tolerancePercent,
      profile: scenario.localizationProfile || profile,
    });

    const isPass = evalReport.verdict === 'HIGHLY_RELIABLE' || evalReport.verdict === 'MODERATE_RELIABILITY';
    if (isPass) passedCount++;

    const numAccScore = evalReport.dimensions.find((d) => d.id === 'numericalAccuracy')?.rawScore ?? 0;
    const consensusScore = evalReport.dimensions.find((d) => d.id === 'dualModelConsensus')?.rawScore ?? 0;
    const safetyScore = evalReport.dimensions.find((d) => d.id === 'safetyCompliance')?.rawScore ?? 0;

    totalAccuracySum += numAccScore;
    totalConsensusSum += consensusScore;
    totalSafetySum += safetyScore;
    totalOverallSum += evalReport.overallScore;

    runProgress.results.push({
      scenarioId: scenario.scenarioId,
      prompt: scenario.prompt,
      overallScore: evalReport.overallScore,
      verdict: evalReport.verdict,
      pass: isPass,
      durationMs: evalReport.executionDurationMs,
    });

    // Save report record
    const record: StoredReportRecord = {
      reportId: `REPORT-${scenario.scenarioId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      appVersion: '2.0.0',
      benchmarkVersion: scenario.version,
      modelNames: {
        primaryModel: models.primaryModel,
        secondaryModel: models.secondaryModel,
      },
      query: scenario.prompt,
      scenarioId: scenario.scenarioId,
      evaluation: evalReport,
      reproducibility: {
        temperature: 0.2,
        evaluationProfile: scenario.localizationProfile || profile,
        scoringVersion: '7-Dim-V1',
        deterministicEngineVersion: 'Decimal.js-2.0',
      },
    };
    saveReportRecord(record);

    runProgress.completedScenarios = i + 1;
  }

  const totalDurationMs = Date.now() - startTime;
  const count = scenariosToRun.length || 1;

  runProgress.status = 'COMPLETED';
  runProgress.aggregateStats = {
    totalCount: scenariosToRun.length,
    passedCount,
    failedCount: scenariosToRun.length - passedCount,
    averageAccuracy: Math.round(totalAccuracySum / count),
    averageConsensus: Math.round(totalConsensusSum / count),
    safetyComplianceRate: Math.round(totalSafetySum / count),
    overallAverageScore: Math.round(totalOverallSum / count),
    totalDurationMs,
    modelVersion: `${models.primaryModel} / ${models.secondaryModel}`,
    datasetVersion: 'v1.0.0',
  };

  return runProgress;
}
