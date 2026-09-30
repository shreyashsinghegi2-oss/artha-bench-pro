/**
 * Real data sources for Layer B (data gathering). Each returns { data, source, as_of, reliability } or throws;
 * src/advisor/data-gathering.ts turns failures into "unavailable" without stopping the pipeline.
 *
 * Caching (per server instance, in memory): quotes 60 s, NIFTY daily history and sector history 1 h,
 * RBI feed 30 min. The spec's Supabase market_cache table is not used yet: it needs the service-role key,
 * which is not configured on this deployment.
 */
import { getCryptoMarkets } from '../cryptoService';
import { getBusinessNews } from '../businessNewsService';
import { politeGetText } from '../fetch/polite';
import { webSearch } from '../liveGrounding';
import { fetchYahooFinanceChart, fetchYahooFinanceQuote } from '../providers/yahooFinanceProvider';
import { fiiDiiFlows, NSE_SECTORS } from '../v1/market';
import { marketReliability } from '../v1/envelope';
import { computeFeatures, type Close } from '../../src/advisor/features';
import type { Fetched, Fetchers } from '../../src/advisor/data-gathering';
import type { MarketSnapshot, MarketState, Quote, RbiData, SectorRow } from '../../src/advisor/context';

const cache = new Map<string, { at: number; value: unknown }>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function resetAdvisorCachesForTests(): void {
  cache.clear();
}

async function yahoo(symbol: string, name: string): Promise<Quote> {
  const r = await fetchYahooFinanceQuote(symbol, 'index');
  if (r.status !== 'connected' || r.quote.freshness === 'demo' || !Number.isFinite(r.quote.price)) throw new Error(`${name} unavailable`);
  return { symbol, name, price: r.quote.price, change_percent: r.quote.changePercent, currency: r.quote.currency, as_of: r.quote.providerTimestamp };
}

async function market(): Promise<Fetched<MarketSnapshot>> {
  return cached('market', 60_000, async () => {
    const btc = async (): Promise<Quote> => {
      const m = (await getCryptoMarkets()).markets.find((x) => x.symbol === 'BTCUSDT');
      if (!m) throw new Error('BTC unavailable');
      return { symbol: 'BTCUSDT', name: 'Bitcoin', price: m.price, change_percent: m.changePercent, currency: 'USDT', as_of: m.providerTimestamp };
    };
    const [nifty, sp500, bitcoin, usdinr, gold] = await Promise.allSettled([
      yahoo('^NSEI', 'NIFTY 50'),
      yahoo('^GSPC', 'S&P 500'),
      btc(),
      yahoo('INR=X', 'USD/INR'),
      yahoo('GC=F', 'Gold (COMEX, USD/oz)'),
    ]);
    const v = <T>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null);
    const data: MarketSnapshot = { nifty: v(nifty), sp500: v(sp500), btc: v(bitcoin), usdinr: v(usdinr), gold: v(gold) };
    const got = Object.values(data).filter((q): q is Quote => q !== null);
    if (!got.length) throw new Error('no market quotes available');
    const scores = got.map((q) => marketReliability(q.symbol === 'BTCUSDT' ? 'binance' : 'yahoo', q.as_of));
    return {
      data,
      source: 'Yahoo Finance (NIFTY, S&P 500, USD/INR, gold) and Binance (BTC)',
      as_of: data.nifty?.as_of ?? got[0]?.as_of ?? null,
      reliability: Math.min(...scores) * (got.length / 5),
    };
  });
}

/** NIFTY 50 daily closes, up to 10 years (shared with the pattern matcher). */
export async function niftyHistory(): Promise<Close[]> {
  return cached('nifty-10y', 3_600_000, async () => {
    const chart = await fetchYahooFinanceChart('^NSEI', '10y', '1d');
    const points = chart.points.map((p) => ({ date: p.date.slice(0, 10), close: p.close ?? p.price }));
    if (points.length < 260) throw new Error('not enough NIFTY history');
    return points;
  });
}

async function marketState(): Promise<Fetched<MarketState>> {
  const features = computeFeatures(await niftyHistory());
  const last = features.at(-1);
  if (!last) throw new Error('not enough NIFTY history for features');
  return {
    data: last,
    source: 'NIFTY 50 daily closes (Yahoo Finance ^NSEI), features computed by ArthaBench',
    as_of: `${last.date}T10:00:00Z`,
    reliability: marketReliability('yahoo', `${last.date}T10:00:00Z`),
  };
}

const RBI_RSS = 'https://www.rbi.org.in/pressreleases_rss.xml';
const REPO_RE = /policy repo rate[^.]{0,120}?(\d{1,2}(?:\.\d{1,2})?)\s*(?:per\s*cent|%)/i;

async function rbi(): Promise<Fetched<RbiData>> {
  return cached('rbi', 1_800_000, async () => {
    const xml = await politeGetText(RBI_RSS, { timeoutMs: 6000 });
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
      const body = m[1] ?? '';
      const tag = (t: string) =>
        (new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(body)?.[1] ?? '')
          .replace(/<!\[CDATA\[|\]\]>/g, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      return { title: tag('title'), url: tag('link'), date: tag('pubDate') || null, text: `${tag('title')} ${tag('description')}` };
    });
    if (!items.length) throw new Error('RBI feed returned no items');
    const policy = items.find((i) => REPO_RE.test(i.text));
    const match = policy ? REPO_RE.exec(policy.text) : null;
    const latest = items[0]?.date ? new Date(items[0].date).toISOString() : null;
    return {
      data: {
        repo_rate_pct: match?.[1] ? Number(match[1]) : null,
        repo_rate_statement: policy ? policy.title : null,
        recent: items.slice(0, 5).map(({ title, url, date }) => ({ title, url, date })),
      },
      source: 'RBI press releases (rbi.org.in RSS)',
      as_of: latest,
      reliability: marketReliability('exchange', latest),
    };
  });
}

async function fiiDii(): Promise<Fetched<import('../../src/advisor/context').FiiDiiData>> {
  const r = await fiiDiiFlows();
  return {
    data: { date: r.data.date, fii_net_cr: r.data.fii.net, dii_net_cr: r.data.dii.net, history_30d: null },
    source: r.source,
    as_of: r.timestamp,
    reliability: r.reliability_score,
  };
}

async function sectors(): Promise<Fetched<import('../../src/advisor/context').SectorData>> {
  return cached('sectors', 3_600_000, async () => {
    const rows = await Promise.all(
      NSE_SECTORS.map(async (s): Promise<SectorRow> => {
        try {
          const c = (await fetchYahooFinanceChart(s.symbol, '2mo', '1d')).points.map((p) => p.close ?? p.price);
          const last = c.at(-1);
          const prev = c.at(-2);
          const back = c.at(-21);
          return { name: s.name, symbol: s.symbol, return_1d: last && prev ? last / prev - 1 : null, return_20d: last && back ? last / back - 1 : null };
        } catch {
          return { name: s.name, symbol: s.symbol, return_1d: null, return_20d: null };
        }
      }),
    );
    const ranked = rows.filter((r) => r.return_20d !== null).sort((a, b) => (b.return_20d ?? 0) - (a.return_20d ?? 0));
    if (ranked.length < 5) throw new Error('too few sector indices available');
    return {
      data: { sectors: rows, leaders: ranked.slice(0, 3), laggards: ranked.slice(-3).reverse() },
      source: 'NSE sectoral indices via Yahoo Finance (20 trading days)',
      as_of: new Date().toISOString(),
      reliability: 80 * (ranked.length / rows.length),
    };
  });
}

async function news(query: string): Promise<Fetched<import('../../src/advisor/context').NewsItem[]>> {
  const r = await getBusinessNews(query);
  const items = r.items.slice(0, 5).map((n) => ({ title: n.title, source: n.sourceName, url: n.sourceUrl, published_at: n.publishedAt }));
  if (!items.length) throw new Error('no news found');
  return { data: items, source: r.providerName, as_of: items[0]?.published_at ?? null, reliability: 70 };
}

async function web(query: string): Promise<Fetched<import('../../src/advisor/context').WebItem[]>> {
  const r = await webSearch(query);
  const items = r.results.slice(0, 2).map((w) => ({ title: w.title, url: w.url, snippet: w.snippet.slice(0, 300) }));
  if (!items.length) throw new Error('no web results');
  return { data: items, source: `Web search (${r.provider})`, as_of: r.results[0]?.publishedAt ?? null, reliability: 60 };
}

export const serverFetchers: Fetchers = { market, marketState, rbi, fiiDii, sectors, news, web };
