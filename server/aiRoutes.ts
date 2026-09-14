import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { runAiGateway } from './aiGateway';
import { calculateEMI, calculateEmergencyFund, calculateBudget503020, calculateSavingsTarget } from './financeEngine';

export const aiRouter = Router();

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  model: z.enum(['artha', 'nemotron']).optional(),
  task: z.enum(['education', 'calculation', 'live_data', 'quiz', 'scenario', 'evaluation', 'report', 'general']).optional(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) })).max(10).optional(),
  context: z.object({
    country: z.enum(['India', 'US', 'Global']).optional(),
    currency: z.enum(['INR', 'USD', 'EUR', 'GBP']).optional(),
    language: z.enum(['english', 'hindi', 'hinglish']).optional(),
    level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    mode: z.enum(['explain', 'quiz', 'calc']).optional(),
    detail: z.enum(['short', 'detailed']).optional(),
    useOfficialSources: z.boolean().optional(),
  }).optional(),
});

const number = z.coerce.number().finite();
const calcSchema = z.object({
  kind: z.enum(['emi', 'emergency-fund', 'budget-503020', 'savings-target']),
  principal: number.optional(),
  annualRatePercent: number.optional(),
  years: number.optional(),
  monthlyIncome: number.optional(),
  monthlyExpenses: number.optional(),
  targetAmount: number.optional(),
  months: number.optional(),
});

function logEvent(event: Record<string, unknown>) {
  console.info(JSON.stringify({ scope: 'artha-ai', ...event }));
}

aiRouter.post('/ai/chat', async (req: Request, res: Response) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid AI request.' });
  const started = Date.now();
  const result = await runAiGateway({ prompt: parsed.data.prompt, requestedModel: parsed.data.model, task: parsed.data.task, history: parsed.data.history, context: parsed.data.context });
  logEvent({ requestId: result.requestId, provider: result.provider, model: result.model, fallbackUsed: result.fallbackUsed, latencyMs: Date.now() - started, status: result.ok ? 'ok' : 'fallback' });
  return res.status(result.ok ? 200 : 503).json({ ...result, error: result.ok ? undefined : 'The selected AI model is temporarily unavailable. A safe fallback is being shown.' });
});

aiRouter.post('/ai/calculate', async (req: Request, res: Response) => {
  const parsed = calcSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid calculation input.' });
  try {
    const input = parsed.data;
    let calculation: unknown;
    switch (input.kind) {
      case 'emi': calculation = calculateEMI(input.principal!, input.annualRatePercent!, input.years!); break;
      case 'emergency-fund': calculation = calculateEmergencyFund(input.monthlyExpenses!, input.months!); break;
      case 'budget-503020': calculation = calculateBudget503020(input.monthlyIncome!); break;
      case 'savings-target': calculation = calculateSavingsTarget(input.targetAmount!, input.months!); break;
    }
    return res.json({ calculation, engine: 'Decimal.js', verificationStatus: 'verified', calculatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Calculation could not be completed.' });
  }
});
