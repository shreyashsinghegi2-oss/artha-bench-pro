/**
 * Market terminal data layer for the landing-page dashboard and candlestick chart.
 *
 * The UI talks to instrument ids (nifty50, sensex, usdinr, gold, btcusdt), never to a vendor.
 * Each instrument names a CandleProvider; adding or swapping a vendor means adding a provider
 * here, not touching the UI. All requests are server-side, cached, and fall back to the last
 * good response (flagged stale) when a provider fails.
 */
import { fetchYahooFinanceChart } from './providers/yahooFinanceProvider';
import { getCryptoKlines } from './cryptoService';
import { getMarketQuote } from './marketDataService';
import type { MarketHistoryPoint } from '../src/types';

export const TERMINAL_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type TerminalInterval = (typeof TERMINAL_INTERVALS)[number];

export interface TerminalInstrument {
  id: 'nifty50' | 'sensex' | 'usdinr' | 'gold' | 'btcusdt';
  label: string;
  category: string;
  currency: string;
  decimals: number;
  provider: 'yahoo' | 'binance';
  providerSymbol: string;
  /** Timezone the instrument trades in, used for axis and timestamp labels. */
  timezone: 'Asia/Kolkata' | 'UTC';
}

export const TERMINAL_INSTRUMENTS: TerminalInstrument[] = [
  { id: 'nifty50', label: 'NIFTY 50', category: 'Index · NSE', currency: 'INR', decimals: 2, provider: 'yahoo', providerSymbol: '^NSEI', timezone: 'Asia/Kolkata' },
  { id: 'sensex', label: 'BSE SENSEX', category: 'Index · BSE', currency: 'INR', decimals: 2, provider: 'yahoo', providerSymbol: '^BSESN', timezone: 'Asia/Kolkata' },
  { id: 'usdinr', label: 'USD/INR', category: 'Currency · FX', currency: 'INR', decimals: 4, provider: 'yahoo', providerSymbol: 'INR=X', timezone: 'Asia/Kolkata' },
  { id: 'gold', label: 'Gold', category: 'Commodity · COMEX futures (USD/oz)', currency: 'USD', decimals: 2, provider: 'yahoo', providerSymbol: 'GC=F', timezone: 'UTC' },
  { id: 'btcusdt', label: 'BTC/USDT', category: 'Crypto · Binance spot', currency: 'USDT', decimals: 2, provider: 'binance', providerSymbol: 'BTCUSDT', timezone: 'UTC' },
];

export interface TerminalCandle { time: number; open: number; high: number; low: number; close: number; volume?: number }

export interface TerminalCandles {
  instrument: TerminalInstrument['id'];
  label: string;
  category: string;
  currency: string;
  decimals: number;
  timezone: TerminalInstrument['timezone'];
  interval: TerminalInterval;
  candles: TerminalCandle[];
  /** False when the provider returned only closes; the UI then draws a line chart. */
  hasOhlc: boolean;
  hasVolume: boolean;
  source: string;
  delayNote: string;
  providerTimestamp: string | null;
  retrievedAt: string;
  stale: boolean;
}

interface CandleProvider {
  name: string;
  fetchCandles(instrument: TerminalInstrument, interval: TerminalInterval): Promise<Omit<TerminalCandles, 'instrument' | 'label' | 'category' | 'currency' | 'decimals' | 'timezone' | 'interval' | 'retrievedAt' | 'stale'>>;
}

// Yahoo has no native 4h bar; 4h is aggregated from 60m bars.
const YAHOO_INTERVALS: Record<TerminalInterval, { range: string; interval: string; aggregate?: number }> = {
  '1m': { range: '1d', interval: '1m' },
  '5m': { range: '5d', interval: '5m' },
  '15m': { range: '5d', interval: '15m' },
  '1h': { range: '1mo', interval: '60m' },
  '4h': { range: '3mo', interval: '60m', aggregate: 4 },
  '1d': { range: '1y', interval: '1d' },
};

function pointsToCandles(points: MarketHistoryPoint[]): TerminalCandle[] {
  const seen = new Set<number>();
  return points.flatMap((point) => {
    const time = Math.floor(Date.parse(point.date) / 1000);
    if (!Number.isFinite(time) || seen.has(time)) return [];
    seen.add(time);
    const close = point.close ?? point.price;
    const open = point.open ?? close;
    const high = point.high ?? Math.max(open, close);
    const low = point.low ?? Math.min(open, close);
    return [{ time, open, high, low, close, ...(point.volume ? { volume: point.volume } : {}) }];
  }).sort((a, b) => a.time - b.time);
}

/** Groups consecutive bars into fixed-width buckets (e.g. four 1h bars → one 4h bar). */
export function aggregateCandles(candles: TerminalCandle[], bucketSeconds: number): TerminalCandle[] {
  const buckets = new Map<number, TerminalCandle>();
  for (const candle of candles) {
    const key = Math.floor(candle.time / bucketSeconds) * bucketSeconds;
    const current = buckets.get(key);
    if (!current) { buckets.set(key, { ...candle, time: key }); continue; }
    current.high = Math.max(current.high, candle.high);
    current.low = Math.min(current.low, candle.low);
    current.close = candle.close;
    if (candle.volume !== undefined) current.volume = (current.volume ?? 0) + candle.volume;
  }
  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

const yahooProvider: CandleProvider = {
  name: 'Yahoo Finance (experimental, delayed)',
  async fetchCandles(instrument, interval) {
    const config = YAHOO_INTERVALS[interval];
    const series = await fetchYahooFinanceChart(instrument.providerSymbol, config.range, config.interval);
    let candles = pointsToCandles(series.points);
    if (config.aggregate) candles = aggregateCandles(candles, config.aggregate * 3600);
    if (!candles.length) throw new Error('No candles returned for this interval.');
    const hasOhlc = series.points.some((point) => point.open !== undefined && point.high !== undefined && point.low !== undefined);
    const delay = series.delayMinutes;
    return {
      candles: candles.slice(-500),
      hasOhlc,
      hasVolume: candles.some((candle) => (candle.volume ?? 0) > 0),
      source: 'Yahoo Finance (experimental)',
      delayNote: delay && delay > 0 ? `Exchange data delayed by about ${delay} minutes.` : 'Data may be delayed.',
      providerTimestamp: series.providerTimestamp,
    };
  },
};

const binanceProvider: CandleProvider = {
  name: 'Binance public market data',
  async fetchCandles(instrument, interval) {
    const result = await getCryptoKlines(instrument.providerSymbol as 'BTCUSDT', interval);
    const candles = result.candles.map((candle) => ({ time: Math.floor(candle.openTime / 1000), open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume }));
    return {
      candles,
      hasOhlc: true,
      hasVolume: true,
      source: 'Binance public market data',
      delayNote: 'Near real-time exchange data.',
      providerTimestamp: result.retrievedAt,
    };
  },
};

const PROVIDERS: Record<TerminalInstrument['provider'], CandleProvider> = { yahoo: yahooProvider, binance: binanceProvider };

// ── Cache with stale-on-error ────────────────────────────────────────────────
interface CacheEntry<T> { value: T; expiresAt: number }
const candleCache = new Map<string, CacheEntry<TerminalCandles>>();
const inflight = new Map<string, Promise<TerminalCandles>>();

export function candleTtlMs(instrument: TerminalInstrument, interval: TerminalInterval): number {
  if (instrument.provider === 'binance') return 10_000;
  if (interval === '1m' || interval === '5m' || interval === '15m') return 30_000;
  if (interval === '1h' || interval === '4h') return 120_000;
  return 600_000;
}

export function findInstrument(id: string): TerminalInstrument | undefined {
  return TERMINAL_INSTRUMENTS.find((instrument) => instrument.id === id);
}

export async function getTerminalCandles(id: TerminalInstrument['id'], interval: TerminalInterval): Promise<TerminalCandles> {
  const instrument = findInstrument(id);
  if (!instrument) throw new Error('Unknown instrument.');
  const key = `${id}:${interval}`;
  const cached = candleCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const data = await PROVIDERS[instrument.provider].fetchCandles(instrument, interval);
      const value: TerminalCandles = {
        instrument: instrument.id, label: instrument.label, category: instrument.category, currency: instrument.currency,
        decimals: instrument.decimals, timezone: instrument.timezone, interval, retrievedAt: new Date().toISOString(), stale: false, ...data,
      };
      candleCache.set(key, { value, expiresAt: Date.now() + candleTtlMs(instrument, interval) });
      return value;
    } catch (error) {
      if (cached) return { ...cached.value, stale: true };
      throw error;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, request);
  return request;
}

// ── Snapshot for the four macro cards ───────────────────────────────────────
export interface TerminalSnapshotItem {
  id: TerminalInstrument['id'];
  label: string;
  category: string;
  currency: string;
  decimals: number;
  status: 'ok' | 'unavailable';
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  providerTimestamp: string | null;
  freshness: string | null;
  source: string;
  sparkline: number[];
  message?: string;
}

const SNAPSHOT_IDS: TerminalInstrument['id'][] = ['nifty50', 'sensex', 'usdinr', 'gold'];
const SNAPSHOT_TTL_MS = 45_000;
let snapshotCache: CacheEntry<{ items: TerminalSnapshotItem[]; retrievedAt: string }> | null = null;
let snapshotInflight: Promise<{ items: TerminalSnapshotItem[]; retrievedAt: string }> | null = null;
const lastGoodSnapshot = new Map<string, TerminalSnapshotItem>();

async function sparklineFor(instrument: TerminalInstrument): Promise<number[]> {
  for (const [range, interval] of [['1d', '5m'], ['5d', '30m']] as const) {
    try {
      const series = await fetchYahooFinanceChart(instrument.providerSymbol, range, interval);
      const closes = series.points.map((point) => point.close ?? point.price).filter(Number.isFinite);
      if (closes.length >= 8) return closes.slice(-96);
    } catch { /* try the wider window */ }
  }
  return [];
}

async function snapshotItem(instrument: TerminalInstrument): Promise<TerminalSnapshotItem> {
  const base = { id: instrument.id, label: instrument.label, category: instrument.category, currency: instrument.currency, decimals: instrument.decimals };
  try {
    const [quoteResult, sparkline] = await Promise.all([getMarketQuote(instrument.providerSymbol, 'index'), sparklineFor(instrument)]);
    const quote = quoteResult.quote;
    const item: TerminalSnapshotItem = {
      ...base, status: 'ok', price: quote.price, change: quote.change, changePercent: quote.changePercent,
      previousClose: quote.previousClose, providerTimestamp: quote.providerTimestamp, freshness: quote.freshness,
      source: quote.providerName, sparkline,
    };
    lastGoodSnapshot.set(instrument.id, item);
    return item;
  } catch (error) {
    const previous = lastGoodSnapshot.get(instrument.id);
    if (previous) return { ...previous, message: 'Showing the last successful value; the provider did not respond to the latest refresh.' };
    return { ...base, status: 'unavailable', price: null, change: null, changePercent: null, previousClose: null, providerTimestamp: null, freshness: null, source: 'Yahoo Finance (experimental)', sparkline: [], message: error instanceof Error ? error.message.slice(0, 160) : 'Provider unavailable.' };
  }
}

export async function getTerminalSnapshot(): Promise<{ items: TerminalSnapshotItem[]; retrievedAt: string }> {
  if (snapshotCache && snapshotCache.expiresAt > Date.now()) return snapshotCache.value;
  if (snapshotInflight) return snapshotInflight;
  snapshotInflight = (async () => {
    try {
      const items = await Promise.all(SNAPSHOT_IDS.map((id) => snapshotItem(findInstrument(id)!)));
      const value = { items, retrievedAt: new Date().toISOString() };
      snapshotCache = { value, expiresAt: Date.now() + SNAPSHOT_TTL_MS };
      return value;
    } finally {
      snapshotInflight = null;
    }
  })();
  return snapshotInflight;
}

export function resetMarketTerminalCachesForTests() {
  candleCache.clear();
  inflight.clear();
  lastGoodSnapshot.clear();
  snapshotCache = null;
  snapshotInflight = null;
}
