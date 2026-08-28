import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { callGroqStructuredFinancialAnswer, getGroqModels } from './groqService';
import {
  buildStructuredFinancialAnswerInstructions,
  createFallbackStructuredFinancialAnswer,
  serializeStructuredFinancialAnswer,
} from './aiResponseStandard';
import { checkPromptSafety } from './safetyChecker';

export const personalAccountRouter = Router();

const contextSettingsSchema = z.object({
  personalFinance: z.boolean(),
  budgetsAndGoals: z.boolean(),
  paperPortfolio: z.boolean(),
  learningProgress: z.boolean(),
  saveConversation: z.boolean().optional(),
});

const personalizedAssistantSchema = z.object({
  question: z.string().min(3).max(1200),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) })).max(10).optional(),
  settings: contextSettingsSchema,
  publicContext: z.object({
    capturedAt: z.string().max(64),
    selectedSymbol: z.string().min(1).max(20),
    selectedRange: z.string().min(1).max(8),
    selectedCountry: z.enum(['us', 'india']),
    quotes: z.array(z.object({ symbol: z.string(), price: z.number(), changePercent: z.number().nullable(), freshness: z.string(), providerName: z.string() })).max(8),
    economicIndicators: z.array(z.object({ label: z.string(), value: z.number().nullable(), unit: z.string(), date: z.string().nullable(), sourceName: z.string(), status: z.string() })).max(30),
    latestEvaluation: z.any().nullable().optional(),
  }),
});

type VerifiedUser = { id: string; email?: string };

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, anonKey, serviceRole };
}

function bearer(req: Request): string | null {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

async function verifyUser(token: string): Promise<VerifiedUser> {
  const { url, anonKey } = supabaseConfig();
  if (!url || !anonKey) throw new Error('Personal account services are not configured.');
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) throw new Error('Your account session is invalid or expired.');
  return payload as VerifiedUser;
}

async function fetchWorkspace(token: string): Promise<Record<string, string | null>> {
  const { url, anonKey } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/user_workspace_state?select=storage_key,payload`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error('Personal workspace could not be loaded.');
  return Object.fromEntries((Array.isArray(rows) ? rows : []).map((row: any) => [row.storage_key, row.payload]));
}

function parsePayload(workspace: Record<string, string | null>, key: string): any | null {
  try { return workspace[key] ? JSON.parse(workspace[key] as string) : null; } catch { return null; }
}

function buildPersonalContext(workspace: Record<string, string | null>, settings: z.infer<typeof contextSettingsSchema>) {
  const context: Record<string, unknown> = {};
  const references: string[] = [];

  if (settings.personalFinance) {
    const income = parsePayload(workspace, 'artha_income_sources_v1');
    const expenses = parsePayload(workspace, 'artha_expenses_v1');
    const sources = Array.isArray(income?.sources) ? income.sources.slice(0, 80).map((item: any) => ({ type: item.type, amount: item.amount, currency: item.currency, frequency: item.frequency, description: item.description, startDate: item.startDate, endDate: item.endDate ?? null })) : [];
    const records = Array.isArray(expenses?.records) ? expenses.records.slice(-150).map((item: any) => ({ amount: item.amount, category: item.category, date: item.date, merchant: item.merchant, paymentMethod: item.paymentMethod, recurring: item.recurring })) : [];
    context.income = sources;
    context.expenses = records;
    if (sources.length) references.push(`Income: ${sources.length} recorded source${sources.length === 1 ? '' : 's'}`);
    if (records.length) {
      const dates = records.map((item: any) => item.date).filter(Boolean).sort();
      references.push(`Expenses: ${dates[0] || 'date unavailable'}–${dates.at(-1) || 'date unavailable'}; ${records.length} records`);
    }
  }

  if (settings.budgetsAndGoals) {
    const budgets = parsePayload(workspace, 'artha_budgets_v1');
    const items = Array.isArray(budgets?.budgets) ? budgets.budgets.slice(-24).map((budget: any) => ({ name: budget.name, month: budget.month, savingsTarget: budget.savingsTarget, notes: budget.notes, categories: budget.categories })) : [];
    context.budgets = items;
    if (items.length) references.push(`Budgets: ${items.length} saved plan${items.length === 1 ? '' : 's'}`);
  }

  if (settings.paperPortfolio) {
    const portfolio = parsePayload(workspace, 'artha_paper_portfolio_v1');
    if (portfolio) {
      context.paperPortfolio = { cashBalance: portfolio.cashBalance, initialBalance: portfolio.initialBalance, positions: Array.isArray(portfolio.positions) ? portfolio.positions : [], trades: Array.isArray(portfolio.trades) ? portfolio.trades.slice(0, 50) : [] };
      references.push(`Paper portfolio: ${Array.isArray(portfolio.positions) ? portfolio.positions.length : 0} positions; ${Array.isArray(portfolio.trades) ? portfolio.trades.length : 0} trades`);
    }
  }

  if (settings.learningProgress) {
    const progress = parsePayload(workspace, 'artha_learning_progress_v1');
    if (progress) {
      context.learningProgress = { completedLessonIds: progress.completedLessonIds ?? [], quizScores: progress.quizScores ?? {}, bookmarkedLessonIds: progress.bookmarkedLessonIds ?? [], lastActiveLessonId: progress.lastActiveLessonId ?? null, streakDays: progress.streakDays ?? 0, lastActiveDate: progress.lastActiveDate ?? null };
      references.push(`Learning: ${Array.isArray(progress.completedLessonIds) ? progress.completedLessonIds.length : 0} completed lessons`);
    }
  }

  return { context, references };
}

personalAccountRouter.post('/personal/assistant', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = personalizedAssistantSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'A valid personalized assistant request is required.' });
    const token = bearer(req);
    if (!token) return res.status(401).json({ error: 'Sign in to use personal ArthaMind context.' });
    const user = await verifyUser(token);
    const safety = checkPromptSafety(parsed.data.question);
    if (!safety.safe) return res.status(400).json({ error: safety.reason, safety });

    const directAdvicePattern = /\b(should i|would you|do you recommend|tell me (?:whether|if) to)\b.{0,80}\b(buy|sell|hold|invest)\b|\b(target price|trade signal|guaranteed return)\b/i;
    if (directAdvicePattern.test(parsed.data.question)) return res.status(400).json({ error: 'ArthaMind can explain your recorded data and educational trade-offs, but cannot provide personalized buy/sell/hold instructions, target prices, or guaranteed outcomes.' });

    const workspace = await fetchWorkspace(token);
    const { context: personalContext, references } = buildPersonalContext(workspace, parsed.data.settings);
    const personalDataUsed = Object.keys(personalContext).length > 0;
    const publicContext = parsed.data.publicContext;
    const groundedContext = { publicDashboard: publicContext, authorizedPersonalContext: personalContext };

    const systemPrompt = `You are ArthaMind, the evidence-grounded financial-intelligence assistant inside Artha Bench Pro.\n\nRules:\n1. Use only the supplied public dashboard snapshot and authorized personal context for specific personal facts. Never invent a transaction, income amount, balance, budget, holding, goal, or learning event.\n2. If requested personal data is absent, say there is insufficient recorded data and name the next useful record/action.\n3. State the data period or record context used when relevant. Distinguish recorded facts, calculations, and educational suggestions.\n4. Never provide personalized investment instructions, guaranteed outcomes, regulated financial advice, tax advice, or legal advice.\n5. Suggestions must be practical educational guidance, with INR context when the recorded values use INR.\n6. Do not infer disabled personal data sources.\n${buildStructuredFinancialAnswerInstructions({ audience: 'dashboard', language: 'English', level: 'beginner', detail: 'detailed', hasVerifiedCurrentData: publicContext.quotes.length > 0 || personalDataUsed })}`;
    const userPrompt = `Question: ${parsed.data.question}\nAuthenticated user id: ${user.id}\nGrounded context:\n${JSON.stringify(groundedContext)}`;
    const demoMode = !process.env.GROQ_API_KEY?.trim();
    const fallback = personalDataUsed
      ? `I found authorized personal context for this account (${references.join('; ')}). The live AI model is not configured, so I will not invent an interpretation. Review the recorded values in the relevant workspace or configure the AI provider for grounded natural-language analysis.`
      : 'There is not enough authorized personal data in the enabled context to answer this as a personal-data question. Add records or enable the relevant AI Data Context source; I will not invent missing values.';
    const structuredAnswer = demoMode
      ? createFallbackStructuredFinancialAnswer(parsed.data.question, fallback)
      : await callGroqStructuredFinancialAnswer(systemPrompt, userPrompt, { history: parsed.data.history, fallbackQuestion: parsed.data.question });
    const answer = serializeStructuredFinancialAnswer(structuredAnswer);
    const sourceLabels = Array.from(new Set([
      ...publicContext.quotes.map((quote) => quote.providerName),
      ...publicContext.economicIndicators.map((indicator) => indicator.sourceName),
      ...(personalDataUsed ? ['My authorized Artha Bench workspace'] : []),
    ]));

    res.json({
      answer,
      structuredAnswer,
      provider: demoMode ? 'demo' : 'groq',
      model: demoMode ? null : getGroqModels().tutorModel,
      groundedAt: publicContext.capturedAt,
      sourceLabels,
      suggestedQuestions: ['Where did I spend the most in my recorded expenses?', 'Which saved budget category is closest to its limit?', 'Summarize my recorded income and expenses.', 'What should I learn next from my saved learning progress?'],
      disclaimer: 'Educational analysis only — not investment, tax, legal, or financial advice.',
      personalDataUsed,
      personalContextReferences: references,
      requestId: res.getHeader('x-request-id'),
    });
  } catch (error) { next(error); }
});

personalAccountRouter.delete('/account/delete', async (req: Request, res: Response) => {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const user = await verifyUser(token);
    const { url, serviceRole } = supabaseConfig();
    if (!url || !serviceRole) return res.status(503).json({ error: 'Account deletion is not configured. SUPABASE_SERVICE_ROLE_KEY is required on the server.' });
    const response = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: payload?.message || 'Account deletion failed.' });
    return res.json({ deleted: true });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : 'Account deletion failed.' });
  }
});
