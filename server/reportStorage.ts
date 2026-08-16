/**
 * Artha Bench - Report & Benchmark Run Storage Adapter
 * Provides local storage persistence and export capabilities (JSON, CSV).
 */

import { FullReliabilityEvaluation } from './scoringEngine';

export interface StoredReportRecord {
  reportId: string;
  timestamp: string;
  appVersion: string;
  benchmarkVersion: string;
  modelNames: {
    primaryModel: string;
    secondaryModel: string;
  };
  query: string;
  scenarioId?: string;
  evaluation: FullReliabilityEvaluation;
  reproducibility: {
    temperature: number;
    evaluationProfile: string;
    scoringVersion: string;
    deterministicEngineVersion: string;
  };
}

// In-Memory Storage Buffer with Initial Memory Seeds from previous real executions
const reportsMap = new Map<string, StoredReportRecord>();

/**
 * Saves a new evaluation report record into storage.
 */
export function saveReportRecord(record: StoredReportRecord): StoredReportRecord {
  reportsMap.set(record.reportId, record);
  return record;
}

/**
 * Retrieves all stored report records.
 */
export function getAllReportRecords(): StoredReportRecord[] {
  const list = Array.from(reportsMap.values());
  // Sort descending by timestamp
  list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return list;
}

/**
 * Retrieves a single report record by ID.
 */
export function getReportRecordById(reportId: string): StoredReportRecord | undefined {
  return reportsMap.get(reportId);
}

/**
 * Generates CSV string for reports export.
 */
export function exportReportsToCSV(records: StoredReportRecord[]): string {
  const headers = [
    'ReportID',
    'Timestamp',
    'Query',
    'OverallScore',
    'Verdict',
    'PrimaryModel',
    'SecondaryModel',
    'NumericalAccuracyScore',
    'ConsensusScore',
    'SafetyScore',
    'ExecutionDurationMs',
  ];

  const rows = records.map((r) => [
    r.reportId,
    `"${r.timestamp}"`,
    `"${r.query.replace(/"/g, '""')}"`,
    r.evaluation.overallScore,
    r.evaluation.verdict,
    r.modelNames.primaryModel,
    r.modelNames.secondaryModel,
    r.evaluation.dimensions.find((d) => d.id === 'numericalAccuracy')?.rawScore ?? 0,
    r.evaluation.dimensions.find((d) => d.id === 'dualModelConsensus')?.rawScore ?? 0,
    r.evaluation.dimensions.find((d) => d.id === 'safetyCompliance')?.rawScore ?? 0,
    r.evaluation.executionDurationMs,
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}
