/**
 * Mutual fund NAVs from official AMFI data.
 * - Latest NAV for every scheme: AMFI's daily NAVAll.txt (scheme code, ISINs, name, NAV, date).
 * - NAV history and search: api.mfapi.in, a free API built on AMFI data; AMFI is the fallback for search.
 * Results are cached in memory; AMFI updates NAVs once a day in the evening.
 */

import { assetClassFor, type FundAssetClass as AssetClass } from '../src/data/fundClass';
export { assetClassFor };
export interface AmfiScheme {
  code: string; name: string; house: string; category: string; assetClass: AssetClass;
  isinGrowth: string | null; isinReinvest: string | null; nav: number; navDate: string;
}
export interface NavPoint { date: string; nav: number }

const AMFI_URLS = [process.env.AMFI_NAV_URL, 'https://www.amfiindia.com/spages/NAVAll.txt', 'https://portal.amfiindia.com/spages/NAVAll.txt'].filter(Boolean) as string[];
const MFAPI_URL = (process.env.MFAPI_BASE_URL || 'https://api.mfapi.in').replace(/\/$/, '');
const AMFI_TTL_MS = 6 * 60 * 60 * 1000;
const HISTORY_TTL_MS = 3 * 60 * 60 * 1000;

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
      const problems: string[] = [];
      let list: AmfiScheme[] = [];
      for (const url of AMFI_URLS) {
        try {
          const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArthaMind/1.0)', Accept: 'text/plain,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
          const text = await res.text();
          if (!res.ok) { problems.push(`${new URL(url).host}: HTTP ${res.status}`); continue; }
          list = parseAmfiNav(text);
          if (list.length >= 1000) break;
          problems.push(`${new URL(url).host}: ${list.length} rows from ${text.length} bytes, starts "${text.slice(0, 80).replace(/\s+/g, ' ')}"`);
        } catch (e) { problems.push(`${new URL(url).host}: ${e instanceof Error ? e.message : 'failed'}`); }
      }
      if (list.length < 1000) throw new Error(`AMFI NAV file unavailable (${problems.join('; ')}).`);
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
  try {
    const { list } = await amfiSchemes();
    return { results: searchSchemes(list, q, limit), source: 'AMFI daily NAV file' };
  } catch (amfiError) {
    // Fallback: mfapi.in search (names and codes only; the NAV comes from the scheme page).
    const res = await fetch(`${MFAPI_URL}/mf/search?q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!res?.ok) throw amfiError;
    const rows = await res.json() as Array<{ schemeCode: number | string; schemeName: string }>;
    const results: AmfiScheme[] = rows.slice(0, 200).map((r) => ({ code: String(r.schemeCode), name: r.schemeName, house: '', category: '', assetClass: assetClassFor('', r.schemeName), isinGrowth: null, isinReinvest: null, nav: 0, navDate: '' }));
    return { results: searchSchemes(results, q, limit), source: 'mfapi.in (AMFI data)' };
  }
}

export async function fundsByIsin(items: Array<{ isin: string; name?: string }>) {
  const out: Record<string, AmfiScheme | null> = {};
  const list = items.slice(0, 60);
  // A few at a time, so a large statement does not flood the data source.
  for (let i = 0; i < list.length; i += 6) {
    const batch = list.slice(i, i + 6);
    const found = await Promise.all(batch.map((it) => matchFund(it.isin, it.name ?? '').catch(() => null)));
    batch.forEach((it, j) => { out[it.isin.toUpperCase()] = found[j]; });
  }
  return out;
}

const historyCache = new Map<string, { at: number; points: NavPoint[]; meta: MfapiMeta | null }>();
interface MfapiMeta { fund_house?: string; scheme_type?: string; scheme_category?: string; scheme_code?: number | string; scheme_name?: string; isin_growth?: string | null; isin_div_reinvestment?: string | null }

function schemeFromMeta(code: string, meta: MfapiMeta | null, last?: NavPoint): AmfiScheme | null {
  if (!meta?.scheme_name) return null;
  const category = (meta.scheme_category || '').replace(/^.*?Scheme\s*-\s*/i, (m) => m).trim();
  return { code, name: meta.scheme_name, house: meta.fund_house || '', category, assetClass: assetClassFor(category, meta.scheme_name), isinGrowth: meta.isin_growth || null, isinReinvest: meta.isin_div_reinvestment || null, nav: last?.nav ?? 0, navDate: last?.date ?? '' };
}

async function mfapiScheme(code: string, latestOnly = false) {
  const res = await fetch(`${MFAPI_URL}/mf/${code}${latestOnly ? '/latest' : ''}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`mfapi HTTP ${res.status}`);
  const body = await res.json() as { meta?: MfapiMeta; data?: Array<{ date: string; nav: string }> };
  const points = (body.data ?? []).map((d) => ({ date: isoDate(d.date), nav: Number(d.nav) })).filter((p) => Number.isFinite(p.nav) && p.nav > 0).reverse();
  return { meta: body.meta ?? null, points };
}

/** Daily points for the last year, weekly before that: small enough for a phone, exact for returns. */
export function thinHistory(points: NavPoint[]): NavPoint[] {
  if (points.length < 400) return points;
  const cutoff = new Date(new Date(points[points.length - 1].date).getTime() - 366 * 86_400_000).toISOString().slice(0, 10);
  const out: NavPoint[] = [];
  let lastWeek = '';
  for (const p of points) {
    if (p.date >= cutoff) { out.push(p); continue; }
    const d = new Date(p.date); const week = `${d.getUTCFullYear()}-${Math.floor((d.getTime() / 86_400_000 + 4) / 7)}`;
    if (week !== lastWeek) { out.push(p); lastWeek = week; }
  }
  return out;
}

/** Scheme details, NAV history (oldest first) and trailing returns. */
export async function fundDetail(code: string) {
  if (!/^\d{3,8}$/.test(code)) throw new Error('Invalid scheme code.');
  const amfi = await amfiSchemes().catch(() => null);
  let cached = historyCache.get(code);
  if (!cached || Date.now() - cached.at > HISTORY_TTL_MS) {
    try {
      const { meta, points } = await mfapiScheme(code);
      cached = { at: Date.now(), points, meta };
      historyCache.set(code, cached);
      if (historyCache.size > 300) historyCache.delete(historyCache.keys().next().value as string);
    } catch {
      const a = amfi?.byCode.get(code);
      cached = { at: Date.now(), points: a ? [{ date: a.navDate, nav: a.nav }] : [], meta: null };
    }
  }
  const last = cached.points[cached.points.length - 1];
  const scheme = amfi?.byCode.get(code) ?? schemeFromMeta(code, cached.meta, last);
  if (!scheme && !cached.points.length) throw new Error('Scheme not found.');
  return { scheme, history: thinHistory(cached.points), returns: trailingReturns(cached.points), sources: [amfi ? 'AMFI (official NAVs)' : 'mfapi.in (AMFI NAV data)'] };
}

/** Find the scheme for an ISIN: AMFI's file when reachable, else search mfapi by name and confirm the ISIN. */
export async function matchFund(isin: string, name: string): Promise<AmfiScheme | null> {
  const id = isin.trim().toUpperCase();
  const amfi = await amfiSchemes().catch(() => null);
  if (amfi) return amfi.byIsin.get(id) ?? null;
  const words = name.replace(/\(.*?\)/g, ' ').replace(/[^A-Za-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !/^(fund|plan|option|the|of)$/i.test(w)).slice(0, 5).join(' ');
  if (!words) return null;
  const res = await fetch(`${MFAPI_URL}/mf/search?q=${encodeURIComponent(words)}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return null;
  const rows = (await res.json() as Array<{ schemeCode: number | string; schemeName: string }>).slice(0, 12);
  const direct = /direct/i.test(name), growth = !/idcw|dividend/i.test(name);
  rows.sort((a, b) => Number(/direct/i.test(b.schemeName) === direct) - Number(/direct/i.test(a.schemeName) === direct) || Number(!/idcw|dividend/i.test(b.schemeName) === growth) - Number(!/idcw|dividend/i.test(a.schemeName) === growth));
  for (const r of rows.slice(0, 6)) {
    try {
      const { meta, points } = await mfapiScheme(String(r.schemeCode), true);
      if (meta && (meta.isin_growth === id || meta.isin_div_reinvestment === id)) return schemeFromMeta(String(r.schemeCode), meta, points[points.length - 1]);
    } catch { /* try the next candidate */ }
  }
  return null;
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
