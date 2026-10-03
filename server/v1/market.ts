/**
 * Public market endpoints: NIFTY 50, BTC, FII/DII daily flows and 1-day sector performance.
 * No demo substitutes: if a source fails, the endpoint answers 503 with the reason.
 */
import { getCryptoMarkets } from '../cryptoService';
import { fetchYahooFinanceQuote } from '../providers/yahooFinanceProvider';
import type { NormalizedMarketQuote } from '../../src/types';
import { envelope, marketReliability, money, pct, type ApiEnvelope } from './envelope';

export class SourceUnavailableError extends Error {}

export interface QuoteData {
  symbol: string;
  name: string;
  price: number;
  change: number | null;
  change_percent: number | null;
  previous_close: number | null;
  currency: string;
  as_of: string | null;
  freshness: NormalizedMarketQuote['freshness'];
}

async function yahooQuote(symbol: string): Promise<NormalizedMarketQuote> {
  const r = await fetchYahooFinanceQuote(symbol, 'index');
  if (r.status !== 'connected' || r.quote.freshness === 'demo' || !Number.isFinite(r.quote.price)) {
    throw new SourceUnavailableError(r.message || `Yahoo Finance did not return ${symbol}.`);
  }
  return r.quote;
}

function toQuoteData(q: NormalizedMarketQuote, name: string): QuoteData {
  return {
    symbol: q.symbol,
    name,
    price: q.price,
    change: q.change === null ? null : money(q.change),
    change_percent: q.changePercent === null ? null : pct(q.changePercent),
    previous_close: q.previousClose,
    currency: q.currency,
    as_of: q.providerTimestamp,
    freshness: q.freshness,
  };
}

export async function niftyQuote(): Promise<ApiEnvelope<QuoteData>> {
  const q = await yahooQuote('^NSEI');
  return envelope(toQuoteData(q, 'NIFTY 50'), `${q.providerName} (NSE index ^NSEI)`, marketReliability('yahoo', q.providerTimestamp), false);
}

export async function btcQuote(): Promise<ApiEnvelope<QuoteData & { high_24h: number; low_24h: number; volume_24h: number }>> {
  let markets;
  try {
    markets = await getCryptoMarkets();
  } catch (e) {
    throw new SourceUnavailableError(e instanceof Error ? e.message : 'Binance is unavailable.');
  }
  const btc = markets.markets.find((m) => m.symbol === 'BTCUSDT');
  if (!btc) throw new SourceUnavailableError('Binance did not return BTCUSDT.');
  return envelope(
    {
      symbol: 'BTCUSDT',
      name: 'Bitcoin / Tether',
      price: btc.price,
      change: money(btc.change),
      change_percent: pct(btc.changePercent),
      previous_close: null,
      currency: 'USDT',
      as_of: btc.providerTimestamp,
      freshness: 'real_time',
      high_24h: btc.high24h,
      low_24h: btc.low24h,
      volume_24h: btc.volume24h,
    },
    markets.sourceLabel,
    marketReliability('binance', btc.providerTimestamp),
    false,
  );
}

/* ---------------- FII / DII (NSE) ---------------- */

const NSE = 'https://www.nseindia.com';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export interface FlowSide {
  buy: number;
  sell: number;
  net: number;
}
export interface FiiDiiData {
  date: string;
  fii: FlowSide;
  dii: FlowSide;
  unit: string;
  segment: string;
}

interface NseFlowRow {
  category?: unknown;
  date?: unknown;
  buyValue?: unknown;
  sellValue?: unknown;
  netValue?: unknown;
}

const toNum = (v: unknown): number => {
  const x = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(x) ? x : Number.NaN;
};

/** Parses NSE's fiidiiTradeReact response ([{category, date, buyValue, sellValue, netValue}]). Exported for tests. */
export function parseNseFlows(payload: unknown): FiiDiiData {
  if (!Array.isArray(payload)) throw new SourceUnavailableError('NSE returned an unexpected FII/DII response.');
  const rows = payload as NseFlowRow[];
  const pick = (re: RegExp): FlowSide & { date: string } => {
    const row = rows.find((r) => re.test(String(r.category ?? '')));
    if (!row) throw new SourceUnavailableError('NSE response is missing FII or DII figures.');
    const side = { buy: toNum(row.buyValue), sell: toNum(row.sellValue), net: toNum(row.netValue), date: String(row.date ?? '') };
    if (![side.buy, side.sell, side.net].every(Number.isFinite)) throw new SourceUnavailableError('NSE returned non-numeric FII/DII values.');
    return side;
  };
  const fii = pick(/FII|FPI/i);
  const dii = pick(/DII/i);
  return {
    date: fii.date || dii.date,
    fii: { buy: fii.buy, sell: fii.sell, net: fii.net },
    dii: { buy: dii.buy, sell: dii.sell, net: dii.net },
    unit: '₹ crore',
    segment: 'Capital market (cash), provisional',
  };
}

/** NSE date "29-Sep-2026" → ISO end of that trading day in IST (15:30 +05:30). */
export function nseDateToIso(date: string): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(date.trim());
  if (!m) return null;
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const mi = months.indexOf((m[2] ?? '').toLowerCase());
  if (mi < 0) return null;
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}T15:30:00+05:30`;
}

let flowCache: { at: number; value: ApiEnvelope<FiiDiiData> } | undefined;

export async function fiiDiiFlows(fetchImpl: typeof fetch = fetch): Promise<ApiEnvelope<FiiDiiData>> {
  if (flowCache && Date.now() - flowCache.at < 5 * 60_000) return flowCache.value;
  try {
    const home = await fetchImpl(NSE, { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' }, signal: AbortSignal.timeout(6_000) });
    const cookies = (home.headers.get('set-cookie') ?? '')
      .split(/,(?=\s*[A-Za-z0-9_]+=)/)
      .map((c) => c.split(';')[0]?.trim())
      .filter(Boolean)
      .join('; ');
    const res = await fetchImpl(`${NSE}/api/fiidiiTradeReact`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json', Referer: `${NSE}/reports/fii-dii`, ...(cookies ? { Cookie: cookies } : {}) },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) throw new SourceUnavailableError(`NSE answered HTTP ${res.status} (NSE often blocks cloud servers; try again later).`);
    const data = parseNseFlows(await res.json());
    const asOf = nseDateToIso(data.date);
    // Official exchange data, published once a day after market close: freshness is judged against the next day.
    const value = envelope(
      data,
      'NSE India · FII/DII trading activity (fiidiiTradeReact)',
      marketReliability('exchange', asOf ? new Date(Date.parse(asOf) + 17 * 3_600_000).toISOString() : null),
      false,
    );
    flowCache = { at: Date.now(), value };
    return value;
  } catch (e) {
    if (e instanceof SourceUnavailableError) throw e;
    throw new SourceUnavailableError(`NSE FII/DII data is unavailable: ${e instanceof Error ? e.message : 'request failed'}.`);
  }
}

/* ---------------- Sector performance ---------------- */

export const NSE_SECTORS: ReadonlyArray<{ name: string; symbol: string }> = [
  { name: 'NIFTY BANK', symbol: '^NSEBANK' },
  { name: 'NIFTY IT', symbol: '^CNXIT' },
  { name: 'NIFTY AUTO', symbol: '^CNXAUTO' },
  { name: 'NIFTY PHARMA', symbol: '^CNXPHARMA' },
  { name: 'NIFTY FMCG', symbol: '^CNXFMCG' },
  { name: 'NIFTY METAL', symbol: '^CNXMETAL' },
  { name: 'NIFTY REALTY', symbol: '^CNXREALTY' },
  { name: 'NIFTY ENERGY', symbol: '^CNXENERGY' },
  { name: 'NIFTY MEDIA', symbol: '^CNXMEDIA' },
  { name: 'NIFTY PSU BANK', symbol: '^CNXPSUBANK' },
];

export interface SectorRow {
  name: string;
  symbol: string;
  price: number;
  change_percent: number;
  as_of: string | null;
}
export interface SectorRotationData {
  period: string;
  sectors: SectorRow[];
  leaders: SectorRow[];
  laggards: SectorRow[];
  unavailable: string[];
}

export async function sectorRotation(quote: (symbol: string) => Promise<NormalizedMarketQuote> = yahooQuote): Promise<ApiEnvelope<SectorRotationData>> {
  const settled = await Promise.allSettled(NSE_SECTORS.map((s) => quote(s.symbol)));
  const sectors: SectorRow[] = [];
  const unavailable: string[] = [];
  settled.forEach((r, i) => {
    const def = NSE_SECTORS[i];
    if (!def) return;
    if (r.status === 'fulfilled' && r.value.changePercent !== null) {
      sectors.push({ name: def.name, symbol: def.symbol, price: r.value.price, change_percent: pct(r.value.changePercent), as_of: r.value.providerTimestamp });
    } else unavailable.push(def.name);
  });
  if (sectors.length < NSE_SECTORS.length / 2)
    throw new SourceUnavailableError(`Only ${sectors.length} of ${NSE_SECTORS.length} sector indices are available right now.`);
  sectors.sort((a, b) => b.change_percent - a.change_percent);
  const scores = sectors.map((s) => marketReliability('yahoo', s.as_of));
  const coverage = sectors.length / NSE_SECTORS.length;
  const latest = sectors
    .map((s) => s.as_of)
    .filter((x): x is string => Boolean(x))
    .sort()
    .at(-1);
  return envelope(
    { period: '1 day (change versus previous close)', sectors, leaders: sectors.slice(0, 3), laggards: sectors.slice(-3).reverse(), unavailable },
    'Yahoo Finance (NSE sectoral indices)',
    Math.min(...scores) * coverage,
    false,
    latest ?? new Date().toISOString(),
  );
}

/* ---------------- Source health (for /api/v1/health) ---------------- */

export type SourceHealth = 'ok' | 'degraded' | 'down';

async function probe(fn: () => Promise<unknown>): Promise<SourceHealth> {
  try {
    await fn();
    return 'ok';
  } catch (e) {
    return e instanceof SourceUnavailableError ? 'degraded' : 'down';
  }
}

let healthCache: { at: number; value: Record<'yahoo' | 'binance' | 'nse', SourceHealth> } | undefined;

export async function sourceHealth(): Promise<Record<'yahoo' | 'binance' | 'nse', SourceHealth>> {
  if (healthCache && Date.now() - healthCache.at < 30_000) return healthCache.value;
  const [yahoo, binance, nse] = await Promise.all([
    probe(() => yahooQuote('^NSEI')),
    probe(() => getCryptoMarkets()),
    // The data call itself (cached 5 min): NSE's homepage can refuse cloud IPs while its data API still works.
    probe(() => fiiDiiFlows()),
  ]);
  const value = { yahoo, binance, nse };
  healthCache = { at: Date.now(), value };
  return value;
}

export function resetMarketCachesForTests(): void {
  flowCache = undefined;
  healthCache = undefined;
}
