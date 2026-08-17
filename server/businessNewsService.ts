/**
 * Business News Service & AI News Explanation Router
 */

import { NormalizedNewsItem, StructuredFinancialAnswer } from '../src/types';
import { fetchNewsFromProvider } from './providers/newsProvider';
import { callGroqStructuredFinancialAnswer } from './groqService';
import {
  buildStructuredFinancialAnswerInstructions,
  createFallbackStructuredFinancialAnswer,
  serializeStructuredFinancialAnswer,
} from './aiResponseStandard';

export async function getBusinessNews(
  query = '',
  category = 'all',
  region = 'global',
  page = 1
) {
  return fetchNewsFromProvider(query, category, region, page);
}

export async function explainNewsArticle(article: {
  articleId: string;
  title: string;
  summary?: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt?: string | null;
}) {
  const systemPrompt = `You are ArthaBench, an educational business-news analyst.
Explain the provided news headline and short summary in plain English for learners.
CRITICAL RULES:
1. Do not invent facts not present in the article or summary.
2. Do not offer stock tips or buy/sell advice.
3. Highlight key business metrics, economic implications, and educational context.
4. Treat the supplied summary as a limited excerpt, not the complete article.
5. If no meaningful equation applies, put the decision method in the formula section instead of inventing a formula.
${buildStructuredFinancialAnswerInstructions({
  audience: 'tutor',
  language: 'English',
  level: 'beginner',
  detail: 'short',
  hasVerifiedCurrentData: true,
})}`;

  const userPrompt = `News Title: ${article.title}
Summary: ${article.summary || 'N/A'}
Source: ${article.sourceName}
Published: ${article.publishedAt || 'Publication time unavailable'}

Please explain:
1. What this news means in simple terms
2. Key economic/business concepts involved
3. A step-by-step method for evaluating the claim
4. A numerical example if supported; otherwise a clearly labelled illustrative example
5. Key limitations caused by having only a headline and summary`;

  let structuredAnswer: StructuredFinancialAnswer;
  try {
    structuredAnswer = await callGroqStructuredFinancialAnswer(
      systemPrompt,
      userPrompt,
      { fallbackQuestion: article.title },
    );
  } catch {
    structuredAnswer = createFallbackStructuredFinancialAnswer(
      article.title,
      `The supplied headline and summary from ${article.sourceName} are a starting point for analysis. Verify the full article and any linked primary filing or official data release before drawing a conclusion.`,
    );
  }

  return {
    explanation: serializeStructuredFinancialAnswer(structuredAnswer),
    structuredAnswer,
    keyTakeaways: structuredAnswer.keyTakeaways,
    disclaimer:
      'AI explanation generated from the supplied headline and summary for educational analysis only. Not investment advice.',
  };
}
