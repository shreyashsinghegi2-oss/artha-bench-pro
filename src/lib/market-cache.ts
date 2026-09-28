/**
 * In-memory tick cache: a ring buffer of the last N ticks per symbol (default 1,000) with LRU eviction
 * across symbols. Used by the WebSocket server (latest price for new subscribers) and by the AI layer, which
 * asks for a compact summary and only re-sends symbols that changed since the last prompt.
 */
import type { Tick } from './market-protocol';

class Ring {
  private buf: Tick[];
  private start = 0;
  size = 0;
  constructor(private readonly capacity: number) {
    this.buf = new Array(capacity);
  }
  push(t: Tick) {
    if (this.size < this.capacity) {
      this.buf[(this.start + this.size) % this.capacity] = t;
      this.size++;
    } else {
      this.buf[this.start] = t;
      this.start = (this.start + 1) % this.capacity;
    }
  }
  last(): Tick | undefined {
    return this.size ? this.buf[(this.start + this.size - 1) % this.capacity] : undefined;
  }
  /** Oldest to newest, at most n. */
  tail(n: number): Tick[] {
    const k = Math.max(0, Math.min(n, this.size));
    const out: Tick[] = [];
    for (let i = this.size - k; i < this.size; i++) out.push(this.buf[(this.start + i) % this.capacity]);
    return out;
  }
}

export interface MarketCacheOptions {
  ticksPerSymbol?: number;
  maxSymbols?: number;
}

export class MarketCache {
  readonly ticksPerSymbol: number;
  readonly maxSymbols: number;
  private readonly rings = new Map<string, Ring>(); // insertion order = LRU order (oldest first)

  constructor(opts: MarketCacheOptions = {}) {
    this.ticksPerSymbol = opts.ticksPerSymbol ?? 1000;
    this.maxSymbols = opts.maxSymbols ?? 500;
  }

  /** Adds a tick. Returns false for out-of-order or duplicate ticks (same timestamp and price). */
  push(t: Tick): boolean {
    let ring = this.rings.get(t.symbol);
    if (ring) {
      const last = ring.last()!;
      if (t.timestamp < last.timestamp || (t.timestamp === last.timestamp && t.price === last.price)) return false;
      this.rings.delete(t.symbol);
    } else {
      ring = new Ring(this.ticksPerSymbol);
      if (this.rings.size >= this.maxSymbols) this.rings.delete(this.rings.keys().next().value as string);
    }
    ring.push(t);
    this.rings.set(t.symbol, ring);
    return true;
  }

  latest(symbol: string): Tick | undefined {
    return this.rings.get(symbol)?.last();
  }
  history(symbol: string, n = this.ticksPerSymbol): Tick[] {
    return this.rings.get(symbol)?.tail(n) ?? [];
  }
  size(symbol: string): number {
    return this.rings.get(symbol)?.size ?? 0;
  }
  symbols(): string[] {
    return [...this.rings.keys()];
  }

  /** Session stats from the cached window: first, last, high, low, total volume. */
  summary(symbol: string) {
    const h = this.history(symbol);
    if (!h.length) return null;
    let high = -Infinity,
      low = Infinity,
      volume = 0;
    for (const t of h) {
      high = Math.max(high, t.price);
      low = Math.min(low, t.price);
      volume += t.volume ?? 0;
    }
    const first = h[0],
      last = h[h.length - 1];
    return {
      symbol,
      first: first.price,
      last: last.price,
      high,
      low,
      volume,
      ticks: h.length,
      from: first.timestamp,
      to: last.timestamp,
      change: last.change,
      source: last.source,
    };
  }

  /**
   * One line per symbol for an LLM prompt. With `sentAt` (symbol → timestamp already sent), symbols with no new
   * tick since then are skipped, so repeated prompts in one conversation do not re-send unchanged prices.
   */
  llmContext(symbols: string[], sentAt?: Map<string, number>): string[] {
    const lines: string[] = [];
    for (const s of symbols) {
      const sum = this.summary(s);
      if (!sum) continue;
      if (sentAt && (sentAt.get(s) ?? -1) >= sum.to) continue;
      const chg = sum.change == null ? '' : ` (${sum.change >= 0 ? '+' : ''}${sum.change.toFixed(2)})`;
      lines.push(`${s}: ${sum.last}${chg} · range ${sum.low}–${sum.high} over ${sum.ticks} ticks · ${sum.source}, as of ${new Date(sum.to).toISOString()}`);
      sentAt?.set(s, sum.to);
    }
    return lines;
  }
}
