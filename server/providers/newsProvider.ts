/** Production business-news provider built around NewsData.io. */
import { z } from 'zod';
import type { NormalizedNewsItem, ProviderDiagnostic } from '../../src/types';

const DEFAULT_NEWSDATA_URL = 'https://newsdata.io/api/1/latest';
const DEFAULT_MARKET_NEWSDATA_URL = 'https://newsdata.io/api/1/market';
const DEFAULT_CRYPTO_NEWSDATA_URL = 'https://newsdata.io/api/1/crypto';
const CACHE_TTL_MS = 45_000;
const REQUEST_TIMEOUT_MS = 4_500;
const MAX_ITEMS = 10;

type CacheEntry = { expiresAt: number; result: NewsProviderResult };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<NewsProviderResult>>();

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
  status: 'connected' | 'not_configured' | 'invalid_credentials' | 'invalid_response' | 'rate_limited' | 'error';
  message?: string;
  providerName: string;
  nextPage?: string;
  mode?: 'live' | 'cached' | 'fallback';
}

function mapCategory(category: string) {
  const normalized = category.trim().toLowerCase();
  const map: Record<string, string> = {
    corporate: 'business',
    earnings: 'business',
    macroeconomics: 'business',
    markets: 'business',
    policy: 'business',
    tech: 'technology',
  };
  return map[normalized] || (normalized === 'all' || !normalized ? 'business' : normalized);
}

function categoryQuery(category: string) {
  switch (category.trim().toLowerCase()) {
    case 'macroeconomics': return '(inflation OR GDP OR economy OR "interest rates" OR central bank OR monetary policy)';
    case 'corporate': return '(earnings OR companies OR merger OR acquisition OR revenue OR profit)';
    case 'tech': return '(AI OR technology OR software OR semiconductor OR cloud OR startup)';
    case 'policy': return '(central bank OR monetary policy OR interest rates OR regulation OR fiscal policy)';
    case 'business': return '(business OR markets OR economy OR finance OR investing OR companies)';
    default: return '(business OR markets OR economy OR finance OR investing OR companies OR AI)';
  }
}

function regionQuery(region: string) {
  const normalized = region.trim().toLowerCase();
  if (normalized === 'india' || normalized === 'in') return 'India';
  if (normalized === 'us' || normalized === 'usa') return 'US';
  return '';
}

function toIsoDate(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function safeUrl(value?: string | null) {
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
    apiKey: process.env.BUSINESS_NEWS_API_KEY?.trim() || '',
    baseUrl: process.env.BUSINESS_NEWS_BASE_URL?.trim() || DEFAULT_NEWSDATA_URL,
  };
}

function buildQuery(query: string, category: string, region: string) {
  const parts: string[] = [];
  if (query.trim()) parts.push(query.trim());
  else if (category.trim().toLowerCase() !== 'all') parts.push(categoryQuery(category));
  const regionPart = regionQuery(region);
  if (regionPart) parts.push(regionPart);
  return parts.join(' ');
}

async function fetchNewsData(query: string, category: string, region: string, page: number | string, endpointUrl = getConfiguration().baseUrl, providerName = 'NewsData.io'): Promise<NewsProviderResult> {
  const { apiKey, baseUrl } = getConfiguration();
  if (!apiKey) {
    return {
      items: [],
      status: 'not_configured',
      providerName,
      message: `${providerName} is not connected. Add BUSINESS_NEWS_API_KEY to the production environment.`
    };
  }

  const url = new URL(endpointUrl || baseUrl);
  if (url.protocol !== 'https:') throw new Error('News provider URL must use HTTPS.');
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('language', 'en');
  const normalizedCategory = category.trim().toLowerCase();
  const builtQuery = buildQuery(query, category, region);
  if (builtQuery) url.searchParams.set('q', builtQuery);
  if (normalizedCategory !== 'all' && providerName === 'NewsData.io') url.searchParams.set('category', mapCategory(category));
  if (normalizedCategory === 'all' && providerName === 'NewsData.io' && url.pathname.endsWith('/latest')) {
    url.searchParams.set('category', 'business,technology');
    url.searchParams.set('q', builtQuery || '(business OR finance OR markets OR economy OR companies OR stocks OR crypto OR technology OR AI OR central bank)');
  }
  url.searchParams.set('image', '1');
  url.searchParams.set('removeduplicate', '1');
  url.searchParams.set('size', String(MAX_ITEMS));
  url.searchParams.set('timezone', 'Asia/Kolkata');
  if (typeof page === 'string' && page && !/^\d+$/.test(page)) url.searchParams.set('page', page);
  const normalizedRegion = region.trim().toLowerCase();
  if (normalizedRegion === 'india' || normalizedRegion === 'in') url.searchParams.set('country', 'in');
  if (normalizedRegion === 'us' || normalizedRegion === 'usa') url.searchParams.set('country', 'us');

  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'ArthaBench-Pro/2.0' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return { items: [], status: 'invalid_credentials', providerName, message: `${providerName} rejected the API key (HTTP ${response.status}).` };
    }
    if (response.status === 429) {
      return { items: [], status: 'rate_limited', providerName, message: `${providerName} rate limit reached. Cached results will continue to be served when available.` };
    }
    throw new Error(`${providerName} request failed with HTTP ${response.status}.`);
  }

  const parsed = newsDataResponseSchema.safeParse(await response.json());
  if (!parsed.success || parsed.data.status.toLowerCase() !== 'success') {
    return { items: [], status: 'invalid_response', providerName, message: `${providerName} returned an unexpected response.` };
  }

  const retrievedAt = new Date().toISOString();
  const items: NormalizedNewsItem[] = parsed.data.results.flatMap((article, index) => {
    const title = article.title?.trim();
    const sourceUrl = safeUrl(article.link);
    if (!title || sourceUrl === '#') return [];
    const imageUrl = safeUrl(article.image_url);
    return [{
      id: article.article_id || `newsdata-${retrievedAt}-${index}`,
      title,
      summary: article.description?.trim() || 'Open the original publisher article for the full report.',
      sourceName: article.source_name || article.source_id || 'Publisher',
      sourceUrl,
      publishedAt: toIsoDate(article.pubDate),
      retrievedAt,
      category: article.category?.[0] || mapCategory(category),
      region: article.country?.[0] || region || 'global',
      imageUrl: imageUrl === '#' ? null : imageUrl,
    }];
  });

  return {
    items,
    status: 'connected',
    providerName,
    nextPage: parsed.data.nextPage || undefined,
    mode: 'live',
    message: `${items.length} current ${providerName} headlines loaded directly from the provider.`
  };
}

async function getCachedOrFetch(key: string, loader: () => Promise<NewsProviderResult>) {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const request = loader()
    .then((result) => {
      if (result.items.length) cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result });
      return result;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

export async function fetchNewsFromProvider(query = '', category = 'all', region = 'global', page: number | string = 1): Promise<NewsProviderResult> {
  const key = JSON.stringify({ query: query.trim(), category: category.trim().toLowerCase(), region: region.trim().toLowerCase(), page });
  const result = await getCachedOrFetch(key, () => fetchNewsData(query, category, region, page));
  if (!result.items.length) {
    const stale = cache.get(key)?.result;
    if (stale?.items.length) return { ...stale, mode: 'cached', message: `Serving the most recent cached ${stale.providerName} feed.` };
  }
  return result;
}

export async function fetchSecondaryNewsProviders(query = '', category = 'all', region = 'global', page: number | string = 1): Promise<NewsProviderResult> {
  const candidates = [
    { url: DEFAULT_MARKET_NEWSDATA_URL, name: 'NewsData.io Market' },
    { url: DEFAULT_CRYPTO_NEWSDATA_URL, name: 'NewsData.io Crypto' },
  ];
  for (const candidate of candidates) {
    const key = JSON.stringify({ secondary: candidate.name, query: query.trim(), category: category.trim().toLowerCase(), region: region.trim().toLowerCase(), page });
    const result = await getCachedOrFetch(key, () => fetchNewsData(query || '(markets OR finance OR stocks OR economy OR companies OR crypto OR technology)', category, region, page, candidate.url, candidate.name));
    if (result.items.length) return { ...result, mode: 'live', message: `${result.items.length} current ${candidate.name} headlines loaded as the secondary provider.` };
    const stale = cache.get(key)?.result;
    if (stale?.items.length) return { ...stale, mode: 'cached', message: `Serving the most recent cached ${candidate.name} feed.` };
  }
  return { items: [], status: 'error', providerName: 'Secondary NewsData.io feeds', message: 'Secondary market and crypto feeds returned no valid articles.' };
}

export async function checkNewsProviderDiagnostic(): Promise<ProviderDiagnostic> {
  const startedAt = Date.now();
  const result = await fetchNewsFromProvider('', 'business', 'global');
  return {
    id: 'business-news',
    name: result.providerName,
    role: 'Current business, financial and educational news',
    status: result.status,
    lastChecked: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    message: result.message,
  };
}
