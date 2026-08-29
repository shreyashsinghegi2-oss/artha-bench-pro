/**
 * Artha Bench - Real Batch Benchmark Execution Engine
 * Runs benchmark scenarios against real dual models and computes real aggregate stats.
 */

import { BENCHMARK_DATASET_V1 } from './data/benchmarks/v1/scenarios';
import { getGroqModels, runMultiModelEvaluation } from './groqService';
import { saveReportRecord, StoredReportRecord } from './reportStorage';
import type { DimensionScoreResult } from './scoringEngine';

export interface BatchScenarioResult {
  scenarioId: string;
  category: string;
  query: string;
  prompt: string;
  passed: boolean;
  pass: boolean;
  overallScore: number;
  verdict: string;
  groundTruthPassed: boolean;
  consensusScore: number;
  safetyScore: number;
  primaryModel: string;
  secondaryModel: string;
  durationMs: number;
  dimensions: DimensionScoreResult[];
}

export interface BatchAggregateStats {
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
  averageDimensions: DimensionScoreResult[];
  totalDurationMs: number;
  modelVersion: string;
  datasetVersion: string;
}

export interface BatchRunProgress {
  runId: string;
  totalScenarios: number;
  completedScenarios: number;
  currentScenarioId?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  results: BatchScenarioResult[];
  aggregateStats?: BatchAggregateStats;
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
    scenariosToRun = BENCHMARK_DATASET_V1.filter((scenario) => scenarioIds.includes(scenario.scenarioId));
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
  const dimensionAccumulator = new Map<string, { template: DimensionScoreResult; total: number }>();

  for (let i = 0; i < scenariosToRun.length; i++) {
    const scenario = scenariosToRun[i];
    runProgress.currentScenarioId = scenario.scenarioId;

    const evalReport = await runMultiModelEvaluation(scenario.prompt, {
      type:
        scenario.category === 'savings'
          ? 'COMPOUND_INTEREST'
          : scenario.category === 'ratios'
            ? 'QUICK_RATIO'
            : scenario.category === 'break_even'
              ? 'BREAK_EVEN'
              : undefined,
      inputs: scenario.inputValues,
      expectedAnswer: scenario.expectedNumericalAnswer,
      tolerancePercent: scenario.tolerancePercent,
      profile: scenario.localizationProfile || profile,
    });

    const isPass = evalReport.verdict === 'HIGHLY_RELIABLE' || evalReport.verdict === 'MODERATE_RELIABILITY';
    if (isPass) passedCount++;

    const numAccScore = evalReport.dimensions.find((dimension) => dimension.id === 'numericalAccuracy')?.rawScore ?? 0;
    const consensusScore = evalReport.dimensions.find((dimension) => dimension.id === 'dualModelConsensus')?.rawScore ?? 0;
    const safetyScore = evalReport.dimensions.find((dimension) => dimension.id === 'safetyCompliance')?.rawScore ?? 0;

    totalAccuracySum += numAccScore;
    totalConsensusSum += consensusScore;
    totalSafetySum += safetyScore;
    totalOverallSum += evalReport.overallScore;

    for (const dimension of evalReport.dimensions) {
      const existing = dimensionAccumulator.get(dimension.id);
      if (existing) existing.total += dimension.rawScore;
      else dimensionAccumulator.set(dimension.id, { template: dimension, total: dimension.rawScore });
    }

    runProgress.results.push({
      scenarioId: scenario.scenarioId,
      category: scenario.category,
      query: scenario.prompt,
      prompt: scenario.prompt,
      passed: isPass,
      pass: isPass,
      overallScore: evalReport.overallScore,
      verdict: evalReport.verdict,
      groundTruthPassed: evalReport.groundTruth.pass,
      consensusScore,
      safetyScore,
      primaryModel: models.primaryModel,
      secondaryModel: models.secondaryModel,
      durationMs: evalReport.executionDurationMs,
      dimensions: evalReport.dimensions,
    });

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
  const averageDimensions = Array.from(dimensionAccumulator.values()).map(({ template, total }) => {
    const rawScore = Math.round(total / count);
    return {
      ...template,
      rawScore,
      weightedScore: Number(((rawScore * template.weight) / 100).toFixed(2)),
      reason: `Average score across ${scenariosToRun.length} benchmark scenario${scenariosToRun.length === 1 ? '' : 's'}.`,
      evidence: [`Aggregated from ${scenariosToRun.length} completed benchmark evaluation${scenariosToRun.length === 1 ? '' : 's'}.`],
      pass: rawScore >= 70,
      limitations: 'This is an aggregate batch score. Open an individual saved report for scenario-specific evidence and reasoning.',
    };
  });

  runProgress.status = 'COMPLETED';
  runProgress.currentScenarioId = undefined;
  runProgress.aggregateStats = {
    totalCount: scenariosToRun.length,
    passedCount,
    failedCount: scenariosToRun.length - passedCount,
    passRatePercent: Math.round((passedCount / count) * 100),
    overallAverageScore: Math.round(totalOverallSum / count),
    averageNumericalAccuracy: Math.round(totalAccuracySum / count),
    averageConsensusScore: Math.round(totalConsensusSum / count),
    averageSafetyScore: Math.round(totalSafetySum / count),
    primaryModel: models.primaryModel,
    secondaryModel: models.secondaryModel,
    regionProfile: profile,
    averageDimensions,
    totalDurationMs,
    modelVersion: `${models.primaryModel} / ${models.secondaryModel}`,
    datasetVersion: 'v1.0.0',
  };

  return runProgress;
}
