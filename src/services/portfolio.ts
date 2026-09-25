/**
 * Portfolio and net worth, kept on this device. Holdings come from a CAS statement import, a fund
 * search, or manual entry. Values refresh from official AMFI NAVs and exchange quotes.
 */

export type HoldingKind = 'mf' | 'stock' | 'fd' | 'ppf' | 'epf' | 'nps' | 'gold' | 'cash' | 'property' | 'crypto' | 'other';
export type AssetClass = 'Equity' | 'Debt' | 'Hybrid' | 'Gold & commodities' | 'Real estate' | 'Cash' | 'Crypto' | 'Other';

export interface Txn { date: string; amount: number; units?: number; kind: 'buy' | 'sell' | 'other' }
export interface Holding {
  id: string; kind: HoldingKind; name: string; assetClass: AssetClass;
  schemeCode?: string; isin?: string; folio?: string; house?: string; category?: string; symbol?: string;
  units?: number; price?: number; priceDate?: string;
  invested: number; value: number;
  txns?: Txn[];
  /** False when the transactions do not include every purchase (e.g. units held before the statement period). */
  txnsComplete?: boolean;
  source: 'cas' | 'search' | 'manual'; updatedAt: string;
}
export interface Liability { id: string; name: string; outstanding: number; ratePct?: number }
export interface PortfolioData { holdings: Holding[]; liabilities: Liability[]; importedFrom?: string; importedAt?: string }

export const KIND_LABEL: Record<HoldingKind, string> = { mf: 'Mutual fund', stock: 'Stock', fd: 'Fixed deposit', ppf: 'PPF', epf: 'EPF', nps: 'NPS', gold: 'Gold', cash: 'Cash & savings', property: 'Property', crypto: 'Crypto', other: 'Other' };
export const KIND_CLASS: Record<HoldingKind, AssetClass> = { mf: 'Other', stock: 'Equity', fd: 'Debt', ppf: 'Debt', epf: 'Debt', nps: 'Hybrid', gold: 'Gold & commodities', cash: 'Cash', property: 'Real estate', crypto: 'Crypto', other: 'Other' };
export const CLASS_COLOR: Record<AssetClass, string> = { Equity: '#2563eb', Debt: '#0f9d8a', Hybrid: '#7c3aed', 'Gold & commodities': '#d4a017', 'Real estate': '#b45309', Cash: '#64748b', Crypto: '#f97316', Other: '#94a3b8' };

const KEY = 'arthamind-portfolio-v1';
export const PORTFOLIO_EVENT = 'arthamind:portfolio-changed';

export function loadPortfolio(): PortfolioData {
  try { const raw = window.localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw) as PortfolioData; return { holdings: d.holdings ?? [], liabilities: d.liabilities ?? [], importedFrom: d.importedFrom, importedAt: d.importedAt }; } } catch { /* unreadable or blocked */ }
  return { holdings: [], liabilities: [] };
}
export function savePortfolio(data: PortfolioData) {
  try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
  window.dispatchEvent(new Event(PORTFOLIO_EVENT));
}
export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ---------------- XIRR ----------------

/**
 * Annualised return for irregular cash flows (money in negative, money out / current value positive).
 * Newton's method with a bisection fallback. Returns null when it cannot be defined.
 */
export function xirr(flows: Array<{ date: string; amount: number }>): number | null {
  const cf = flows.filter((f) => Number.isFinite(f.amount) && f.amount !== 0).map((f) => ({ t: new Date(f.date).getTime(), a: f.amount })).filter((f) => Number.isFinite(f.t)).sort((a, b) => a.t - b.t);
  if (cf.length < 2 || !cf.some((f) => f.a < 0) || !cf.some((f) => f.a > 0)) return null;
  const t0 = cf[0].t;
  const yrs = cf.map((f) => (f.t - t0) / (365 * 86_400_000));
  if (yrs[yrs.length - 1] < 1 / 365) return null;
  const npv = (r: number) => cf.reduce((s, f, i) => s + f.a / (1 + r) ** yrs[i], 0);
  const d = (r: number) => cf.reduce((s, f, i) => s - (yrs[i] * f.a) / (1 + r) ** (yrs[i] + 1), 0);
  let r = 0.1;
  for (let i = 0; i < 60; i++) {
    const v = npv(r), dv = d(r);
    if (!Number.isFinite(v) || !Number.isFinite(dv) || dv === 0) break;
    const next = r - v / dv;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - r) < 1e-9) return next;
    r = next;
  }
  // Bisection between -99.99% and +10,000%.
  let lo = -0.9999, hi = 100;
  let flo = npv(lo), fhi = npv(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = npv(mid);
    if (Math.abs(fm) < 1e-7) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

/** Cash flows for XIRR from a holding's transactions plus today's value. */
export function holdingFlows(h: Holding, today = new Date().toISOString().slice(0, 10)) {
  const flows = (h.txns ?? []).filter((t) => t.kind !== 'other').map((t) => ({ date: t.date, amount: t.kind === 'buy' ? -Math.abs(t.amount) : Math.abs(t.amount) }));
  if (h.value > 0) flows.push({ date: today, amount: h.value });
  return flows;
}

// ---------------- Summary and checks ----------------

export interface Insight { tone: 'good' | 'warn' | 'info'; title: string; detail: string }
export interface PortfolioSummary {
  assets: number; liabilities: number; netWorth: number; invested: number; investedValue: number; gain: number; gainPct: number | null;
  xirr: number | null; xirrCoverage: number;
  byClass: Array<{ cls: AssetClass; value: number; share: number }>;
  topHoldings: Array<{ name: string; value: number; share: number }>;
  insights: Insight[];
}

const inr = (v: number) => `${v < 0 ? '−' : ''}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function summarise(data: PortfolioData, age?: number): PortfolioSummary {
  const hs = data.holdings.filter((h) => h.value > 0 || h.invested > 0);
  const assets = hs.reduce((s, h) => s + (h.value || 0), 0);
  const liabilities = data.liabilities.reduce((s, l) => s + (l.outstanding || 0), 0);
  // "Invested" only counts holdings where a cost is known (not cash, property or EPF entered by value).
  const tracked = hs.filter((h) => h.invested > 0);
  const invested = tracked.reduce((s, h) => s + h.invested, 0);
  const investedValue = tracked.reduce((s, h) => s + h.value, 0);
  const gain = investedValue - invested;
  const withTxns = hs.filter((h) => (h.txns?.length ?? 0) > 0 && h.txnsComplete !== false && (h.txns ?? []).some((t) => t.kind === 'buy'));
  const flows = withTxns.flatMap((h) => holdingFlows(h));
  const coverage = assets ? withTxns.reduce((s, h) => s + h.value, 0) / assets : 0;
  const classMap = new Map<AssetClass, number>();
  for (const h of hs) classMap.set(h.assetClass, (classMap.get(h.assetClass) ?? 0) + h.value);
  const byClass = [...classMap.entries()].map(([cls, value]) => ({ cls, value, share: assets ? value / assets : 0 })).sort((a, b) => b.value - a.value);
  const topHoldings = [...hs].sort((a, b) => b.value - a.value).slice(0, 5).map((h) => ({ name: h.name, value: h.value, share: assets ? h.value / assets : 0 }));

  const insights: Insight[] = [];
  const mfs = hs.filter((h) => h.kind === 'mf');
  const regular = mfs.filter((h) => /\bregular\b/i.test(h.name) && !/\bdirect\b/i.test(h.name));
  if (regular.length) {
    const v = regular.reduce((s, h) => s + h.value, 0);
    insights.push({ tone: 'warn', title: `${regular.length} fund${regular.length > 1 ? 's are' : ' is'} in a Regular plan`, detail: `Regular plans pay a distributor commission inside the fund, usually about 0.5% to 1.5% a year more than the Direct plan of the same fund. On ${inr(v)} that is roughly ${inr(v * 0.005)} to ${inr(v * 0.015)} a year. Check the exact expense ratios on the AMC website before switching, and remember a switch is a sale (tax and exit load may apply).` });
  }
  if (mfs.length > 8) insights.push({ tone: 'warn', title: `${mfs.length} mutual funds`, detail: 'Many funds usually hold the same large companies, so more funds rarely means more diversification. 4 to 6 well-chosen funds are often enough.' });
  const catCount = new Map<string, number>();
  for (const h of mfs) if (h.category) catCount.set(h.category, (catCount.get(h.category) ?? 0) + 1);
  for (const [cat, n] of catCount) if (n >= 3) insights.push({ tone: 'info', title: `${n} funds in the same category`, detail: `You hold ${n} funds in “${cat}”. Funds in one category tend to own similar stocks; consider whether each one adds something different.` });
  // Concentration matters for holdings whose price moves: shares, equity or hybrid funds, crypto.
  const MARKET: HoldingKind[] = ['stock', 'mf', 'crypto'];
  const risky = [...hs].filter((h) => MARKET.includes(h.kind) && h.assetClass !== 'Debt').sort((a, b) => b.value - a.value)[0];
  if (risky && assets > 0 && risky.value / assets > 0.35 && hs.length > 1) insights.push({ tone: 'warn', title: 'One market-linked holding is a big share', detail: `${risky.name} is ${pct(risky.value / assets)} of your assets. If it falls sharply, your whole net worth feels it. Many planners keep any single stock or fund well below a third.` });
  const equity = byClass.find((c) => c.cls === 'Equity')?.share ?? 0;
  if (age && assets > 0) {
    const guide = Math.max(0.2, Math.min(0.8, (100 - age) / 100));
    if (Math.abs(equity - guide) > 0.2) insights.push({ tone: 'info', title: `Equity is ${pct(equity)} of your assets`, detail: `A common rule of thumb (100 minus age) suggests about ${pct(guide)} in equity at ${age}. It is only a starting point: your goals, time horizon and comfort with ups and downs matter more.` });
  }
  // Money you can use within days: savings, FDs and liquid/overnight funds.
  const ready = hs.filter((h) => h.kind === 'cash' || h.kind === 'fd' || (h.kind === 'mf' && /liquid|overnight|money market/i.test(`${h.category ?? ''} ${h.name}`))).reduce((sum, h) => sum + h.value, 0);
  if (assets > 0 && ready === 0) insights.push({ tone: 'info', title: 'No emergency money recorded', detail: 'Add your savings account, FDs or liquid funds so we can check your emergency fund (about 6 months of expenses is a common target).' });
  if (liabilities > 0 && assets > 0 && liabilities / assets > 0.5) insights.push({ tone: 'warn', title: 'Loans are high compared with assets', detail: `Loans are ${pct(liabilities / assets)} of your assets. Prepaying the costliest loan often gives a guaranteed return equal to its interest rate.` });
  if (!insights.length && hs.length) insights.push({ tone: 'good', title: 'Nothing urgent stands out', detail: 'Your holdings pass the basic checks. Review once a quarter and rebalance if an asset class drifts far from your plan.' });

  return { assets, liabilities, netWorth: assets - liabilities, invested, investedValue, gain, gainPct: invested ? gain / invested : null, xirr: xirr(flows), xirrCoverage: coverage, byClass, topHoldings, insights };
}

/** Compact text of the portfolio for the AI assistant (full amounts, no personal identifiers). */
export function portfolioSnapshot(data: PortfolioData, s: PortfolioSummary): string {
  const lines = [
    `Net worth ${inr(s.netWorth)} (assets ${inr(s.assets)}, loans ${inr(s.liabilities)}).`,
    s.invested ? `Invested ${inr(s.invested)}, now ${inr(s.investedValue)}, gain ${inr(s.gain)}${s.gainPct !== null ? ` (${pct(s.gainPct)})` : ''}.` : '',
    s.xirr !== null ? `XIRR ${pct(s.xirr)} a year on ${pct(s.xirrCoverage)} of assets with transaction history.` : '',
    `Allocation: ${s.byClass.map((c) => `${c.cls} ${pct(c.share)}`).join(', ')}.`,
    `Holdings: ${data.holdings.slice(0, 25).map((h) => `${h.name}${h.category ? ` [${h.category}]` : ''} ${inr(h.value)}${h.invested ? ` (cost ${inr(h.invested)})` : ''}`).join('; ')}.`,
    data.liabilities.length ? `Loans: ${data.liabilities.map((l) => `${l.name} ${inr(l.outstanding)}${l.ratePct ? ` at ${l.ratePct}%` : ''}`).join('; ')}.` : '',
    `Checks: ${s.insights.map((i) => i.title).join('; ')}.`,
  ];
  return lines.filter(Boolean).join('\n');
}

// ---------------- SIP check on real NAV history ----------------

export interface SipBacktest { months: number; invested: number; value: number; units: number; xirr: number | null; start: string; end: string }

/**
 * What a monthly SIP would be worth today, from actual NAVs: buys on the first available NAV on or
 * after the same day each month, values the units at the latest NAV. Returns null if history is short.
 */
export function sipBacktest(history: Array<{ date: string; nav: number }>, monthly: number, years: number): SipBacktest | null {
  if (history.length < 2 || !(monthly > 0) || !(years > 0)) return null;
  const last = history[history.length - 1];
  const end = new Date(`${last.date}T00:00:00Z`);
  const start = new Date(end); start.setUTCMonth(start.getUTCMonth() - years * 12);
  if (history[0].date > start.toISOString().slice(0, 10)) return null;
  let units = 0, invested = 0, i = 0;
  const flows: Array<{ date: string; amount: number }> = [];
  for (let m = 0; m < years * 12; m++) {
    const d = new Date(start); d.setUTCMonth(start.getUTCMonth() + m);
    const want = d.toISOString().slice(0, 10);
    while (i < history.length && history[i].date < want) i++;
    if (i >= history.length) break;
    const p = history[i];
    units += monthly / p.nav; invested += monthly;
    flows.push({ date: p.date, amount: -monthly });
  }
  const value = units * last.nav;
  flows.push({ date: last.date, amount: value });
  return { months: flows.length - 1, invested, value, units, xirr: xirr(flows), start: flows[0]?.date ?? '', end: last.date };
}
