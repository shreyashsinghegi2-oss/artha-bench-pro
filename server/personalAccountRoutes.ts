import { Router, Request, Response } from 'express';
import Decimal from 'decimal.js';
import { z } from 'zod';
import { callGroqStructuredFinancialAnswer, getGroqModels } from './groqService';
import {
  buildStructuredFinancialAnswerInstructions,
  createFallbackStructuredFinancialAnswer,
  serializeStructuredFinancialAnswer,
} from './aiResponseStandard';
import { checkPromptSafety } from './safetyChecker';

export const personalAccountRouter = Router();

const DEFAULT_SUPABASE_URL = 'https://agjbvoosukxfvrritgto.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_KOdXB7LW5Ho5hDjsi3GMiw_xdogy5oR';

const contextSettingsSchema = z.object({
  income: z.boolean().optional(),
  expenses: z.boolean().optional(),
  budgets: z.boolean().optional(),
  emis: z.boolean().optional(),
  goals: z.boolean().optional(),
  personalFinance: z.boolean().optional(),
  budgetsAndGoals: z.boolean().optional(),
  paperPortfolio: z.boolean().optional(),
  learningProgress: z.boolean().optional(),
  saveConversation: z.boolean().optional(),
});

type ContextSettings = z.infer<typeof contextSettingsSchema>;

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
    marketHistory: z.object({
      symbol: z.string(),
      range: z.string(),
      pointCount: z.number(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      startPrice: z.number().nullable(),
      latestPrice: z.number().nullable(),
      high: z.number().nullable(),
      low: z.number().nullable(),
      returnPercent: z.number().nullable(),
    }).nullable().optional(),
    economicIndicators: z.array(z.object({ label: z.string(), value: z.number().nullable(), unit: z.string(), date: z.string().nullable(), sourceName: z.string(), status: z.string() })).max(30),
    providerHealth: z.object({
      connected: z.number(),
      total: z.number(),
      connectedProviders: z.array(z.string()).max(30),
      unavailableProviders: z.array(z.string()).max(30),
    }).optional(),
    latestEvaluation: z.any().nullable().optional(),
  }),
});

const replayChangesSchema = z.object({
  monthlyIncomeDelta: z.number().min(-100000000).max(100000000).default(0),
  expenseReductionPercent: z.number().min(0).max(100).default(0),
  additionalMonthlyExpense: z.number().min(0).max(100000000).default(0),
  newMonthlyEmi: z.number().min(0).max(100000000).default(0),
  savingsTargetDelta: z.number().min(-100000000).max(100000000).default(0),
});

const decisionReplaySchema = z.object({
  horizonMonths: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
  changes: replayChangesSchema,
  explain: z.boolean().optional().default(false),
});

type VerifiedUser = { id: string; email?: string };

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, anonKey, serviceRole };
}

function bearer(req: Request): string | null {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

async function verifyUser(token: string): Promise<VerifiedUser> {
  const { url, anonKey } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) throw new Error('Your account session is invalid or expired. Sign in again and retry.');
  return payload as VerifiedUser;
}

async function fetchWorkspace(token: string): Promise<Record<string, string | null>> {
  const { url, anonKey } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/user_workspace_state?select=storage_key,payload`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error('Your private workspace could not be loaded from Supabase.');
  return Object.fromEntries((Array.isArray(rows) ? rows : []).map((row: any) => [row.storage_key, row.payload]));
}

function parsePayload(workspace: Record<string, string | null>, key: string): any | null {
  try { return workspace[key] ? JSON.parse(workspace[key] as string) : null; } catch { return null; }
}

function enabled(settings: ContextSettings, granular: keyof Pick<ContextSettings, 'income' | 'expenses' | 'budgets' | 'emis' | 'goals'>, legacy: 'personalFinance' | 'budgetsAndGoals'): boolean {
  if (settings[granular] === true) return true;
  if (settings[granular] === false) return false;
  return settings[legacy] === true;
}

function buildPersonalContext(workspace: Record<string, string | null>, settings: ContextSettings) {
  const context: Record<string, unknown> = {};
  const references: string[] = [];
  const incomeEnabled = enabled(settings, 'income', 'personalFinance');
  const expensesEnabled = enabled(settings, 'expenses', 'personalFinance');
  const budgetsEnabled = enabled(settings, 'budgets', 'budgetsAndGoals');
  const emisEnabled = enabled(settings, 'emis', 'personalFinance');

  if (incomeEnabled) {
    const income = parsePayload(workspace, 'artha_income_sources_v1');
    const sources = Array.isArray(income?.sources) ? income.sources.slice(0, 80).map((item: any) => ({ type: item.type, amount: item.amount, currency: item.currency, frequency: item.frequency, description: item.description, startDate: item.startDate, endDate: item.endDate ?? null })) : [];
    context.income = sources;
    if (sources.length) references.push(`Income: ${sources.length} recorded source${sources.length === 1 ? '' : 's'}`);
  }

  if (expensesEnabled) {
    const expenses = parsePayload(workspace, 'artha_expenses_v1');
    const records = Array.isArray(expenses?.records) ? expenses.records.slice(-150).map((item: any) => ({ amount: item.amount, category: item.category, date: item.date, merchant: item.merchant, paymentMethod: item.paymentMethod, recurring: item.recurring })) : [];
    context.expenses = records;
    if (records.length) {
      const dates = records.map((item: any) => item.date).filter(Boolean).sort();
      references.push(`Expenses: ${dates[0] || 'date unavailable'}–${dates.at(-1) || 'date unavailable'}; ${records.length} records`);
    }
  }

  if (budgetsEnabled) {
    const budgets = parsePayload(workspace, 'artha_budgets_v1');
    const items = Array.isArray(budgets?.budgets) ? budgets.budgets.slice(-24).map((budget: any) => ({ name: budget.name, month: budget.month, savingsTarget: budget.savingsTarget, notes: budget.notes, categories: budget.categories })) : [];
    context.budgets = items;
    if (items.length) references.push(`Budgets: ${items.length} saved plan${items.length === 1 ? '' : 's'}`);
  }

  if (emisEnabled) {
    const emis = parsePayload(workspace, 'artha_emi_records_v1');
    const items = Array.isArray(emis?.records) ? emis.records.slice(0, 60).map((item: any) => ({ name: item.name, lender: item.lender, loanType: item.loanType, status: item.status, emiAmount: item.emiAmount, outstandingBalance: item.outstandingBalance, annualInterestRate: item.annualInterestRate, nextDueDate: item.nextDueDate, remainingInstallments: item.remainingInstallments })) : [];
    context.emis = items;
    if (items.length) references.push(`EMIs: ${items.length} recorded commitment${items.length === 1 ? '' : 's'}`);
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

function monthlyIncomeFromWorkspace(workspace: Record<string, string | null>): { total: Decimal; sourceCount: number } {
  const income = parsePayload(workspace, 'artha_income_sources_v1');
  const sources = Array.isArray(income?.sources) ? income.sources : [];
  const today = new Date().toISOString().slice(0, 10);
  let total = new Decimal(0);
  let count = 0;
  for (const source of sources) {
    if (String(source?.currency || '').toUpperCase() !== 'INR') continue;
    if (source?.frequency === 'One-time') continue;
    if (source?.startDate && source.startDate > today) continue;
    if (source?.endDate && source.endDate < today) continue;
    const amount = new Decimal(Number(source?.amount || 0));
    if (!amount.isFinite() || amount.lte(0)) continue;
    const monthly = source.frequency === 'Quarterly' ? amount.div(3) : source.frequency === 'Annually' ? amount.div(12) : amount;
    total = total.plus(monthly);
    count += 1;
  }
  return { total, sourceCount: count };
}

function currentMonthExpenses(workspace: Record<string, string | null>): { total: Decimal; recordCount: number; month: string } {
  const expenses = parsePayload(workspace, 'artha_expenses_v1');
  const records = Array.isArray(expenses?.records) ? expenses.records : [];
  const month = new Date().toISOString().slice(0, 7);
  const current = records.filter((item: any) => typeof item?.date === 'string' && item.date.startsWith(month));
  return {
    total: current.reduce((sum: Decimal, item: any) => sum.plus(Number(item?.amount || 0)), new Decimal(0)),
    recordCount: current.length,
    month,
  };
}

function currentBudget(workspace: Record<string, string | null>, month: string) {
  const budgets = parsePayload(workspace, 'artha_budgets_v1');
  const items = Array.isArray(budgets?.budgets) ? budgets.budgets : [];
  const budget = items.find((item: any) => item?.month === month) ?? null;
  if (!budget) return { planned: new Decimal(0), savingsTarget: new Decimal(0), categoryCount: 0 };
  const categories = Array.isArray(budget.categories) ? budget.categories : [];
  return {
    planned: categories.reduce((sum: Decimal, item: any) => sum.plus(Number(item?.plannedAmount || 0)), new Decimal(0)),
    savingsTarget: new Decimal(Number(budget?.savingsTarget || 0)),
    categoryCount: categories.length,
  };
}

function activeEmis(workspace: Record<string, string | null>) {
  const envelope = parsePayload(workspace, 'artha_emi_records_v1');
  const records = Array.isArray(envelope?.records) ? envelope.records.filter((item: any) => item?.status !== 'closed') : [];
  return {
    monthly: records.reduce((sum: Decimal, item: any) => sum.plus(Number(item?.emiAmount || 0)), new Decimal(0)),
    count: records.length,
  };
}

function roundMoney(value: Decimal): number { return value.toDecimalPlaces(2).toNumber(); }
function roundPercent(value: Decimal | null): number | null { return value ? value.toDecimalPlaces(2).toNumber() : null; }

personalAccountRouter.post('/personal/assistant', async (req: Request, res: Response) => {
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

    const systemPrompt = `You are ArthaMind, the evidence-grounded financial-intelligence assistant inside Artha Bench Pro.\n\nRules:\n1. Use only the supplied public dashboard snapshot and authorized personal context for specific personal facts. Never invent a transaction, income amount, balance, budget, EMI, holding, goal, or learning event.\n2. If requested personal data is absent, say there is insufficient recorded data and name the next useful record/action.\n3. State the data period or record context used when relevant. Distinguish recorded facts, calculations, and educational suggestions.\n4. Never provide personalized investment instructions, guaranteed outcomes, regulated financial advice, tax advice, or legal advice.\n5. Suggestions must be practical educational guidance, with INR context when the recorded values use INR.\n6. Do not infer disabled personal data sources.\n7. For public market/economic questions, use the supplied quote, chart-history, economic and provider-health snapshot exactly as captured. Do not call unavailable or delayed data live.\n${buildStructuredFinancialAnswerInstructions({ audience: 'dashboard', language: 'English', level: 'beginner', detail: 'detailed', hasVerifiedCurrentData: publicContext.quotes.length > 0 || publicContext.economicIndicators.length > 0 || personalDataUsed })}`;
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

    return res.json({
      answer,
      structuredAnswer,
      provider: demoMode ? 'demo' : 'groq',
      model: demoMode ? null : getGroqModels().tutorModel,
      groundedAt: publicContext.capturedAt,
      sourceLabels,
      suggestedQuestions: ['Where did I spend the most in my recorded expenses?', 'Which saved budget category is closest to its limit?', 'Summarize my recorded income and expenses.', 'How would a change in one monthly commitment affect my recorded cash flow?'],
      disclaimer: 'Educational analysis only — not investment, tax, legal, or financial advice.',
      personalDataUsed,
      personalContextReferences: references,
      requestId: res.getHeader('x-request-id'),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Personalized ArthaMind request failed.';
    const status = /session is invalid|sign in/i.test(message) ? 401 : 500;
    console.error('[personal-assistant]', message);
    return res.status(status).json({ error: message });
  }
});

personalAccountRouter.post('/personal/decision-replay', async (req: Request, res: Response) => {
  try {
    const parsed = decisionReplaySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'A valid Decision Replay scenario is required.' });
    const token = bearer(req);
    if (!token) return res.status(401).json({ error: 'Sign in to use Decision Replay.' });
    const user = await verifyUser(token);
    const workspace = await fetchWorkspace(token);

    const income = monthlyIncomeFromWorkspace(workspace);
    const expenses = currentMonthExpenses(workspace);
    const budget = currentBudget(workspace, expenses.month);
    const emis = activeEmis(workspace);
    const changes = parsed.data.changes;

    const baselineCashFlow = income.total.minus(expenses.total);
    const incomeScenario = Decimal.max(0, income.total.plus(changes.monthlyIncomeDelta));
    const reducedExpenseBase = expenses.total.times(new Decimal(1).minus(new Decimal(changes.expenseReductionPercent).div(100)));
    const expenseScenario = Decimal.max(0, reducedExpenseBase.plus(changes.additionalMonthlyExpense));
    const scenarioCashFlow = incomeScenario.minus(expenseScenario).minus(changes.newMonthlyEmi);
    const monthlyChange = scenarioCashFlow.minus(baselineCashFlow);
    const horizonImpact = monthlyChange.times(parsed.data.horizonMonths);
    const baselineEmiRatio = income.total.gt(0) ? emis.monthly.div(income.total).times(100) : null;
    const scenarioEmi = emis.monthly.plus(changes.newMonthlyEmi);
    const scenarioEmiRatio = incomeScenario.gt(0) ? scenarioEmi.div(incomeScenario).times(100) : null;
    const baselineHeadroom = budget.planned.gt(0) ? budget.planned.minus(expenses.total) : null;
    const scenarioHeadroom = budget.planned.gt(0) ? budget.planned.minus(expenseScenario) : null;
    const scenarioSavingsTarget = Decimal.max(0, budget.savingsTarget.plus(changes.savingsTargetDelta));

    const completenessSignals = [income.sourceCount > 0, expenses.recordCount > 0, budget.categoryCount > 0, emis.count > 0];
    const completenessCount = completenessSignals.filter(Boolean).length;
    const completeness = completenessCount >= 3 ? 'High' : completenessCount >= 2 ? 'Medium' : 'Low';

    const replay = {
      scenarioId: `replay-${Date.now().toString(36)}`,
      calculatedAt: new Date().toISOString(),
      month: expenses.month,
      horizonMonths: parsed.data.horizonMonths,
      baseline: {
        monthlyIncome: roundMoney(income.total),
        recordedMonthlyExpenses: roundMoney(expenses.total),
        recordedNetCashFlow: roundMoney(baselineCashFlow),
        activeMonthlyEmiCommitment: roundMoney(emis.monthly),
        emiCommitmentRatioPercent: roundPercent(baselineEmiRatio),
        plannedBudget: roundMoney(budget.planned),
        budgetHeadroom: baselineHeadroom ? roundMoney(baselineHeadroom) : null,
        savingsTarget: roundMoney(budget.savingsTarget),
      },
      scenario: {
        monthlyIncome: roundMoney(incomeScenario),
        monthlyExpenses: roundMoney(expenseScenario),
        projectedMonthlyCashFlowAfterNewCommitment: roundMoney(scenarioCashFlow),
        activePlusNewMonthlyEmi: roundMoney(scenarioEmi),
        emiCommitmentRatioPercent: roundPercent(scenarioEmiRatio),
        budgetHeadroom: scenarioHeadroom ? roundMoney(scenarioHeadroom) : null,
        savingsTarget: roundMoney(scenarioSavingsTarget),
      },
      impact: {
        monthlyCashFlowChange: roundMoney(monthlyChange),
        horizonCashFlowChange: roundMoney(horizonImpact),
      },
      dataBasis: {
        recurringIncomeSources: income.sourceCount,
        currentMonthExpenseRecords: expenses.recordCount,
        budgetCategories: budget.categoryCount,
        activeEmis: emis.count,
        completeness,
      },
      assumptions: [
        'Recurring INR income is normalized to a monthly amount; one-time income is excluded.',
        `Recorded expenses use ${expenses.month} only; the replay does not invent missing transactions.`,
        'A new EMI is treated as an additional future monthly commitment and is not written to Expenses or EMI Manager.',
        `The ${parsed.data.horizonMonths}-month impact holds the entered changes constant and does not predict markets, inflation, salary growth, taxes, or unexpected expenses.`,
      ],
      changes,
    };

    let structuredAnswer = null;
    let answer = null;
    if (parsed.data.explain) {
      const prompt = `Explain this private Decision Replay without changing its arithmetic. Separate recorded baseline facts from scenario assumptions. Do not give investment, tax, legal, lending-approval, refinancing, or guaranteed-outcome advice. State data completeness as record coverage, not accuracy. Authenticated user id: ${user.id}. Deterministic replay: ${JSON.stringify(replay)}`;
      const demoMode = !process.env.GROQ_API_KEY?.trim();
      structuredAnswer = demoMode
        ? createFallbackStructuredFinancialAnswer('Decision Replay', 'The deterministic replay is available above, but the live AI explanation provider is not configured. No interpretation has been invented.')
        : await callGroqStructuredFinancialAnswer(
            `You are ArthaMind Decision Replay, a private counterfactual financial-education assistant. Use the supplied deterministic output exactly. ${buildStructuredFinancialAnswerInstructions({ audience: 'dashboard', language: 'English', level: 'beginner', detail: 'detailed', hasVerifiedCurrentData: true })}`,
            prompt,
            { fallbackQuestion: 'Explain my Decision Replay.' },
          );
      answer = serializeStructuredFinancialAnswer(structuredAnswer);
    }

    return res.json({
      replay,
      structuredAnswer,
      answer,
      disclaimer: 'Counterfactual educational analysis only. Decision Replay does not modify your records, predict markets, approve credit, or provide financial advice.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Decision Replay failed.';
    const status = /session is invalid|sign in/i.test(message) ? 401 : 500;
    console.error('[decision-replay]', message);
    return res.status(status).json({ error: message });
  }
});

personalAccountRouter.delete('/account/delete', async (req: Request, res: Response) => {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const user = await verifyUser(token);
    const { url, serviceRole } = supabaseConfig();
    if (!serviceRole) return res.status(503).json({ error: 'Account deletion is not configured. SUPABASE_SERVICE_ROLE_KEY is required on the server.' });
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
