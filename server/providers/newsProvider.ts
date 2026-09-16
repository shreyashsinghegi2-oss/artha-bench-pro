/** Production business-news provider. */
import { z } from 'zod';
import type { NormalizedNewsItem, ProviderDiagnostic } from '../../src/types';
import { resolvePublisherImage } from '../newsImageProxy';

const DEFAULT_NEWSDATA_URL = 'https://newsdata.io/api/1/latest';
const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search';
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
  if (!normalized) return undefined;
  if (normalized === 'all') return 'business';
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
function decodeXml(value: string) { return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim(); }
function tag(block: string, name: string) { const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i')); return match ? decodeXml(match[1]) : ''; }
function attribute(block: string, tagName: string, attributeName: string) { const match = block.match(new RegExp(`<${tagName}\\b[^>]*\\b${attributeName}=["']([^"']+)["'][^>]*>`, 'i')); return match ? safeUrl(match[1]) : '#'; }
function extractRssImage(block: string) {
  const candidates = [attribute(block, 'media:content', 'url'), attribute(block, 'media:thumbnail', 'url'), attribute(block, 'enclosure', 'url')];
  const direct = candidates.find((value) => value !== '#');
  if (direct) return direct;
  return safeUrl(block.match(/<description>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)?.[1]);
}
function getConfiguration() { return { provider: (process.env.BUSINESS_NEWS_PROVIDER || 'newsdata').trim().toLowerCase(), apiKey: process.env.BUSINESS_NEWS_API_KEY?.trim() || '', baseUrl: process.env.BUSINESS_NEWS_BASE_URL?.trim() || DEFAULT_NEWSDATA_URL }; }

async function enrichPublisherImages(items: NormalizedNewsItem[]) {
  return Promise.all(items.map(async (item) => {
    if (item.imageUrl) return item;
    try { const imageUrl = await resolvePublisherImage(item.sourceUrl); return imageUrl ? { ...item, imageUrl } : item; } catch { return item; }
  }));
}

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
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`NewsData request failed with HTTP ${response.status}.`);
  const parsed = newsDataResponseSchema.safeParse(await response.json());
  if (!parsed.success || parsed.data.status.toLowerCase() !== 'success') throw new Error('NewsData returned an invalid response.');
  const retrievedAt = new Date().toISOString();
  const items: NormalizedNewsItem[] = parsed.data.results.flatMap((article, index) => {
    const title = article.title?.trim(); const link = safeUrl(article.link); if (!title || link === '#') return [];
    const image = safeUrl(article.image_url);
    return [{ id: article.article_id || `newsdata-${index}-${article.pubDate || retrievedAt}`, title, summary: article.description?.trim() || 'Open the original publisher link for the full report.', sourceName: article.source_name || article.source_id || 'NewsData source', sourceUrl: link, publishedAt: toIsoDate(article.pubDate), retrievedAt, category: article.category?.[0] || providerCategory || 'business', region: article.country?.[0] || country || 'global', imageUrl: image === '#' ? null : image }];
  });
  return { items: await enrichPublisherImages(items), status: 'connected', providerName: 'NewsData.io', nextPage: parsed.data.nextPage || undefined, message: `${items.length} current NewsData headlines loaded.` };
}

function newsQuery(query: string, category: string, region: string) {
  const parts = [query.trim()];
  if (!query.trim()) parts.push(category === 'technology' || category === 'tech' ? 'technology business markets' : category === 'policy' ? 'economy monetary policy business' : 'business markets economy finance');
  if (region.toLowerCase() === 'india') parts.push('India'); else if (region.toLowerCase() === 'us' || region.toLowerCase() === 'usa') parts.push('US');
  return parts.filter(Boolean).join(' ');
}

async function fetchGdeltNews(query: string, category: string, region: string): Promise<NewsProviderResult> {
  const url = new URL(GDELT_DOC_URL);
  url.searchParams.set('query', newsQuery(query, category, region)); url.searchParams.set('mode', 'artlist'); url.searchParams.set('format', 'json');
  url.searchParams.set('sort', 'datedesc'); url.searchParams.set('timespan', '1day'); url.searchParams.set('maxrecords', '24');
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'ArthaBench-Pro-News/1.0' }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`GDELT request failed with HTTP ${response.status}.`);
  const payload = await response.json() as { articles?: Array<{ url?: string; title?: string; seendate?: string; socialimage?: string; domain?: string }> };
  const retrievedAt = new Date().toISOString();
  const items: NormalizedNewsItem[] = (payload.articles || []).flatMap((article, index) => {
    const title = article.title?.trim(); const sourceUrl = safeUrl(article.url); if (!title || sourceUrl === '#') return [];
    const imageUrl = safeUrl(article.socialimage);
    return [{ id: `gdelt-${retrievedAt}-${index}`, title, summary: 'Open the original publisher article for the full report.', sourceName: article.domain?.replace(/^www\./i, '') || 'Publisher', sourceUrl, publishedAt: null, retrievedAt, category: mapCategory(category) || 'business', region: region || 'global', imageUrl: imageUrl === '#' ? null : imageUrl }];
  });
  if (!items.length) throw new Error('GDELT returned no current headlines.');
  return { items, status: 'connected', providerName: 'GDELT News', message: `${items.length} current publisher headlines with source images loaded.` };
}

async function fetchGoogleNewsRss(query: string, category: string, region: string): Promise<NewsProviderResult> {
  const url = new URL(GOOGLE_NEWS_RSS); url.searchParams.set('q', newsQuery(query, category, region)); url.searchParams.set('hl', 'en-IN'); url.searchParams.set('gl', 'IN'); url.searchParams.set('ceid', 'IN:en');
  const response = await fetch(url, { headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'ArthaBench-Pro-News/1.0' }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Google News RSS request failed with HTTP ${response.status}.`);
  const xml = await response.text(); const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1]).slice(0, 30); const retrievedAt = new Date().toISOString();
  const items: NormalizedNewsItem[] = blocks.flatMap((block, index) => {
    const title = tag(block, 'title'); const link = safeUrl(tag(block, 'link')); if (!title || link === '#') return [];
    const publishedAt = toIsoDate(tag(block, 'pubDate')); const source = tag(block, 'source') || title.split(' - ').at(-1) || 'Publisher'; const description = tag(block, 'description'); const image = extractRssImage(block);
    return [{ id: `gnews-${publishedAt || retrievedAt}-${index}`, title, summary: description || 'Open the publisher link for the full article.', sourceName: source, sourceUrl: link, publishedAt, retrievedAt, category: mapCategory(category) || 'business', region: region || 'global', imageUrl: image === '#' ? null : image }];
  });
  if (!items.length) throw new Error('Google News RSS returned no usable headlines.');
  return { items: await enrichPublisherImages(items), status: 'connected', providerName: 'Google News RSS', message: `${items.length} current RSS headlines loaded.` };
}

export async function fetchNewsFromProvider(query = '', category = 'all', region = 'global', page: number | string = 1): Promise<NewsProviderResult> {
  const configuration = getConfiguration(); const failures: string[] = [];
  if ((configuration.provider === 'newsdata' || configuration.provider === 'newsdata.io') && configuration.apiKey) {
    try { return await fetchNewsData(query, category, region, page); } catch (error) { failures.push(error instanceof Error ? error.message : 'NewsData unavailable.'); }
  }
  try { return await fetchGdeltNews(query, category, region); } catch (error) { failures.push(error instanceof Error ? error.message : 'GDELT unavailable.'); }
  try { return await fetchGoogleNewsRss(query, category, region); } catch (error) { failures.push(error instanceof Error ? error.message : 'Google News RSS unavailable.'); }
  return { items: [], status: configuration.apiKey ? 'error' : 'not_configured', providerName: 'Business News', message: failures.join(' ') || 'Business news is unavailable.' };
}

export async function checkNewsProviderDiagnostic(): Promise<ProviderDiagnostic> {
  const startedAt = Date.now(); const result = await fetchNewsFromProvider('', 'business', 'global');
  return { id: 'business-news', name: result.providerName, role: 'Current business and market headlines', status: result.status, lastChecked: new Date().toISOString(), latencyMs: Date.now() - startedAt, message: result.message };
}
