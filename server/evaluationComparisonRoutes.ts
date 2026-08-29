import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { callGroqChat, getGroqModels } from './groqService';
import { computeFullReliabilityEvaluation, FullReliabilityEvaluation } from './scoringEngine';

export const evaluationComparisonRouter = Router();

const profileSchema = z.enum(['India', 'US', 'Global']).default('US');

const suppliedResponseSchema = z.object({
  query: z.string().trim().min(3, 'Financial question or evaluation instruction is required.').max(4000),
  response: z.string().trim().min(3, 'A response or uploaded text is required for evaluation.').max(12000),
  profile: profileSchema.optional(),
});

const comparisonSchema = z.object({
  query: z.string().trim().min(3, 'Shared financial question is required.').max(4000),
  responseA: z.string().trim().min(3, 'Response A is required.').max(12000),
  responseB: z.string().trim().min(3, 'Response B is required.').max(12000),
  profile: profileSchema.optional(),
});

function buildSuggestions(report: FullReliabilityEvaluation) {
  return [...report.dimensions]
    .sort((a, b) => a.rawScore - b.rawScore)
    .filter((dimension) => dimension.rawScore < 85)
    .slice(0, 4)
    .map((dimension) => `${dimension.name}: ${dimension.limitations || dimension.reason}`);
}

function buildComparisonReasons(
  winner: 'A' | 'B' | 'tie',
  reportA: FullReliabilityEvaluation,
  reportB: FullReliabilityEvaluation,
) {
  if (winner === 'tie') {
    return ['The overall reliability scores are effectively equal; review the seven dimension scores and evidence before preferring one response.'];
  }

  const preferred = winner === 'A' ? reportA : reportB;
  const other = winner === 'A' ? reportB : reportA;
  const otherMap = new Map(other.dimensions.map((dimension) => [dimension.id, dimension]));
  const reasons = preferred.dimensions
    .map((dimension) => {
      const comparison = otherMap.get(dimension.id);
      const difference = dimension.rawScore - (comparison?.rawScore ?? 0);
      return { dimension, difference };
    })
    .filter(({ difference }) => difference >= 3)
    .sort((a, b) => b.difference - a.difference)
    .slice(0, 4)
    .map(({ dimension, difference }) => `${dimension.name} is ${Math.round(difference)} points stronger (${Math.round(dimension.rawScore)}/100): ${dimension.reason}`);

  if (preferred.groundTruth.hasNumericalCheck && preferred.groundTruth.pass && !other.groundTruth.pass) {
    reasons.unshift(`Its numerical result matches the deterministic ground truth within the configured ${preferred.groundTruth.allowedTolerancePercent}% tolerance, while the other response does not.`);
  }

  if (!reasons.length) {
    reasons.push(`Response ${winner} has the higher weighted reliability score (${preferred.overallScore}/100 versus ${other.overallScore}/100) under the current seven-dimension methodology.`);
  }
  return reasons.slice(0, 5);
}

async function buildIndependentReference(query: string, profile: 'India' | 'US' | 'Global') {
  const models = getGroqModels();
  return callGroqChat(
    `You are the independent educational verifier for Artha Bench Pro. Produce an accurate, concise reference answer for the supplied financial question. Show relevant formulas and assumptions when numerical work is present. Respect the ${profile} context. Do not make guaranteed-return claims or present personalized investment, tax, legal, or lending advice. This answer is used only as an independent comparison signal; deterministic calculations remain the source of truth for exact math.`,
    query,
    models.secondaryModel,
  );
}

evaluationComparisonRouter.post('/evaluate-response', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = suppliedResponseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid evaluation input.' });

    const { query, response } = parsed.data;
    const profile = parsed.data.profile || 'US';
    const startedAt = Date.now();
    const independentReference = await buildIndependentReference(query, profile);
    const report = computeFullReliabilityEvaluation(
      query,
      response,
      independentReference,
      startedAt,
      { profile },
    );

    res.json({
      report,
      evaluationMode: 'supplied_response',
      independentReference,
      disclaimer: 'Educational and research evaluation only — not financial, investment, tax, or legal advice.',
    });
  } catch (error) {
    next(error);
  }
});

evaluationComparisonRouter.post('/compare-responses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = comparisonSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid comparison input.' });

    const { query, responseA, responseB } = parsed.data;
    const profile = parsed.data.profile || 'US';
    const reportA = computeFullReliabilityEvaluation(query, responseA, responseB, Date.now(), { profile });
    const reportB = computeFullReliabilityEvaluation(query, responseB, responseA, Date.now(), { profile });
    const difference = reportA.overallScore - reportB.overallScore;
    const winner: 'A' | 'B' | 'tie' = Math.abs(difference) < 1 ? 'tie' : difference > 0 ? 'A' : 'B';

    res.json({
      reportA,
      reportB,
      comparison: {
        winner,
        scoreA: reportA.overallScore,
        scoreB: reportB.overallScore,
        whyBetter: buildComparisonReasons(winner, reportA, reportB),
        suggestionsA: buildSuggestions(reportA),
        suggestionsB: buildSuggestions(reportB),
      },
      disclaimer: 'Educational and research comparison only — not financial, investment, tax, or legal advice.',
    });
  } catch (error) {
    next(error);
  }
});
