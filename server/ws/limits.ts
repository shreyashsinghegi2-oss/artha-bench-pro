import type { Tick } from '../../src/lib/market-protocol';
import { MAX_SYMBOLS_PER_CLIENT } from '../../src/lib/market-protocol';

/** Per-client subscription set capped at MAX_SYMBOLS_PER_CLIENT (50). */
export class SubscriptionSet {
  readonly symbols = new Set<string>();
  constructor(readonly limit = MAX_SYMBOLS_PER_CLIENT) {}

  /** Adds what fits. Returns the newly added symbols and whether any were refused by the cap. */
  add(requested: string[]): { added: string[]; refused: string[] } {
    const added: string[] = [],
      refused: string[] = [];
    for (const s of requested) {
      if (this.symbols.has(s)) continue;
      if (this.symbols.size >= this.limit) {
        refused.push(s);
        continue;
      }
      this.symbols.add(s);
      added.push(s);
    }
    return { added, refused };
  }

  remove(requested: string[]): string[] {
    return requested.filter((s) => this.symbols.delete(s));
  }
}

/**
 * At most one message per symbol per interval (default 1 s) for one client. Ticks inside the window are
 * coalesced: only the latest is delivered when the window ends, so fast symbols never flood a slow client.
 */
export class SymbolThrottle {
  private lastSent = new Map<string, number>();
  private pending = new Map<string, Tick>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly send: (t: Tick) => void,
    readonly intervalMs = 1000,
    private readonly now: () => number = Date.now,
  ) {}

  offer(t: Tick): void {
    const last = this.lastSent.get(t.symbol) ?? -Infinity;
    const elapsed = this.now() - last;
    if (elapsed >= this.intervalMs && !this.timers.has(t.symbol)) {
      this.emit(t);
      return;
    }
    this.pending.set(t.symbol, t);
    if (!this.timers.has(t.symbol)) {
      this.timers.set(
        t.symbol,
        setTimeout(
          () => {
            this.timers.delete(t.symbol);
            const p = this.pending.get(t.symbol);
            this.pending.delete(t.symbol);
            if (p) this.emit(p);
          },
          Math.max(0, this.intervalMs - elapsed),
        ),
      );
    }
  }

  drop(symbol: string): void {
    const timer = this.timers.get(symbol);
    if (timer) clearTimeout(timer);
    this.timers.delete(symbol);
    this.pending.delete(symbol);
    this.lastSent.delete(symbol);
  }

  close(): void {
    for (const s of [...this.timers.keys()]) this.drop(s);
  }

  private emit(t: Tick) {
    this.lastSent.set(t.symbol, this.now());
    this.send(t);
  }
}

/** Fixed-window limiter for control messages (subscribe/unsubscribe/ping) per connection. */
export class WindowLimiter {
  private count = 0;
  private windowStart: number;
  constructor(
    readonly max = 30,
    readonly windowMs = 10_000,
    private readonly now: () => number = Date.now,
  ) {
    this.windowStart = now();
  }
  allow(): boolean {
    const t = this.now();
    if (t - this.windowStart >= this.windowMs) {
      this.windowStart = t;
      this.count = 0;
    }
    return ++this.count <= this.max;
  }
}
