import { useEffect, useState } from 'react';
import type { TerminalCandles, TerminalInterval, TerminalInstrument, TerminalSnapshotItem } from '../../server/marketTerminal';

export type { TerminalCandles, TerminalInterval, TerminalSnapshotItem };
export type TerminalInstrumentId = TerminalInstrument['id'];

export const TERMINAL_TABS: Array<{ id: TerminalInstrumentId; label: string }> = [
  { id: 'nifty50', label: 'NIFTY 50' },
  { id: 'sensex', label: 'SENSEX' },
  { id: 'usdinr', label: 'USD/INR' },
  { id: 'gold', label: 'Gold' },
  { id: 'btcusdt', label: 'BTC/USDT' },
];
export const TERMINAL_INTERVAL_OPTIONS: TerminalInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || 'Market data is temporarily unavailable.');
  return data as T;
}

export const fetchTerminalSnapshot = (signal?: AbortSignal) =>
  getJson<{ items: TerminalSnapshotItem[]; retrievedAt: string }>('/api/markets/terminal/snapshot', signal);

export const fetchTerminalCandles = (instrument: TerminalInstrumentId, interval: TerminalInterval, signal?: AbortSignal) =>
  getJson<TerminalCandles>(`/api/markets/terminal/candles?instrument=${instrument}&interval=${interval}`, signal);

/** Polling cadence: fast only where the data actually moves quickly. */
export function candlePollMs(instrument: TerminalInstrumentId, interval: TerminalInterval): number {
  if (interval === '1d') return 300_000;
  if (instrument === 'btcusdt') return interval === '1m' || interval === '5m' ? 10_000 : 30_000;
  return interval === '1h' || interval === '4h' ? 120_000 : 45_000;
}

export function formatMarketPrice(value: number, currency: string, decimals: number): string {
  const formatted = value.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (currency === 'INR') return `₹${formatted}`;
  if (currency === 'USD') return `$${formatted}`;
  return `${formatted} ${currency}`;
}

/** "▲ +12.40 (+0.53%)" — direction is carried by arrow and sign, not only colour. */
export function formatChange(change: number | null, percent: number | null, decimals: number): { text: string; direction: 'up' | 'down' | 'flat' } {
  if (change === null || percent === null || !Number.isFinite(change) || !Number.isFinite(percent)) return { text: 'Change unavailable', direction: 'flat' };
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '■';
  const sign = direction === 'up' ? '+' : direction === 'down' ? '−' : '';
  return { text: `${arrow} ${sign}${Math.abs(change).toFixed(decimals)} (${sign}${Math.abs(percent).toFixed(2)}%)`, direction };
}

export function formatIst(iso: string | null, withDate = false): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', ...(withDate ? { day: '2-digit', month: 'short' } : {}) })} IST`;
}

export function formatAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return '—';
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export const FRESHNESS_LABEL: Record<string, string> = { real_time: 'Live', delayed: 'Delayed', end_of_day: 'Market closed · last close', stale: 'Stale', demo: 'Demo' };

/** True while the browser tab is visible; polling pauses when it is hidden. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

/** Re-renders every `ms` so relative timestamps ("12s ago") stay current. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(id); }, [ms]);
  return now;
}
