import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketSocket, backoffDelay, defaultPoll } from '../src/lib/ws-client';
import type { Tick } from '../src/lib/market-protocol';

class FakeWS {
  static instances: FakeWS[] = [];
  readyState = 0;
  sent: any[] = [];
  onopen: ((e: unknown) => void) | null = null;
  onclose: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  constructor(public url: string) {
    FakeWS.instances.push(this);
  }
  send(d: string) {
    this.sent.push(JSON.parse(d));
  }
  close() {
    this.readyState = 3;
  }
  // test helpers
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({});
  }
  push(msg: object | string) {
    this.onmessage?.({ data: typeof msg === 'string' ? msg : JSON.stringify(msg) });
  }
}
const last = () => FakeWS.instances.at(-1)!;

describe('backoffDelay', () => {
  it('doubles from 500 ms and caps at 30 s (no jitter at midpoint)', () => {
    const mid = () => 0.5;
    expect([0, 1, 2, 3, 6, 10].map((n) => backoffDelay(n, 500, 30_000, mid))).toEqual([500, 1000, 2000, 4000, 30000, 30000]);
  });
  it('applies ±20% jitter', () => {
    expect(backoffDelay(0, 500, 30_000, () => 0)).toBe(400);
    expect(backoffDelay(0, 500, 30_000, () => 1)).toBe(600);
  });
});

describe('MarketSocket', () => {
  let poll: ReturnType<typeof vi.fn<(symbols: string[]) => Promise<Tick[]>>>;
  let sock: MarketSocket;
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWS.instances = [];
    poll = vi.fn(async (symbols: string[]): Promise<Tick[]> =>
      symbols.map((s) => ({ symbol: s, price: 10, change: null, volume: null, timestamp: 1, source: 'rest-fallback' })),
    );
    sock = new MarketSocket({ url: 'ws://x/stream', WebSocketImpl: FakeWS as any, poll, random: () => 0.5 });
  });
  afterEach(() => {
    sock.stop();
    vi.useRealTimers();
  });

  it('subscribes on open, emits validated ticks and ignores junk', () => {
    const ticks: Tick[] = [];
    sock.onTick((t) => ticks.push(t));
    sock.subscribe(['aapl', 'bad sym']);
    sock.start();
    last().open();
    expect(last().sent[0]).toEqual({ type: 'subscribe', symbols: ['AAPL'] });
    last().push({ type: 'tick', symbol: 'AAPL', price: 190, change: 1, volume: 5, timestamp: 2, source: 'finnhub' });
    last().push('not json');
    last().push({ type: 'tick', symbol: 'AAPL', price: -1, timestamp: 3 });
    expect(ticks).toEqual([{ symbol: 'AAPL', price: 190, change: 1, volume: 5, timestamp: 2, source: 'finnhub' }]);
    expect(sock.state).toBe('open');
  });

  it('reconnects with exponential backoff and re-subscribes', () => {
    sock.subscribe(['TCS.NS']);
    sock.start();
    last().open();
    last().drop();
    expect(FakeWS.instances).toHaveLength(1);
    vi.advanceTimersByTime(500);
    expect(FakeWS.instances).toHaveLength(2);
    last().drop();
    vi.advanceTimersByTime(999);
    expect(FakeWS.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeWS.instances).toHaveLength(3);
    last().open();
    expect(last().sent[0]).toEqual({ type: 'subscribe', symbols: ['TCS.NS'] });
  });

  it('falls back to REST polling every 30 s while down, and stops when reconnected', async () => {
    const ticks: Tick[] = [];
    sock.onTick((t) => ticks.push(t));
    sock.subscribe(['INFY.NS']);
    sock.start();
    last().drop(); // never opened
    await vi.advanceTimersByTimeAsync(0);
    expect(sock.state).toBe('polling');
    expect(poll).toHaveBeenCalledTimes(1);
    // keep the socket down: every reconnect attempt fails immediately
    for (let i = 0; i < 20; i++) {
      await vi.advanceTimersByTimeAsync(2000);
      if (last().readyState === 0) last().drop();
    }
    expect(poll.mock.calls.length).toBeGreaterThanOrEqual(2);
    await vi.advanceTimersByTimeAsync(30_000);
    const opened = last();
    opened.open();
    const calls = poll.mock.calls.length;
    // answer heartbeats so the socket stays healthy for a full minute, longer than one poll interval
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(20_000);
      opened.push({ type: 'pong' });
    }
    expect(poll.mock.calls.length).toBe(calls);
    expect(sock.state).toBe('open');
    expect(ticks.every((t) => t.source === 'rest-fallback')).toBe(true);
  });

  it('recycles the socket when a pong does not arrive in time', () => {
    sock.start();
    last().open();
    vi.advanceTimersByTime(20_000);
    expect(last().sent.at(-1).type).toBe('ping');
    vi.advanceTimersByTime(10_000);
    vi.advanceTimersByTime(500);
    expect(FakeWS.instances).toHaveLength(2);
  });

  it('keeps the socket when pongs arrive', () => {
    sock.start();
    last().open();
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(20_000);
      last().push({ type: 'pong', t: 1 });
    }
    expect(FakeWS.instances).toHaveLength(1);
  });

  it('caps client subscriptions at 50 and unsubscribes', () => {
    sock.start();
    last().open();
    const accepted = sock.subscribe(Array.from({ length: 60 }, (_, i) => `S${i}`));
    expect(accepted).toHaveLength(50);
    sock.unsubscribe(['S0', 'NOT']);
    expect(last().sent.at(-1)).toEqual({ type: 'unsubscribe', symbols: ['S0'] });
    expect(sock.subscribed).toHaveLength(49);
  });

  it('stop() closes cleanly and never reconnects', () => {
    sock.start();
    last().open();
    sock.stop();
    vi.advanceTimersByTime(60_000);
    expect(FakeWS.instances).toHaveLength(1);
    expect(sock.state).toBe('closed');
  });
});

describe('defaultPoll (REST fallback)', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('maps /api/markets/batch results to ticks and drops unusable quotes', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              { symbol: 'tcs.ns', quote: { price: 4100.5, change: 12, volume: 1000, providerTimestamp: '2026-09-28T09:15:00Z' } },
              { symbol: 'NOQUOTE' },
              { symbol: 'ZERO', quote: { price: 0, change: null, volume: null, providerTimestamp: null } },
              { symbol: 'BADTIME', quote: { price: 1, change: null, volume: null, providerTimestamp: 'garbage' } },
            ],
          }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const ticks = await defaultPoll(['TCS.NS', 'NOQUOTE']);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('/api/markets/batch?symbols=TCS.NS%2CNOQUOTE');
    expect(ticks.map((t) => t.symbol)).toEqual(['TCS.NS', 'BADTIME']);
    expect(ticks[0]).toMatchObject({ price: 4100.5, change: 12, volume: 1000, timestamp: Date.parse('2026-09-28T09:15:00Z'), source: 'rest-fallback' });
    expect(Number.isFinite(ticks[1].timestamp)).toBe(true);
  });
  it('returns nothing when the body has no results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}')),
    );
    expect(await defaultPoll(['A'])).toEqual([]);
  });
});

describe('MarketSocket edge paths', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWS.instances = [];
  });
  afterEach(() => vi.useRealTimers());

  it('retries when the WebSocket constructor throws, and keeps polling', async () => {
    let calls = 0;
    class Throwing {
      constructor() {
        calls++;
        throw new Error('blocked');
      }
    }
    const poll = vi.fn(async () => []);
    const s = new MarketSocket({ url: 'ws://x', WebSocketImpl: Throwing as any, poll, random: () => 0.5 });
    s.subscribe(['A']);
    s.start();
    expect(s.state).toBe('polling');
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(poll).toHaveBeenCalled();
    s.stop();
  });

  it('survives a poll that throws and skips polling with no symbols', async () => {
    const poll = vi.fn(async () => {
      throw new Error('offline');
    });
    const s = new MarketSocket({ url: 'ws://x', WebSocketImpl: FakeWS as any, poll, random: () => 0.5 });
    s.start();
    last().drop();
    await vi.advanceTimersByTimeAsync(0);
    expect(poll).not.toHaveBeenCalled();
    s.subscribe(['A']);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(poll).toHaveBeenCalled();
    s.stop();
  });

  it('delivers control messages and supports listener removal; start() is idempotent', () => {
    const s = new MarketSocket({ url: 'ws://x', WebSocketImpl: FakeWS as any, poll: async () => [] });
    const msgs: string[] = [];
    const states: string[] = [];
    const offMsg = s.onMessage((m) => msgs.push(m.type));
    const offState = s.onState((st) => states.push(st));
    s.start();
    s.start();
    expect(FakeWS.instances).toHaveLength(1);
    last().open();
    last().push({ type: 'error', code: 'rate_limited', message: 'slow' });
    offMsg();
    offState();
    last().push({ type: 'pong' });
    expect(msgs).toEqual(['error']);
    expect(states).toEqual(['connecting', 'open']);
    s.subscribe([]);
    s.unsubscribe(['NOPE']);
    expect(last().sent).toEqual([]);
    s.stop();
  });
});
