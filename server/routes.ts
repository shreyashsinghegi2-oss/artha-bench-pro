/**
 * Artha Bench - Shared API Router & Production Security Middleware
 * Serves both local Express server.ts and Vercel serverless api/index.ts.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { checkGroqDiagnostics, callGroqChat, getGroqModels, runMultiModelEvaluation } from './groqService';
import { checkPromptSafety } from './safetyChecker';
import { executeBatchBenchmark, getBatchRunProgress } from './batchBenchmark';
import { getAllReportRecords, exportReportsToCSV, saveReportRecord } from './reportStorage';
import { BENCHMARK_DATASET_V1 } from './data/benchmarks/v1/scenarios';
import { generateVerificationCode } from './financeEngine';
import { generateLessonContent, reviewQuizAnswer } from './learningService';
import { getBusinessNews, explainNewsArticle } from './businessNewsService';
import { getMarketQuote, searchMarketQuotes, getMarketHistory } from './marketDataService';
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
  history: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
});

const batchRunSchema = z.object({
  scenarioIds: z.array(z.string()).optional(),
  profile: z.enum(['India', 'US', 'Global']).optional(),
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
    const [groqDiagnostics, newsDiagnostic, marketDiagnostic, fredDiagnostic, indiaDiagnostic] = await Promise.all([
      checkGroqDiagnostics(),
      checkNewsProviderDiagnostic(),
      checkMarketProviderDiagnostic(),
      checkFredDiagnostic(),
      checkWorldBankIndiaDiagnostic(),
    ]);
    const payload = {
      diagnostics: [...groqDiagnostics, newsDiagnostic, marketDiagnostic, fredDiagnostic, indiaDiagnostic],
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

    const { systemPrompt, modelName, history } = req.body;

    const safety = checkPromptSafety(promptText);
    if (!safety.safe) {
      return res.status(400).json({ error: safety.reason, safety });
    }

    const sys = systemPrompt || 'You are ArthaBench AI Tutor, an elite financial educator. Provide clear, non-advisory educational guidance and step-by-step reasoning.';
    const text = await callGroqChat(sys, promptText, modelName, history);
    const demoMode = !process.env.GROQ_API_KEY?.trim();
    res.json({
      answer: text,
      response: text,
      suggestedFollowUps: ['Explain formula steps', 'Give a practice problem'],
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

// 9. FRED Economic Data Routes
apiRouter.get('/economy/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await fetchFredOverview());
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
