/**
 * Mutual fund NAVs from official AMFI data.
 * - Latest NAV for every scheme: AMFI's daily NAVAll.txt (scheme code, ISINs, name, NAV, date).
 * - NAV history and search: api.mfapi.in, a free API built on AMFI data; AMFI is the fallback for search.
 * Results are cached in memory; AMFI updates NAVs once a day in the evening.
 */

export type AssetClass = 'Equity' | 'Debt' | 'Hybrid' | 'Gold & commodities' | 'Other';
export interface AmfiScheme {
  code: string; name: string; house: string; category: string; assetClass: AssetClass;
  isinGrowth: string | null; isinReinvest: string | null; nav: number; navDate: string;
}
export interface NavPoint { date: string; nav: number }

const AMFI_URL = process.env.AMFI_NAV_URL || 'https://www.amfiindia.com/spages/NAVAll.txt';
const MFAPI_URL = (process.env.MFAPI_BASE_URL || 'https://api.mfapi.in').replace(/\/$/, '');
const AMFI_TTL_MS = 6 * 60 * 60 * 1000;
const HISTORY_TTL_MS = 3 * 60 * 60 * 1000;

export function assetClassFor(category: string, name = ''): AssetClass {
  const c = `${category} ${name}`.toLowerCase();
  if (/gold|silver|commodit/.test(c)) return 'Gold & commodities';
  if (/hybrid|balanced|asset allocation|arbitrage|equity savings|multi asset/.test(c)) return 'Hybrid';
  if (/equity|elss|index|etf|large cap|mid cap|small cap|flexi|multi cap|focused|value|contra|dividend yield|sectoral|thematic|nifty|sensex/.test(c)) return 'Equity';
  if (/debt|liquid|overnight|money market|gilt|bond|duration|credit risk|banking and psu|floater|income|fixed maturity|fmp/.test(c)) return 'Debt';
  return 'Other';
}

/** "24-Sep-2025" or "24-09-2025" → "2025-09-24". */
export function isoDate(d: string): string {
  const m = d.trim().match(/^(\d{1,2})-([A-Za-z]{3}|\d{2})-(\d{4})$/);
  if (!m) return d.trim();
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const mm = /\d/.test(m[2]) ? m[2] : String(months.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0');
  return `${m[3]}-${mm}-${m[1].padStart(2, '0')}`;
}

/** Parse AMFI NAVAll.txt. Category and fund-house header lines apply to the rows under them. */
export function parseAmfiNav(text: string): AmfiScheme[] {
  const out: AmfiScheme[] = [];
  let category = '', house = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('Scheme Code;')) continue;
    const parts = line.split(';');
    if (parts.length >= 6 && /^\d+$/.test(parts[0])) {
      const nav = Number(parts[4]);
      if (!Number.isFinite(nav) || nav <= 0) continue;
      const isin = (s: string) => (/^INF[A-Z0-9]{9}$/.test(s.trim()) ? s.trim() : null);
      out.push({ code: parts[0], isinGrowth: isin(parts[1]), isinReinvest: isin(parts[2]), name: parts[3].trim(), nav, navDate: isoDate(parts[5]), category, house, assetClass: assetClassFor(category, parts[3]) });
    } else if (/schemes?\s*\(/i.test(line)) {
      category = line.replace(/^.*?\((.*)\)\s*$/, '$1').trim() || line;
    } else if (parts.length === 1) {
      house = line;
    }
  }
  return out;
}

let amfiCache: { at: number; list: AmfiScheme[]; byCode: Map<string, AmfiScheme>; byIsin: Map<string, AmfiScheme> } | null = null;
let amfiLoading: Promise<NonNullable<typeof amfiCache>> | null = null;

export async function amfiSchemes() {
  if (amfiCache && Date.now() - amfiCache.at < AMFI_TTL_MS) return amfiCache;
  if (amfiLoading) return amfiLoading;
  amfiLoading = (async () => {
    try {
      const res = await fetch(AMFI_URL, { headers: { 'User-Agent': 'ArthaMind/1.0' }, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`AMFI NAV file request failed with HTTP ${res.status}.`);
      const list = parseAmfiNav(await res.text());
      if (list.length < 1000) throw new Error('AMFI NAV file looked incomplete.');
      const byCode = new Map(list.map((s) => [s.code, s]));
      const byIsin = new Map<string, AmfiScheme>();
      for (const s of list) { if (s.isinGrowth) byIsin.set(s.isinGrowth, s); if (s.isinReinvest) byIsin.set(s.isinReinvest, s); }
      amfiCache = { at: Date.now(), list, byCode, byIsin };
      return amfiCache;
    } catch (error) {
      if (amfiCache) return amfiCache; // serve yesterday's data rather than nothing
      throw error;
    } finally { amfiLoading = null; }
  })();
  return amfiLoading;
}

const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Search schemes by name words (all words must match); direct growth plans first. */
export function searchSchemes(list: AmfiScheme[], query: string, limit = 20): AmfiScheme[] {
  const words = normal(query).split(' ').filter((w) => w.length >= 2);
  if (!words.length) return [];
  const hits = list.filter((s) => { const n = normal(`${s.name} ${s.house}`); return words.every((w) => n.includes(w)); });
  const rank = (s: AmfiScheme) => (/direct/i.test(s.name) ? 0 : 2) + (/growth/i.test(s.name) ? 0 : 1);
  return hits.sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length).slice(0, limit);
}

export async function searchFunds(query: string, limit = 20) {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return { results: [] as AmfiScheme[], source: 'AMFI' };
  const { list } = await amfiSchemes();
  return { results: searchSchemes(list, q, limit), source: 'AMFI daily NAV file' };
}

export async function fundsByIsin(isins: string[]) {
  const { byIsin } = await amfiSchemes();
  const out: Record<string, AmfiScheme | null> = {};
  for (const i of isins.slice(0, 200)) out[i] = byIsin.get(i.trim().toUpperCase()) ?? null;
  return out;
}

const historyCache = new Map<string, { at: number; points: NavPoint[] }>();

/** NAV history (oldest first), from mfapi.in; falls back to AMFI's latest NAV only. */
export async function fundDetail(code: string) {
  if (!/^\d{3,8}$/.test(code)) throw new Error('Invalid scheme code.');
  const { byCode } = await amfiSchemes().catch(() => ({ byCode: new Map<string, AmfiScheme>() }));
  const scheme = byCode.get(code) ?? null;
  let points = historyCache.get(code);
  if (!points || Date.now() - points.at > HISTORY_TTL_MS) {
    try {
      const res = await fetch(`${MFAPI_URL}/mf/${code}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { data?: Array<{ date: string; nav: string }> };
      const pts = (body.data ?? []).map((d) => ({ date: isoDate(d.date), nav: Number(d.nav) })).filter((p) => Number.isFinite(p.nav) && p.nav > 0).reverse();
      points = { at: Date.now(), points: pts };
      historyCache.set(code, points);
      if (historyCache.size > 300) historyCache.delete(historyCache.keys().next().value as string);
    } catch {
      points = { at: Date.now(), points: scheme ? [{ date: scheme.navDate, nav: scheme.nav }] : [] };
    }
  }
  if (!scheme && !points.points.length) throw new Error('Scheme not found.');
  return { scheme, history: points.points, returns: trailingReturns(points.points), sources: ['AMFI (official NAVs)', ...(points.points.length > 1 ? ['mfapi.in (AMFI history)'] : [])] };
}

/** Point-to-point returns: absolute for up to 1 year, compounded yearly (CAGR) beyond. */
export function trailingReturns(points: NavPoint[]) {
  if (points.length < 2) return {};
  const last = points[points.length - 1];
  const at = (days: number) => {
    const target = new Date(new Date(last.date).getTime() - days * 86_400_000).toISOString().slice(0, 10);
    let found: NavPoint | undefined;
    for (const p of points) { if (p.date <= target) found = p; else break; }
    return found;
  };
  const out: Record<string, number> = {};
  for (const [label, days] of [['1M', 30], ['6M', 182], ['1Y', 365], ['3Y', 1095], ['5Y', 1826]] as const) {
    const p = at(days);
    if (!p) continue;
    const years = days / 365;
    out[label] = years <= 1 ? last.nav / p.nav - 1 : (last.nav / p.nav) ** (1 / years) - 1;
  }
  return out;
}
