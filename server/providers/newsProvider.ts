/**
 * NewsData.io server adapter.
 *
 * Credentials are read only from server-side environment variables:
 * BUSINESS_NEWS_PROVIDER, BUSINESS_NEWS_API_KEY, BUSINESS_NEWS_BASE_URL.
 */

import { z } from 'zod';
import { NormalizedNewsItem, ProviderDiagnostic } from '../../src/types';
import { DEMO_NEWS_ITEMS } from '../../src/data/newsFixtures';

const DEFAULT_NEWSDATA_URL = 'https://newsdata.io/api/1/latest';

const newsDataArticleSchema = z.object({
  article_id: z.string().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  pubDate: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  source_id: z.string().nullable().optional(),
  source_name: z.string().nullable().optional(),
  category: z.array(z.string()).nullable().optional(),
  country: z.array(z.string()).nullable().optional(),
}).passthrough();

const newsDataResponseSchema = z.object({
  status: z.string(),
  results: z.array(newsDataArticleSchema).optional().default([]),
  nextPage: z.string().nullable().optional(),
}).passthrough();

export interface NewsProviderResult {
  items: NormalizedNewsItem[];
  status:
    | 'connected'
    | 'not_configured'
    | 'invalid_credentials'
    | 'invalid_response'
    | 'rate_limited'
    | 'error';
  message?: string;
  providerName: string;
  nextPage?: string;
}

function filterDemoNews(query: string, category: string) {
  let filtered = DEMO_NEWS_ITEMS;
  if (query) {
    const normalizedQuery = query.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.summary.toLowerCase().includes(normalizedQuery),
    );
  }
  if (category && category !== 'all') {
    const normalizedCategory = category.toLowerCase();
    filtered = filtered.filter((item) =>
      item.category.toLowerCase().includes(normalizedCategory),
    );
  }
  return filtered;
}

function mapCategory(category: string) {
  const normalized = category.toLowerCase();
  const categoryMap: Record<string, string> = {
    corporate: 'business',
    earnings: 'business',
    macroeconomics: 'business',
    markets: 'business',
    policy: 'politics',
    tech: 'technology',
  };
  if (!normalized || normalized === 'all') return undefined;
  return categoryMap[normalized] || normalized;
}

function mapRegion(region: string) {
  const normalized = region.toLowerCase();
  const regionMap: Record<string, string> = {
    india: 'in',
    us: 'us',
    usa: 'us',
    uk: 'gb',
  };
  if (!normalized || normalized === 'global' || normalized === 'all') return undefined;
  return regionMap[normalized] || normalized;
}

function toIsoDate(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function safeArticleUrl(value?: string | null) {
  if (!value) return '#';
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '#';
  } catch {
    return '#';
  }
}

function getConfiguration() {
  return {
    provider: (process.env.BUSINESS_NEWS_PROVIDER || 'newsdata').trim().toLowerCase(),
    apiKey: process.env.BUSINESS_NEWS_API_KEY?.trim() || '',
    baseUrl: process.env.BUSINESS_NEWS_BASE_URL?.trim() || DEFAULT_NEWSDATA_URL,
  };
}

export async function fetchNewsFromProvider(
  query = '',
  category = 'all',
  region = 'global',
  page: number | string = 1,
): Promise<NewsProviderResult> {
  const { provider, apiKey, baseUrl } = getConfiguration();
  const demoItems = filterDemoNews(query, category);

  if (!apiKey) {
    return {
      items: demoItems,
      status: 'not_configured',
      providerName: 'Demo News Fixtures',
      message: 'NewsData API key is not configured. Displaying labelled demo fixtures.',
    };
  }

  if (provider !== 'newsdata' && provider !== 'newsdata.io') {
    return {
      items: demoItems,
      status: 'error',
      providerName: provider || 'Unknown Provider',
      message: 'Unsupported business-news provider configuration.',
    };
  }

  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:') {
      throw new Error('News provider URL must use HTTPS.');
    }
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('language', 'en');
    if (query.trim()) url.searchParams.set('q', query.trim());

    const providerCategory = mapCategory(category);
    if (providerCategory) url.searchParams.set('category', providerCategory);

    const country = mapRegion(region);
    if (country) url.searchParams.set('country', country);

    // NewsData pagination uses an opaque nextPage token, not a numeric page number.
    if (typeof page === 'string' && page && !/^\d+$/.test(page)) {
      url.searchParams.set('page', page);
    }

    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) {
      const status =
        response.status === 401 || response.status === 403
          ? 'invalid_credentials'
          : response.status === 429
            ? 'rate_limited'
            : 'error';
      return {
        items: demoItems,
        status,
        providerName: 'NewsData.io',
        message:
          status === 'invalid_credentials'
            ? 'NewsData rejected the configured credential.'
            : status === 'rate_limited'
              ? 'NewsData rate limit reached. Displaying labelled demo fixtures.'
              : `NewsData request failed with HTTP ${response.status}.`,
      };
    }

    const parsed = newsDataResponseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.status.toLowerCase() !== 'success') {
      return {
        items: demoItems,
        status: 'invalid_response',
        providerName: 'NewsData.io',
        message: 'NewsData returned an unexpected response. Displaying labelled demo fixtures.',
      };
    }

    const retrievedAt = new Date().toISOString();
    const items: NormalizedNewsItem[] = parsed.data.results.map((article, index) => ({
      id: article.article_id || `newsdata-${Date.now()}-${index}`,
      title: article.title?.trim() || 'Untitled article',
      summary: article.description?.trim() || 'No summary supplied by the publisher.',
      sourceName: article.source_name || article.source_id || 'NewsData source',
      sourceUrl: safeArticleUrl(article.link),
      publishedAt: toIsoDate(article.pubDate),
      retrievedAt,
      category: article.category?.[0] || providerCategory || 'business',
      region: article.country?.[0] || country || 'global',
      imageUrl: safeArticleUrl(article.image_url) === '#' ? null : safeArticleUrl(article.image_url),
    }));

    return {
      items,
      status: 'connected',
      providerName: 'NewsData.io',
      nextPage: parsed.data.nextPage || undefined,
      message: items.length > 0 ? 'Live NewsData headlines loaded.' : 'NewsData returned no matching headlines.',
    };
  } catch {
    return {
      items: demoItems,
      status: 'error',
      providerName: 'NewsData.io',
      message: 'NewsData is temporarily unreachable. Displaying labelled demo fixtures.',
    };
  }
}

export async function checkNewsProviderDiagnostic(): Promise<ProviderDiagnostic> {
  const startedAt = Date.now();
  const result = await fetchNewsFromProvider('', 'business', 'global');
  return {
    id: 'business-news',
    name: 'NewsData.io',
    role: 'Live business-news headlines',
    status: result.status,
    lastChecked: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    message: result.message,
  };
}
