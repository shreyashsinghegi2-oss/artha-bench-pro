/**
 * Reads a Consolidated Account Statement (CAS) from CAMS, KFintech or MF Central, after its text has
 * been extracted on the device. For each scheme it collects the folio, ISIN, transactions, closing
 * units, NAV, cost and market value. Stamp-duty and tax lines are ignored.
 */
import type { Holding, Txn } from './portfolio';
import { assetClassFor } from '../data/fundClass';

export interface CasScheme {
  name: string; isin: string | null; folio: string | null; amc: string | null; registrar: string | null; advisor: string | null;
  openingUnits: number | null; units: number | null; nav: number | null; navDate: string | null; cost: number | null; value: number | null; txns: Txn[];
}
export interface CasResult { schemes: CasScheme[]; statementPeriod: string | null; investorName: string | null; kind: 'detailed' | 'summary' | 'unknown' }

const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
const toIso = (d: string) => {
  const m = d.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  return m ? `${m[3]}-${MONTHS[m[2].toLowerCase()] ?? '01'}-${m[1].padStart(2, '0')}` : d;
};
/** "1,23,456.78" → 123456.78; "(5,000.00)" or "-5,000.00" → -5000. */
const num = (s: string | undefined | null): number | null => {
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s.trim()) || s.trim().startsWith('-');
  const n = Number(s.replace(/[(),\s]/g, '').replace(/^-/, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
};

const DATE = String.raw`\d{2}-[A-Za-z]{3}-\d{4}`;
const AMT = String.raw`\(?-?[\d,]+\.\d{1,4}\)?`;
const TXN = new RegExp(`^(${DATE})\\s+(.+?)\\s+(${AMT})\\s+(${AMT})\\s+(${AMT})\\s+(${AMT})\\s*$`);
const ISIN = /ISIN\s*:\s*(INF[A-Z0-9]{9})/i;

function cleanSchemeName(line: string): string {
  return line
    .replace(/\s*-?\s*ISIN\s*:.*$/i, '')
    .replace(/^[A-Z0-9]{2,12}-(?=[A-Za-z])/, '')
    .replace(/\((non-demat|demat|formerly[^)]*)\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s-]+$/, '')
    .trim();
}

export function parseCas(text: string): CasResult {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const schemes: CasScheme[] = [];
  let folio: string | null = null, amc: string | null = null, cur: CasScheme | null = null;
  const period = text.match(new RegExp(`(${DATE})\\s*(?:To|to|-)\\s*(${DATE})`));
  let investorName: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!investorName) { const m = line.match(/^(?:Name|Investor Name)\s*:\s*(.+?)(?:\s{2,}|$)/i); if (m) investorName = m[1].trim(); }
    if (/mutual fund$/i.test(line) && line.length < 80 && !/ISIN/i.test(line)) amc = line;
    const f = line.match(/Folio\s*No\s*[:.]?\s*([A-Za-z0-9/ ]+?)(?=\s+(?:PAN|KYC|Nominee|$))/i) ?? line.match(/Folio\s*No\s*[:.]?\s*([A-Za-z0-9/]+(?:\s*\/\s*[A-Za-z0-9]+)?)/i);
    if (f) folio = f[1].trim();

    const isinM = line.match(ISIN);
    if (isinM) {
      let name = cleanSchemeName(line);
      // Scheme names sometimes wrap onto the line above the ISIN.
      if (name.length < 12 && i > 0 && !TXN.test(lines[i - 1]) && !/Folio|Balance|PAN/i.test(lines[i - 1])) name = cleanSchemeName(`${lines[i - 1]} ${line}`);
      cur = { name, isin: isinM[1].toUpperCase(), folio, amc, registrar: line.match(/Registrar\s*:\s*([A-Za-z]+)/i)?.[1] ?? null, advisor: line.match(/Advisor\s*:\s*([A-Za-z0-9-]+)/i)?.[1] ?? null, openingUnits: null, units: null, nav: null, navDate: null, cost: null, value: null, txns: [] };
      schemes.push(cur);
      continue;
    }
    if (!cur) continue;

    const t = line.match(TXN);
    if (t && !/\*\*\*|stamp duty|stt paid|tds/i.test(t[2])) {
      const amount = num(t[3]) ?? 0, units = num(t[4]) ?? 0;
      const desc = t[2].toLowerCase();
      const kind: Txn['kind'] = /redemption|switch[- ]?out|withdraw|sell|payout|transfer out/.test(desc) || units < 0 || amount < 0 ? 'sell'
        : /purchase|sip|systematic|switch[- ]?in|invest|reinvest|transfer in|nfo/.test(desc) ? 'buy' : 'other';
      cur.txns.push({ date: toIso(t[1]), amount: Math.abs(amount), units, kind });
      continue;
    }
    const opening = line.match(/Opening Unit Balance\s*:?\s*([\d,]+\.\d+)/i);
    if (opening) cur.openingUnits = num(opening[1]);
    const closing = line.match(/Closing Unit Balance\s*:?\s*([\d,]+\.\d+)/i);
    if (closing) cur.units = num(closing[1]);
    const nav = line.match(new RegExp(`NAV on (${DATE})\\s*:?\\s*(?:INR|Rs\\.?|₹)?\\s*([\\d,]+\\.\\d+)`, 'i'));
    if (nav) { cur.navDate = toIso(nav[1]); cur.nav = num(nav[2]); }
    const cost = line.match(/(?:Total )?Cost Value\s*:?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+\.\d+)/i);
    if (cost) cur.cost = num(cost[1]);
    const mv = line.match(new RegExp(`(?:Market Value|Valuation) on (${DATE})\\s*:?\\s*(?:INR|Rs\\.?|₹)?\\s*([\\d,]+\\.\\d+)`, 'i'));
    if (mv) { cur.value = num(mv[2]); cur.navDate = cur.navDate ?? toIso(mv[1]); }
  }

  // Merge the same scheme across folios only when the folio differs? Keep folios separate; drop empty schemes.
  const kept = schemes.filter((s) => (s.units ?? 0) > 0.0001 || (s.value ?? 0) > 0);
  for (const s of kept) if (s.value === null && s.units !== null && s.nav !== null) s.value = s.units * s.nav;
  const detailed = kept.some((s) => s.txns.length > 0);
  return { schemes: kept, statementPeriod: period ? `${toIso(period[1])} to ${toIso(period[2])}` : null, investorName, kind: kept.length ? (detailed ? 'detailed' : 'summary') : 'unknown' };
}

/** CAS schemes → portfolio holdings. Cost falls back to net purchases when the statement has none. */
export function casToHoldings(cas: CasResult, now = new Date().toISOString()): Holding[] {
  return cas.schemes.map((s, i) => {
    const net = s.txns.reduce((sum, t) => sum + (t.kind === 'buy' ? t.amount : t.kind === 'sell' ? -t.amount : 0), 0);
    const invested = s.cost ?? (net > 0 ? net : 0);
    return {
      id: `cas-${s.isin ?? i}-${s.folio ?? ''}`.replace(/[^A-Za-z0-9-]/g, ''),
      kind: 'mf', name: s.name, assetClass: assetClassFor('', s.name), isin: s.isin ?? undefined, folio: s.folio ?? undefined, house: s.amc ?? undefined,
      units: s.units ?? undefined, price: s.nav ?? undefined, priceDate: s.navDate ?? undefined,
      invested, value: s.value ?? 0, txns: s.txns,
      // XIRR needs every purchase: only when the statement starts from zero units.
      txnsComplete: (s.openingUnits ?? 0) < 0.001 && s.txns.some((t) => t.kind === 'buy'),
      source: 'cas', updatedAt: now,
    } satisfies Holding;
  });
}
