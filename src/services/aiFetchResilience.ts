import { buildFallbackStructuredAnswer, buildGroundedFallbackAnswer } from './reliableTutor';

const FALLBACK_PATHS = new Set([
  '/api/dashboard/assistant',
  '/api/personal/assistant',
  '/api/company/assistant',
  '/api/crypto/assistant',
  '/api/finance/scenario-assistant',
  '/api/news/explain',
]);

const DISCLAIMER = 'Educational analysis only — not personalised investment, trading, tax, legal, lending, credit, or financial advice.';

function requestPath(input: RequestInfo | URL) {
  try {
    if (typeof input === 'string') return new URL(input, window.location.origin).pathname;
    if (input instanceof URL) return input.pathname;
    return new URL(input.url, window.location.origin).pathname;
  } catch {
    return '';
  }
}

function requestPayload(init?: RequestInit): Record<string, any> {
  if (typeof init?.body !== 'string') return {};
  try {
    const parsed = JSON.parse(init.body);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function sourceLabelsFromDashboard(snapshot: any) {
  const labels = new Set<string>(['Visible dashboard snapshot']);
  for (const quote of Array.isArray(snapshot?.quotes) ? snapshot.quotes : []) {
    if (typeof quote?.providerName === 'string' && quote.providerName) labels.add(quote.providerName);
  }
  for (const item of Array.isArray(snapshot?.economicIndicators) ? snapshot.economicIndicators : []) {
    if (typeof item?.sourceName === 'string' && item.sourceName) labels.add(item.sourceName);
  }
  return [...labels].slice(0, 8);
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Artha-Fallback': 'grounded-client',
    },
  });
}

function fallbackFor(path: string, body: Record<string, any>) {
  const now = new Date().toISOString();
  const question = String(body.question || body.userPrompt || 'Explain the visible information.').slice(0, 1200);

  if (path === '/api/dashboard/assistant') {
    const snapshot = body.snapshot || {};
    const sources = sourceLabelsFromDashboard(snapshot);
    const answer = buildGroundedFallbackAnswer(question, snapshot);
    return jsonResponse({
      answer,
      structuredAnswer: buildFallbackStructuredAnswer({ title: 'ArthaMind dashboard fallback', question, answer, sourceLabels: sources, dataAsOf: snapshot.capturedAt || now }),
      provider: 'demo',
      model: null,
      groundedAt: now,
      sourceLabels: sources,
      suggestedQuestions: ['Explain the selected market snapshot.', 'What data is missing from this dashboard?', 'Summarise provider freshness and limitations.'],
      disclaimer: DISCLAIMER,
      requestId: `fallback-${Date.now()}`,
    });
  }

  if (path === '/api/personal/assistant') {
    const publicContext = body.publicContext || {};
    const answer = `${buildGroundedFallbackAnswer(question, publicContext)}\n\nPersonal context note\nThe authenticated personal-data endpoint was unavailable, so this fallback did not read or infer private finance records.`;
    return jsonResponse({
      answer,
      structuredAnswer: buildFallbackStructuredAnswer({ title: 'ArthaMind public-context fallback', question, answer, sourceLabels: ['Visible public dashboard snapshot'], dataAsOf: publicContext.capturedAt || now }),
      provider: 'demo',
      model: null,
      groundedAt: now,
      sourceLabels: ['Visible public dashboard snapshot'],
      suggestedQuestions: ['Explain the visible public data.', 'What personal context is unavailable right now?', 'What can I verify directly on the dashboard?'],
      disclaimer: DISCLAIMER,
      requestId: `fallback-${Date.now()}`,
      personalDataUsed: false,
      personalContextReferences: ['Personal endpoint unavailable — fallback used public dashboard context only.'],
    });
  }

  if (path === '/api/company/assistant') {
    const symbol = String(body.symbol || 'Selected company').toUpperCase();
    const visible = { symbol, note: 'Company-provider evidence was not included in this failed assistant request.' };
    const answer = `${buildGroundedFallbackAnswer(question, visible)}\n\nCompany evidence limitation\nThe company AI endpoint was unavailable. No valuation ratio, earnings figure, analyst trend, target, fundamental, or company fact has been invented.`;
    return jsonResponse({
      symbol,
      answer,
      structuredAnswer: buildFallbackStructuredAnswer({ title: `${symbol} company assistant fallback`, question, answer, sourceLabels: [`Selected identity: ${symbol}`], dataAsOf: now }),
      provider: 'demo',
      model: null,
      groundedAt: now,
      disclaimer: DISCLAIMER,
      suggestedQuestions: ['Explain what company data is currently unavailable.', 'What should I verify from the visible company panel?', 'Explain the difference between quote data and fundamentals.'],
      requestId: `fallback-${Date.now()}`,
    });
  }

  if (path === '/api/crypto/assistant') {
    const context = body.context || {};
    const answer = buildGroundedFallbackAnswer(question, context);
    return jsonResponse({ answer });
  }

  if (path === '/api/finance/scenario-assistant') {
    const visible = {
      scenario: body.scenario,
      profile: body.profile,
      currency: body.currency,
      companySymbol: body.companySymbol || null,
      useExternalContext: Boolean(body.useExternalContext),
      inputs: body.inputs || {},
    };
    const answer = `${buildGroundedFallbackAnswer(question, visible)}\n\nCalculation boundary\nThe scenario AI endpoint was unavailable, so this fallback does not claim a newly verified deterministic result. Use the calculator's visible deterministic result as the numerical source of truth.`;
    return jsonResponse({
      structuredAnswer: buildFallbackStructuredAnswer({ title: 'ArthaMind scenario fallback', question, answer, sourceLabels: ['Visible scenario inputs / calculator state'], dataAsOf: now }),
      sourceLabels: ['Visible scenario inputs / calculator state'],
      contextNotes: ['External AI generation unavailable; no hidden market or company fact was substituted.'],
      suggestedQuestions: ['Which visible assumption should I review?', 'What data is missing from this scenario?', 'Explain the limitation of this fallback.'],
      groundedAt: now,
      engine: 'Client grounded fallback — no new calculation',
      disclaimer: DISCLAIMER,
    });
  }

  if (path === '/api/news/explain') {
    const visible = {
      title: body.title,
      summary: body.summary,
      sourceName: body.sourceName,
      sourceUrl: body.sourceUrl,
      publishedAt: body.publishedAt,
    };
    const answer = buildGroundedFallbackAnswer(question || `Explain this supplied headline: ${body.title || ''}`, visible);
    const structuredAnswer = buildFallbackStructuredAnswer({ title: 'News explanation fallback', question, answer, sourceLabels: [String(body.sourceName || 'Supplied news source')], dataAsOf: body.publishedAt || now });
    return jsonResponse({
      explanation: answer,
      structuredAnswer,
      keyTakeaways: structuredAnswer.keyTakeaways,
      disclaimer: DISCLAIMER,
    });
  }

  return null;
}

export function installAiFetchResilience() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const marker = '__arthaAiFetchResilienceInstalled';
  const state = window as typeof window & Record<string, unknown>;
  if (state[marker]) return;
  state[marker] = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = requestPath(input);
    const isFallbackPath = FALLBACK_PATHS.has(path);
    try {
      const response = await nativeFetch(input, init);
      if (!isFallbackPath || response.ok || (response.status !== 404 && response.status !== 429 && response.status < 500)) return response;
      return fallbackFor(path, requestPayload(init)) || response;
    } catch (error) {
      if (!isFallbackPath) throw error;
      const fallback = fallbackFor(path, requestPayload(init));
      if (fallback) return fallback;
      throw error;
    }
  }) as typeof window.fetch;
}
