/**
 * Artha Bench - Groq AI Service Proxy
 * Evaluates responses using dual models and the 7-dimension scoring engine.
 * Never exposes keys or credentials to the browser.
 */

import { ProviderDiagnostic, StructuredFinancialAnswer } from '../src/types';
import {
  createFallbackStructuredFinancialAnswer,
  sanitizeStructuredFinancialAnswer,
  STRUCTURED_FINANCIAL_ANSWER_JSON_SCHEMA,
  structuredFinancialAnswerSchema,
} from './aiResponseStandard';
import { generateVerificationCode } from './financeEngine';
import { computeFullReliabilityEvaluation, FullReliabilityEvaluation } from './scoringEngine';

export interface GroqModelsConfig {
  tutorModel: string;
  evaluatorModel: string;
  primaryModel: string;
  secondaryModel: string;
}

const GROQ_DEFAULT_MODELS: GroqModelsConfig = {
  tutorModel: 'openai/gpt-oss-120b',
  evaluatorModel: 'openai/gpt-oss-20b',
  primaryModel: 'openai/gpt-oss-120b',
  secondaryModel: 'openai/gpt-oss-20b',
};

/**
 * Groq retired both legacy Llama model IDs on 2026-08-16. Keep existing
 * deployments working even when their optional Vercel overrides still contain
 * those IDs; unrelated custom model overrides remain untouched.
 */
const GROQ_RETIRED_MODEL_REPLACEMENTS: Readonly<Record<string, string>> = {
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
};

function resolveGroqModel(environmentKey: string, fallback: string): string {
  const configuredModel = process.env[environmentKey]?.trim();
  if (!configuredModel) return fallback;
  return GROQ_RETIRED_MODEL_REPLACEMENTS[configuredModel] || configuredModel;
}

export function getGroqModels(): GroqModelsConfig {
  return {
    tutorModel: resolveGroqModel('GROQ_TUTOR_MODEL', GROQ_DEFAULT_MODELS.tutorModel),
    evaluatorModel: resolveGroqModel(
      'GROQ_EVALUATOR_MODEL',
      GROQ_DEFAULT_MODELS.evaluatorModel,
    ),
    primaryModel: resolveGroqModel('GROQ_PRIMARY_MODEL', GROQ_DEFAULT_MODELS.primaryModel),
    secondaryModel: resolveGroqModel(
      'GROQ_SECONDARY_MODEL',
      GROQ_DEFAULT_MODELS.secondaryModel,
    ),
  };
}

const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';

function getGroqDiagnosticRoles(models: GroqModelsConfig) {
  return [
    {
      id: 'groq-tutor',
      name: models.tutorModel,
      role: 'Financial Tutor & Lesson Generation',
    },
    {
      id: 'groq-primary',
      name: models.primaryModel,
      role: 'Primary Financial Evaluator',
    },
    {
      id: 'groq-secondary',
      name: models.secondaryModel,
      role: 'Independent Reliability Cross-checker',
    },
  ];
}

function groqStatusFromHttp(status: number): ProviderDiagnostic['status'] {
  if (status === 401 || status === 403) return 'invalid_credentials';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'provider_unavailable';
  return 'error';
}

/** Authenticates once and verifies that every configured Groq model is active. */
export async function checkGroqDiagnostics(): Promise<ProviderDiagnostic[]> {
  const apiKey = process.env.GROQ_API_KEY?.trim() || '';
  const models = getGroqModels();
  const roles = getGroqDiagnosticRoles(models);
  if (!apiKey) {
    const lastChecked = new Date().toISOString();
    return roles.map((role) => ({
      ...role,
      status: 'not_configured',
      lastChecked,
      message: 'GROQ_API_KEY is not configured.',
    }));
  }

  const startedAt = Date.now();
  const lastChecked = new Date().toISOString();
  try {
    const response = await fetch(GROQ_MODELS_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
    });
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const status = groqStatusFromHttp(response.status);
      return roles.map((role) => ({
        ...role,
        status,
        lastChecked,
        latencyMs,
        message: `Groq model-directory check failed with HTTP ${response.status}.`,
      }));
    }

    const data = await response.json().catch(() => null);
    if (!Array.isArray(data?.data)) {
      return roles.map((role) => ({
        ...role,
        status: 'invalid_response',
        lastChecked,
        latencyMs,
        message: 'Groq returned an invalid model-directory response.',
      }));
    }

    const activeModels = new Set(
      data.data
        .map((model: unknown) =>
          model && typeof model === 'object' && 'id' in model ? (model as { id?: unknown }).id : null,
        )
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0),
    );

    return roles.map((role) => {
      const connected = activeModels.has(role.name);
      return {
        ...role,
        status: connected ? 'connected' : 'error',
        lastChecked,
        latencyMs,
        message: connected
          ? 'Authenticated Groq model directory confirms this model is active.'
          : 'The configured Groq model is no longer active for this API key.',
      };
    });
  } catch {
    return roles.map((role) => ({
      ...role,
      status: 'provider_unavailable',
      lastChecked,
      latencyMs: Date.now() - startedAt,
      message: 'Groq model-directory check timed out or the provider was unreachable.',
    }));
  }
}

function generateFallbackChatResponse(userPrompt: string): string {
  const p = userPrompt.toLowerCase();

  if (p.includes('10,000') || p.includes('10000') || (p.includes('compound') && p.includes('8%') && p.includes('5'))) {
    return `### Compound Interest Calculation\n\n` +
      `For a principal deposit of **$10,000** at **8% per annum** compounded annually over **5 years**:\n\n` +
      `**1. Formula:**\n` +
      `$$A = P(1 + r)^t$$\n\n` +
      `**2. Step-by-Step Calculation:**\n` +
      `- Principal ($P$) = $10,000\n` +
      `- Rate ($r$) = 0.08\n` +
      `- Time ($t$) = 5 years\n` +
      `- Growth factor = $(1 + 0.08)^5 = 1.08^5 = 1.469328$\n` +
      `- Final Balance ($A$) = $10,000 \\times 1.469328 = \\mathbf{\$14,693.28}$\n\n` +
      `**3. Total Interest Earned:**\n` +
      `$$\\text{Interest} = \$14,693.28 - \$10,000 = \\mathbf{\$4,693.28}$\n\n` +
      `*Note: ArthaBench deterministic engine verified exact compounding outputs.*`;
  }

  if (p.includes('50/30/20') || p.includes('budget')) {
    return `### The 50/30/20 Budgeting Rule\n\n` +
      `The 50/30/20 rule is an intuitive framework for personal financial allocation:\n\n` +
      `1. **50% Needs:** Mandatory expenses like housing, utilities, grocers, and basic insurance.\n` +
      `2. **30% Wants:** Discretionary lifestyle spending such as dining, subscriptions, and entertainment.\n` +
      `3. **20% Savings & Debt:** Contributions toward emergency funds, retirement, or high-interest debt reduction.\n\n` +
      `**Example Breakdown ($4,000 Monthly Net Income):**\n` +
      `- **Needs (50%):** $2,000\n` +
      `- **Wants (30%):** $1,200\n` +
      `- **Savings/Debt (20%):** $800`;
  }

  if (p.includes('emi') || p.includes('loan')) {
    return `### Equated Monthly Installment (EMI) Mechanics\n\n` +
      `An EMI represents the fixed payment made by a borrower to a lender on a specified date each month.\n\n` +
      `**Formula:**\n` +
      `$$E = P \\cdot \\frac{r(1+r)^n}{(1+r)^n - 1}$$\n` +
      `*Where $P$ = Loan Amount, $r$ = Monthly Rate, $n$ = Tenure in months.*\n\n` +
      `**Example:** For a $50,000 loan at 6% per annum over 5 years (60 months), monthly interest rate is 0.5% (0.005). The calculated monthly EMI is **$966.64**.`;
  }

  if (p.includes('quick ratio') || p.includes('current ratio')) {
    return `### Quick Ratio vs. Current Ratio\n\n` +
      `Both ratios measure short-term liquidity, but differ in asset strictness:\n\n` +
      `- **Current Ratio:** $\\frac{\\text{Current Assets}}{\\text{Current Liabilities}}$. Includes inventory and prepaid items.\n` +
      `- **Quick Ratio (Acid-Test):** $\\frac{\\text{Cash + Marketable Securities + Receivables}}{\\text{Current Liabilities}}$. Excludes inventory because inventory cannot always be liquidated immediately without price haircuts.`;
  }

  return `### Financial Learning Explanation\n\n` +
    `Regarding your inquiry ("*${userPrompt.trim()}*"):\n\n` +
    `**Key Concept Breakdown:**\n` +
    `1. **Core Principle:** Sound financial analysis relies on objective mathematical frameworks, liquidity evaluation, and risk-adjusted return calculations.\n` +
    `2. **Analytical Steps:** Always establish baseline numbers, account for compounding frequency, and adjust for inflation and tax liabilities.\n` +
    `3. **Risk & Limitations:** Models assume static inputs. Real-world market execution involves variance, interest rate fluctuations, and unexpected liquidity demands.\n\n` +
    `*Educational Disclaimer: ArthaBench provides non-advisory educational frameworks only.*`;
}

function buildGroqMessages(
  systemPrompt: string,
  userPrompt: string,
  history?: Array<{ role: string; content: string }>,
) {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  if (Array.isArray(history)) {
    for (const item of history.slice(-10)) {
      if (
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.trim()
      ) {
        messages.push({ role: item.role, content: item.content.slice(0, 4_000) });
      }
    }
  }

  messages.push({ role: 'user', content: userPrompt });
  return messages;
}

/**
 * Executes a Chat Completion request to Groq API.
 */
export async function callGroqChat(
  systemPrompt: string,
  userPrompt: string,
  modelName?: string,
  history?: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim() || '';
  if (!apiKey) {
    return generateFallbackChatResponse(userPrompt);
  }

  const models = getGroqModels();
  const allowedModels = new Set(Object.values(models));
  const selectedModel = modelName && allowedModels.has(modelName) ? modelName : models.tutorModel;

  const messages = buildGroqMessages(systemPrompt, userPrompt, history);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: selectedModel,
      messages,
      temperature: 0.2,
      max_tokens: 1500,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed with HTTP ${response.status}.`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Groq returned an invalid completion response.');
  }

  return text;
}

/**
 * Uses Groq Structured Outputs for a predictable, type-safe financial answer.
 * GPT-OSS models use strict JSON Schema mode; custom configured models retain
 * compatibility through JSON Object mode and server-side Zod validation.
 */
export async function callGroqStructuredFinancialAnswer(
  systemPrompt: string,
  userPrompt: string,
  options: {
    modelName?: string;
    history?: Array<{ role: string; content: string }>;
    fallbackQuestion?: string;
  } = {},
): Promise<StructuredFinancialAnswer> {
  const fallbackQuestion = options.fallbackQuestion || userPrompt;
  const apiKey = process.env.GROQ_API_KEY?.trim() || '';
  if (!apiKey) {
    return createFallbackStructuredFinancialAnswer(
      fallbackQuestion,
      generateFallbackChatResponse(fallbackQuestion),
    );
  }

  const models = getGroqModels();
  const allowedModels = new Set(Object.values(models));
  const selectedModel =
    options.modelName && allowedModels.has(options.modelName)
      ? options.modelName
      : models.tutorModel;
  const strictSchemaSupported =
    selectedModel === 'openai/gpt-oss-120b' || selectedModel === 'openai/gpt-oss-20b';
  const messages = buildGroqMessages(
    `${systemPrompt}\n\nReturn one valid JSON object only. It must match the supplied Artha financial-answer schema exactly.`,
    userPrompt,
    options.history,
  );
  const requestStructuredCompletion = (
    requestMessages: Array<{ role: string; content: string }>,
    responseFormat: Record<string, unknown>,
  ) =>
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: requestMessages,
        temperature: 0.15,
        max_tokens: 3_500,
        response_format: responseFormat,
      }),
      signal: AbortSignal.timeout(25_000),
    });

  let response: Response;
  try {
    response = await requestStructuredCompletion(
      messages,
      strictSchemaSupported
        ? {
            type: 'json_schema',
            json_schema: {
              name: 'artha_structured_financial_answer',
              strict: true,
              schema: STRUCTURED_FINANCIAL_ANSWER_JSON_SCHEMA,
            },
          }
        : { type: 'json_object' },
    );

    if (response.status === 400 && strictSchemaSupported) {
      const compatibilityMessages = buildGroqMessages(
        `${systemPrompt}\n\nReturn one valid JSON object only with exactly this contract: ${JSON.stringify(STRUCTURED_FINANCIAL_ANSWER_JSON_SCHEMA)}`,
        userPrompt,
        options.history,
      );
      response = await requestStructuredCompletion(
        compatibilityMessages,
        { type: 'json_object' },
      );
    }
  } catch {
    return createFallbackStructuredFinancialAnswer(
      fallbackQuestion,
      generateFallbackChatResponse(fallbackQuestion),
    );
  }

  if (!response.ok) {
    return createFallbackStructuredFinancialAnswer(
      fallbackQuestion,
      generateFallbackChatResponse(fallbackQuestion),
    );
  }

  const data = await response.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    return createFallbackStructuredFinancialAnswer(
      fallbackQuestion,
      generateFallbackChatResponse(fallbackQuestion),
    );
  }

  const decoded = (() => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  })();
  const parsed = structuredFinancialAnswerSchema.safeParse(decoded);
  if (!parsed.success) {
    return createFallbackStructuredFinancialAnswer(fallbackQuestion, content);
  }

  return sanitizeStructuredFinancialAnswer(parsed.data);
}

/**
 * Runs primary and secondary evaluators concurrently and evaluates using 7-dimension scoring engine.
 */
export async function runMultiModelEvaluation(
  query: string,
  scenarioContext?: {
    type?: 'COMPOUND_INTEREST' | 'CAGR' | 'QUICK_RATIO' | 'BREAK_EVEN' | 'DTI';
    inputs?: any;
    expectedAnswer?: number;
    tolerancePercent?: number;
    profile?: 'India' | 'US' | 'Global';
  }
): Promise<FullReliabilityEvaluation> {
  const startTime = Date.now();
  const apiKey = process.env.GROQ_API_KEY;
  const models = getGroqModels();

  if (!apiKey || apiKey.trim() === '') {
    // Demo / Offline Evaluation using deterministic engine ground truth
    const demoPrimaryText = `[Demo Evaluator Output for Query: "${query}"]\n\n1. Formula & Derivation:\nCompound interest is calculated using A = P * (1 + r/n)^(n*t).\nFor $10,000 at 7% over 5 years compounded monthly (n=12), the final amount is $14,176.25.\n\n2. Financial Disclaimer:\nThis is an educational simulation. Past performance is not indicative of future returns.`;
    const demoSecondaryText = `[Secondary Model Check]: Verified formula A = P * (1 + r/n)^(n*t). Final calculated result is $14,176.25.`;

    const demoReport = computeFullReliabilityEvaluation(
      query,
      demoPrimaryText,
      demoSecondaryText,
      startTime,
      scenarioContext
    );
    demoReport.demoMode = true;
    demoReport.isVerified = false;
    if (demoReport.verdict === 'HIGHLY_RELIABLE' || demoReport.verdict === 'MODERATE_RELIABILITY') {
      demoReport.verdict = 'LOW_RELIABILITY';
    }
    demoReport.riskFlags.push('Demo Mode: no live Groq evaluator was used.');
    return demoReport;
  }

  const systemPromptPrimary = `You are Artha Bench Primary Financial Evaluator. Analyze the user query. Provide a clear, mathematically sound answer with step-by-step logic, formula references, and explicit numerical outputs. Never give explicit stock buy/sell mandates.`;
  const systemPromptSecondary = `You are Artha Bench Secondary Financial Evaluator. Analyze the user query. Provide an independent mathematical and logic check.`;

  const [primaryResult, secondaryResult] = await Promise.allSettled([
    callGroqChat(systemPromptPrimary, query, models.primaryModel),
    callGroqChat(systemPromptSecondary, query, models.secondaryModel),
  ]);

  const primaryText = primaryResult.status === 'fulfilled' ? primaryResult.value : '';
  const secondaryText = secondaryResult.status === 'fulfilled' ? secondaryResult.value : '';
  const failedEvaluatorCount = Number(primaryResult.status === 'rejected') + Number(secondaryResult.status === 'rejected');

  const report = computeFullReliabilityEvaluation(
    query,
    primaryText,
    secondaryText,
    startTime,
    scenarioContext
  );

  if (failedEvaluatorCount === 2) {
    report.overallScore = 0;
    report.metrics.overallReliabilityScore = 0;
    report.metrics.dualModelConsensusScore = 0;
    report.consensus.score = 0;
    report.consensus.pass = false;
    report.verdict = 'REJECTED';
    report.isVerified = false;
    report.riskFlags.push('Both Groq evaluators failed; the response is rejected.');
    return report;
  }

  if (failedEvaluatorCount === 1) {
    report.overallScore = Math.min(report.overallScore, 59);
    report.metrics.overallReliabilityScore = report.overallScore;
    report.metrics.dualModelConsensusScore = 0;
    report.consensus.score = 0;
    report.consensus.pass = false;
    report.verdict = 'LOW_RELIABILITY';
    report.isVerified = false;
    report.riskFlags.push('One Groq evaluator failed; consensus is unavailable.');
    return report;
  }

  const hasVerifiedEvidence = report.evidenceSources.some((source) => source.verified);
  report.isVerified =
    report.verdict === 'HIGHLY_RELIABLE' &&
    report.consensus.pass &&
    report.safety.safe &&
    (!report.groundTruth.hasNumericalCheck || report.groundTruth.pass) &&
    hasVerifiedEvidence;
  return report;
}
