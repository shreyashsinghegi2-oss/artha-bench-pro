import { describe, expect, it } from 'vitest';
import { MarketCache } from '../src/lib/market-cache';
import type { Tick } from '../src/lib/market-protocol';

const t = (symbol: string, price: number, timestamp: number, volume = 1): Tick => ({ symbol, price, change: price - 100, volume, timestamp, source: 'test' });

describe('MarketCache', () => {
  it('keeps the last 1,000 ticks per symbol in order', () => {
    const c = new MarketCache();
    for (let i = 1; i <= 1500; i++) c.push(t('A', 100 + i, i));
    expect(c.size('A')).toBe(1000);
    const h = c.history('A');
    expect(h[0].timestamp).toBe(501);
    expect(h.at(-1)!.timestamp).toBe(1500);
    expect(c.history('A', 3).map((x) => x.timestamp)).toEqual([1498, 1499, 1500]);
    expect(c.latest('A')!.price).toBe(1600);
  });

  it('rejects out-of-order and duplicate ticks', () => {
    const c = new MarketCache();
    expect(c.push(t('A', 101, 10))).toBe(true);
    expect(c.push(t('A', 101, 10))).toBe(false);
    expect(c.push(t('A', 99, 5))).toBe(false);
    expect(c.push(t('A', 102, 10))).toBe(true);
  });

  it('evicts the least recently updated symbol when full', () => {
    const c = new MarketCache({ maxSymbols: 2 });
    c.push(t('A', 1, 1));
    c.push(t('B', 1, 1));
    c.push(t('A', 2, 2));
    c.push(t('C', 1, 1));
    expect(c.symbols()).toEqual(['A', 'C']);
    expect(c.latest('B')).toBeUndefined();
  });

  it('summarises high, low and volume over the window', () => {
    const c = new MarketCache();
    [101, 99, 105, 103].forEach((p, i) => c.push(t('A', p, i + 1, 10)));
    expect(c.summary('A')).toMatchObject({ first: 101, last: 103, high: 105, low: 99, volume: 40, ticks: 4 });
    expect(c.summary('NONE')).toBeNull();
  });

  it('only re-sends changed symbols to the LLM', () => {
    const c = new MarketCache();
    c.push(t('A', 101, 1));
    c.push(t('B', 50, 1));
    const sent = new Map<string, number>();
    expect(c.llmContext(['A', 'B', 'Z'], sent)).toHaveLength(2);
    expect(c.llmContext(['A', 'B'], sent)).toHaveLength(0);
    c.push(t('A', 102, 2));
    const again = c.llmContext(['A', 'B'], sent);
    expect(again).toHaveLength(1);
    expect(again[0]).toMatch(/^A: 102 \(\+2\.00\)/);
  });

  it('small ring capacity works', () => {
    const c = new MarketCache({ ticksPerSymbol: 2 });
    [1, 2, 3].forEach((i) => c.push(t('A', i, i)));
    expect(c.history('A').map((x) => x.price)).toEqual([2, 3]);
  });
});
