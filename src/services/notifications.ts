import type { AppNavigationDestination } from '../navigationTypes';
import { loadMoneyProfile } from './moneyProfile';
import { buildCompleteDashboard } from './completeDashboard';
import { loadEmiRecords } from './emiStorage';
import { loadIncomeSources } from './incomeStorage';
import { loadExpenses } from './personalFinanceStorage';

/** up = growth (green), down = loss (red), alert = needs attention (amber), news/info = information (blue). */
export type NoticeKind = 'up' | 'down' | 'alert' | 'news' | 'info';
export interface Notice { id: string; kind: NoticeKind; title: string; body: string; at: string; read: boolean; to?: AppNavigationDestination; url?: string }

const KEY = 'arthamind-notifications-v1';
const MAX = 40;
export const NOTICES_EVENT = 'arthamind:notices';

export function loadNotices(): Notice[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function save(list: Notice[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent(NOTICES_EVENT));
}
/** Adds notices that are not already stored (by id); returns the ones that were new. */
export function addNotices(items: Array<Omit<Notice, 'read' | 'at'> & { at?: string }>): Notice[] {
  const list = loadNotices();
  const known = new Set(list.map((n) => n.id));
  const fresh = items.filter((n) => !known.has(n.id)).map((n) => ({ ...n, at: n.at ?? new Date().toISOString(), read: false }));
  if (fresh.length) save([...fresh, ...list]);
  return fresh;
}
export const markAllRead = () => save(loadNotices().map((n) => ({ ...n, read: true })));
export const markRead = (id: string) => save(loadNotices().map((n) => (n.id === id ? { ...n, read: true } : n)));
export const clearNotices = () => save([]);

const day = () => new Date().toISOString().slice(0, 10);
const MARKETS = [
  { symbol: '^NSEI', label: 'NIFTY 50' }, { symbol: '^BSESN', label: 'SENSEX' }, { symbol: '^NSEBANK', label: 'BANK NIFTY' },
  { symbol: 'INR=X', label: 'USD / INR' }, { symbol: 'GC=F', label: 'Gold' }, { symbol: 'BTC-USD', label: 'Bitcoin' },
];

/** Market moves of 1% or more today, one notice per market and direction per day. */
export async function checkMarkets(): Promise<Notice[]> {
  const r = await fetch(`/api/markets/batch?symbols=${encodeURIComponent(MARKETS.map((m) => m.symbol).join(','))}`);
  if (!r.ok) return [];
  const d = await r.json() as { results?: Array<{ symbol: string; quote?: { changePercent: number | null } }> };
  const items = (d.results ?? []).flatMap((row) => {
    const ch = row.quote?.changePercent;
    const m = MARKETS.find((x) => x.symbol === row.symbol);
    if (!m || ch == null || Math.abs(ch) < 1) return [];
    const up = ch > 0;
    return [{ id: `mkt:${row.symbol}:${day()}:${up ? 'u' : 'd'}`, kind: (up ? 'up' : 'down') as NoticeKind, title: `${m.label} ${up ? 'up' : 'down'} ${Math.abs(ch).toFixed(2)}% today`, body: up ? 'A strong move up. Check how it affects your investments.' : 'A sharp fall today. Stay calm; review your plan rather than react.', to: (row.symbol === 'BTC-USD' ? 'crypto' : 'markets') as AppNavigationDestination }];
  });
  return addNotices(items);
}

/** New business headlines (up to three per check). */
export async function checkNews(): Promise<Notice[]> {
  const r = await fetch('/api/news?region=india&category=business');
  if (!r.ok) return [];
  const d = await r.json() as { items?: Array<{ title: string; sourceName?: string; sourceUrl?: string }> };
  const items = (d.items ?? []).slice(0, 3).filter((n) => n.title).map((n) => ({ id: `news:${n.title.slice(0, 80)}`, kind: 'news' as NoticeKind, title: n.title, body: n.sourceName ? `From ${n.sourceName}` : 'Business news', url: n.sourceUrl }));
  return addNotices(items);
}

/** Alerts from the user's own dashboard numbers; they reappear only when the numbers change. */
export function checkMoney(): Notice[] {
  const profile = loadMoneyProfile();
  if (!profile) return [];
  let d;
  try { d = buildCompleteDashboard({ profile, loans: loadEmiRecords(), income: loadIncomeSources(), expenses: loadExpenses() }); } catch { return []; }
  const r = d.report, stamp = profile.updatedAt ?? '';
  const items: Array<Omit<Notice, 'read' | 'at'>> = [];
  const emiLoad = d.monthlyTakeHome.value > 0 ? d.monthlyEmi.value / d.monthlyTakeHome.value : 0;
  if (emiLoad > 0.4) items.push({ id: `money:emi:${stamp}`, kind: 'down', title: `EMIs take ${Math.round(emiLoad * 100)}% of your take-home`, body: 'Above the safe 40% limit. Prepaying the costliest loan helps most.', to: 'emi-manager' });
  if (r.emergency.gap > 0) items.push({ id: `money:emergency:${stamp}`, kind: 'alert', title: 'Emergency fund is short', body: `₹${Math.round(r.emergency.gap).toLocaleString('en-IN')} more gives you 6 months of cover.`, to: 'financial-health' });
  if (r.protection.termGap > 0) items.push({ id: `money:term:${stamp}`, kind: 'alert', title: 'Life cover gap', body: `You may need ₹${Math.round(r.protection.termGap).toLocaleString('en-IN')} more term cover.`, to: 'financial-health' });
  if (r.tax.better !== 'same' && r.tax.saving > 0) items.push({ id: `money:tax:${stamp}`, kind: 'up', title: `The ${r.tax.better} tax regime saves you ₹${Math.round(r.tax.saving).toLocaleString('en-IN')}`, body: 'Tell your employer your regime choice at the start of the year.', to: 'income' });
  if (d.monthlySurplus.value < 0) items.push({ id: `money:deficit:${stamp}`, kind: 'down', title: 'You are spending more than you earn', body: 'Close the monthly gap before anything else.', to: 'budgeting' });
  return addNotices(items);
}
