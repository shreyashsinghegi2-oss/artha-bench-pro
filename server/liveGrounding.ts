/**
 * Live grounding for every AI assistant.
 *
 * Before a model answers, this gathers current facts for the question from the connected sources:
 *   - market quotes (indices, Indian and US stocks, gold, crude, currencies, crypto) via the market-data
 *     provider already used by the app,
 *   - business headlines via the news provider,
 *   - web search results (Tavily, Brave or Serper when a key is configured; Wikipedia and DuckDuckGo
 *     Instant Answers as keyless fallbacks) when the question needs current or outside information.
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

export type WebSearchMode = 'auto' | 'on' | 'off';
export interface GroundingSource { name: string; dataDate: string; freshness: string; url?: string; kind: 'market' | 'news' | 'web' | 'page' | 'fund' }
interface GroundingState { mode: WebSearchMode; sources: GroundingSource[]; used: boolean }

const store = new AsyncLocalStorage<GroundingState>();

/** Express middleware: reads the chat's web-search setting and opens a grounding scope for the request. */
export function groundingMiddleware(req: Request, _res: Response, next: NextFunction) {
  const raw = String(req.header('x-artha-web-search') ?? (req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>).webSearch : '') ?? 'auto').toLowerCase();
  const mode: WebSearchMode = raw === 'on' || raw === 'true' ? 'on' : raw === 'off' || raw === 'false' ? 'off' : 'auto';
  store.run({ mode, sources: [], used: false }, next);
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
const NEWSY = /\b(news|why (did|is|are)|what happened|today|latest|headline|announce|results|earnings|merger|ipo|rbi|sebi|budget|policy)\b/i;
/** Questions that need no outside facts (pure calculation or personal planning). */
const SELF_CONTAINED = /^\s*(calculate|compute|what is (my|the) (emi|sip|cagr)|how much (should|do) i)\b/i;

export function shouldSearchWeb(query: string, mode: WebSearchMode): boolean {
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  return TIME_SENSITIVE.test(query) && !SELF_CONTAINED.test(query);
}

// ---------- Web search providers ----------

export interface WebResult { title: string; url: string; snippet: string; source: string }

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
  const r = await fetch('https://google.serper.dev/search', { method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ q, gl: 'in', num: 5 }), signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`Serper ${r.status}`);
  const j = await r.json() as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (j.organic ?? []).map((x) => ({ title: strip(x.title ?? ''), url: x.link ?? '', snippet: strip(x.snippet ?? '').slice(0, 400), source: 'Google results via Serper' }));
}
async function wikipedia(q: string): Promise<WebResult[]> {
  const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=3&origin=*`, { headers: { 'User-Agent': 'ArthaMindAI/1.0 (education)' }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`Wikipedia ${r.status}`);
  const j = await r.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
  return (j.query?.search ?? []).map((x) => ({ title: x.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(x.title.replace(/ /g, '_'))}`, snippet: strip(x.snippet), source: 'Wikipedia' }));
}
async function duckduckgo(q: string): Promise<WebResult[]> {
  const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`DuckDuckGo ${r.status}`);
  const j = await r.json() as { AbstractText?: string; AbstractURL?: string; Heading?: string; AbstractSource?: string };
  return j.AbstractText ? [{ title: j.Heading || q, url: j.AbstractURL || 'https://duckduckgo.com', snippet: j.AbstractText.slice(0, 400), source: `${j.AbstractSource || 'DuckDuckGo'} (instant answer)` }] : [];
}

/** Web search with the best configured provider, falling back to keyless sources. */
export async function webSearch(query: string): Promise<{ provider: string; results: WebResult[] }> {
  const q = query.slice(0, 300);
  const keyed: Array<[string, string | undefined, (q: string, k: string) => Promise<WebResult[]>]> = [
    ['Tavily', process.env.TAVILY_API_KEY?.trim(), tavily],
    ['Brave', process.env.BRAVE_SEARCH_API_KEY?.trim(), brave],
    ['Serper', process.env.SERPER_API_KEY?.trim(), serper],
  ];
  for (const [name, key, fn] of keyed) {
    if (!key) continue;
    try { const results = await fn(q, key); if (results.length) return { provider: name, results }; } catch { /* try the next provider */ }
  }
  const [ddg, wiki] = await Promise.all([withTimeout(duckduckgo(q), 5000), withTimeout(wikipedia(q), 5000)]);
  return { provider: 'Keyless (DuckDuckGo + Wikipedia)', results: [...(ddg ?? []), ...(wiki ?? [])].slice(0, 4) };
}

// ---------- Context assembly ----------

const cache = new Map<string, { at: number; value: { text: string; sources: GroundingSource[] } }>();
const CACHE_MS = 60_000;
const istNow = () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmt = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: v < 10 ? 4 : 2 });

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

async function pageContext(q: string): Promise<{ lines: string[]; sources: GroundingSource[] }> {
  const links = linksIn(q);
  if (!links.length) return { lines: [], sources: [] };
  const lines: string[] = [];
  const sources: GroundingSource[] = [];
  for (const link of links) {
    try {
      const p = await readWebPage(link);
      lines.push(`Web page the user shared — "${p.title}" (${p.url}), read ${p.retrievedAt}:`, p.text.slice(0, 2600));
      sources.push({ name: `Page: ${p.title.slice(0, 90)}`, dataDate: p.retrievedAt, freshness: 'read now', url: p.url, kind: 'page' });
    } catch (e) {
      lines.push(`Web page ${link} could not be read (${e instanceof Error ? e.message : 'error'}); tell the user and do not guess its contents.`);
    }
  }
  return { lines, sources };
}

export async function gatherLiveContext(query: string, mode: WebSearchMode = 'auto'): Promise<{ text: string; sources: GroundingSource[] }> {
  const q = query.replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!q) return { text: '', sources: [] };
  const key = `${mode}|${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const instruments = detectInstruments(q);
  const wantNews = NEWSY.test(q) || (instruments.length > 0 && /\bwhy|move|fell|rose|up|down\b/i.test(q));
  const wantWeb = shouldSearchWeb(q, mode);

  const [quotes, news, web, page, fund] = await Promise.all([
    Promise.all(instruments.map((i) => withTimeout(getMarketQuote(i.symbol).then((r) => ({ i, quote: r.quote })), 3500))),
    wantNews ? withTimeout(getBusinessNews(instruments[0]?.label ?? q.split(' ').slice(0, 6).join(' '), 'business', 'india'), 4000) : Promise.resolve(null),
    wantWeb ? withTimeout(webSearch(q), 7000) : Promise.resolve(null),
    withTimeout(pageContext(query.slice(0, 2000)), 11000),
    withTimeout(fundContext(q), 8000),
  ]);

  const lines: string[] = [];
  const sources: GroundingSource[] = [];
  const quoteLines = quotes.flatMap((x) => {
    const quote = x?.quote;
    if (!x || !quote || quote.freshness === 'demo' || !Number.isFinite(quote.price)) return [];
    const pct = quote.changePercent != null ? ` (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)` : '';
    const when = quote.providerTimestamp || quote.retrievedAt;
    sources.push({ name: `${quote.providerName}: ${x.i.label}`, dataDate: when, freshness: quote.freshness, kind: 'market' });
    return [`- ${x.i.label} [${quote.symbol}]: ${fmt(quote.price)} ${quote.currency}${pct} · ${quote.providerName}, ${quote.freshness.replace('_', ' ')}, as of ${when}`];
  });
  if (quoteLines.length) lines.push('Market data:', ...quoteLines);
  if (instruments.length && !quoteLines.length) lines.push(`Market data: live quotes for ${instruments.map((i) => i.label).join(', ')} could not be retrieved right now; say so rather than guessing a price.`);

  const items = (news as { items?: Array<{ title: string; sourceName: string; sourceUrl: string; publishedAt: string | null }> } | null)?.items ?? [];
  if (items.length) {
    lines.push('Business news:');
    for (const n of items.slice(0, 4)) {
      lines.push(`- "${n.title}" · ${n.sourceName}${n.publishedAt ? `, ${n.publishedAt}` : ''}`);
      sources.push({ name: `${n.sourceName}: ${n.title.slice(0, 90)}`, dataDate: n.publishedAt ?? '', freshness: 'news', url: n.sourceUrl, kind: 'news' });
    }
  }

  if (web && web.results.length) {
    lines.push(`Web search (${web.provider}):`);
    web.results.forEach((r, k) => {
      lines.push(`[${k + 1}] ${r.title} — ${r.url}\n    ${r.snippet}`);
      sources.push({ name: `${r.source}: ${r.title.slice(0, 90)}`, dataDate: istNow(), freshness: 'web', url: r.url, kind: 'web' });
    });
  } else if (wantWeb) {
    lines.push('Web search: no results could be retrieved; do not state current figures you cannot verify.');
  }

  if (page?.lines.length) { lines.push(...page.lines); sources.push(...page.sources); }
  if (fund?.lines.length) { lines.push(...fund.lines); sources.push(...fund.sources); }

  // Verified formulas from the ArthaMind formula book, so calculations use the exact, tested form.
  const formulas = rankPassages(q, [], 2).flatMap((h) => (h.kind === 'formula' && h.score > 2.5 && h.entry.formula ? [h.entry] : []));
  if (formulas.length) {
    lines.push('Verified formulas (ArthaMind formula book, checked by automated tests):');
    for (const e of formulas) lines.push(`- ${e.title}: ${e.formula}${e.example ? ` · e.g. ${e.example.inputs} → ${e.example.result}` : ''}`);
  }

  const text = lines.length
    ? `LIVE CONTEXT retrieved ${istNow()} IST. Treat these as the current facts for this answer. Quote figures exactly with their source and time; if the question needs something not listed here, say you could not verify it live. Search results can be wrong or dated: prefer official sources (RBI, SEBI, Income Tax Department, NSE, BSE, PIB) when they disagree.\n${lines.join('\n')}`
    : '';
  const value = { text, sources };
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return value;
}

/**
 * Adds live context for `userPrompt` to a system prompt. Used by every model call. Only the first call
 * in a request gathers context; later calls in the same request reuse the collected sources.
 */
/** House number style for every assistant: users of all backgrounds read full amounts more easily than shorthand. */
export const NUMBER_STYLE = 'NUMBER STYLE: write every rupee amount in full with Indian digit grouping (₹12,00,000; ₹1,20,200; ₹5,000). Never abbreviate amounts as k, K, L, lakh, Cr, crore, M or bn.';

export async function groundSystemPrompt(systemPrompt: string, userPrompt: string): Promise<string> {
  const state = store.getStore();
  const styled = `${systemPrompt}\n\n${IDENTITY_BLOCK}\n${SCOPE_BLOCK}\n\n${NUMBER_STYLE}`;
  if (!state) return styled;
  const mode = state.mode;
  try {
    const { text, sources } = await gatherLiveContext(userPrompt, mode);
    if (!state.used) { state.sources.push(...sources); state.used = true; }
    return text ? `${styled}\n\n${text}` : styled;
  } catch {
    return styled;
  }
}

/** Which live sources are connected (no secrets), for the chat UI's source indicator. */
export function liveSourceStatus() {
  const web = process.env.TAVILY_API_KEY?.trim() ? 'Tavily' : process.env.BRAVE_SEARCH_API_KEY?.trim() ? 'Brave Search' : process.env.SERPER_API_KEY?.trim() ? 'Google via Serper' : 'DuckDuckGo + Wikipedia (keyless)';
  return {
    webSearch: { provider: web, keyed: !web.includes('keyless') },
    marketData: process.env.TWELVE_DATA_API_KEY?.trim() ? 'Yahoo Finance + Twelve Data' : 'Yahoo Finance (delayed)',
    news: process.env.NEWSDATA_API_KEY?.trim() || process.env.NEWS_API_KEY?.trim() || process.env.BUSINESS_NEWS_API_KEY?.trim() ? 'News API + public RSS' : 'Public RSS feeds',
    ai: process.env.GROQ_API_KEY?.trim() ? 'Groq' : process.env.NVIDIA_API_KEY?.trim() ? 'NVIDIA NIM' : 'Not configured',
  };
}
