/**
 * Artha Bench - Shared API Router & Production Security Middleware
 * Serves both local Express server.ts and Vercel serverless api/index.ts.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  checkGroqDiagnostics,
  callGroqChat,
  callGroqStructuredFinancialAnswer,
  getGroqModels,
  runMultiModelEvaluation,
} from './groqService';
import {
  buildStructuredFinancialAnswerInstructions,
  createFallbackStructuredFinancialAnswer,
  serializeStructuredFinancialAnswer,
} from './aiResponseStandard';
import { checkPromptSafety } from './safetyChecker';
import { executeBatchBenchmark, getBatchRunProgress } from './batchBenchmark';
import { getAllReportRecords, exportReportsToCSV, saveReportRecord } from './reportStorage';
import { BENCHMARK_DATASET_V1 } from './data/benchmarks/v1/scenarios';
import {
  calculateBreakEven,
  calculateCAGR,
  calculateCompoundInterest,
  calculateDTI,
  calculateQuickRatio,
  generateVerificationCode,
} from './financeEngine';
import { generateLessonContent, reviewQuizAnswer } from './learningService';
import { getBusinessNews, explainNewsArticle } from './businessNewsService';
import { getMarketQuote, searchMarketQuotes, getMarketHistory } from './marketDataService';
import { getIndiaMarketTicker } from './indiaMarketTickerService';
import { checkNewsProviderDiagnostic } from './providers/newsProvider';
import { checkMarketProviderDiagnostic } from './providers/marketDataProvider';
import {
  checkFredDiagnostic,
  fetchFredOverview,
  fetchFredSeries,
} from './providers/fredProvider';
import {
  checkWorldBankIndiaDiagnostic,
  fetchWorldBankIndiaOverview,
  fetchWorldBankIndiaSeries,
} from './providers/worldBankProvider';
import {
  checkFinnhubDiagnostic,
  fetchFinnhubCompanyIntelligence,
} from './providers/finnhubProvider';
import { answerCryptoQuestion, getCryptoKlines, getCryptoMarkets } from './cryptoService';
import { CRYPTO_INTERVALS, CRYPTO_SYMBOLS } from '../src/components/crypto/cryptoTypes';

export const apiRouter = Router();

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60;
const DIAGNOSTIC_CACHE_MS = 60 * 1000;
let diagnosticCache:
  | {
      expiresAt: number;
      payload: { diagnostics: Awaited<ReturnType<typeof checkGroqDiagnostics>>; modelsConfig: ReturnType<typeof getGroqModels> };
    }
  | undefined;

// Security & Request ID Middleware
apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  const reqId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  res.setHeader('x-request-id', reqId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const limitInfo = rateLimitMap.get(clientIp) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

  if (now > limitInfo.resetTime) {
    limitInfo.count = 0;
    limitInfo.resetTime = now + RATE_LIMIT_WINDOW_MS;
  }

  limitInfo.count++;
  rateLimitMap.set(clientIp, limitInfo);

  if (limitInfo.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait before retrying.',
      reqId,
    });
  }

  next();
});

// Zod Input Schemas
const querySchema = z.object({
  query: z.string().min(1, 'Query parameter is required.').max(2000, 'Query exceeds maximum length of 2000 characters.'),
  profile: z.enum(['India', 'US', 'Global']).optional(),
});

const tutorSchema = z.object({
  userPrompt: z.string().min(1, 'Prompt is required.').max(2000, 'Prompt exceeds maximum length.'),
  systemPrompt: z.string().optional(),
  modelName: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(10)
    .optional(),
  context: z
    .object({
      country: z.enum(['US', 'India', 'Global']),
      currency: z.enum(['USD', 'INR', 'EUR', 'GBP']),
      language: z.enum(['english', 'hindi', 'hinglish']),
      level: z.enum(['beginner', 'intermediate', 'advanced']),
      mode: z.enum(['explain', 'quiz', 'calc']),
      detail: z.enum(['short', 'detailed']),
      useOfficialSources: z.boolean(),
    })
    .optional(),
});

const batchRunSchema = z.object({
  scenarioIds: z.array(z.string()).optional(),
  profile: z.enum(['India', 'US', 'Global']).optional(),
});

const calculatorMoneySchema = z.coerce.number().finite().min(0).max(1_000_000_000_000_000);
const calculatorPositiveSchema = z.coerce.number().finite().gt(0).max(1_000_000_000_000_000);

const compoundInterestInputSchema = z.object({
  principal: calculatorMoneySchema,
  annualRatePercent: z.coerce.number().finite().min(0).max(1_000),
  years: z.coerce.number().finite().gt(0).max(200),
  monthlyContribution: calculatorMoneySchema.default(0),
  compoundingFrequencyPerYear: z.coerce.number().int().min(1).max(365).default(12),
});

const quickRatioInputSchema = z.object({
  cash: calculatorMoneySchema,
  marketableSecurities: calculatorMoneySchema,
  receivables: calculatorMoneySchema,
  currentLiabilities: calculatorPositiveSchema,
});

const cagrInputSchema = z.object({
  initialValue: calculatorPositiveSchema,
  finalValue: calculatorPositiveSchema,
  years: z.coerce.number().finite().gt(0).max(200),
});

const breakEvenInputSchema = z.object({
  fixedCosts: calculatorMoneySchema,
  pricePerUnit: calculatorPositiveSchema,
  variableCostPerUnit: calculatorMoneySchema,
}).refine((value) => value.pricePerUnit > value.variableCostPerUnit, {
  message: 'Price per unit must be greater than variable cost per unit.',
});

const dtiInputSchema = z.object({
  monthlyGrossIncome: calculatorPositiveSchema,
  monthlyDebtPayments: calculatorMoneySchema,
});

const scenarioAssistantSchema = z.object({
  scenario: z.enum(['compound', 'quick-ratio', 'cagr', 'break-even', 'dti']),
  question: z.string().min(3).max(1200),
  profile: z.enum(['US', 'India', 'Global']).default('US'),
  currency: z.enum(['USD', 'INR', 'EUR', 'GBP']).default('USD'),
  companySymbol: z.string().trim().max(20).regex(/^[A-Za-z0-9][A-Za-z0-9.:_-]*$/).optional().or(z.literal('')),
  useExternalContext: z.boolean().default(true),
  inputs: z.record(z.string(), z.union([z.number().finite(), z.string().max(120), z.boolean()])),
});

const dashboardAssistantSchema = z.object({
  question: z.string().min(3).max(1200),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(10)
    .optional(),
  snapshot: z.object({
    capturedAt: z.string().max(64),
    selectedSymbol: z.string().min(1).max(20).regex(/^[A-Za-z0-9][A-Za-z0-9.:_-]*$/),
    selectedRange: z.enum(['1d', '1w', '1m', '3m', '6m', '1y']),
    selectedCountry: z.enum(['us', 'india']),
    quotes: z
      .array(
        z.object({
          symbol: z.string().min(1).max(20),
          price: z.number().finite(),
          changePercent: z.number().finite().nullable(),
          freshness: z.enum(['real_time', 'delayed', 'end_of_day', 'stale', 'demo']),
          providerName: z.string().min(1).max(80),
        }),
      )
      .max(8),
    marketHistory: z
      .object({
        symbol: z.string().min(1).max(20),
        range: z.string().min(1).max(8),
        pointCount: z.number().int().min(0).max(500),
        startDate: z.string().max(32).nullable(),
        endDate: z.string().max(32).nullable(),
        startPrice: z.number().finite().nullable(),
        latestPrice: z.number().finite().nullable(),
        high: z.number().finite().nullable(),
        low: z.number().finite().nullable(),
        returnPercent: z.number().finite().nullable(),
      })
      .nullable(),
    economicIndicators: z
      .array(
        z.object({
          label: z.string().min(1).max(120),
          value: z.number().finite().nullable(),
          unit: z.string().max(32),
          date: z.string().max(32).nullable(),
          sourceName: z.enum(['FRED', 'World Bank']),
          status: z.string().max(40),
        }),
      )
      .max(14),
    providerHealth: z.object({
      connected: z.number().int().min(0).max(50),
      total: z.number().int().min(0).max(50),
      connectedProviders: z.array(z.string().max(120)).max(20),
      unavailableProviders: z.array(z.string().max(120)).max(20),
    }),
    latestEvaluation: z
      .object({
        verificationCode: z.string().max(80),
        timestamp: z.string().max(64),
        verdict: z.string().max(80),
        overallReliabilityScore: z.number().finite().min(0).max(100),
        formulaAccuracyScore: z.number().finite().min(0).max(100),
        dualModelConsensusScore: z.number().finite().min(0).max(100),
        evidenceVerificationScore: z.number().finite().min(0).max(100),
        safetyComplianceScore: z.number().finite().min(0).max(100),
      })
      .nullable(),
  }),
});

const cryptoKlineQuerySchema = z.object({
  symbol: z.enum(CRYPTO_SYMBOLS),
  interval: z.enum(CRYPTO_INTERVALS),
});

const cryptoAssistantSchema = z.object({
  question: z.string().min(3).max(500),
  context: z.object({
    symbol: z.enum(CRYPTO_SYMBOLS),
    interval: z.enum(CRYPTO_INTERVALS),
    candleStatus: z.enum(['Forming', 'Closed']),
    timeUtc: z.string().min(1).max(80),
    timeIst: z.string().min(1).max(80),
    open: z.number().finite().nonnegative(),
    high: z.number().finite().nonnegative(),
    low: z.number().finite().nonnegative(),
    close: z.number().finite().nonnegative(),
    absoluteChange: z.number().finite(),
    percentChange: z.number().finite(),
    baseVolume: z.number().finite().nonnegative(),
    quoteVolume: z.number().finite().nonnegative(),
    tradeCount: z.number().int().nonnegative(),
    provider: z.literal('Binance Public Market Data'),
    streamStatus: z.enum(['connecting', 'cached', 'live', 'reconnecting', 'stale', 'unavailable']),
    lastUpdatedAt: z.string().max(80).nullable(),
  }).refine((context) => context.high >= Math.max(context.open, context.close, context.low), {
    message: 'Candle high must be greater than or equal to the other OHLC values.',
  }).refine((context) => context.low <= Math.min(context.open, context.close, context.high), {
    message: 'Candle low must be less than or equal to the other OHLC values.',
  }),
});

function buildDashboardDemoAnswer(snapshot: z.infer<typeof dashboardAssistantSchema>['snapshot']) {
  const selectedQuote = snapshot.quotes.find(
    (quote) => quote.symbol.toUpperCase() === snapshot.selectedSymbol.toUpperCase(),
  );
  const history = snapshot.marketHistory;
  const regionalIndicators = snapshot.economicIndicators
    .filter((indicator) =>
      snapshot.selectedCountry === 'india'
        ? indicator.sourceName === 'World Bank'
        : indicator.sourceName === 'FRED',
    )
    .filter((indicator) => indicator.value !== null)
    .slice(0, 5);
  const marketSummary = history
    ? `${history.symbol} moved from ${history.startPrice ?? 'an unavailable starting value'} to ${history.latestPrice ?? 'an unavailable latest value'} across ${history.pointCount} observations (${history.startDate || 'unknown start date'} to ${history.endDate || 'unknown end date'}). The measured range return is ${history.returnPercent === null ? 'unavailable' : `${history.returnPercent.toFixed(2)}%`}, with a period high of ${history.high ?? '—'} and low of ${history.low ?? '—'}.`
    : `Historical observations are not available for ${snapshot.selectedSymbol} in the selected ${snapshot.selectedRange} range.`;
  const quoteSummary = selectedQuote
    ? `The displayed quote is ${selectedQuote.price} with a ${selectedQuote.changePercent === null ? 'missing' : `${selectedQuote.changePercent.toFixed(2)}%`} reported change. Its freshness label is ${selectedQuote.freshness} from ${selectedQuote.providerName}.`
    : 'The selected symbol does not have a usable quote in this snapshot.';
  const economicSummary = regionalIndicators.length
    ? regionalIndicators
        .map(
          (indicator) =>
            `${indicator.label}: ${indicator.value} ${indicator.unit} (${indicator.date || 'date unavailable'})`,
        )
        .join('; ')
    : 'No usable regional economic indicators are present in this snapshot.';

  return `### Dashboard snapshot\n\n**Selected market:** ${quoteSummary}\n\n**Chart reading:** ${marketSummary}\n\n**Economic context:** ${economicSummary}.\n\n**Data quality:** ${snapshot.providerHealth.connected} of ${snapshot.providerHealth.total} provider checks are connected. A demo, delayed, stale, or end-of-day label must not be interpreted as a real-time signal.\n\nThis is a description of observed dashboard data, not a forecast.\n\nEducational analysis only — not investment advice.`;
}

const DEFAULT_TUTOR_CONTEXT = {
  country: 'US',
  currency: 'USD',
  language: 'english',
  level: 'beginner',
  mode: 'explain',
  detail: 'detailed',
  useOfficialSources: true,
} as const;

function questionNeedsCurrentData(question: string) {
  return /\b(current|currently|latest|today|now|real[ -]?time|inflation|gdp|unemployment|interest rate|federal funds|treasury|economic indicator)\b/i.test(
    question,
  );
}

async function loadTutorCurrentData(
  question: string,
  context: typeof DEFAULT_TUTOR_CONTEXT | NonNullable<z.infer<typeof tutorSchema>['context']>,
) {
  if (!context.useOfficialSources || !questionNeedsCurrentData(question)) return null;

  const overviews =
    context.country === 'India'
      ? [await fetchWorldBankIndiaOverview()]
      : context.country === 'US'
        ? [await fetchFredOverview()]
        : await Promise.all([fetchFredOverview(), fetchWorldBankIndiaOverview()]);
  const indicators = overviews
    .flatMap((overview) => overview.indicators)
    .filter((indicator) => indicator.status === 'connected' && indicator.value !== null)
    .map((indicator) => ({
      label: indicator.label,
      value: indicator.value,
      unit: indicator.unit,
      observationDate: indicator.date,
      provider: indicator.sourceName,
    }));

  if (indicators.length === 0) return null;
  return {
    retrievedAt: new Date().toISOString(),
    providers: Array.from(new Set(indicators.map((indicator) => indicator.provider))),
    indicators,
    freshnessNote:
      'These are the latest available official observations. Release dates differ, so they must not be described as tick-by-tick real-time values.',
  };
}

type FinanceScenarioKind = z.infer<typeof scenarioAssistantSchema>['scenario'];

function sendDeterministicFinanceResult(
  res: Response,
  calculationType: FinanceScenarioKind,
  result: Record<string, unknown>,
) {
  const calculatedAt = new Date().toISOString();
  const verificationCode = generateVerificationCode(`${calculationType}:${JSON.stringify(result)}`);
  res.json({
    ...result,
    calculationType,
    engine: 'Decimal.js',
    precisionPolicy: '20 significant digits; ROUND_HALF_UP for reported values',
    calculatedAt,
    verificationCode,
  });
}

function calculatorValidationError(res: Response, parsed: { success: false; error: z.ZodError }) {
  return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid calculator inputs.' });
}

function requiredScenarioNumber(inputs: Record<string, string | number | boolean>, key: string) {
  const value = inputs[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`A valid numeric ${key} input is required.`);
  }
  return value;
}

function recalculateScenario(
  scenario: FinanceScenarioKind,
  inputs: Record<string, string | number | boolean>,
): any {
  if (scenario === 'compound') {
    return calculateCompoundInterest(
      requiredScenarioNumber(inputs, 'principal'),
      requiredScenarioNumber(inputs, 'annualRatePercent'),
      requiredScenarioNumber(inputs, 'years'),
      requiredScenarioNumber(inputs, 'monthlyContribution'),
      requiredScenarioNumber(inputs, 'compoundingFrequencyPerYear'),
    );
  }
  if (scenario === 'quick-ratio') {
    return calculateQuickRatio(
      requiredScenarioNumber(inputs, 'cash'),
      requiredScenarioNumber(inputs, 'marketableSecurities'),
      requiredScenarioNumber(inputs, 'receivables'),
      requiredScenarioNumber(inputs, 'currentLiabilities'),
    );
  }
  if (scenario === 'cagr') {
    return calculateCAGR(
      requiredScenarioNumber(inputs, 'initialValue'),
      requiredScenarioNumber(inputs, 'finalValue'),
      requiredScenarioNumber(inputs, 'years'),
    );
  }
  if (scenario === 'break-even') {
    return calculateBreakEven(
      requiredScenarioNumber(inputs, 'fixedCosts'),
      requiredScenarioNumber(inputs, 'pricePerUnit'),
      requiredScenarioNumber(inputs, 'variableCostPerUnit'),
    );
  }
  return calculateDTI(
    requiredScenarioNumber(inputs, 'monthlyGrossIncome'),
    requiredScenarioNumber(inputs, 'monthlyDebtPayments'),
  );
}

async function loadScenarioExternalContext(
  profile: 'US' | 'India' | 'Global',
  companySymbol: string | undefined,
  enabled: boolean,
) {
  if (!enabled) {
    return {
      retrievedAt: new Date().toISOString(),
      economicIndicators: [],
      company: null,
      quote: null,
      sourceLabels: [] as string[],
      notes: ['External provider context is turned off.'],
    };
  }

  const economicTasks: Promise<Awaited<ReturnType<typeof fetchFredOverview>> | Awaited<ReturnType<typeof fetchWorldBankIndiaOverview>>>[] = [];
  if (profile === 'US' || profile === 'Global') economicTasks.push(fetchFredOverview());
  if (profile === 'India' || profile === 'Global') economicTasks.push(fetchWorldBankIndiaOverview());

  const economicSettled = await Promise.allSettled(economicTasks);
  const economicOverviews = economicSettled
    .filter((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchFredOverview>> | Awaited<ReturnType<typeof fetchWorldBankIndiaOverview>>> => item.status === 'fulfilled')
    .map((item) => item.value);
  const economicIndicators = economicOverviews
    .flatMap((overview) => overview.indicators)
    .filter((indicator) => indicator.status === 'connected' && indicator.value !== null)
    .slice(0, 12)
    .map((indicator) => ({
      label: indicator.label,
      value: indicator.value,
      unit: indicator.unit,
      date: indicator.date,
      sourceName: indicator.sourceName,
    }));

  let company: Record<string, unknown> | null = null;
  let quote: Record<string, unknown> | null = null;
  const sourceLabels = economicOverviews
    .filter((overview) => overview.status === 'connected')
    .map((overview) => overview.providerName);
  const notes: string[] = [];

  const normalizedSymbol = companySymbol?.trim().toUpperCase();
  if (normalizedSymbol) {
    const [companyResult, quoteResult] = await Promise.allSettled([
      fetchFinnhubCompanyIntelligence(normalizedSymbol),
      getMarketQuote(normalizedSymbol),
    ]);
    if (companyResult.status === 'fulfilled' && companyResult.value.status === 'connected') {
      company = {
        symbol: normalizedSymbol,
        profile: companyResult.value.profile,
        metrics: companyResult.value.metrics,
        earnings: companyResult.value.earnings.slice(0, 4),
        recommendations: companyResult.value.recommendations.slice(0, 4),
        retrievedAt: companyResult.value.retrievedAt,
      };
      sourceLabels.push('Finnhub');
    } else {
      notes.push(`Company fundamentals were unavailable for ${normalizedSymbol}.`);
    }
    if (quoteResult.status === 'fulfilled' && quoteResult.value.quote) {
      quote = quoteResult.value.quote as unknown as Record<string, unknown>;
      sourceLabels.push(quoteResult.value.quote.providerName);
    } else {
      notes.push(`Market quote context was unavailable for ${normalizedSymbol}.`);
    }
  }

  if (economicIndicators.length === 0) {
    notes.push('No connected official macro observations were available for this request.');
  }

  return {
    retrievedAt: new Date().toISOString(),
    economicIndicators,
    company,
    quote,
    sourceLabels: Array.from(new Set(sourceLabels)),
    notes,
  };
}

function scenarioFallbackSummary(scenario: FinanceScenarioKind, result: Record<string, unknown>, currency: string) {
  if (scenario === 'compound') return `The verified Decimal.js compound-interest result is a final balance of ${currency} ${result.finalBalance}, including ${currency} ${result.totalInterestEarned} of calculated interest.`;
  if (scenario === 'quick-ratio') return `The verified Decimal.js quick ratio is ${result.quickRatio}, with the calculator assessment recorded as ${result.assessment}.`;
  if (scenario === 'cagr') return `The verified Decimal.js CAGR is ${result.cagrPercent}% across the entered ${result.years}-year period.`;
  if (scenario === 'break-even') return `The verified Decimal.js break-even point is ${result.breakEvenUnits} units, corresponding to ${currency} ${result.breakEvenRevenue} of modeled revenue.`;
  return `The verified Decimal.js debt-to-income ratio is ${result.dtiPercent}%, with the calculator's educational tier recorded as ${result.healthCategory}.`;
}

apiRouter.post('/finance/compound-interest', (req: Request, res: Response) => {
  const parsed = compoundInterestInputSchema.safeParse(req.body);
  if (parsed.success === false) return calculatorValidationError(res, parsed);
  try {
    const value = parsed.data;
    sendDeterministicFinanceResult(res, 'compound', calculateCompoundInterest(
      value.principal,
      value.annualRatePercent,
      value.years,
      value.monthlyContribution,
      value.compoundingFrequencyPerYear,
    ) as unknown as Record<string, unknown>);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Compound-interest calculation failed.' });
  }
});

apiRouter.post('/finance/quick-ratio', (req: Request, res: Response) => {
  const parsed = quickRatioInputSchema.safeParse(req.body);
  if (parsed.success === false) return calculatorValidationError(res, parsed);
  try {
    const value = parsed.data;
    sendDeterministicFinanceResult(res, 'quick-ratio', calculateQuickRatio(
      value.cash,
      value.marketableSecurities,
      value.receivables,
      value.currentLiabilities,
    ) as unknown as Record<string, unknown>);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Quick-ratio calculation failed.' });
  }
});

apiRouter.post('/finance/cagr', (req: Request, res: Response) => {
  const parsed = cagrInputSchema.safeParse(req.body);
  if (parsed.success === false) return calculatorValidationError(res, parsed);
  try {
    const value = parsed.data;
    sendDeterministicFinanceResult(res, 'cagr', calculateCAGR(value.initialValue, value.finalValue, value.years) as unknown as Record<string, unknown>);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'CAGR calculation failed.' });
  }
});

apiRouter.post('/finance/break-even', (req: Request, res: Response) => {
  const parsed = breakEvenInputSchema.safeParse(req.body);
  if (parsed.success === false) return calculatorValidationError(res, parsed);
  try {
    const value = parsed.data;
    sendDeterministicFinanceResult(res, 'break-even', calculateBreakEven(value.fixedCosts, value.pricePerUnit, value.variableCostPerUnit) as unknown as Record<string, unknown>);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Break-even calculation failed.' });
  }
});

apiRouter.post('/finance/dti', (req: Request, res: Response) => {
  const parsed = dtiInputSchema.safeParse(req.body);
  if (parsed.success === false) return calculatorValidationError(res, parsed);
  try {
    const value = parsed.data;
    sendDeterministicFinanceResult(res, 'dti', calculateDTI(value.monthlyGrossIncome, value.monthlyDebtPayments) as unknown as Record<string, unknown>);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'DTI calculation failed.' });
  }
});

apiRouter.post('/finance/scenario-assistant', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = scenarioAssistantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'A valid scenario question and input set are required.' });
    }
    const safety = checkPromptSafety(parsed.data.question);
    if (!safety.safe) return res.status(400).json({ error: safety.reason, safety });

    const deterministicResult = recalculateScenario(parsed.data.scenario, parsed.data.inputs);
    const externalContext = await loadScenarioExternalContext(
      parsed.data.profile,
      parsed.data.companySymbol || undefined,
      parsed.data.useExternalContext,
    );
    const hasVerifiedCurrentData = externalContext.economicIndicators.length > 0 || Boolean(externalContext.company) || Boolean(externalContext.quote);
    const systemPrompt = `You are ArthaMind Scenario Analyst inside ArthaBench Pro's deterministic Financial Scenario & Calculation Studio.

Rules:
1. The supplied Decimal.js result is the numeric source of truth. Explain it; never replace, override, or silently recompute it with guessed AI math.
2. Use the exact entered inputs and deterministic result for scenario-specific calculations and examples.
3. External provider context is optional enrichment. Use only values supplied in externalContext, preserve dates/provider/freshness, and never fabricate web data.
4. Never substitute a policy rate, market return, company metric, or lender convention for the user's entered assumption unless the user explicitly asks for a separate comparison.
5. For company context, do not claim the user's entered values belong to that company unless the supplied provider data proves the same metric and period.
6. For CAGR, distinguish historical annualized growth from a forecast. For quick ratio, explain that industry norms differ. For DTI, explain that lender thresholds and definitions vary. For break-even, state that costs and price are modeled assumptions. For compound interest, identify contribution timing/compounding assumptions.
7. Keep independent factual claims separate and keep the answer educational, not a personalized investment, tax, credit, or lending instruction.
${buildStructuredFinancialAnswerInstructions({
  audience: 'dashboard',
  language: 'English',
  level: 'beginner',
  detail: 'detailed',
  hasVerifiedCurrentData,
})}`;
    const userPrompt = `Scenario: ${parsed.data.scenario}
Profile: ${parsed.data.profile}
Currency: ${parsed.data.currency}
Question: ${parsed.data.question}
Entered inputs: ${JSON.stringify(parsed.data.inputs)}
Verified deterministic Decimal.js result: ${JSON.stringify(deterministicResult)}
External connected-provider context: ${JSON.stringify(externalContext)}`;

    const demoMode = !process.env.GROQ_API_KEY?.trim();
    const structuredAnswer = demoMode
      ? createFallbackStructuredFinancialAnswer(
          `${parsed.data.scenario} ${parsed.data.question}`,
          scenarioFallbackSummary(parsed.data.scenario, deterministicResult, parsed.data.currency),
        )
      : await callGroqStructuredFinancialAnswer(systemPrompt, userPrompt, {
          fallbackQuestion: `${parsed.data.scenario} ${parsed.data.question}`,
        });

    res.json({
      answer: serializeStructuredFinancialAnswer(structuredAnswer),
      structuredAnswer,
      deterministicResult,
      engine: 'Decimal.js',
      provider: demoMode ? 'deterministic-fallback' : 'groq',
      model: demoMode ? null : getGroqModels().tutorModel,
      groundedAt: externalContext.retrievedAt,
      sourceLabels: externalContext.sourceLabels,
      contextNotes: externalContext.notes,
      suggestedQuestions: [
        'Explain the formula and each input in simple language.',
        'Which input changes this result the most?',
        'Show a conservative and an optimistic variation without changing the original result.',
        hasVerifiedCurrentData
          ? 'Compare this scenario with the connected external context without substituting the inputs.'
          : 'What additional verified data would make this analysis more realistic?',
      ],
      disclaimer: 'Educational analysis only. The deterministic calculation is not financial, investment, tax, lending, or legal advice.',
      requestId: res.getHeader('x-request-id'),
    });
  } catch (error) {
    next(error);
  }
});

// 1. Health Endpoint
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ArthaBench Pro API',
    timestamp: new Date().toISOString(),
    reqId: res.getHeader('x-request-id'),
    version: '2.0.0',
  });
});

// 2. Diagnostics Endpoint
apiRouter.get('/diagnostics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (diagnosticCache && diagnosticCache.expiresAt > Date.now()) {
      res.json(diagnosticCache.payload);
      return;
    }
    const [groqDiagnostics, newsDiagnostic, marketDiagnostic, fredDiagnostic, indiaDiagnostic, finnhubDiagnostic] = await Promise.all([
      checkGroqDiagnostics(),
      checkNewsProviderDiagnostic(),
      checkMarketProviderDiagnostic(),
      checkFredDiagnostic(),
      checkWorldBankIndiaDiagnostic(),
      checkFinnhubDiagnostic(),
    ]);
    const payload = {
      diagnostics: [...groqDiagnostics, newsDiagnostic, marketDiagnostic, fredDiagnostic, indiaDiagnostic, finnhubDiagnostic],
      modelsConfig: getGroqModels(),
    };
    diagnosticCache = { expiresAt: Date.now() + DIAGNOSTIC_CACHE_MS, payload };
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

// 3. Quick Check Endpoint & Alias
const handleQuickCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = querySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0].message });
    }

    const { query, profile } = parseResult.data;

    // Safety check
    const safety = checkPromptSafety(query);
    if (!safety.safe) {
      return res.status(400).json({
        error: safety.reason,
        safety,
      });
    }

    const evalReport = await runMultiModelEvaluation(query, { profile: profile || 'US' });

    res.json({
      answer: evalReport.dimensions.find((d) => d.id === 'numericalAccuracy')?.reason || evalReport.riskFlags.join('; '),
      report: evalReport,
    });
  } catch (err) {
    next(err);
  }
};
apiRouter.post('/quick-check', handleQuickCheck);
apiRouter.post('/groq/quick-check', handleQuickCheck);

// 4. Multi-Model Evaluate Endpoint & Alias
const handleEvaluate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = querySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0].message });
    }

    const { query, profile } = parseResult.data;

    const safety = checkPromptSafety(query);
    if (!safety.safe) {
      return res.status(400).json({
        error: safety.reason,
        safety,
      });
    }

    const evalReport = await runMultiModelEvaluation(query, { profile: profile || 'US' });
    res.json({ report: evalReport });
  } catch (err) {
    next(err);
  }
};
apiRouter.post('/evaluate', handleEvaluate);
apiRouter.post('/groq/evaluate', handleEvaluate);

// 5. Tutor Chat Endpoint & Alias
const handleTutor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const promptText = req.body.userPrompt || req.body.message || req.body.query || '';
    if (!promptText || typeof promptText !== 'string') {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const parsed = tutorSchema.safeParse({ ...req.body, userPrompt: promptText });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid tutor request.' });
    }

    const { modelName, history } = parsed.data;
    const context = parsed.data.context || DEFAULT_TUTOR_CONTEXT;

    const safety = checkPromptSafety(promptText);
    if (!safety.safe) {
      return res.status(400).json({ error: safety.reason, safety });
    }

    const currentData = await loadTutorCurrentData(promptText, context);
    const sys = `You are ArthaBench AI Tutor, a precise and patient financial educator.
Teach at the learner's stated level, define unfamiliar terms, show arithmetic clearly, and never confuse illustrative values with current data.
Country profile: ${context.country}
Currency preference: ${context.currency}
Learning mode: ${context.mode}
${buildStructuredFinancialAnswerInstructions({
  audience: 'tutor',
  language: context.language,
  level: context.level,
  detail: context.detail,
  hasVerifiedCurrentData: Boolean(currentData),
})}`;
    const userPrompt = `Learner question: ${promptText}

Learner preferences:
${JSON.stringify(context)}

Verified current/latest official context:
${currentData ? JSON.stringify(currentData) : 'No verified current-data context was required or available. Use an explicitly labelled illustrative worked example.'}`;
    const structuredAnswer = await callGroqStructuredFinancialAnswer(sys, userPrompt, {
      modelName,
      history,
      fallbackQuestion: promptText,
    });
    const text = serializeStructuredFinancialAnswer(structuredAnswer);
    const demoMode = !process.env.GROQ_API_KEY?.trim();
    res.json({
      answer: text,
      response: text,
      structuredAnswer,
      suggestedFollowUps: [
        'Explain the formula symbols one by one.',
        'Give me another worked example to solve.',
        'Quiz me on this concept.',
      ],
      demoMode,
      provider: demoMode ? 'demo' : 'groq',
      model: demoMode ? null : getGroqModels().tutorModel,
      requestId: res.getHeader('x-request-id'),
    });
  } catch (err: any) {
    next(err);
  }
};
apiRouter.post('/tutor', handleTutor);
apiRouter.post('/groq/tutor', handleTutor);

apiRouter.post('/dashboard/assistant', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = dashboardAssistantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'A valid dashboard question and data snapshot are required.' });
    }

    const safety = checkPromptSafety(parsed.data.question);
    if (!safety.safe) {
      return res.status(400).json({ error: safety.reason, safety });
    }

    const directAdvicePattern =
      /\b(should i|would you|do you recommend|tell me (?:whether|if) to)\b.{0,80}\b(buy|sell|hold|invest)\b|\b(target price|trade signal|guaranteed return)\b/i;
    if (directAdvicePattern.test(parsed.data.question)) {
      return res.status(400).json({
        error:
          'Ask Artha AI can explain dashboard evidence, trends, and risks, but it cannot provide personalized buy, sell, hold, target-price, or guaranteed-return recommendations.',
      });
    }

    const { snapshot } = parsed.data;
    const groundedContext = {
      snapshotCapturedAt: snapshot.capturedAt,
      currentSelection: {
        marketSymbol: snapshot.selectedSymbol,
        marketRange: snapshot.selectedRange,
        economicRegion: snapshot.selectedCountry === 'us' ? 'United States' : 'India',
      },
      marketQuotes: snapshot.quotes,
      selectedMarketHistorySummary: snapshot.marketHistory,
      economicIndicators: snapshot.economicIndicators,
      providerHealth: snapshot.providerHealth,
      latestReliabilityEvaluation: snapshot.latestEvaluation,
    };

    const hasVerifiedCurrentData =
      snapshot.quotes.length > 0 ||
      snapshot.economicIndicators.some(
        (indicator) => indicator.status === 'connected' && indicator.value !== null,
      );
    const systemPrompt = `You are Ask Artha AI, the evidence-grounded dashboard analyst inside ArthaBench Pro.

Rules:
1. Use only the supplied structured dashboard snapshot for specific numbers, dates, provider status, and trends. If data is absent, say it is unavailable.
2. Clearly distinguish observed data from interpretation. Never claim that a trend guarantees a future result.
3. Explain charts, comparisons, anomalies, reliability scores, and data limitations in plain language. Mention the relevant observation date or range when available.
4. Never provide personalized investment advice, buy/sell/hold instructions, target prices, or guaranteed-return language.
5. Treat analyst opinions and market movements as context, not recommendations.
6. End with educational, non-advisory takeaways.
${buildStructuredFinancialAnswerInstructions({
  audience: 'dashboard',
  language: 'English',
  level: 'beginner',
  detail: 'detailed',
  hasVerifiedCurrentData,
})}`;

    const userPrompt = `Dashboard question: ${parsed.data.question}\n\nVerified dashboard snapshot:\n${JSON.stringify(groundedContext)}`;
    const demoMode = !process.env.GROQ_API_KEY?.trim();
    const structuredAnswer = demoMode
      ? createFallbackStructuredFinancialAnswer(
          parsed.data.question,
          buildDashboardDemoAnswer(snapshot),
        )
      : await callGroqStructuredFinancialAnswer(systemPrompt, userPrompt, {
          history: parsed.data.history,
          fallbackQuestion: parsed.data.question,
        });
    const answer = serializeStructuredFinancialAnswer(structuredAnswer);
    const sourceLabels = Array.from(
      new Set([
        ...snapshot.quotes.map((quote) => quote.providerName),
        ...snapshot.economicIndicators.map((indicator) => indicator.sourceName),
        ...(snapshot.latestEvaluation ? ['ArthaBench Reliability Engine'] : []),
      ]),
    );

    res.json({
      answer,
      structuredAnswer,
      provider: demoMode ? 'demo' : 'groq',
      model: demoMode ? null : getGroqModels().tutorModel,
      groundedAt: snapshot.capturedAt,
      sourceLabels,
      suggestedQuestions: [
        `Explain the ${snapshot.selectedSymbol} chart in simple language.`,
        `Compare the latest ${snapshot.selectedCountry === 'us' ? 'US' : 'India'} economic signals.`,
        'Which dashboard data limitations should I notice?',
        snapshot.latestEvaluation
          ? 'Explain the latest reliability score and its weakest dimension.'
          : 'How does ArthaBench measure AI reliability?',
      ],
      disclaimer: 'Educational analysis only — not investment advice.',
      requestId: res.getHeader('x-request-id'),
    });
  } catch (err) {
    next(err);
  }
});

// Crypto Market Lab — public Binance market data plus grounded educational AI.
apiRouter.get('/crypto/markets', async (_req: Request, res: Response) => {
  try {
    const result = await getCryptoMarkets();
    res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=5');
    res.json(result);
  } catch {
    res.status(503).json({ error: 'Binance public market snapshot is temporarily unavailable.' });
  }
});

apiRouter.get('/crypto/klines', async (req: Request, res: Response) => {
  const parsed = cryptoKlineQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'A supported Binance symbol and interval are required.' });
  }
  try {
    const result = await getCryptoKlines(parsed.data.symbol, parsed.data.interval);
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=10');
    res.json(result);
  } catch {
    res.status(503).json({ error: 'Binance candle snapshot is temporarily unavailable.' });
  }
});

apiRouter.post('/crypto/assistant', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = cryptoAssistantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'A valid question and verified Binance candle context are required.' });
    }
    const safety = checkPromptSafety(parsed.data.question);
    if (!safety.safe) return res.status(400).json({ error: safety.reason, safety });
    const result = await answerCryptoQuestion(parsed.data.question, {
      ...parsed.data.context,
      lastUpdatedAt: parsed.data.context.lastUpdatedAt ?? null,
    });
    res.json({ ...result, disclaimer: 'Educational research guidance only — not investment advice.', requestId: res.getHeader('x-request-id') });
  } catch (error) {
    next(error);
  }
});

// 6. Learning Workspace Routes
apiRouter.post('/learning/lesson', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lessonData = await generateLessonContent(req.body);
    res.json(lessonData);
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/learning/quiz/review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reviewData = await reviewQuizAnswer(req.body);
    res.json(reviewData);
  } catch (err) {
    next(err);
  }
});

// 7. Business News Routes
apiRouter.get('/news', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, category, region, page } = req.query;
    const providerResult = await getBusinessNews(
      (query as string) || '',
      (category as string) || 'all',
      (region as string) || 'global',
      Number(page) || 1
    );
    res.json({
      status: providerResult.status || 'ok',
      items: providerResult.items || [],
      message: providerResult.message,
    });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/news/explain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const explanation = await explainNewsArticle(req.body.article || req.body);
    res.json(explanation);
  } catch (err) {
    next(err);
  }
});

// 8. Markets Routes
const handleMarketQuote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const symbol = (req.query.symbol as string) || 'AAPL';
    const assetType = (req.query.assetType as string) || 'equity';
    const result = await getMarketQuote(symbol, assetType);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
apiRouter.get('/markets/quote', handleMarketQuote);
apiRouter.get('/markets/quotes', handleMarketQuote);

apiRouter.get('/markets/india-ticker', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const ticker = await getIndiaMarketTicker();
    res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=30');
    res.json(ticker);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/markets/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req.query.query as string) || '';
    const results = await searchMarketQuotes(query);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/markets/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const symbol = (req.query.symbol as string) || 'AAPL';
    const range = (req.query.range as string) || '1m';
    const historyData = await getMarketHistory(symbol, range);
    res.json(historyData);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/company/intelligence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z
      .object({
        symbol: z.string().min(1).max(20).regex(/^[A-Za-z0-9][A-Za-z0-9.:_-]*$/),
      })
      .safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ error: 'A valid company stock symbol is required.' });
    }

    const result = await fetchFinnhubCompanyIntelligence(parsed.data.symbol);
    res.setHeader(
      'Cache-Control',
      result.status === 'connected'
        ? 'public, s-maxage=900, stale-while-revalidate=3600'
        : 'no-store',
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/company/assistant', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z
      .object({
        symbol: z.string().min(1).max(20).regex(/^[A-Za-z0-9][A-Za-z0-9.:_-]*$/),
        question: z.string().min(3).max(1200),
        history: z
          .array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string().min(1).max(4000),
            }),
          )
          .max(10)
          .optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'A valid symbol and company-analysis question are required.' });
    }

    const safety = checkPromptSafety(parsed.data.question);
    if (!safety.safe) {
      return res.status(400).json({ error: safety.reason, safety });
    }

    const directAdvicePattern =
      /\b(should i|would you|do you recommend|tell me (?:whether|if) to)\b.{0,60}\b(buy|sell|hold)\b|\b(target price|trade signal)\b/i;
    if (directAdvicePattern.test(parsed.data.question)) {
      return res.status(400).json({
        error:
          'The Company AI Assistant cannot provide buy, sell, hold, target-price, or personalized investment recommendations. Ask about the company’s reported metrics, earnings, risks, or trends instead.',
      });
    }

    const symbol = parsed.data.symbol.toUpperCase();
    const [company, quoteResult] = await Promise.all([
      fetchFinnhubCompanyIntelligence(symbol),
      getMarketQuote(symbol),
    ]);

    if (company.status !== 'connected') {
      return res.status(503).json({
        error: company.message || 'Finnhub company data is unavailable for this question.',
      });
    }

    const groundedContext = {
      companyProfile: company.profile,
      fundamentalMetrics: company.metrics,
      recentEarnings: company.earnings,
      analystRecommendationCounts: company.recommendations,
      marketQuote: quoteResult.quote,
      dataRetrievedAt: company.retrievedAt,
      dataProviders: ['Finnhub', quoteResult.quote.providerName],
    };

    const systemPrompt = `You are the ArthaBench Company AI Assistant, a careful financial educator and evidence-grounded company-analysis explainer.

Rules:
1. Use only the supplied structured company context for company-specific factual claims. Never invent missing values.
2. Explain metrics, changes, trade-offs, uncertainty, and data limitations in plain language.
3. Never give personalized investment advice, a buy/sell/hold recommendation, a target price, a forecast presented as certain, or guaranteed-return language.
4. Analyst recommendation counts are third-party historical opinions, not ArthaBench recommendations.
5. Mention relevant units and observation periods when available. Distinguish live, delayed, end-of-day, or demo quote freshness.
6. Keep the answer focused and structured, normally under 600 words.
${buildStructuredFinancialAnswerInstructions({
  audience: 'dashboard',
  language: 'English',
  level: 'intermediate',
  detail: 'detailed',
  hasVerifiedCurrentData: true,
})}`;

    const userPrompt = `Question about ${symbol}: ${parsed.data.question}\n\nVerified structured context:\n${JSON.stringify(groundedContext)}`;
    const structuredAnswer = await callGroqStructuredFinancialAnswer(
      systemPrompt,
      userPrompt,
      {
        history: parsed.data.history,
        fallbackQuestion: `${parsed.data.question}\nVerified context: ${JSON.stringify(groundedContext)}`,
      },
    );
    const answer = serializeStructuredFinancialAnswer(structuredAnswer);
    const demoMode = !process.env.GROQ_API_KEY?.trim();

    res.json({
      symbol,
      answer,
      structuredAnswer,
      provider: demoMode ? 'demo' : 'groq',
      model: demoMode ? null : getGroqModels().tutorModel,
      groundedAt: company.retrievedAt,
      disclaimer: 'Educational analysis only — not investment advice.',
      suggestedQuestions: [
        'Explain the valuation ratios in simple language.',
        'What do the latest earnings surprises show?',
        'Summarize the main financial strengths and risks visible in this data.',
        'How does the 52-week range compare with the current quote?',
      ],
      requestId: res.getHeader('x-request-id'),
    });
  } catch (err) {
    next(err);
  }
});

// 9. FRED Economic Data Routes
apiRouter.get('/economy/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await fetchFredOverview();
    res.setHeader(
      'Cache-Control',
      result.status === 'connected'
        ? 'public, s-maxage=900, stale-while-revalidate=3600'
        : 'no-store',
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/economy/series', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z
      .object({
        seriesId: z.string().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/),
        limit: z.coerce.number().int().min(1).max(240).optional(),
      })
      .safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ error: 'A valid FRED seriesId is required.' });
    }

    res.json(await fetchFredSeries(parsed.data.seriesId, parsed.data.limit || 24));
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/economy/india/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await fetchWorldBankIndiaOverview();
    res.setHeader(
      'Cache-Control',
      result.status === 'connected'
        ? 'public, s-maxage=3600, stale-while-revalidate=86400'
        : 'no-store',
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/economy/india/series', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z
      .object({
        indicatorId: z.string().min(2).max(64).regex(/^[A-Za-z0-9._-]+$/),
        limit: z.coerce.number().int().min(1).max(240).optional(),
      })
      .safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ error: 'A valid World Bank indicatorId is required.' });
    }

    const result = await fetchWorldBankIndiaSeries(
      parsed.data.indicatorId,
      parsed.data.limit || 60,
    );
    res.setHeader(
      'Cache-Control',
      result.status === 'connected'
        ? 'public, s-maxage=3600, stale-while-revalidate=86400'
        : 'no-store',
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 6. Batch Benchmark Routes
apiRouter.get('/batch/scenarios', (req: Request, res: Response) => {
  res.json({ scenarios: BENCHMARK_DATASET_V1 });
});

apiRouter.post('/batch/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = batchRunSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0].message });
    }

    const { scenarioIds, profile } = parseResult.data;
    const progress = await executeBatchBenchmark(scenarioIds, profile || 'US');
    res.json({ run: progress });
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/batch/status/:runId', (req: Request, res: Response) => {
  const { runId } = req.params;
  const progress = getBatchRunProgress(runId);
  if (!progress) {
    return res.status(404).json({ error: 'Batch run not found' });
  }
  res.json({ run: progress });
});

// 7. Reports Routes
apiRouter.get('/reports', (req: Request, res: Response) => {
  const reports = getAllReportRecords();
  res.json({ reports });
});

apiRouter.get('/reports/export', (req: Request, res: Response) => {
  const format = req.query.format as string;
  const reports = getAllReportRecords();

  if (format === 'csv') {
    const csv = exportReportsToCSV(reports);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="arthabench_reports.csv"');
    return res.send(csv);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="arthabench_reports.json"');
  res.json(reports);
});

// Centralized Error Handling Middleware (Sanitizes errors, hides credentials)
apiRouter.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const reqId = res.getHeader('x-request-id') || 'unknown';
  console.error(`[API ERROR ${reqId}]`, err?.message || err);

  const safeMessage = err?.message?.includes('GROQ_API_KEY')
    ? 'Server API Key configuration error.'
    : err?.message || 'An internal API error occurred.';

  res.status(500).json({
    error: safeMessage,
    reqId,
  });
});
