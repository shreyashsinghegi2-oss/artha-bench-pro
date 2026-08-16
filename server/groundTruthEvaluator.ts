/**
 * Artha Bench - Ground Truth Numerical Evaluator
 * Compares model outputs against deterministic finance engine ground truths.
 * Never allows an LLM to grade its own math.
 */

import {
  calculateCompoundInterest,
  calculateCAGR,
  calculateQuickRatio,
  calculateBreakEven,
  calculateDTI,
} from './financeEngine';
import { DEFAULT_TOLERANCE_PERCENT } from './scoringConfig';

export interface GroundTruthEvaluationResult {
  hasNumericalCheck: boolean;
  expectedResult?: number;
  aiResult?: number;
  numericalErrorPercent?: number;
  allowedTolerancePercent: number;
  formulaCorrectness: boolean;
  pass: boolean;
  explanation: string;
}

export function extractFinalNumericValue(text: string): number | undefined {
  if (!text) return undefined;
  // Match currency values or percentage numbers, e.g. $14,176.25, 14176.25, 7.2%, etc.
  const regex = /(?:[\$\₹]\s*)?(-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|\.\d+)/g;
  const matches = [...text.matchAll(regex)];
  if (matches.length === 0) return undefined;

  // Search from the end for the last declared number or result statement
  for (let i = matches.length - 1; i >= 0; i--) {
    const rawVal = matches[i][1].replace(/,/g, '');
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed) && isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

/**
 * Independently calculates expected ground truth and checks AI output against it.
 */
export function evaluateGroundTruth(
  query: string,
  aiResponseText: string,
  scenarioContext?: {
    type?: 'COMPOUND_INTEREST' | 'CAGR' | 'QUICK_RATIO' | 'BREAK_EVEN' | 'DTI';
    inputs?: any;
    expectedAnswer?: number;
    tolerancePercent?: number;
  }
): GroundTruthEvaluationResult {
  const tolerance = scenarioContext?.tolerancePercent ?? DEFAULT_TOLERANCE_PERCENT;

  let expectedResult: number | undefined = scenarioContext?.expectedAnswer;

  // Auto-detect financial equation type if not supplied in scenarioContext
  if (expectedResult === undefined) {
    const lower = query.toLowerCase();

    // Check for Compound Interest inputs in query
    if (lower.includes('compound interest') || lower.includes('compounded')) {
      const pMatch = query.match(/[\$\₹]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:principal|at|for)/i) || query.match(/[\$\₹]\s*(\d+(?:,\d{3})*(?:\.\d+)?)/);
      const rMatch = query.match(/(\d+(?:\.\d+)?)\s*%/);
      const tMatch = query.match(/(\d+)\s*years/i);

      if (pMatch && rMatch && tMatch) {
        const principal = parseFloat(pMatch[1].replace(/,/g, ''));
        const rate = parseFloat(rMatch[1]);
        const years = parseFloat(tMatch[1]);
        const res = calculateCompoundInterest(principal, rate, years, 0, 12);
        expectedResult = res.finalBalance;
      }
    } else if (lower.includes('quick ratio')) {
      const cashMatch = query.match(/[\$\₹]\s*(\d+(?:,\d{3})*)\s*cash/i) || query.match(/cash.*[\$\₹]\s*(\d+(?:,\d{3})*)/i);
      const liabMatch = query.match(/[\$\₹]\s*(\d+(?:,\d{3})*)\s*liabilities/i) || query.match(/liabilities.*[\$\₹]\s*(\d+(?:,\d{3})*)/i);

      if (cashMatch && liabMatch) {
        const cash = parseFloat(cashMatch[1].replace(/,/g, ''));
        const liab = parseFloat(liabMatch[1].replace(/,/g, ''));
        const res = calculateQuickRatio(cash, 0, 0, liab);
        expectedResult = res.quickRatio;
      }
    }
  }

  if (expectedResult === undefined) {
    return {
      hasNumericalCheck: false,
      allowedTolerancePercent: tolerance,
      formulaCorrectness: true,
      pass: true,
      explanation: 'No explicit numerical ground truth equation applicable for this qualitative query.',
    };
  }

  const aiResult = extractFinalNumericValue(aiResponseText);

  if (aiResult === undefined) {
    return {
      hasNumericalCheck: true,
      expectedResult,
      allowedTolerancePercent: tolerance,
      formulaCorrectness: false,
      pass: false,
      explanation: `Expected ground truth value ${expectedResult}, but failed to extract a valid numeric final answer from AI response.`,
    };
  }

  const diff = Math.abs(aiResult - expectedResult);
  const errorPercent = expectedResult !== 0 ? (diff / Math.abs(expectedResult)) * 100 : diff;
  const pass = errorPercent <= tolerance;

  return {
    hasNumericalCheck: true,
    expectedResult,
    aiResult,
    numericalErrorPercent: Math.round(errorPercent * 100) / 100,
    allowedTolerancePercent: tolerance,
    formulaCorrectness: pass,
    pass,
    explanation: pass
      ? `AI result (${aiResult}) matches ground truth (${expectedResult}) within ${errorPercent.toFixed(2)}% error (tolerance ${tolerance}%).`
      : `AI result (${aiResult}) deviates from ground truth (${expectedResult}) by ${errorPercent.toFixed(2)}% (allowed ${tolerance}%).`,
  };
}
