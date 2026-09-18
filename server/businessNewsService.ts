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

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

function stripHtml(value: string) {
  return decodeXml(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function extractAttribute(block: string, tag: string, attribute: string) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*\\b${attribute}=["']([^"']+)["'][^>]*>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

async function fetchRssFeed(feedUrl: string, sourceName: string, category = 'Business'): Promise<NormalizedNewsItem[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
        'User-Agent': 'ArthaBench-Pro/2.0',
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
    const retrievedAt = new Date().toISOString();

    return blocks.slice(0, 12).flatMap((block, index) => {
      const title = stripHtml(extractTag(block, 'title'));
      const url = safeHttpUrl(extractTag(block, 'link'));
      const publishedAt = extractTag(block, 'pubDate');
      const description = stripHtml(extractTag(block, 'description'));
      const imageUrl =
        safeHttpUrl(extractAttribute(block, 'media:content', 'url')) ||
        safeHttpUrl(extractAttribute(block, 'media:thumbnail', 'url')) ||
        safeHttpUrl(extractAttribute(block, 'enclosure', 'url'));
      if (!title || !url) return [];
      const timestamp = Date.parse(publishedAt);
      return [{
        id: `rss-${sourceName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${timestamp || retrievedAt}-${index}`,
        title,
        summary: description || 'Open the original publisher article for the full report.',
        sourceName,
        sourceUrl: url,
        publishedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
        retrievedAt,
        category,
        region: 'global',
        imageUrl: imageUrl || null,
      }];
    });
  } catch {
    return [];
  }
}

async function fetchPublicNewsFallback(category = 'business'): Promise<NormalizedNewsItem[]> {
  const feeds = category.trim().toLowerCase() === 'all'
    ? [
        ['https://feeds.bbci.co.uk/news/rss.xml', 'BBC News'],
        ['https://feeds.bbci.co.uk/news/technology/rss.xml', 'BBC Technology'],
        ['https://finance.yahoo.com/rss/topstories', 'Yahoo Finance'],
        ['https://www.cnbc.com/id/100003114/device/rss/rss.html', 'CNBC'],
      ] as const
    : [
        ['https://finance.yahoo.com/rss/topstories', 'Yahoo Finance'],
        ['https://www.cnbc.com/id/100003114/device/rss/rss.html', 'CNBC'],
      ] as const;
  const results = await Promise.all(feeds.map(([url, source]) => fetchRssFeed(url, source, category)));
  const seen = new Set<string>();
  return results
    .flat()
    .filter((item) => {
      const key = `${item.title.toLowerCase()}|${item.sourceUrl.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (Date.parse(b.publishedAt || '') || 0) - (Date.parse(a.publishedAt || '') || 0))
    .slice(0, 10);
}

export async function getBusinessNews(
  query = '',
  category = 'business',
  region = 'global',
  page = 1,
) {
  const providerResult = await fetchNewsFromProvider(query, category, region, page);
  if (providerResult.items.length) return providerResult;

  const fallbackItems = await fetchPublicNewsFallback(category);
  if (fallbackItems.length) {
    return {
      items: fallbackItems,
      status: 'connected' as const,
      providerName: `${providerResult.providerName} + public RSS fallback`,
      message: providerResult.message
        ? `${providerResult.message} Public RSS fallback supplied ${fallbackItems.length} headlines.`
        : `Public RSS fallback supplied ${fallbackItems.length} headlines.`,
    };
  }

  return providerResult;
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
