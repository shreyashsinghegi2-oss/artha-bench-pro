/** Production business-news provider. */
import { z } from 'zod';
import type { NormalizedNewsItem, ProviderDiagnostic } from '../../src/types';

const DEFAULT_NEWSDATA_URL = 'https://newsdata.io/api/1/latest';
const GDELT_DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';

const newsDataArticleSchema = z.object({
  article_id: z.string().optional(), title: z.string().nullable().optional(), description: z.string().nullable().optional(),
  link: z.string().nullable().optional(), pubDate: z.string().nullable().optional(), image_url: z.string().nullable().optional(),
  source_id: z.string().nullable().optional(), source_name: z.string().nullable().optional(), category: z.array(z.string()).nullable().optional(),
  country: z.array(z.string()).nullable().optional(),
}).passthrough();
const newsDataResponseSchema = z.object({ status: z.string(), results: z.array(newsDataArticleSchema).optional().default([]), nextPage: z.string().nullable().optional() }).passthrough();

export interface NewsProviderResult {
  items: NormalizedNewsItem[];
  status: 'connected' | 'not_configured' | 'invalid_credentials' | 'invalid_response' | 'rate_limited' | 'error';
  message?: string;
  providerName: string;
  nextPage?: string;
}

function mapCategory(category: string) {
  const normalized = category.toLowerCase();
  const map: Record<string, string> = { corporate: 'business', earnings: 'business', macroeconomics: 'business', markets: 'business', policy: 'politics', tech: 'technology' };
  if (!normalized || normalized === 'all') return normalized === 'all' ? 'business' : undefined;
  return map[normalized] || normalized;
}
function mapRegion(region: string) {
  const normalized = region.toLowerCase();
  const map: Record<string, string> = { india: 'in', us: 'us', usa: 'us', uk: 'gb' };
  if (!normalized || normalized === 'global' || normalized === 'all') return undefined;
  return map[normalized] || normalized;
}
function toIsoDate(value?: string | null) { if (!value) return null; const timestamp = Date.parse(value); return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null; }
function safeUrl(value?: string | null) {
  if (!value) return '#';
  try { const parsed = new URL(value); return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '#'; } catch { return '#'; }
}
function getConfiguration() { return { provider: (process.env.BUSINESS_NEWS_PROVIDER || 'newsdata').trim().toLowerCase(), apiKey: process.env.BUSINESS_NEWS_API_KEY?.trim() || '', baseUrl: process.env.BUSINESS_NEWS_BASE_URL?.trim() || DEFAULT_NEWSDATA_URL }; }

async function fetchNewsData(query: string, category: string, region: string, page: number | string): Promise<NewsProviderResult> {
  const { apiKey, baseUrl } = getConfiguration();
  if (!apiKey) throw new Error('NewsData API key is not configured.');
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:') throw new Error('News provider URL must use HTTPS.');
  url.searchParams.set('apikey', apiKey); url.searchParams.set('language', 'en');
  if (query.trim()) url.searchParams.set('q', query.trim());
  const providerCategory = mapCategory(category); if (providerCategory) url.searchParams.set('category', providerCategory);
  const country = mapRegion(region); if (country) url.searchParams.set('country', country);
  if (typeof page === 'string' && page && !/^\d+$/.test(page)) url.searchParams.set('page', page);
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`NewsData request failed with HTTP ${response.status}.`);
  const parsed = newsDataResponseSchema.safeParse(await response.json());
  if (!parsed.success || parsed.data.status.toLowerCase() !== 'success') throw new Error('NewsData returned an invalid response.');
  const retrievedAt = new Date().toISOString();
  const items: NormalizedNewsItem[] = parsed.data.results.flatMap((article, index) => {
    const title = article.title?.trim(); const link = safeUrl(article.link); if (!title || link === '#') return [];
    const image = safeUrl(article.image_url);
    return [{ id: article.article_id || `newsdata-${index}-${article.pubDate || retrievedAt}`, title, summary: article.description?.trim() || 'Open the original publisher article for the full report.', sourceName: article.source_name || article.source_id || 'Publisher', sourceUrl: link, publishedAt: toIsoDate(article.pubDate), retrievedAt, category: article.category?.[0] || providerCategory || 'business', region: article.country?.[0] || country || 'global', imageUrl: image === '#' ? null : image }];
  });
  return { items, status: 'connected', providerName: 'NewsData.io', nextPage: parsed.data.nextPage || undefined, message: `${items.length} current NewsData headlines loaded.` };
}

function newsQuery(query: string, category: string, region: string) {
  if (query.trim()) return region.toLowerCase() === 'india' ? `(${query.trim()}) India` : region.toLowerCase() === 'us' || region.toLowerCase() === 'usa' ? `(${query.trim()}) US` : query.trim();
  const categoryQuery = category === 'technology' || category === 'tech'
    ? '(technology OR startups OR software OR AI)'
    : category === 'policy'
      ? '(economy OR monetary policy OR interest rates OR regulation)'
      : '(business OR markets OR economy OR finance OR investing OR companies)';
  if (region.toLowerCase() === 'india') return `${categoryQuery} India`;
  if (region.toLowerCase() === 'us' || region.toLowerCase() === 'usa') return `${categoryQuery} US`;
  return categoryQuery;
}

async function fetchGdeltNews(query: string, category: string, region: string): Promise<NewsProviderResult> {
  const url = new URL(GDELT_DOC_URL);
  url.searchParams.set('query', newsQuery(query, category, region)); url.searchParams.set('mode', 'artlist'); url.searchParams.set('format', 'json');
  url.searchParams.set('sort', 'datedesc'); url.searchParams.set('timespan', '1day'); url.searchParams.set('maxrecords', '24');
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'ArthaBench-Pro-News/1.0' }, signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`GDELT request failed with HTTP ${response.status}.`);
  const payload = await response.json() as { articles?: Array<{ url?: string; title?: string; seendate?: string; socialimage?: string; domain?: string }> };
  const retrievedAt = new Date().toISOString();
  const items: NormalizedNewsItem[] = (payload.articles || []).flatMap((article, index) => {
    const title = article.title?.trim(); const sourceUrl = safeUrl(article.url); if (!title || sourceUrl === '#') return [];
    const imageUrl = safeUrl(article.socialimage);
    return [{ id: `gdelt-${retrievedAt}-${index}`, title, summary: 'Open the original publisher article for the full report.', sourceName: article.domain?.replace(/^www\./i, '') || 'Publisher', sourceUrl, publishedAt: toIsoDate(article.seendate), retrievedAt, category: mapCategory(category) || 'business', region: region || 'global', imageUrl: imageUrl === '#' ? null : imageUrl }];
  });
  if (!items.length) throw new Error('GDELT returned no current headlines.');
  return { items, status: 'connected', providerName: 'GDELT News', message: `${items.length} current publisher headlines loaded.` };
}

export async function fetchNewsFromProvider(query = '', category = 'all', region = 'global', page: number | string = 1): Promise<NewsProviderResult> {
  const configuration = getConfiguration(); const failures: string[] = [];
  if ((configuration.provider === 'newsdata' || configuration.provider === 'newsdata.io') && configuration.apiKey) {
    try { return await fetchNewsData(query, category, region, page); } catch (error) { failures.push(error instanceof Error ? error.message : 'NewsData unavailable.'); }
  }
  try { return await fetchGdeltNews(query, category, region); } catch (error) { failures.push(error instanceof Error ? error.message : 'GDELT unavailable.'); }
  return { items: [], status: configuration.apiKey ? 'error' : 'not_configured', providerName: 'Business News', message: 'Business news is temporarily unavailable. ' + failures.join(' ') };
}

export async function checkNewsProviderDiagnostic(): Promise<ProviderDiagnostic> {
  const startedAt = Date.now(); const result = await fetchNewsFromProvider('', 'business', 'global');
  return { id: 'business-news', name: result.providerName, role: 'Current business and market headlines', status: result.status, lastChecked: new Date().toISOString(), latencyMs: Date.now() - startedAt, message: result.message };
}
