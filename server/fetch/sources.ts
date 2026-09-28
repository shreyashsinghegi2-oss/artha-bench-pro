/**
 * The live sources, in priority order (lower = more authoritative):
 *   0  rag        official documents indexed in the RAG sidecar (SEBI, RBI, CBDT, AMFI, NSE/BSE)
 *   1  official   latest RBI / SEBI releases from their RSS feeds, plus official pages found by search
 *   2  market     quotes for instruments named in the question (existing market-data service)
 *   2  fund       official AMFI NAVs for a named mutual fund (existing mutual-fund service)
 *   2  user-page  pages the user linked (safe reader; optional Firecrawl for JavaScript-rendered pages)
 *   3  news       business headlines (existing news service)
 *   4  web        Google-first web search (Serper → Tavily/Brave → keyless Google News)
 *   9  wikipedia  concept definitions only, used last and labelled as background
 * Dependencies are injected so each source can be tested with mocks and liveGrounding avoids import cycles.
 */
import { htmlToText } from '../webReader';
import { isOfficialUrl, politeGetText, publisherFor, USER_AGENT } from './polite';
import { HostThrottledError, type FetchItem, type Source } from './types';

export interface SourceDeps {
  rag: {
    enabled: boolean;
    retrieve(
      q: string,
      o: { topK: number },
    ): Promise<{
      ok: boolean;
      passages: Array<{
        text: string;
        title: string | null;
        authority: string | null;
        section: string | null;
        date: string | null;
        url: string | null;
        source: string | null;
      }>;
    }>;
  };
  getMarketQuote(symbol: string): Promise<{
    quote: {
      symbol: string;
      price: number;
      changePercent: number | null;
      currency: string;
      freshness: string;
      providerName: string;
      providerTimestamp: string | null;
      retrievedAt: string;
    } | null;
  }>;
  fund(question: string): Promise<{ lines: string[]; sources: Array<{ name: string; dataDate: string }> }>;
  getBusinessNews(
    q: string,
    category: string,
    region: string,
  ): Promise<{ items?: Array<{ title: string; sourceName: string; sourceUrl: string; publishedAt: string | null; description?: string | null }> }>;
  webSearch(q: string): Promise<{ provider: string; results: Array<{ title: string; url: string; snippet: string; source: string }> }>;
  readWebPage(url: string): Promise<{ url: string; title: string; text: string; retrievedAt: string }>;
  linksIn(text: string): string[];
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

const iso = (deps: SourceDeps) => (deps.now?.() ?? new Date()).toISOString();
const fmtNum = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: v < 10 ? 4 : 2 });

// ---- RSS -------------------------------------------------------------------------------------------
/** Official feeds (URLs published on rbi.org.in/Scripts/rss.aspx and sebi.gov.in/rss.html). */
export const OFFICIAL_FEEDS = [
  { url: 'https://www.rbi.org.in/pressreleases_rss.xml', publisher: 'RBI', label: 'RBI press release' },
  { url: 'https://www.rbi.org.in/notifications_rss.xml', publisher: 'RBI', label: 'RBI notification' },
  { url: 'https://www.sebi.gov.in/sebirss.xml', publisher: 'SEBI', label: 'SEBI update' },
];

const decodeXml = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1] ?? '';

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}
export function parseRss(xml: string): RssItem[] {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
    .map((m) => ({
      title: decodeXml(tag(m[1], 'title')),
      link: decodeXml(tag(m[1], 'link')),
      description: decodeXml(tag(m[1], 'description')).slice(0, 700),
      pubDate: decodeXml(tag(m[1], 'pubDate')),
    }))
    .filter((i) => i.title);
}

const STOP = new Set(
  'the a an of to in on for and or is are was what which who how why when does do did i my me can should latest current new rule rules today please tell about with from by at as it this that'.split(
    ' ',
  ),
);
export const terms = (s: string) => [
  ...new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N} ]+/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  ),
];

/** Share of the question's content words that appear in the text (0..1). */
export function overlap(question: string, text: string): number {
  const q = terms(question);
  if (!q.length) return 0;
  const t = ` ${text.toLowerCase()} `;
  return q.filter((w) => t.includes(w)).length / q.length;
}

/** Questions about RBI or SEBI matters read those regulators' own feeds. */
export const RBI_TOPIC =
  /\b(rbi|reserve bank|repo|reverse repo|crr|slr|monetary policy|mpc|nbfc|upi|forex reserves?|kyc|bank (rate|holiday|licen[cs]e)|payment bank|digital lending)\b/i;
export const SEBI_TOPIC =
  /\b(sebi|mutual funds? (rule|regulation|circular|expense)|amc|expense ratio|ipo (rule|norm|regulation)|stock broker|demat|f&o|derivatives? (rule|norm)|insider trading|portfolio manag|aif|reit|invit|nfo|kyc|circular)\b/i;

// ---- sources ---------------------------------------------------------------------------------------
export function createSources(deps: SourceDeps): Source[] {
  const fetchImpl = deps.fetchImpl ?? fetch;

  const rag: Source = {
    id: 'rag',
    kind: 'official',
    priority: 0,
    timeoutMs: 3_000,
    cacheTtlMs: 10 * 60_000,
    enabled: (ctx) => deps.rag.enabled && ctx.wantOfficial,
    async fetch(ctx) {
      const r = await deps.rag.retrieve(ctx.question, { topK: 5 });
      if (!r.ok) return [];
      return r.passages.map((p) => ({
        sourceId: 'rag',
        kind: 'official' as const,
        title: [p.title ?? p.source ?? 'Official document', p.section].filter(Boolean).join(' · '),
        url: p.url ?? undefined,
        publisher: p.authority ?? 'Official document',
        publishedAt: p.date ?? '',
        text: p.text,
        fetchedAt: iso(deps),
        freshness: 'official document',
      }));
    },
  };

  const official: Source = {
    id: 'official',
    kind: 'official',
    priority: 1,
    timeoutMs: 3_800,
    cacheTtlMs: 15 * 60_000,
    hosts: ['www.rbi.org.in', 'www.sebi.gov.in'],
    enabled: (ctx) => ctx.webMode !== 'off' && (RBI_TOPIC.test(ctx.question) || SEBI_TOPIC.test(ctx.question)),
    async fetch(ctx) {
      const wantRbi = RBI_TOPIC.test(ctx.question);
      const wantSebi = SEBI_TOPIC.test(ctx.question);
      const feeds = OFFICIAL_FEEDS.filter((f) => (f.publisher === 'RBI' ? wantRbi : wantSebi));
      const settled = await Promise.allSettled(feeds.map(async (f) => ({ f, items: parseRss(await politeGetText(f.url, { fetchImpl })) })));
      const throttled = settled.find((s) => s.status === 'rejected' && s.reason instanceof HostThrottledError);
      const scored = settled.flatMap((s) =>
        s.status === 'fulfilled' ? s.value.items.map((it) => ({ f: s.value.f, it, score: overlap(ctx.question, `${it.title} ${it.description}`) })) : [],
      );
      const picked = scored
        .filter((x) => x.score >= 0.34)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      if (!picked.length && throttled?.status === 'rejected') throw throttled.reason;
      return picked.map(({ f, it, score }) => ({
        sourceId: 'official',
        kind: 'official' as const,
        title: `${f.label}: ${it.title}`,
        url: it.link || undefined,
        publisher: f.publisher,
        publishedAt: it.pubDate,
        text: `${it.title}. ${it.description}`.trim(),
        fetchedAt: iso(deps),
        freshness: 'official',
        boost: score,
      }));
    },
  };

  const market: Source = {
    id: 'market',
    kind: 'market',
    priority: 2,
    timeoutMs: 3_500,
    cacheTtlMs: 60_000,
    enabled: (ctx) => ctx.instruments.length > 0,
    async fetch(ctx) {
      const quotes = await Promise.all(
        ctx.instruments.map((i) =>
          deps
            .getMarketQuote(i.symbol)
            .then((r) => ({ i, q: r.quote }))
            .catch(() => ({ i, q: null })),
        ),
      );
      return quotes.flatMap(({ i, q }) => {
        if (!q || q.freshness === 'demo' || !Number.isFinite(q.price)) return [];
        const pct = q.changePercent != null ? ` (${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%)` : '';
        const when = q.providerTimestamp || q.retrievedAt;
        return [
          {
            sourceId: 'market',
            kind: 'market' as const,
            title: `${i.label} [${q.symbol}]`,
            publisher: q.providerName,
            publishedAt: when,
            text: `${i.label} [${q.symbol}]: ${fmtNum(q.price)} ${q.currency}${pct} · ${q.providerName}, ${q.freshness.replaceAll('_', ' ')}, as of ${when}`,
            fetchedAt: iso(deps),
            freshness: q.freshness.replaceAll('_', ' '),
            boost: 1,
          },
        ];
      });
    },
  };

  const fund: Source = {
    id: 'fund',
    kind: 'market',
    priority: 2,
    timeoutMs: 3_800,
    cacheTtlMs: 30 * 60_000,
    enabled: () => true,
    async fetch(ctx) {
      const r = await deps.fund(ctx.question);
      const line = r.lines.find((l) => l.startsWith('- '));
      if (!line || !r.sources[0]) return [];
      return [
        {
          sourceId: 'fund',
          kind: 'market' as const,
          title: r.sources[0].name,
          publisher: 'AMFI (via mfapi.in)',
          publishedAt: r.sources[0].dataDate,
          text: line.slice(2),
          fetchedAt: iso(deps),
          freshness: 'end of day',
          boost: 1,
        },
      ];
    },
  };

  const userPage: Source = {
    id: 'user-page',
    kind: 'web',
    priority: 2,
    timeoutMs: 3_900,
    cacheTtlMs: 10 * 60_000,
    enabled: (ctx) => deps.linksIn(ctx.prompt).length > 0,
    async fetch(ctx) {
      const out: FetchItem[] = [];
      for (const link of deps.linksIn(ctx.prompt)) {
        let page: { url: string; title: string; text: string } | null = null;
        try {
          page = await deps.readWebPage(link);
        } catch {
          page = null;
        }
        if ((!page || page.text.length < 400) && firecrawlEnabled()) page = (await firecrawlScrape(link, fetchImpl).catch(() => null)) ?? page;
        if (page?.text) {
          out.push({
            sourceId: 'user-page',
            kind: isOfficialUrl(page.url) ? 'official' : 'web',
            title: page.title,
            url: page.url,
            publisher: publisherFor(page.url),
            text: page.text.slice(0, 2600),
            fetchedAt: iso(deps),
            freshness: 'read now',
            boost: 1,
          });
        }
      }
      return out;
    },
  };

  const news: Source = {
    id: 'news',
    kind: 'news',
    priority: 3,
    timeoutMs: 3_500,
    cacheTtlMs: 5 * 60_000,
    enabled: (ctx) => ctx.wantNews,
    async fetch(ctx) {
      const r = await deps.getBusinessNews(ctx.instruments[0]?.label ?? ctx.question.split(' ').slice(0, 6).join(' '), 'business', 'india');
      return (r.items ?? []).slice(0, 4).map((n) => ({
        sourceId: 'news',
        kind: 'news' as const,
        title: n.title,
        url: n.sourceUrl,
        publisher: n.sourceName,
        publishedAt: n.publishedAt ?? '',
        text: [n.title, n.description].filter(Boolean).join('. '),
        fetchedAt: iso(deps),
        freshness: 'news',
      }));
    },
  };

  const web: Source = {
    id: 'web',
    kind: 'web',
    priority: 4,
    timeoutMs: 3_900,
    cacheTtlMs: 5 * 60_000,
    enabled: (ctx) => ctx.wantWeb,
    async fetch(ctx) {
      const r = await deps.webSearch(ctx.question);
      const items: FetchItem[] = r.results.map((x) => ({
        sourceId: 'web',
        kind: isOfficialUrl(x.url) ? ('official' as const) : ('web' as const),
        title: x.title,
        url: x.url,
        publisher: isOfficialUrl(x.url) ? publisherFor(x.url) : x.source,
        text: x.snippet,
        fetchedAt: iso(deps),
        freshness: isOfficialUrl(x.url) ? 'official' : 'web',
      }));
      // Read the first official page in the results (allowlisted hosts only, robots.txt respected).
      const off = items.find((i) => i.kind === 'official' && i.url);
      if (off?.url) {
        try {
          const html = await politeGetText(off.url, { fetchImpl, timeoutMs: 2_500 });
          const page = htmlToText(html);
          if (page.text.length > 200) off.text = `${off.text}\n${page.text.slice(0, 2400)}`;
        } catch {
          /* snippet only */
        }
      }
      return items;
    },
  };

  const wikipedia: Source = {
    id: 'wikipedia',
    kind: 'reference',
    priority: 9,
    timeoutMs: 2_500,
    cacheTtlMs: 24 * 3600_000,
    hosts: ['en.wikipedia.org'],
    enabled: (ctx) => ctx.isConcept && ctx.webMode !== 'off',
    async fetch(ctx) {
      const q = terms(ctx.question).slice(0, 6).join(' ');
      if (!q) return [];
      const headers = { 'User-Agent': USER_AGENT, Accept: 'application/json' };
      const s = await fetchImpl(`https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=1`, {
        headers,
        signal: AbortSignal.timeout(2_000),
      });
      if (s.status === 429 || s.status === 403) throw new HostThrottledError('en.wikipedia.org', s.status);
      if (!s.ok) return [];
      const key = ((await s.json()) as { pages?: Array<{ key: string }> }).pages?.[0]?.key;
      if (!key) return [];
      const r = await fetchImpl(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`, {
        headers,
        signal: AbortSignal.timeout(2_000),
      });
      if (!r.ok) return [];
      const j = (await r.json()) as { title?: string; extract?: string; content_urls?: { desktop?: { page?: string } }; timestamp?: string };
      if (!j.extract) return [];
      return [
        {
          sourceId: 'wikipedia',
          kind: 'reference' as const,
          title: `${j.title} (background definition)`,
          url: j.content_urls?.desktop?.page,
          publisher: 'Wikipedia (background only)',
          publishedAt: j.timestamp ?? '',
          text: j.extract.slice(0, 900),
          fetchedAt: iso(deps),
          freshness: 'background',
        },
      ];
    },
  };

  return [rag, official, market, fund, userPage, news, web, wikipedia];
}

// ---- optional Firecrawl ----------------------------------------------------------------------------
/**
 * Firecrawl (https://docs.firecrawl.dev): POST /v2/scrape with "Authorization: Bearer fc-…". An API key is
 * required (there is no keyless mode); the Free plan gives 1,000 credits a month, 1 credit per page scraped.
 * Used only for pages the safe reader could not read (JavaScript-rendered) and only when FIRECRAWL_API_KEY is set.
 */
export const firecrawlEnabled = () => Boolean(process.env.FIRECRAWL_API_KEY?.trim());

export async function firecrawlScrape(url: string, fetchImpl: typeof fetch = fetch): Promise<{ url: string; title: string; text: string } | null> {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) return null;
  const res = await fetchImpl('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
    signal: AbortSignal.timeout(3_500),
  });
  if (res.status === 402 || res.status === 429) throw new HostThrottledError('api.firecrawl.dev', res.status);
  if (!res.ok) return null;
  const j = (await res.json()) as { success?: boolean; data?: { markdown?: string; metadata?: { title?: string; sourceURL?: string } } };
  const md = j.data?.markdown?.trim();
  if (!md) return null;
  return { url: j.data?.metadata?.sourceURL || url, title: j.data?.metadata?.title || url, text: md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').slice(0, 6000) };
}
