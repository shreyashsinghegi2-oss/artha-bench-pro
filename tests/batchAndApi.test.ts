import { describe, it, expect } from 'vitest';
import { executeBatchBenchmark } from '../server/batchBenchmark';
import { BENCHMARK_DATASET_V1 } from '../server/data/benchmarks/v1/scenarios';

describe('Batch Benchmark & Dataset Integration Tests', () => {
  it('loads dataset scenarios correctly', () => {
    expect(BENCHMARK_DATASET_V1.length).toBeGreaterThanOrEqual(10);
    const compoundScen = BENCHMARK_DATASET_V1.find((s) => s.scenarioId === 'SCEN-001');
    expect(compoundScen).toBeDefined();
    expect(compoundScen?.expectedNumericalAnswer).toBe(14176.25);
  });

  it('executes batch benchmark scenarios deterministically and computes aggregates', async () => {
    const progress = await executeBatchBenchmark(['SCEN-001', 'SCEN-003']);
    expect(progress.status).toBe('COMPLETED');
    expect(progress.completedScenarios).toBe(2);
    expect(progress.aggregateStats).toBeDefined();
    expect(progress.aggregateStats?.totalCount).toBe(2);
    expect(progress.aggregateStats?.overallAverageScore).toBeGreaterThan(0);
  });
});
