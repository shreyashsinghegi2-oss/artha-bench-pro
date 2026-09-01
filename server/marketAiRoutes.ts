import { Router } from 'express';
import { z } from 'zod';
import { callGroqChat } from './groqService';

export const marketAiRouter = Router();

const evidenceSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(160),
  sourceType: z.enum([
    'market_quote',
    'market_history',
    'economic_indicator',
    'company_profile',
    'news',
    'user_record',
    'calculation',
    'learning_content',
    'provider_status',
  ]),
  providerName: z.string().max(120).optional(),
  sourceUrl: z.string().url().max(500).optional(),
  timestamp: z.string().max(100).optional(),
  retrievedAt: z.string().max(100).optional(),
  freshnessState: z.string().max(80).optional(),
  valueSummary: z.string().max(500).optional(),
});

const requestSchema = z.object({
  page: z.string().min(1).max(120),
  question: z.string().min(2).max(600),
  visibleData: z.unknown(),
  evidence: z.array(evidenceSchema).max(20),
});

const SAFE_REDIRECT = 'I can help you inspect the visible market data, explain chart concepts, compare timestamped references, review risk concepts, and create an educational research checklist. I cannot provide personalised buy/sell instructions, entry/exit levels, targets, stop-losses, leverage guidance, or profit guarantees.';
const DISCLAIMER = 'Educational analysis only — not personalised investment, trading, tax, legal, or financial advice.';

function unsafeAdvice(question: string) {
  return /\b(buy|sell|hold|short|long|entry|exit|target(?:\s+price)?|stop[- ]?loss|leverage|sure[- ]?shot|guarantee(?:d)?|what\s+should\s+i\s+invest|which\s+stock\s+will\s+rise|how\s+much\s+should\s+i\s+trade)\b/i.test(question);
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value).slice(0, 7_500);
  } catch {
    return '{}';
  }
}

function parseSections(text: string) {
  const headings = [
    'What the visible data shows',
    'Price/range context',
    'Chart observation',
    'Source and freshness',
    'Data limitations',
    'Educational concepts',
    'Research questions the user can inspect next',
  ];
  const sections: Array<{ title: string; content: string }> = [];
  for (let index = 0; index < headings.length; index += 1) {
    const title = headings[index];
    const nextTitle = headings[index + 1];
    const startPattern = new RegExp(`(?:^|\\n)(?:#{1,4}\\s*)?${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?\\s*`, 'i');
    const match = text.match(startPattern);
    if (!match || match.index == null) continue;
    const start = match.index + match[0].length;
    let end = text.length;
    if (nextTitle) {
      const tail = text.slice(start);
      const nextPattern = new RegExp(`(?:^|\\n)(?:#{1,4}\\s*)?${nextTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?\\s*`, 'i');
      const next = tail.match(nextPattern);
      if (next?.index != null) end = start + next.index;
    }
    const content = text.slice(start, end).trim();
    if (content) sections.push({ title, content: content.slice(0, 1_800) });
  }
  if (!sections.length && text.trim()) sections.push({ title: 'What the visible data shows', content: text.trim().slice(0, 2_000) });
  return sections;
}

marketAiRouter.post('/markets/explain', async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      answer: 'The market explanation request was invalid.',
      sections: [],
      evidence: [],
      limitations: ['No AI response was generated.'],
      suggestedActions: [{ label: 'Retry', actionType: 'retry' }],
      generatedAt: new Date().toISOString(),
      requestId: res.getHeader('x-request-id') ?? null,
    });
  }

  const { page, question, visibleData, evidence } = parsed.data;
  if (unsafeAdvice(question)) {
    return res.json({
      status: 'safety_redirect',
      answer: SAFE_REDIRECT,
      sections: [{ title: 'Safety boundary', content: SAFE_REDIRECT }],
      evidence,
      limitations: [DISCLAIMER],
      suggestedActions: [{ label: 'Review visible data', actionType: 'learn_more' }],
      generatedAt: new Date().toISOString(),
      requestId: res.getHeader('x-request-id') ?? null,
    });
  }

  if (!evidence.length) {
    const answer = 'No verified evidence is available for this request. ArthaMind cannot provide a data-grounded explanation until a supported source is available.';
    return res.json({
      status: 'insufficient_context',
      answer,
      sections: [{ title: 'Data limitations', content: answer }],
      evidence: [],
      limitations: [DISCLAIMER],
      suggestedActions: [{ label: 'Retry data source', actionType: 'retry' }],
      generatedAt: new Date().toISOString(),
      requestId: res.getHeader('x-request-id') ?? null,
    });
  }

  if (!process.env.GROQ_API_KEY?.trim()) {
    const answer = 'ArthaMind AI is not configured in this deployment. The verified evidence remains visible below, but no AI interpretation was generated.';
    return res.json({
      status: 'provider_unavailable',
      answer,
      sections: [{ title: 'Data limitations', content: answer }],
      evidence,
      limitations: ['AI provider configuration is unavailable.', DISCLAIMER],
      suggestedActions: [{ label: 'Retry', actionType: 'retry' }],
      generatedAt: new Date().toISOString(),
      requestId: res.getHeader('x-request-id') ?? null,
    });
  }

  const systemPrompt = `You are ArthaMind Market Explainer. Use ONLY the supplied visibleData and evidence records. Never invent prices, timestamps, providers, news, company facts, indicators, bid/ask values, chart observations, or citations. Never forecast a future price or provide buy/sell/hold calls, entries, exits, targets, stop-losses, leverage guidance, personalised allocation, or profit guarantees. If a field is missing, explicitly say it is unavailable. Preserve freshness states and explain delayed, cached, stale, end-of-day or unavailable data clearly. Return plain text using these exact headings in this exact order:\nWhat the visible data shows\nPrice/range context\nChart observation\nSource and freshness\nData limitations\nEducational concepts\nResearch questions the user can inspect next\nEnd with: ${DISCLAIMER}`;
  const userPrompt = `Page: ${page}\nQuestion: ${question}\nVisible data: ${safeJson(visibleData)}\nVerified evidence records: ${safeJson(evidence)}`;

  try {
    const answer = await callGroqChat(systemPrompt, userPrompt);
    return res.json({
      status: 'success',
      answer,
      sections: parseSections(answer),
      evidence,
      limitations: [DISCLAIMER],
      suggestedActions: [
        { label: 'Ask follow-up', actionType: 'learn_more' },
        { label: 'Retry', actionType: 'retry' },
      ],
      generatedAt: new Date().toISOString(),
      requestId: res.getHeader('x-request-id') ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const rateLimited = message.includes('429');
    return res.status(rateLimited ? 429 : 503).json({
      status: rateLimited ? 'rate_limited' : 'provider_unavailable',
      answer: rateLimited
        ? 'ArthaMind is temporarily rate limited. The verified evidence remains visible and no substitute analysis was generated.'
        : 'ArthaMind Market Explainer is unavailable right now. The verified evidence remains visible and no substitute analysis was generated.',
      sections: [],
      evidence,
      limitations: [DISCLAIMER],
      suggestedActions: [{ label: 'Retry', actionType: 'retry' }],
      generatedAt: new Date().toISOString(),
      requestId: res.getHeader('x-request-id') ?? null,
    });
  }
});
