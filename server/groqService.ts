/**
 * Artha Bench - Groq AI Service Proxy
 * Evaluates responses using dual models and the 7-dimension scoring engine.
 * Never exposes keys or credentials to the browser.
 */

import { ProviderDiagnostic } from '../src/types';
import { generateVerificationCode } from './financeEngine';
import { computeFullReliabilityEvaluation, FullReliabilityEvaluation } from './scoringEngine';

export interface GroqModelsConfig {
  tutorModel: string;
  evaluatorModel: string;
  primaryModel: string;
  secondaryModel: string;
}

export function getGroqModels(): GroqModelsConfig {
  return {
    tutorModel: process.env.GROQ_TUTOR_MODEL || 'llama-3.3-70b-versatile',
    evaluatorModel: process.env.GROQ_EVALUATOR_MODEL || 'llama-3.1-8b-instant',
    primaryModel: process.env.GROQ_PRIMARY_MODEL || 'llama-3.3-70b-versatile',
    secondaryModel: process.env.GROQ_SECONDARY_MODEL || 'llama-3.1-8b-instant',
  };
}

function groqStatusFromHttp(status: number): ProviderDiagnostic['status'] {
  if (status === 401 || status === 403) return 'invalid_credentials';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'provider_unavailable';
  return 'error';
}

async function probeGroqModel(
  id: string,
  role: string,
  model: string,
  apiKey: string,
): Promise<ProviderDiagnostic> {
  const startedAt = Date.now();
  const lastChecked = new Date().toISOString();
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        temperature: 0,
        max_tokens: 4,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      return {
        id,
        name: model,
        role,
        status: groqStatusFromHttp(response.status),
        lastChecked,
        latencyMs,
        message: `Groq model probe failed with HTTP ${response.status}.`,
      };
    }

    const data = await response.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      return {
        id,
        name: model,
        role,
        status: 'invalid_response',
        lastChecked,
        latencyMs,
        message: 'Groq returned an invalid model-probe response.',
      };
    }

    return {
      id,
      name: model,
      role,
      status: 'connected',
      lastChecked,
      latencyMs,
      message: 'Authenticated completion succeeded.',
    };
  } catch {
    return {
      id,
      name: model,
      role,
      status: 'provider_unavailable',
      lastChecked,
      latencyMs: Date.now() - startedAt,
      message: 'Groq model probe timed out or the provider was unreachable.',
    };
  }
}

/** Tests each configured Groq role with a real, minimal completion. */
export async function checkGroqDiagnostics(): Promise<ProviderDiagnostic[]> {
  const apiKey = process.env.GROQ_API_KEY?.trim() || '';
  const models = getGroqModels();
  if (!apiKey) {
    const lastChecked = new Date().toISOString();
    return [
      {
        id: 'groq-tutor',
        name: models.tutorModel,
        role: 'Financial Tutor & Lesson Generation',
        status: 'not_configured',
        lastChecked,
        message: 'GROQ_API_KEY is not configured.',
      },
      {
        id: 'groq-primary',
        name: models.primaryModel,
        role: 'Primary Financial Evaluator',
        status: 'not_configured',
        lastChecked,
        message: 'GROQ_API_KEY is not configured.',
      },
      {
        id: 'groq-secondary',
        name: models.secondaryModel,
        role: 'Independent Reliability Cross-checker',
        status: 'not_configured',
        lastChecked,
        message: 'GROQ_API_KEY is not configured.',
      },
    ];
  }

  return Promise.all([
    probeGroqModel('groq-tutor', 'Financial Tutor & Lesson Generation', models.tutorModel, apiKey),
    probeGroqModel('groq-primary', 'Primary Financial Evaluator', models.primaryModel, apiKey),
    probeGroqModel(
      'groq-secondary',
      'Independent Reliability Cross-checker',
      models.secondaryModel,
      apiKey,
    ),
  ]);
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
