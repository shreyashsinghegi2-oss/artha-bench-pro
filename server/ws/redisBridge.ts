/**
 * Horizontal scale-out (over ~100 concurrent clients or more than one WS instance).
 *
 *   ingest instance (WS_ROLE=ingest): holds the ONLY upstream connection. Listens on channel `market:interest`
 *     for {instance, symbol, op} and keeps a refcount per symbol with a TTL, publishing ticks to `market:tick:<SYM>`.
 *   edge instances (WS_ROLE=edge): accept clients; implement TickSource by subscribing to `market:tick:<SYM>` and
 *     announcing interest (re-announced every 30 s so a crashed edge's interest expires after 90 s).
 *
 * Uses `ioredis` when installed (optional dependency: npm i ioredis). InterestTable is pure and unit-tested.
 */
import type { Tick } from '../../src/lib/market-protocol';
import type { TickHandler, TickSource } from './sources';

export const INTEREST_CHANNEL = 'market:interest';
export const tickChannel = (symbol: string) => `market:tick:${symbol}`;
export const INTEREST_TTL_MS = 90_000;
export const REANNOUNCE_MS = 30_000;

/** symbol -> instance -> last announcement time. A symbol is live while any instance announced it within the TTL. */
export class InterestTable {
  private table = new Map<string, Map<string, number>>();
  constructor(private readonly ttlMs = INTEREST_TTL_MS) {}

  /** Returns 'start' when the symbol just gained its first instance, 'stop' when it lost its last, else null. */
  apply(instance: string, symbol: string, op: 'add' | 'remove', now: number): 'start' | 'stop' | null {
    const before = this.live(symbol, now);
    let m = this.table.get(symbol);
    if (op === 'add') {
      if (!m) {
        m = new Map();
        this.table.set(symbol, m);
      }
      m.set(instance, now);
    } else m?.delete(instance);
    const after = this.live(symbol, now);
    if (!before && after) return 'start';
    if (before && !after) {
      this.table.delete(symbol);
      return 'stop';
    }
    return null;
  }

  /** Symbols whose every announcement expired (crashed edges). */
  expire(now: number): string[] {
    const stopped: string[] = [];
    for (const [symbol, m] of this.table) {
      for (const [inst, at] of m) if (now - at > this.ttlMs) m.delete(inst);
      if (!m.size) {
        this.table.delete(symbol);
        stopped.push(symbol);
      }
    }
    return stopped;
  }

  live(symbol: string, now: number): boolean {
    const m = this.table.get(symbol);
    if (!m) return false;
    for (const at of m.values()) if (now - at <= this.ttlMs) return true;
    return false;
  }
}

type RedisLike = {
  publish(ch: string, msg: string): Promise<unknown>;
  subscribe(...ch: string[]): Promise<unknown>;
  unsubscribe(...ch: string[]): Promise<unknown>;
  on(ev: 'message', fn: (ch: string, msg: string) => void): unknown;
  quit(): Promise<unknown>;
};

async function connectRedis(url: string): Promise<RedisLike> {
  const mod: any = await import(/* @vite-ignore */ 'ioredis' as string).catch(() => {
    throw new Error('WS_ROLE edge/ingest needs the optional ioredis package: npm i ioredis');
  });
  const Redis = mod.default ?? mod;
  return new Redis(url) as RedisLike;
}

/** TickSource for edge instances. */
export class RedisEdgeSource implements TickSource {
  readonly name = 'redis-edge';
  private handlers: TickHandler[] = [];
  private symbols = new Set<string>();
  private timer: ReturnType<typeof setInterval>;

  private constructor(
    private readonly pub: RedisLike,
    private readonly sub: RedisLike,
    private readonly instance: string,
  ) {
    sub.on('message', (_ch, msg) => {
      try {
        const t = JSON.parse(msg) as Tick;
        for (const h of this.handlers) h(t);
      } catch {
        /* ignore */
      }
    });
    this.timer = setInterval(() => {
      for (const s of this.symbols) this.announce(s, 'add');
    }, REANNOUNCE_MS);
  }

  static async create(url: string, instance: string) {
    return new RedisEdgeSource(await connectRedis(url), await connectRedis(url), instance);
  }

  private announce(symbol: string, op: 'add' | 'remove') {
    void this.pub.publish(INTEREST_CHANNEL, JSON.stringify({ instance: this.instance, symbol, op }));
  }
  onTick(h: TickHandler) {
    this.handlers.push(h);
  }
  subscribe(symbol: string) {
    this.symbols.add(symbol);
    void this.sub.subscribe(tickChannel(symbol));
    this.announce(symbol, 'add');
  }
  unsubscribe(symbol: string) {
    this.symbols.delete(symbol);
    void this.sub.unsubscribe(tickChannel(symbol));
    this.announce(symbol, 'remove');
  }
  close() {
    clearInterval(this.timer);
    void this.pub.quit();
    void this.sub.quit();
  }
}

/** Ingest loop: one upstream, fanned out through Redis. */
export async function runIngest(url: string, upstream: TickSource) {
  const pub = await connectRedis(url),
    sub = await connectRedis(url);
  const interest = new InterestTable();
  upstream.onTick((t) => {
    void pub.publish(tickChannel(t.symbol), JSON.stringify(t));
  });
  sub.on('message', (_ch, msg) => {
    try {
      const { instance, symbol, op } = JSON.parse(msg);
      const change = interest.apply(String(instance), String(symbol), op === 'remove' ? 'remove' : 'add', Date.now());
      if (change === 'start') upstream.subscribe(symbol);
      if (change === 'stop') upstream.unsubscribe(symbol);
    } catch {
      /* ignore malformed */
    }
  });
  await sub.subscribe(INTEREST_CHANNEL);
  const timer = setInterval(() => {
    for (const s of interest.expire(Date.now())) upstream.unsubscribe(s);
  }, REANNOUNCE_MS);
  return () => {
    clearInterval(timer);
    upstream.close();
    void pub.quit();
    void sub.quit();
  };
}
