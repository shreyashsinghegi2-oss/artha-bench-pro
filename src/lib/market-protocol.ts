/**
 * Wire protocol shared by the market WebSocket server (server/ws-market.ts) and client (src/lib/ws-client.ts).
 *
 * client → server   { type: 'subscribe' | 'unsubscribe', symbols: string[] }   { type: 'ping', t? }
 * server → client   { type: 'tick', symbol, price, change, volume, timestamp, source }
 *                   { type: 'subscribed', symbols }  { type: 'pong', t }  { type: 'error', code, message }
 */

export interface Tick {
  symbol: string;
  price: number;
  /** Absolute change against the previous close when known, else null. */
  change: number | null;
  volume: number | null;
  /** Epoch milliseconds of the trade or quote at the provider. */
  timestamp: number;
  /** Provider name, e.g. "finnhub" or "rest-poll". */
  source: string;
}

export type ClientMessage = { type: 'subscribe'; symbols: string[] } | { type: 'unsubscribe'; symbols: string[] } | { type: 'ping'; t?: number };

export type ServerMessage =
  ({ type: 'tick' } & Tick) | { type: 'subscribed'; symbols: string[] } | { type: 'pong'; t: number } | { type: 'error'; code: ErrorCode; message: string };

export type ErrorCode = 'bad_message' | 'bad_symbol' | 'symbol_limit' | 'rate_limited' | 'unauthorised';

export const MAX_SYMBOLS_PER_CLIENT = 50;
export const MAX_MESSAGE_BYTES = 4096;
/** NSE/BSE (RELIANCE.NS), indices (^NSEI), forex (INR=X), futures (GC=F), exchange-prefixed crypto (BINANCE:BTCUSDT). */
const SYMBOL_RE = /^[A-Z0-9^][A-Z0-9.^=:_-]{0,23}$/;

export const normaliseSymbol = (s: unknown): string | null => {
  if (typeof s !== 'string') return null;
  const v = s.trim().toUpperCase();
  return SYMBOL_RE.test(v) ? v : null;
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; code: ErrorCode; message: string };

/** Validate an incoming client frame. Unknown fields are ignored; bad symbols are reported, not silently dropped. */
export function parseClientMessage(raw: unknown): ParseResult<ClientMessage> {
  const text = typeof raw === 'string' ? raw : raw instanceof Uint8Array ? new TextDecoder().decode(raw) : String(raw ?? '');
  if (text.length > MAX_MESSAGE_BYTES) return { ok: false, code: 'bad_message', message: 'Message too large.' };
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, code: 'bad_message', message: 'Message is not JSON.' };
  }
  if (!data || typeof data !== 'object') return { ok: false, code: 'bad_message', message: 'Message must be an object.' };
  if (data.type === 'ping') return { ok: true, value: { type: 'ping', t: Number.isFinite(data.t) ? Number(data.t) : undefined } };
  if (data.type !== 'subscribe' && data.type !== 'unsubscribe') return { ok: false, code: 'bad_message', message: 'Unknown message type.' };
  if (!Array.isArray(data.symbols) || data.symbols.length === 0) return { ok: false, code: 'bad_message', message: 'symbols must be a non-empty array.' };
  if (data.symbols.length > MAX_SYMBOLS_PER_CLIENT)
    return { ok: false, code: 'symbol_limit', message: `At most ${MAX_SYMBOLS_PER_CLIENT} symbols per request.` };
  const symbols: string[] = [];
  for (const s of data.symbols) {
    const n = normaliseSymbol(s);
    if (!n) return { ok: false, code: 'bad_symbol', message: `Invalid symbol: ${String(s).slice(0, 30)}` };
    if (!symbols.includes(n)) symbols.push(n);
  }
  return { ok: true, value: { type: data.type, symbols } };
}

/** Validate a server frame on the client. Returns null for anything malformed. */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  let data: any;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  switch (data.type) {
    case 'tick': {
      const symbol = normaliseSymbol(data.symbol);
      if (!symbol || !Number.isFinite(data.price) || data.price <= 0 || !Number.isFinite(data.timestamp)) return null;
      return {
        type: 'tick',
        symbol,
        price: data.price,
        change: Number.isFinite(data.change) ? data.change : null,
        volume: Number.isFinite(data.volume) && data.volume >= 0 ? data.volume : null,
        timestamp: data.timestamp,
        source: typeof data.source === 'string' ? data.source.slice(0, 40) : 'unknown',
      };
    }
    case 'subscribed':
      return Array.isArray(data.symbols) ? { type: 'subscribed', symbols: data.symbols.map(normaliseSymbol).filter(Boolean) as string[] } : null;
    case 'pong':
      return { type: 'pong', t: Number(data.t) || 0 };
    case 'error':
      return typeof data.code === 'string' ? { type: 'error', code: data.code, message: String(data.message ?? '') } : null;
    default:
      return null;
  }
}

export const tickMessage = (t: Tick): string => JSON.stringify({ type: 'tick', ...t });
