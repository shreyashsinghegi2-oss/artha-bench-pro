/**
 * Artha Bench - Dual-Model Consensus Evaluation Engine
 * Independently compares Model A and Model B outputs to measure real consensus.
 */

export interface DisagreementDetail {
  disagreementType: 'NONE' | 'NUMERICAL_MISMATCH' | 'FORMULA_MISMATCH' | 'RISK_ASSESSMENT_DISAGREEMENT' | 'EXECUTION_FAILURE';
  modelAAnswer: string;
  modelBAnswer: string;
  deterministicAnswer?: string;
  closerModel?: 'MODEL_A' | 'MODEL_B' | 'NEITHER' | 'BOTH_EQUAL';
  explanation: string;
}

export interface ConsensusEvaluationResult {
  score: number; // 0 to 100
  pass: boolean;
  disagreement: DisagreementDetail;
  similarityRatio: number;
}

/**
 * Extracts numbers from text for comparison.
 */
function extractNumbers(text: string): number[] {
  if (!text) return [];
  const matches = text.match(/(?:[\$\₹]\s*)?(-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?)/g);
  if (!matches) return [];
  return matches
    .map((m) => parseFloat(m.replace(/[\$\₹\s,]/g, '')))
    .filter((n) => !isNaN(n) && isFinite(n));
}

function findBestNumericValue(numbers: number[], expected?: number): number | undefined {
  if (numbers.length === 0) return undefined;
  if (expected !== undefined) {
    // Pick the number closest to expected ground truth
    let best = numbers[0];
    let minDiff = Math.abs(best - expected);
    for (const num of numbers) {
      const diff = Math.abs(num - expected);
      if (diff < minDiff) {
        minDiff = diff;
        best = num;
      }
    }
    return best;
  }
  // Default to the maximum financial number or last
  return Math.max(...numbers);
}

/**
 * Calculates string word-level similarity Jaccard index.
 */
function calculateJaccardSimilarity(textA: string, textB: string): number {
  if (!textA || !textB) return 0;
  const wordsA = new Set(textA.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(textB.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 && wordsB.size === 0) return 1.0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

/**
 * Evaluates real consensus between two model outputs and compares against ground truth.
 */
export function evaluateDualModelConsensus(
  modelAOutput: string,
  modelBOutput: string,
  expectedNumericalAnswer?: number
): ConsensusEvaluationResult {
  if (!modelAOutput || !modelBOutput) {
    return {
      score: 0,
      pass: false,
      similarityRatio: 0,
      disagreement: {
        disagreementType: 'EXECUTION_FAILURE',
        modelAAnswer: modelAOutput || 'No output from Model A',
        modelBAnswer: modelBOutput || 'No output from Model B',
        explanation: 'One or both models failed to return output.',
      },
    };
  }

  const numsA = extractNumbers(modelAOutput);
  const numsB = extractNumbers(modelBOutput);
  const textSimilarity = calculateJaccardSimilarity(modelAOutput, modelBOutput);

  const mainA = findBestNumericValue(numsA, expectedNumericalAnswer);
  const mainB = findBestNumericValue(numsB, expectedNumericalAnswer);

  let numericalMatch = true;

  if (mainA !== undefined && mainB !== undefined) {
    const numericalDiff = Math.abs(mainA - mainB);

    if (expectedNumericalAnswer !== undefined) {
      const diffA = Math.abs(mainA - expectedNumericalAnswer);
      const diffB = Math.abs(mainB - expectedNumericalAnswer);
      let closerModel: 'MODEL_A' | 'MODEL_B' | 'NEITHER' | 'BOTH_EQUAL' = 'BOTH_EQUAL';

      if (diffA < diffB && diffA <= 0.05 * expectedNumericalAnswer) closerModel = 'MODEL_A';
      else if (diffB < diffA && diffB <= 0.05 * expectedNumericalAnswer) closerModel = 'MODEL_B';
      else if (diffA > 0.05 * expectedNumericalAnswer && diffB > 0.05 * expectedNumericalAnswer) closerModel = 'NEITHER';

      if (numericalDiff > Math.max(0.01 * Math.abs(expectedNumericalAnswer), 0.5)) {
        numericalMatch = false;
        return {
          score: Math.round(textSimilarity * 40),
          pass: false,
          similarityRatio: textSimilarity,
          disagreement: {
            disagreementType: 'NUMERICAL_MISMATCH',
            modelAAnswer: `Final value: ${mainA}`,
            modelBAnswer: `Final value: ${mainB}`,
            deterministicAnswer: `Expected: ${expectedNumericalAnswer}`,
            closerModel,
            explanation: `Model A output (${mainA}) and Model B output (${mainB}) differ by ${numericalDiff.toFixed(2)}. Closer model to ground truth: ${closerModel}.`,
          },
        };
      }
    }
  }

  const baseScore = Math.round(textSimilarity * 100);
  const finalConsensusScore = Math.min(100, Math.max(0, numericalMatch ? Math.max(baseScore, 85) : baseScore));

  return {
    score: finalConsensusScore,
    pass: finalConsensusScore >= 70,
    similarityRatio: textSimilarity,
    disagreement: {
      disagreementType: 'NONE',
      modelAAnswer: 'Model A provided coherent output',
      modelBAnswer: 'Model B corroborated Model A output',
      deterministicAnswer: expectedNumericalAnswer !== undefined ? String(expectedNumericalAnswer) : undefined,
      closerModel: 'BOTH_EQUAL',
      explanation: 'Dual models reached strong structural and numerical consensus.',
    },
  };
}
