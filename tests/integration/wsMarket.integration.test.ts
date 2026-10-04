/** Real sockets: connect → subscribe → receive → throttle → limits → disconnect releases the upstream. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { Tick } from '../../src/lib/market-protocol';
import { createMarketWsServer } from '../../server/ws-market';
import type { TickHandler, TickSource } from '../../server/ws/sources';

class FakeSource implements TickSource {
  readonly name = 'fake';
  subs = new Set<string>();
  calls: string[] = [];
  private handlers: TickHandler[] = [];
  onTick(h: TickHandler) {
    this.handlers.push(h);
  }
  subscribe(s: string) {
    this.subs.add(s);
    this.calls.push(`+${s}`);
  }
  unsubscribe(s: string) {
    this.subs.delete(s);
    this.calls.push(`-${s}`);
  }
  close() {}
  emit(t: Tick) {
    this.handlers.forEach((h) => h(t));
  }
}

const tick = (symbol: string, price: number, timestamp: number): Tick => ({ symbol, price, change: 1, volume: 10, timestamp, source: 'fake' });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function client(port: number) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/stream`);
  const msgs: any[] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
  return { ws, msgs, ready: new Promise<void>((r) => ws.on('open', () => r())) };
}

async function until(fn: () => boolean, ms = 2000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timeout');
    await wait(10);
  }
}

describe('market WebSocket server', () => {
  let src: FakeSource;
  let svc: ReturnType<typeof createMarketWsServer>;
  let port: number;
  beforeEach(async () => {
    src = new FakeSource();
    svc = createMarketWsServer({ source: src, throttleMs: 200 });
    port = await svc.listen(0);
  });
  afterEach(async () => {
    await svc.close();
  });

  it('delivers ticks to subscribers within 2 s, shares one upstream subscription and releases it', async () => {
    const a = client(port),
      b = client(port);
    await Promise.all([a.ready, b.ready]);
    a.ws.send(JSON.stringify({ type: 'subscribe', symbols: ['aapl'] }));
    b.ws.send(JSON.stringify({ type: 'subscribe', symbols: ['AAPL', 'TCS.NS'] }));
    await until(() => a.msgs.some((m) => m.type === 'subscribed') && b.msgs.some((m) => m.type === 'subscribed'));
    expect(src.calls.filter((c) => c === '+AAPL')).toHaveLength(1);

    const started = Date.now();
    src.emit(tick('AAPL', 190, 1));
    await until(() => a.msgs.some((m) => m.type === 'tick') && b.msgs.some((m) => m.type === 'tick'));
    expect(Date.now() - started).toBeLessThan(2000);
    expect(a.msgs.find((m) => m.type === 'tick')).toMatchObject({ symbol: 'AAPL', price: 190, change: 1, volume: 10, timestamp: 1, source: 'fake' });

    a.ws.close();
    await until(() => svc.hub.watcherCount('AAPL') === 1);
    expect(src.subs.has('AAPL')).toBe(true);
    b.ws.close();
    await until(() => !src.subs.has('AAPL') && !src.subs.has('TCS.NS'));
    await until(() => svc.hub.clientCount === 0);
  });

  it('throttles a fast symbol and sends the latest price', async () => {
    const a = client(port);
    await a.ready;
    a.ws.send(JSON.stringify({ type: 'subscribe', symbols: ['BTC'] }));
    await until(() => a.msgs.some((m) => m.type === 'subscribed'));
    for (let i = 1; i <= 50; i++) src.emit(tick('BTC', 100 + i, i));
    await wait(450);
    const ticks = a.msgs.filter((m) => m.type === 'tick');
    expect(ticks.length).toBeLessThanOrEqual(3);
    expect(ticks.at(-1).price).toBe(150);
    a.ws.close();
  });

  it('sends the cached latest price to a new subscriber', async () => {
    src.emit(tick('INFY.NS', 1500, 5));
    const first = client(port);
    await first.ready;
    first.ws.send(JSON.stringify({ type: 'subscribe', symbols: ['INFY.NS'] }));
    src.emit(tick('INFY.NS', 1501, 6));
    await until(() => first.msgs.some((m) => m.type === 'tick'));
    const late = client(port);
    await late.ready;
    late.ws.send(JSON.stringify({ type: 'subscribe', symbols: ['INFY.NS'] }));
    await until(() => late.msgs.some((m) => m.type === 'tick'));
    expect(late.msgs.find((m) => m.type === 'tick').price).toBe(1501);
    first.ws.close();
    late.ws.close();
  });

  it('enforces the 50-symbol limit, validates input and answers pings', async () => {
    const a = client(port);
    await a.ready;
    a.ws.send(JSON.stringify({ type: 'subscribe', symbols: Array.from({ length: 50 }, (_, i) => `S${i}`) }));
    a.ws.send(JSON.stringify({ type: 'subscribe', symbols: ['EXTRA'] }));
    a.ws.send('nonsense');
    a.ws.send(JSON.stringify({ type: 'ping', t: 42 }));
    await until(() => a.msgs.some((m) => m.type === 'pong'));
    expect(a.msgs.some((m) => m.type === 'error' && m.code === 'symbol_limit')).toBe(true);
    expect(a.msgs.some((m) => m.type === 'error' && m.code === 'bad_message')).toBe(true);
    expect(a.msgs.find((m) => m.type === 'pong').t).toBe(42);
    a.ws.close();
  });

  it('serves /health and rejects other paths', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(await res.json()).toMatchObject({ ok: true, source: 'fake' });
    const bad = new WebSocket(`ws://127.0.0.1:${port}/other`);
    await new Promise<void>((r) => bad.on('error', () => r()));
  });

  it('rejects connections that fail token verification', async () => {
    const secured = createMarketWsServer({ source: new FakeSource(), verifyToken: async (t) => t === 'good' });
    const p = await secured.listen(0);
    const denied = new WebSocket(`ws://127.0.0.1:${p}/stream?token=bad`);
    await new Promise<void>((r) => denied.on('error', () => r()));
    const ok = new WebSocket(`ws://127.0.0.1:${p}/stream?token=good`);
    await new Promise<void>((r) => ok.on('open', () => r()));
    ok.close();
    await secured.close();
  });
});
