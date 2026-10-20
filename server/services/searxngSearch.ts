import { createHash } from 'crypto';

/**
 * Free web search through a self-hosted SearXNG instance (SEARXNG_BASE_URL). The browser never calls it:
 * every request goes through the backend. Only a neutral, public version of the question is sent; amounts,
 * first-person words and personal details are removed first. Results are normalised, filtered, ranked by
 * source quality, cached, and returned as numbered sources for the grounding layer.
 */

export type SourceType = 'government' | 'regulator' | 'exchange' | 'fund_house' | 'financial_news' | 'reference' | 'other';

export interface WebSearchResult {
  id: number;
  title: string;
  url: string;
  domain: string;
  date: string | null;
  snippet: string;
  source_type: SourceType;
  publisher: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  search_provider: 'SearXNG';
  cached: boolean;
  fetched_at: string;
  expires_at: string;
}

export class WebSearchUnavailable extends Error {
  constructor(message = 'Live web search is temporarily unavailable.') { super(message); this.name = 'WebSearchUnavailable'; }
}

const env = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const freshMs = () => env('WEB_SEARCH_CACHE_TTL_SECONDS', 900) * 1000;
const STALE_MS = 6 * 60 * 60 * 1000;
const timeoutMs = () => env('WEB_SEARCH_TIMEOUT_MS', 9000);
const maxResults = () => Math.min(5, env('WEB_SEARCH_MAX_RESULTS', 5));

export const isSearxngConfigured = () => Boolean(process.env.SEARXNG_BASE_URL?.trim());

/* ---------- Public query guard ---------- */

const FIRST_PERSON = /\b(my|mine|me|i|i'm|i've|im|we|our|ours|us|myself|family|wife|husband|son|daughter|kids?|children|parents?)\b/gi;
/** Request words that are not topics ("tell me the latest…"). */
const FILLER = /\b(tell|show|explain|give|please|kindly|know|want|help|can|could|would|should|need)\b/gi;
const PERSONAL = /\b(salary|income|take[- ]?home|ctc|expenses?|spend(?:ing)?|emis?|savings?|saved|net worth|portfolio|holdings?|budget|dependants?|age|aged|years old|goal|debt|loans? of|credit card (?:bill|due|balance))\b/gi;

/** Removes amounts, personal words and identifiers, so only a neutral public topic is searched. Null when nothing is left. */
export function publicQuery(raw: string): string | null {
  let q = raw
    .replace(/https?:\/\/\S+|\S+@\S+\.\S+/g, ' ')
    .replace(/[₹$€£]\s?[\d,.]+(?:\s?(?:lakh|lac|crore|cr|k|thousand|million|billion))?/gi, ' ')
    .replace(/\b(?:rs\.?|inr)\s?[\d,.]+(?:\s?(?:lakh|lac|crore|cr|k|thousand|million|billion))?/gi, ' ')
    .replace(/\b\d[\d,.]*\s?(?:lakh|lac|lakhs|crore|crores|cr|k|thousand|million|billion)\b/gi, ' ')
    .replace(FIRST_PERSON, ' ')
    .replace(FILLER, ' ')
    .replace(PERSONAL, ' ')
    .replace(/\b(?!(?:19|20)\d{2}\b)\d[\d,.]*\b/g, ' ')
    .replace(/[^\p{L}\p{N}%&.\- ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  q = q.split(' ').slice(0, 14).join(' ');
  return q.length >= 3 ? q : null;
}

const FINANCE_TOPIC = /\b(rbi|sebi|irdai|pfrda|amfi|nse|bse|nifty|sensex|mutual funds?|nav|sip|elss|etf|index funds?|stocks?|shares?|equity|bonds?|gold|silver|ipo|repo|reverse repo|interest rates?|inflation|cpi|gdp|budget|tax|income tax|gst|tds|itr|80c|80d|old regime|new regime|scheme|subsidy|pension|nps|epf|ppf|fixed deposits?|fd|insurance|policy|regulations?|circular|notification|market|markets|rupee|usd|inr|forex|economy|economic|company|results|news|loan rates?|home loan|credit score|cibil|personal finance|finance|financial)\b/i;

/** Only financial and economic questions are searched, so the endpoint cannot be used as a general search proxy. */
export function isFinanceTopic(query: string): boolean {
  return FINANCE_TOPIC.test(query);
}

/* ---------- Result normalisation ---------- */

const PUBLISHERS: Array<[RegExp, string, SourceType, number]> = [
  [/(^|\.)rbi\.org\.in$/, 'RBI', 'regulator', 2],
  [/(^|\.)sebi\.gov\.in$/, 'SEBI', 'regulator', 3],
  [/(^|\.)irdai\.gov\.in$/, 'IRDAI', 'regulator', 3],
  [/(^|\.)incometax\.gov\.in$/, 'Income Tax Department', 'government', 4],
  [/(^|\.)amfiindia\.com$/, 'AMFI', 'fund_house', 5],
  [/(^|\.)nseindia\.com$/, 'NSE', 'exchange', 6],
  [/(^|\.)bseindia\.com$/, 'BSE', 'exchange', 6],
  [/(^|\.)gov\.in$|(^|\.)nic\.in$/, 'Government of India', 'government', 1],
  [/(^|\.)economictimes\.indiatimes\.com$/, 'Economic Times', 'financial_news', 8],
  [/(^|\.)moneycontrol\.com$/, 'Moneycontrol', 'financial_news', 8],
  [/(^|\.)livemint\.com$/, 'Mint', 'financial_news', 8],
  [/(^|\.)business-standard\.com$/, 'Business Standard', 'financial_news', 8],
  [/(^|\.)thehindubusinessline\.com$/, 'BusinessLine', 'financial_news', 8],
  [/(^|\.)reuters\.com$/, 'Reuters', 'financial_news', 8],
  [/(^|\.)ndtvprofit\.com$/, 'NDTV Profit', 'financial_news', 8],
  [/(^|\.)investopedia\.com$|(^|\.)wikipedia\.org$/, 'Reference', 'reference', 9],
];

/** Pages that are not reliable for financial facts: content farms, forums, social feeds, shopping. */
const BLOCKED = /(^|\.)(pinterest|quora|reddit|facebook|instagram|tiktok|youtube|twitter|x|linkedin|medium|blogspot|wordpress|wixsite|tumblr|scribd|slideshare|amazon|flipkart|ebay|olx)\.(com|in|org|net|co|blogspot\.com)$/;

export function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function classify(domain: string): { publisher: string; type: SourceType; rank: number } {
  for (const [re, publisher, type, rank] of PUBLISHERS) if (re.test(domain)) return { publisher, type, rank };
  return { publisher: domain, type: 'other', rank: 10 };
}

const canonicalUrl = (u: string) => { try { const x = new URL(u); x.hash = ''; x.search = ''; return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}`.toLowerCase(); } catch { return u.toLowerCase(); } };
const plain = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

interface RawResult { title?: unknown; url?: unknown; content?: unknown; publishedDate?: unknown }

/** Turns SearXNG rows into at most five clean, ranked, numbered results. Pure: no network. */
export function normalizeResults(query: string, rows: unknown[]): WebSearchResult[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const kept: Array<WebSearchResult & { rank: number; time: number }> = [];
  for (const row of rows as RawResult[]) {
    const title = plain(typeof row.title === 'string' ? row.title : '').slice(0, 180);
    const url = typeof row.url === 'string' ? row.url.trim() : '';
    if (!title || !/^https?:\/\//i.test(url)) continue;
    const domain = domainOf(url);
    if (!domain || BLOCKED.test(domain)) continue;
    const snippet = plain(typeof row.content === 'string' ? row.content : '').slice(0, 300);
    const haystack = `${title} ${snippet}`.toLowerCase();
    if (words.length && !words.some((w) => haystack.includes(w))) continue;
    const key = canonicalUrl(url), titleKey = title.toLowerCase();
    if (seenUrl.has(key) || seenTitle.has(titleKey)) continue;
    seenUrl.add(key); seenTitle.add(titleKey);
    const time = typeof row.publishedDate === 'string' ? Date.parse(row.publishedDate) : NaN;
    const { publisher, type, rank } = classify(domain);
    kept.push({
      id: 0, title, url, domain, publisher, source_type: type, snippet,
      date: Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null,
      rank, time: Number.isFinite(time) ? time : 0,
    });
  }
  // Better-quality publishers first; within a publisher, the newest first; undated pages last.
  kept.sort((a, b) => a.rank - b.rank || b.time - a.time);
  return kept.slice(0, maxResults()).map((r, i) => ({ id: i + 1, title: r.title, url: r.url, domain: r.domain, date: r.date, snippet: r.snippet, source_type: r.source_type, publisher: r.publisher }));
}

/* ---------- Cache (memory; Upstash REST when configured for production) ---------- */

interface Stored { query: string; results: WebSearchResult[]; fetched_at: string; expires_at: string }
const memory = new Map<string, Stored>();

export function cacheKey(query: string): string {
  const normal = query.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return `websearch:${createHash('sha256').update(normal).digest('hex').slice(0, 32)}`;
}

async function remoteCommand(command: unknown[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim(), token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return undefined;
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: AbortSignal.timeout(1500) });
  if (!r.ok) return undefined;
  return ((await r.json()) as { result?: unknown }).result;
}

async function readCache(key: string): Promise<Stored | null> {
  const local = memory.get(key);
  if (local) return local;
  try {
    const raw = await remoteCommand(['GET', key]);
    return typeof raw === 'string' ? (JSON.parse(raw) as Stored) : null;
  } catch { return null; }
}

async function writeCache(key: string, value: Stored): Promise<void> {
  memory.set(key, value);
  if (memory.size > 500) memory.delete(memory.keys().next().value as string);
  try { await remoteCommand(['SET', key, JSON.stringify(value), 'EX', String(Math.ceil(STALE_MS / 1000))]); } catch { /* memory copy still serves */ }
}

const withMeta = (s: Stored, cached: boolean): WebSearchResponse => ({ query: s.query, results: s.results, search_provider: 'SearXNG', cached, fetched_at: s.fetched_at, expires_at: s.expires_at });

/* ---------- Search ---------- */

async function callSearxng(query: string): Promise<unknown[]> {
  const base = process.env.SEARXNG_BASE_URL!.trim().replace(/\/+$/, '');
  const url = `${base}/search?${new URLSearchParams({ q: query, format: 'json', language: 'en', safesearch: '1' }).toString()}`;
  const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'ArthaMind-Search/1.0' }, signal: AbortSignal.timeout(timeoutMs()) });
  if (!r.ok) throw new WebSearchUnavailable(`SearXNG answered ${r.status}`);
  const body = (await r.json()) as { results?: unknown };
  if (!Array.isArray(body.results)) throw new WebSearchUnavailable('SearXNG returned no result list');
  return body.results;
}

/**
 * Searches the public web for a neutral query. Fresh cache (15 min) is reused. If SearXNG fails, a cached
 * answer up to six hours old is used. Otherwise this throws WebSearchUnavailable and the caller falls back
 * to the profile and verified calculations. Never returns invented results.
 */
export async function searchWeb(rawQuery: string): Promise<WebSearchResponse> {
  if (!isSearxngConfigured()) throw new WebSearchUnavailable('SEARXNG_BASE_URL is not set.');
  const query = publicQuery(rawQuery);
  if (!query) throw new WebSearchUnavailable('The question has no public topic to search.');
  const key = cacheKey(query);
  const now = Date.now();
  const hit = await readCache(key);
  if (hit && now - Date.parse(hit.fetched_at) < freshMs()) return withMeta(hit, true);
  try {
    const rows = await callSearxng(query);
    const stored: Stored = {
      query,
      results: normalizeResults(query, rows),
      fetched_at: new Date(now).toISOString(),
      expires_at: new Date(now + freshMs()).toISOString(),
    };
    await writeCache(key, stored);
    return withMeta(stored, false);
  } catch (error) {
    if (hit && now - Date.parse(hit.fetched_at) < STALE_MS) return withMeta(hit, true);
    throw error instanceof WebSearchUnavailable ? error : new WebSearchUnavailable();
  }
}

/** Human-readable IST time for the "Cached web data · as of" label. */
export function istLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' IST';
}

/** Test hook: forget every cached search. */
export function clearWebSearchCache(): void { memory.clear(); }
