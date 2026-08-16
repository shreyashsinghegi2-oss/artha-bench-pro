/**
 * Business News Service & AI News Explanation Router
 */

import { NormalizedNewsItem } from '../src/types';
import { fetchNewsFromProvider } from './providers/newsProvider';
import { callGroqChat } from './groqService';
import { sanitizeAIOutput } from './learningSafety';

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
  const systemPrompt = `You are Artha Bench, an educational business analyst.
Explain the provided news headline and short summary in plain English for learners.
CRITICAL RULES:
1. Do not invent facts not present in the article or summary.
2. Do not offer stock tips or buy/sell advice.
3. Highlight key business metrics, economic implications, and educational context.`;

  const userPrompt = `News Title: ${article.title}
Summary: ${article.summary || 'N/A'}
Source: ${article.sourceName}

Please explain:
1. What this news means in simple terms
2. Key economic/business concepts involved
3. 2 key takeaways for students or analysts`;

  let explanationText = '';
  try {
    const rawAi = await callGroqChat(systemPrompt, userPrompt);
    explanationText = sanitizeAIOutput(rawAi);
  } catch (err: any) {
    explanationText = `**Educational Context for "${article.title}"**\n\n` +
      `This news item touches on key economic indicators and corporate announcements from **${article.sourceName}**.\n\n` +
      `**Key Takeaways:**\n` +
      `- Monitor central bank decisions and corporate quarterly filings for official updates.\n` +
      `- Evaluate broad market metrics rather than single headlines when conducting business analysis.`;
  }

  return {
    explanation: explanationText,
    keyTakeaways: [
      'Focus on broad macroeconomic drivers rather than single daily headlines.',
      'Always verify news claims against official company SEC/regulatory filings.',
    ],
    disclaimer:
      'AI explanation generated for educational analysis only. Not investment advice.',
  };
}
