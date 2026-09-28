/**
 * Live grounding for every AI assistant.
 *
 * Before a model answers, this gathers current facts for the question from the connected sources:
 *   - market quotes (indices, Indian and US stocks, gold, crude, currencies, crypto) via the market-data
 *     provider already used by the app,
 *   - business headlines via the news provider,
 *   - web search results, Google first (Serper when a key is configured, else keyless Google News with
 *     publish dates; Tavily or Brave when configured) when the question needs current or outside information.
 * The facts are added to the system prompt with their source and timestamp, and the sources are kept
 * for the response, so answers can cite what they used and say plainly when something is unverified.
 *
 * Per-request settings travel in AsyncLocalStorage, so every existing assistant endpoint benefits
 * without changing its signature. Every lookup has a short timeout and failures never block an answer.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { IDENTITY_BLOCK, SCOPE_BLOCK } from './assistantIdentity';
import { linksIn, readWebPage } from './webReader';
import { fundDetail, searchFunds } from './mutualFundService';
import type { NextFunction, Request, Response } from 'express';
import { INDIA_MARKET_UNIVERSE } from '../src/data/indiaMarketUniverse';
import { getMarketQuote } from './marketDataService';
import { getBusinessNews } from './businessNewsService';
import { rankPassages } from '../src/services/knowledgeLibrary';
import { ragEngine } from '../rag/rag_engine';
import type { StructuredFinancialAnswer } from '../src/types';
import { checkText, validateCitations } from './fetch/citations';
import { buildSourcesBlock, REFINE_RULES, type NumberedSource } from './fetch/refineInput';
import { runSources } from './fetch/registry';
import { createSources, type SourceDeps } from './fetch/sources';
import type { FetchContext, Source, SourceRun } from './fetch/types';
import { computeVerified, enforceVerified, parseIntents, verifiedBlock, type VerifiedNumber } from './fetch/verifyNumbers';

export type WebSearchMode = 'auto' | 'on' | 'off';
export interface GroundingSource { name: string; dataDate: string; freshness: string; url?: string; kind: 'market' | 'news' | 'web' | 'page' | 'fund' | 'doc'; n?: number }
interface GroundingState { mode: WebSearchMode; sources: GroundingSource[]; used: boolean; userProfile?: string; numbered: NumberedSource[]; verified: VerifiedNumber[]; report?: GroundingReport }

const store = new AsyncLocalStorage<GroundingState>();

/** Express middleware: reads the chat's web-search setting and opens a grounding scope for the request. */
/**
 * Lifts the user's shared data summary ("Use my data" on) off every API request body, so strict
 * request schemas never see an unknown field; the grounding scope picks it up for AI answers.
 */
export function stripUserProfile(req: Request, _res: Response, next: NextFunction) {
  const body = req.body as Record<string, unknown> | undefined;
  if (body && typeof body === 'object' && typeof body.userProfile === 'string') {
    (req as Request & { arthaUserProfile?: string }).arthaUserProfile = body.userProfile.replace(/[<>]/g, '').slice(0, 2400);
    delete body.userProfile;
  }
  next();
}

export function groundingMiddleware(req: Request, _res: Response, next: NextFunction) {
  const raw = String(req.header('x-artha-web-search') ?? (req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>).webSearch : '') ?? 'auto').toLowerCase();
  const mode: WebSearchMode = raw === 'on' || raw === 'true' ? 'on' : raw === 'off' || raw === 'false' ? 'off' : 'auto';
  store.run({ mode, sources: [], used: false, numbered: [], verified: [], userProfile: (req as Request & { arthaUserProfile?: string }).arthaUserProfile }, next);
}

/** Web-search setting for the current request ('auto' outside a grounding scope). */
export const currentWebSearchMode = (): WebSearchMode => store.getStore()?.mode ?? 'auto';

/** Sources gathered for the current request (empty outside a grounding scope). */
export const currentGroundingSources = (): GroundingSource[] => store.getStore()?.sources ?? [];

/**
 * The user's actual question inside a composed prompt (many assistants wrap it with page context).
 * Looks for a labelled question first, then the last short paragraph, then the start of the prompt.
 */
export function extractQuestion(prompt: string): string {
  const labelled = prompt.match(/(?:^|\n)\s*(?:user question|question|user asked|query|ask)\s*[:=]\s*(.+)/i);
  if (labelled?.[1]) return labelled[1].trim().slice(0, 400);
  const paragraphs = prompt.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const last = paragraphs[paragraphs.length - 1] ?? '';
  if (last && last.length <= 400 && !/^[[{]/.test(last)) return last;
  return prompt.trim().slice(0, 300);
}

// ---------- Symbol detection ----------

const FIXED: Array<[RegExp, string, string]> = [
  [/(?<!bank\s{0,3})\bnifty\b(?!\s*bank)/i, '^NSEI', 'NIFTY 50'],
  [/\bbank\s*nifty\b|\bnifty\s*bank\b/i, '^NSEBANK', 'NIFTY Bank'],
  [/\bsensex\b/i, '^BSESN', 'S&P BSE Sensex'],
  [/\bs&p\s*500\b|\bs and p\b/i, '^GSPC', 'S&P 500'],
  [/\bnasdaq\b/i, '^IXIC', 'Nasdaq Composite'],
  [/\bdow\b/i, '^DJI', 'Dow Jones'],
  [/\bgold\b/i, 'GC=F', 'Gold futures (USD/oz)'],
  [/\bsilver\b/i, 'SI=F', 'Silver futures (USD/oz)'],
  [/\bcrude\b|\boil price|\bbrent\b|\bwti\b/i, 'CL=F', 'Crude oil WTI (USD/bbl)'],
  [/\busd\s*\/?\s*inr\b|\bdollar\b.*\brupee\b|\brupee\b.*\bdollar\b|\brupee\b/i, 'INR=X', 'USD/INR'],
  [/\beur\s*\/?\s*inr\b|\beuro\b/i, 'EURINR=X', 'EUR/INR'],
  [/\bgbp\s*\/?\s*inr\b|\bpound\b/i, 'GBPINR=X', 'GBP/INR'],
  [/\bbitcoin\b|\bbtc\b/i, 'BTC-USD', 'Bitcoin (USD)'],
  [/\bethereum\b|\beth\b/i, 'ETH-USD', 'Ethereum (USD)'],
  [/\bapple\b|\baapl\b/i, 'AAPL', 'Apple'],
  [/\bmicrosoft\b|\bmsft\b/i, 'MSFT', 'Microsoft'],
  [/\bnvidia\b|\bnvda\b/i, 'NVDA', 'NVIDIA'],
  [/\btesla\b|\btsla\b/i, 'TSLA', 'Tesla'],
  [/\bamazon\b|\bamzn\b/i, 'AMZN', 'Amazon'],
  [/\bgoogle\b|\balphabet\b/i, 'GOOGL', 'Alphabet'],
];

/** Instruments named in the question, most specific first, at most four. */
export function detectInstruments(text: string): Array<{ symbol: string; label: string }> {
  const found: Array<{ symbol: string; label: string }> = [];
  for (const [re, symbol, label] of FIXED) if (re.test(text)) found.push({ symbol, label });
  const lower = text.toLowerCase();
  for (const c of INDIA_MARKET_UNIVERSE) {
    const short = c.displayName.toLowerCase().replace(/ (limited|ltd\.?)$/, '');
    const ticker = c.providerSymbol.replace(/\.(NS|BO)$/, '').toLowerCase();
    if (lower.includes(short) || new RegExp(`\\b${ticker.replace(/[&]/g, '\\&')}\\b`).test(lower)) found.push({ symbol: c.providerSymbol, label: c.displayName });
  }
  const seen = new Set<string>();
  return found.filter((f) => (seen.has(f.symbol) ? false : (seen.add(f.symbol), true))).slice(0, 4);
}

const TIME_SENSITIVE = /\b(today|now|current(ly)?|latest|live|this (week|month|year)|recent|news|price|rate|repo|inflation|cpi|gdp|budget|policy|announced|new rule|circular|notification|deadline|due date|20(2[4-9]|3\d)|who is|what happened|why (did|is)|market)\b/i;
/** Explicitly current information (narrower than TIME_SENSITIVE, which also matches words like "rate"). */
const TIME_SENSITIVE_STRICT = /\b(today|now|current(ly)?|latest|live|this (week|month|year)|recent|news|announced|new rule|circular|notification)\b/i;
const NEWSY = /\b(news|why (did|is|are)|what happened|today|latest|headline|announce|results|earnings|merger|ipo|rbi|sebi|budget|policy)\b/i;
/** Questions that need no outside facts (pure calculation or personal planning). */
const SELF_CONTAINED = /^\s*(calculate|compute|what is (my|the) (emi|sip|cagr)|how much (should|do) i)\b/i;

/** Facts that change or are specific enough that the web should be checked (companies, rules, rates, products). */
const OFFICIAL_TOPIC = /\b(sebi|rbi|cbdt|amfi|nse|bse|pib|irdai|pfrda|circular|regulation|notification|section|rule|tax|nav|expense ratio|kyc|repo|monetary policy|budget|mutual funds?)\b/i;
const FACTUAL = /\b(stock|share|ipo|company|fund|scheme|nav|slab|limit|rule|rbi|sebi|irdai|gst|itr|tds|fd rate|interest rate|loan rate|best|top|compare|vs\.?|versus|which|should i (buy|sell|invest)|returns?|dividend|results|earnings|crypto|bitcoin|gold|silver|dollar|rupee)\b/i;
const CONCEPT = /^\s*(explain|what (is|are)( an?| the)?|define|meaning of|how (does|do)|teach me|why (is|are|do))\b/i;
const PURE_MATHS = /^[\d\s+\-*/().,%^=x×÷]+$/i;

/**
 * In Auto mode the web is searched for anything current or fact-specific, for any named market
 * instrument, and for longer open questions; pure arithmetic and self-contained planning skip it.
 */
export function shouldSearchWeb(query: string, mode: WebSearchMode): boolean {
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  if (PURE_MATHS.test(query)) return false;
  // A pure calculation needs no web search, unless the same question also asks for something current.
  if (SELF_CONTAINED.test(query) && !TIME_SENSITIVE_STRICT.test(query)) return false;
  const instruments = detectInstruments(query).length > 0;
  // Timeless concepts ("explain what an index fund is") are answered from knowledge.
  if (CONCEPT.test(query) && !TIME_SENSITIVE.test(query) && !instruments) return false;
  return TIME_SENSITIVE.test(query) || FACTUAL.test(query) || instruments || query.trim().length > 90;
}

// ---------- Web search providers ----------

export interface WebResult { title: string; url: string; snippet: string; source: string; publishedAt?: string }

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

async function tavily(q: string, key: string): Promise<WebResult[]> {
  const r = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: key, query: q, max_results: 5, search_depth: 'basic' }), signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`Tavily ${r.status}`);
  const j = await r.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };
  return (j.results ?? []).map((x) => ({ title: strip(x.title ?? ''), url: x.url ?? '', snippet: strip(x.content ?? '').slice(0, 400), source: 'Tavily web search' }));
}
async function brave(q: string, key: string): Promise<WebResult[]> {
  const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=5`, { headers: { Accept: 'application/json', 'X-Subscription-Token': key }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`Brave ${r.status}`);
  const j = await r.json() as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } };
  return (j.web?.results ?? []).map((x) => ({ title: strip(x.title ?? ''), url: x.url ?? '', snippet: strip(x.description ?? '').slice(0, 400), source: 'Brave web search' }));
}
async function serper(q: string, key: string): Promise<WebResult[]> {
  const r = await fetch('https://google.serper.dev/search', { method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ q, gl: 'in', hl: 'en', num: 6, tbs: /\b(today|latest|current|now|this (week|month|year))\b/i.test(q) ? 'qdr:m' : undefined }), signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`Serper ${r.status}`);
  const j = await r.json() as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (j.organic ?? []).map((x) => ({ title: strip(x.title ?? ''), url: x.link ?? '', snippet: strip(x.snippet ?? '').slice(0, 400), source: 'Google results via Serper' }));
}
const decode = (s: string) => strip(s.replace(/<!\[CDATA\[|\]\]>/g, ''));
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? '';

/** Search words for Google: drop filler so the query reads like something a person types into Google. */
export function googleQuery(q: string): string {
  const cleaned = q.replace(/https?:\/\/\S+/g, ' ').replace(/\b(please|kindly|can you|could you|tell me|i want to know|explain to me|hey|hi)\b/gi, ' ').replace(/[^\p{L}\p{N}&%.₹$\- ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.split(' ').slice(0, 16).join(' ');
}

/** Google News search (keyless RSS): current, dated headlines from the publishers Google indexes, newest first. */
async function googleNews(q: string): Promise<WebResult[]> {
  const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(googleQuery(q))}&hl=en-IN&gl=IN&ceid=IN:en`, { headers: { 'User-Agent': 'Mozilla/5.0 (ArthaMindAI; +https://artha-bench-pro.vercel.app)' }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`Google News ${r.status}`);
  const xml = await r.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10).map((m) => {
    const it = m[1];
    const source = decode(tag(it, 'source'));
    const title = decode(tag(it, 'title')).replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');
    const date = new Date(decode(tag(it, 'pubDate')));
    return { title, url: decode(tag(it, 'link')), date, source };
  }).filter((x) => x.title && x.url);
  items.sort((a, b) => (b.date.getTime() || 0) - (a.date.getTime() || 0));
  return items.slice(0, 6).map((x) => {
    const when = Number.isFinite(x.date.getTime()) ? x.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'date unknown';
    return { title: x.title, url: x.url, snippet: `${x.title} (${x.source || 'publisher'}, published ${when})`, source: `Google News · ${x.source || 'publisher'}`, publishedAt: Number.isFinite(x.date.getTime()) ? x.date.toISOString() : undefined };
  });
}
async function duckduckgo(q: string): Promise<WebResult[]> {
  const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(googleQuery(q))}&format=json&no_html=1&skip_disambig=1`, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`DuckDuckGo ${r.status}`);
  const j = await r.json() as { AbstractText?: string; AbstractURL?: string; Heading?: string; AbstractSource?: string };
  // Instant answers often quote Wikipedia; they are kept only as background, never as the latest fact.
  return j.AbstractText ? [{ title: j.Heading || q, url: j.AbstractURL || 'https://duckduckgo.com', snippet: `Background (may be out of date): ${j.AbstractText.slice(0, 300)}`, source: `${j.AbstractSource || 'DuckDuckGo'} (background)` }] : [];
}

/**
 * Web search, Google first: Google results via Serper when SERPER_API_KEY is set, then Tavily or Brave,
 * then keyless Google News (dated, newest first). Wikipedia is not used as a source of current facts.
 */
export async function webSearch(query: string): Promise<{ provider: string; results: WebResult[] }> {
  const q = query.slice(0, 300);
  const keyed: Array<[string, string | undefined, (q: string, k: string) => Promise<WebResult[]>]> = [
    ['Google (Serper)', process.env.SERPER_API_KEY?.trim(), serper],
    ['Tavily', process.env.TAVILY_API_KEY?.trim(), tavily],
    ['Brave', process.env.BRAVE_SEARCH_API_KEY?.trim(), brave],
  ];
  for (const [name, key, fn] of keyed) {
    if (!key) continue;
    try { const results = await fn(googleQuery(q) || q, key); if (results.length) return { provider: name, results }; } catch { /* try the next provider */ }
  }
  const [news, ddg] = await Promise.all([withTimeout(googleNews(q), 6500), withTimeout(duckduckgo(q), 5000)]);
  return { provider: 'Google News (live, newest first)', results: [...(news ?? []), ...(ddg ?? []).slice(0, 1)].slice(0, 6) };
}

// ---------- Context assembly ----------

const cache = new Map<string, { at: number; value: LiveContext }>();
const CACHE_MS = 60_000;
const istNow = () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Build the LIVE CONTEXT block for a question. Returns empty text when nothing relevant was found. */

const FUND_HOUSES = /\b(hdfc|sbi|icici(?: prudential)?|axis|parag parikh|ppfas|nippon(?: india)?|kotak|mirae(?: asset)?|uti|quant|dsp|tata|aditya birla(?: sun life)?|motilal oswal|franklin(?: india| templeton)?|canara robeco|bandhan|edelweiss|invesco(?: india)?|hsbc|pgim(?: india)?|sundaram|mahindra manulife|navi|zerodha|groww|whiteoak|360 one|bajaj finserv|jm financial|lic|baroda bnp paribas|union|samco|old bridge|helios|quantum)\b/i;
const FUND_WORD = /\b(fund|mutual funds?|nav|sip|scheme|elss|index fund|etf)\b/i;
const FUND_STOP = new Set('what is the of should i invest in for a an my how are was were today now current latest nav returns return sip mutual fund funds scheme good bad better best me tell about to and or vs with price value performance'.split(' '));

/** A fund named in the question → search words from the fund house onward, e.g. "hdfc flexi cap". */
export function fundQueryFrom(q: string): string | null {
  if (!FUND_WORD.test(q)) return null;
  const m = q.match(FUND_HOUSES);
  if (!m || m.index === undefined) return null;
  const words = q.slice(m.index).toLowerCase().replace(/[^a-z0-9& ]+/g, ' ').split(/\s+/).filter((w) => w && !FUND_STOP.has(w));
  const out = words.slice(0, 5).join(' ');
  return out.split(' ').length >= 2 ? out : null;
}

async function fundContext(q: string): Promise<{ lines: string[]; sources: GroundingSource[] }> {
  const query = fundQueryFrom(q);
  if (!query) return { lines: [], sources: [] };
  const { results } = await searchFunds(query, 3);
  const pick = results[0];
  if (!pick) return { lines: [`Mutual fund data: no scheme matched "${query}"; ask the user for the exact fund name.`], sources: [] };
  const d = await fundDetail(pick.code);
  const last = d.history[d.history.length - 1];
  const r = d.returns as Record<string, number>;
  const pc = (k: string, label: string) => (r[k] !== undefined ? `${label} ${(r[k] * 100).toFixed(1)}%` : '');
  const name = d.scheme?.name ?? pick.name;
  const line = `- ${name}${d.scheme?.category ? ` [${d.scheme.category}]` : ''}: NAV ₹${last?.nav} on ${last?.date}; returns ${[pc('1Y', '1 year'), pc('3Y', '3 years (a year)'), pc('5Y', '5 years (a year)')].filter(Boolean).join(', ')}. Source: ${d.sources.join(', ')}. Past returns do not guarantee future returns.`;
  return { lines: ['Mutual fund data (official NAVs):', line], sources: [{ name: `AMFI NAV: ${name.slice(0, 80)}`, dataDate: last?.date ?? '', freshness: 'end of day', kind: 'fund' }] };
}

// ---------- Fetch → Refine → Verify ----------

let registrySources: Source[] | null = null;
/** Sources are created once per process; dependencies are the app's existing services. */
function liveSources(): Source[] {
  registrySources ??= createSources({
    rag: ragEngine,
    getMarketQuote: (symbol) => getMarketQuote(symbol) as ReturnType<SourceDeps['getMarketQuote']>,
    fund: fundContext,
    getBusinessNews: (q, c, r) => getBusinessNews(q, c, r) as ReturnType<SourceDeps['getBusinessNews']>,
    webSearch,
    readWebPage,
    linksIn,
  });
  return registrySources;
}

const KIND_FOR: Record<string, GroundingSource['kind']> = { rag: 'doc', official: 'doc', market: 'market', fund: 'fund', 'user-page': 'page', news: 'news', web: 'web', wikipedia: 'web' };

export interface LiveContext { text: string; sources: GroundingSource[]; numbered: NumberedSource[]; runs: SourceRun[] }

/** Fetch (registry) → refine input (rank, dedupe, number, wrap). Returns empty text when nothing relevant was found. */
export async function gatherLiveContext(query: string, mode: WebSearchMode = 'auto'): Promise<LiveContext> {
  const q = query.replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!q) return { text: '', sources: [], numbered: [], runs: [] };
  const key = `${mode}|${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const instruments = detectInstruments(q);
  const ctx: FetchContext = {
    question: q,
    prompt: query.slice(0, 2000),
    webMode: mode,
    instruments,
    wantNews: NEWSY.test(q) || (instruments.length > 0 && /\bwhy|move|fell|rose|up|down\b/i.test(q)),
    wantWeb: shouldSearchWeb(q, mode),
    wantOfficial: FACTUAL.test(q) || OFFICIAL_TOPIC.test(q),
    // Background definitions only for plain concept questions (not calculations or current events).
    isConcept: CONCEPT.test(q) && !SELF_CONTAINED.test(q) && !TIME_SENSITIVE.test(q) && !/\b(emi|sip|cagr|xirr|tax on|loan of)\b/i.test(q),
  };
  const runs = await runSources(liveSources(), ctx, { budgetMs: 4_000 });
  const items = runs.flatMap((r) => r.items);
  const built = buildSourcesBlock(items, q, { retrievedAtIst: `${istNow()} IST` });

  const notes: string[] = [];
  if (instruments.length && !items.some((i) => i.sourceId === 'market')) {
    notes.push(`Market data: live quotes for ${instruments.map((i) => i.label).join(', ')} could not be retrieved right now; say so rather than guessing a price.`);
  }
  if (ctx.wantWeb && !runs.find((r) => r.id === 'web')?.items.length) notes.push('Web search: no results could be retrieved; do not state current figures you cannot verify.');
  const fundRun = runs.find((r) => r.id === 'fund');
  if (fundRun?.ok && !fundRun.items.length && fundQueryFrom(q)) notes.push(`Mutual fund data: no scheme matched "${fundQueryFrom(q)}"; ask the user for the exact fund name.`);

  // Verified formulas from the ArthaMind formula book, so calculations use the exact, tested form.
  const formulas = rankPassages(q, [], 2).flatMap((h) => (h.kind === 'formula' && h.score > 2.5 && h.entry.formula ? [h.entry] : []));
  if (formulas.length) {
    notes.push('Verified formulas (ArthaMind formula book, checked by automated tests):');
    for (const e of formulas) notes.push(`- ${e.title}: ${e.formula}${e.example ? ` · e.g. ${e.example.inputs} → ${e.example.result}` : ''}`);
  }

  const parts = [built.text, notes.join('\n')].filter(Boolean);
  const text = parts.length
    ? `LIVE CONTEXT retrieved ${istNow()} IST. Treat the numbered sources as the current facts for this answer. For "who is" / "current" / "latest" questions, answer from the most recent dated source and name its date; never answer current facts from memory or encyclopaedias. Prefer official sources (RBI, SEBI, Income Tax Department, AMFI, NSE, BSE, PIB) when sources disagree.\n${parts.join('\n\n')}`
    : '';
  const sources: GroundingSource[] = built.numbered.map((s) => ({
    name: `[${s.n}] ${s.publisher} · ${s.title}`.slice(0, 160),
    dataDate: (s.publishedAt || s.fetchedAt).slice(0, 80),
    freshness: s.freshness,
    url: s.url,
    kind: KIND_FOR[s.sourceId] ?? 'web',
    n: s.n,
  }));
  const value: LiveContext = { text, sources, numbered: built.numbered, runs };
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return value;
}

/** House number style for every assistant: users of all backgrounds read full amounts more easily than shorthand. */
export const NUMBER_STYLE = 'NUMBER STYLE: write every rupee amount in full with Indian digit grouping (₹12,00,000; ₹1,20,200; ₹5,000). Never abbreviate amounts as k, K, L, lakh, Cr, crore, M or bn.';

/**
 * Adds live context for `userPrompt` to a system prompt. Used by every model call. Only the first call
 * in a request gathers context and computes verified numbers; later calls in the same request reuse them.
 */
export async function groundSystemPrompt(systemPrompt: string, userPrompt: string): Promise<string> {
  const state = store.getStore();
  const profile = state?.userProfile ? `\n\nTHE USER'S OWN DATA (shared by the user from their saved records; treat as facts about this person, use it to personalise every recommendation, and name the figures you rely on):\n${state.userProfile}` : '';
  const styled = `${systemPrompt}\n\n${IDENTITY_BLOCK}\n${SCOPE_BLOCK}\n\n${NUMBER_STYLE}${profile}`;
  if (!state) return styled;
  try {
    const [live, verified] = await Promise.all([
      gatherLiveContext(userPrompt, state.mode),
      state.used ? Promise.resolve(state.verified) : computeVerified(parseIntents(userPrompt)).catch(() => [] as VerifiedNumber[]),
    ]);
    if (!state.used) {
      state.sources.push(...live.sources);
      state.numbered = live.numbered;
      state.verified = verified;
      state.used = true;
    }
    const blocks = [live.text, verifiedBlock(state.verified)].filter(Boolean);
    return blocks.length ? `${styled}\n\n${blocks.join('\n\n')}\n\n${REFINE_RULES}` : styled;
  } catch {
    return styled;
  }
}

export interface GroundingReport { sources: number; cited: number[]; invalidCitationsRemoved: number[]; uncited: boolean; verifiedNumbers: number; certifiedNumbers: number; numberCorrections: string[] }

/**
 * After generation: drop citations that point at no source, enforce verified numbers, and attach the numbered
 * sources (with links) and verified numbers to the answer. Safe to call outside a grounding scope (no-op).
 */
export function finalizeGroundedAnswer(answer: StructuredFinancialAnswer): StructuredFinancialAnswer {
  const state = store.getStore();
  if (!state) return answer;
  const { answer: cited, report } = validateCitations(answer, state.numbered);
  const { answer: fixed, corrections } = enforceVerified(cited, state.verified);
  if (corrections.length) console.info(JSON.stringify({ scope: 'artha-grounding', event: 'verified-number-corrected', corrections }));
  const live = state.sources.map(({ name, dataDate, freshness, url }) => ({ name, dataDate, freshness, ...(url ? { url } : {}) }));
  const seen = new Set(live.map((s) => s.name));
  const own = fixed.sources.filter((s) => !seen.has(s.name));
  state.report = {
    sources: state.numbered.length,
    cited: report.cited,
    invalidCitationsRemoved: report.invalid,
    uncited: report.uncited,
    verifiedNumbers: state.verified.length,
    certifiedNumbers: state.verified.filter((v) => v.certified).length,
    numberCorrections: corrections,
  };
  return {
    ...fixed,
    sources: [...live, ...own].slice(0, 12),
    ...(state.verified.length ? { verifiedNumbers: state.verified } : {}),
  };
}

/** Plain-text answers: remove citation markers that point at no source (numbers are enforced on structured answers). */
export function finalizeGroundedText(text: string): string {
  const state = store.getStore();
  if (!state || !state.used) return text;
  return checkText(text, new Set(state.numbered.map((s) => s.n))).text;
}

/** Citation / verification summary for the current request (null outside a grounding scope or before finalising). */
export const currentGroundingReport = (): GroundingReport | null => store.getStore()?.report ?? null;

/** Readable live facts for the offline fallback (no AI): numbered sources as plain lines. */
export function numberedFactsForFallback(ctx: LiveContext): string[] {
  const byN = new Map(ctx.numbered.map((s) => [s.n, s]));
  return ctx.text
    .split('<<<SOURCE ')
    .slice(1)
    .map((chunk) => {
      const n = Number(chunk.slice(0, chunk.indexOf('>>>')));
      const body = chunk.slice(chunk.indexOf('\n') + 1, chunk.indexOf('<<<END')).trim().replace(/\s+/g, ' ').slice(0, 320);
      const s = byN.get(n);
      return s ? `[${n}] ${s.publisher}: ${body}` : '';
    })
    .filter(Boolean);
}


/** Which live sources are connected (no secrets), for the chat UI's source indicator. */
export function liveSourceStatus() {
  const web = process.env.SERPER_API_KEY?.trim() ? 'Google via Serper' : process.env.TAVILY_API_KEY?.trim() ? 'Tavily' : process.env.BRAVE_SEARCH_API_KEY?.trim() ? 'Brave Search' : 'Google News (keyless)';
  return {
    webSearch: { provider: web, keyed: !web.includes('keyless') },
    marketData: process.env.TWELVE_DATA_API_KEY?.trim() ? 'Yahoo Finance + Twelve Data' : 'Yahoo Finance (delayed)',
    news: process.env.NEWSDATA_API_KEY?.trim() || process.env.NEWS_API_KEY?.trim() || process.env.BUSINESS_NEWS_API_KEY?.trim() ? 'News API + public RSS' : 'Public RSS feeds',
    ai: process.env.GROQ_API_KEY?.trim() ? 'Groq' : process.env.NVIDIA_API_KEY?.trim() ? 'NVIDIA NIM' : 'Not configured',
  };
}
