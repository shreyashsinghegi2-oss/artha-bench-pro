import { describe, expect, it } from 'vitest';
import { MAX_SYMBOLS_PER_CLIENT, normaliseSymbol, parseClientMessage, parseServerMessage, tickMessage } from '../src/lib/market-protocol';

describe('symbols', () => {
  it.each([
    ['reliance.ns', 'RELIANCE.NS'],
    ['^NSEI', '^NSEI'],
    ['INR=X', 'INR=X'],
    ['GC=F', 'GC=F'],
    [' aapl ', 'AAPL'],
    ['BINANCE:BTCUSDT', 'BINANCE:BTCUSDT'],
  ])('accepts %s', (i, o) => {
    expect(normaliseSymbol(i)).toBe(o);
  });
  it.each(['', ' ', 'A B', '<script>', 'X'.repeat(30), 123, null, '.NS', 'DROP;TABLE'])('rejects %s', (i) => {
    expect(normaliseSymbol(i)).toBeNull();
  });
});

describe('parseClientMessage', () => {
  it('parses subscribe, dedupes and normalises', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'subscribe', symbols: ['aapl', 'AAPL', 'tcs.ns'] }))).toEqual({
      ok: true,
      value: { type: 'subscribe', symbols: ['AAPL', 'TCS.NS'] },
    });
  });
  it('parses ping with and without t', () => {
    expect(parseClientMessage('{"type":"ping","t":5}')).toEqual({ ok: true, value: { type: 'ping', t: 5 } });
    expect(parseClientMessage('{"type":"ping"}')).toEqual({ ok: true, value: { type: 'ping', t: undefined } });
  });
  it.each([
    ['not json', 'bad_message'],
    ['null', 'bad_message'],
    ['{"type":"hack"}', 'bad_message'],
    ['{"type":"subscribe"}', 'bad_message'],
    ['{"type":"subscribe","symbols":[]}', 'bad_message'],
    ['{"type":"subscribe","symbols":["OK","bad sym"]}', 'bad_symbol'],
  ])('rejects %s', (raw, code) => {
    const r = parseClientMessage(raw);
    expect(r.ok).toBe(false);
    expect('code' in r && r.code).toBe(code);
  });
  it('enforces the 50-symbol cap per request and the size limit', () => {
    const many = Array.from({ length: MAX_SYMBOLS_PER_CLIENT + 1 }, (_, i) => `S${i}`);
    expect(parseClientMessage(JSON.stringify({ type: 'subscribe', symbols: many }))).toMatchObject({ ok: false, code: 'symbol_limit' });
    expect(parseClientMessage('x'.repeat(5000))).toMatchObject({ ok: false, code: 'bad_message' });
  });
  it('accepts binary frames', () => {
    expect(parseClientMessage(new TextEncoder().encode('{"type":"ping"}')).ok).toBe(true);
  });
});

describe('parseServerMessage', () => {
  const tick = { symbol: 'AAPL', price: 190.5, change: 1.2, volume: 100, timestamp: 1_790_000_000_000, source: 'finnhub' };
  it('round-trips a tick', () => {
    expect(parseServerMessage(tickMessage(tick))).toEqual({ type: 'tick', ...tick });
  });
  it('nulls optional fields that are not numbers', () => {
    expect(parseServerMessage(JSON.stringify({ type: 'tick', ...tick, change: 'x', volume: -1 }))).toMatchObject({ change: null, volume: null });
  });
  it.each([
    ['{"type":"tick","symbol":"AAPL","price":0,"timestamp":1}'],
    ['{"type":"tick","symbol":"AAPL","price":-5,"timestamp":1}'],
    ['{"type":"tick","symbol":"bad sym","price":1,"timestamp":1}'],
    ['{"type":"tick","symbol":"AAPL","price":1}'],
    ['{"type":"unknown"}'],
    ['garbage'],
    ['{"type":"error"}'],
  ])('rejects %s', (raw) => {
    expect(parseServerMessage(raw)).toBeNull();
  });
  it('parses control messages', () => {
    expect(parseServerMessage('{"type":"pong","t":9}')).toEqual({ type: 'pong', t: 9 });
    expect(parseServerMessage('{"type":"subscribed","symbols":["aapl","bad sym"]}')).toEqual({ type: 'subscribed', symbols: ['AAPL'] });
    expect(parseServerMessage('{"type":"error","code":"rate_limited","message":"slow"}')).toEqual({ type: 'error', code: 'rate_limited', message: 'slow' });
  });
});
