import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tick } from '../src/lib/market-protocol';
import { SubscriptionSet, SymbolThrottle, WindowLimiter } from '../server/ws/limits';
import { InterestTable } from '../server/ws/redisBridge';
import { streamable } from '../server/ws/sources';

const t = (symbol: string, price: number, timestamp = price): Tick => ({ symbol, price, change: null, volume: null, timestamp, source: 'test' });

describe('SubscriptionSet', () => {
  it('caps at 50 symbols per user and reports refused ones', () => {
    const s = new SubscriptionSet();
    s.add(Array.from({ length: 48 }, (_, i) => `A${i}`));
    const r = s.add(['X1', 'X2', 'X3', 'A0']);
    expect(r.added).toEqual(['X1', 'X2']);
    expect(r.refused).toEqual(['X3']);
    expect(s.symbols.size).toBe(50);
    expect(s.remove(['X1', 'NOPE'])).toEqual(['X1']);
  });
});

describe('SymbolThrottle (1 msg/sec per symbol)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends the first tick immediately and coalesces the rest into one per second', () => {
    const sent: Tick[] = [];
    const th = new SymbolThrottle(
      (x) => sent.push(x),
      1000,
      () => Date.now(),
    );
    th.offer(t('A', 1));
    th.offer(t('A', 2));
    th.offer(t('A', 3));
    expect(sent.map((x) => x.price)).toEqual([1]);
    vi.advanceTimersByTime(999);
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sent.map((x) => x.price)).toEqual([1, 3]);
  });

  it('throttles symbols independently', () => {
    const sent: Tick[] = [];
    const th = new SymbolThrottle(
      (x) => sent.push(x),
      1000,
      () => Date.now(),
    );
    th.offer(t('A', 1));
    th.offer(t('B', 1));
    th.offer(t('A', 2));
    expect(sent.map((x) => x.symbol)).toEqual(['A', 'B']);
    vi.advanceTimersByTime(1000);
    expect(sent.map((x) => `${x.symbol}${x.price}`)).toEqual(['A1', 'B1', 'A2']);
  });

  it('never exceeds one message per second under a 100 Hz stream', () => {
    const sent: Tick[] = [];
    const th = new SymbolThrottle(
      (x) => sent.push(x),
      1000,
      () => Date.now(),
    );
    for (let i = 1; i <= 500; i++) {
      th.offer(t('A', i));
      vi.advanceTimersByTime(10);
    }
    vi.advanceTimersByTime(1000);
    expect(sent.length).toBeLessThanOrEqual(6);
    expect(sent.at(-1)!.price).toBe(500);
  });

  it('drop and close cancel pending sends', () => {
    const sent: Tick[] = [];
    const th = new SymbolThrottle(
      (x) => sent.push(x),
      1000,
      () => Date.now(),
    );
    th.offer(t('A', 1));
    th.offer(t('A', 2));
    th.drop('A');
    th.offer(t('B', 1));
    th.offer(t('B', 2));
    th.close();
    vi.advanceTimersByTime(5000);
    expect(sent.map((x) => `${x.symbol}${x.price}`)).toEqual(['A1', 'B1']);
  });
});

describe('WindowLimiter', () => {
  it('allows max messages per window then resets', () => {
    let now = 0;
    const l = new WindowLimiter(3, 1000, () => now);
    expect([l.allow(), l.allow(), l.allow(), l.allow()]).toEqual([true, true, true, false]);
    now = 1000;
    expect(l.allow()).toBe(true);
  });
});

describe('InterestTable (Redis fan-out refcounts)', () => {
  it('starts on first interest, stops when the last instance leaves', () => {
    const it2 = new InterestTable(90_000);
    expect(it2.apply('e1', 'AAPL', 'add', 0)).toBe('start');
    expect(it2.apply('e2', 'AAPL', 'add', 1)).toBeNull();
    expect(it2.apply('e1', 'AAPL', 'remove', 2)).toBeNull();
    expect(it2.apply('e2', 'AAPL', 'remove', 3)).toBe('stop');
  });
  it('expires interest from crashed edges after the TTL', () => {
    const table = new InterestTable(90_000);
    table.apply('e1', 'TCS.NS', 'add', 0);
    expect(table.expire(60_000)).toEqual([]);
    expect(table.expire(90_001)).toEqual(['TCS.NS']);
    expect(table.live('TCS.NS', 90_001)).toBe(false);
  });
});

describe('routing', () => {
  it.each([
    ['AAPL', true],
    ['BINANCE:BTCUSDT', true],
    ['RELIANCE.NS', false],
    ['^NSEI', false],
    ['INR=X', false],
  ])('%s streamable=%s', (s, v) => {
    expect(streamable(s)).toBe(v);
  });
});
