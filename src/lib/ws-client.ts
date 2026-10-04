/**
 * Browser client for the market WebSocket service.
 *
 * - Auto-reconnect with exponential backoff and jitter (0.5 s → 30 s cap), re-subscribing on every reconnect.
 * - Application heartbeat: sends {type:'ping'} every 20 s; if no pong within 10 s the socket is recycled.
 * - Graceful degradation: while disconnected (after the first failed attempt) it polls REST every 30 s,
 *   and stops polling as soon as the stream is back.
 * - Every inbound frame is validated (parseServerMessage); malformed frames are ignored.
 *
 * `MarketSocket` is framework-free (and testable with a fake WebSocket); `useMarketStream` wraps it for React.
 */
import { useEffect, useRef, useState } from 'react';
import { MAX_SYMBOLS_PER_CLIENT, normaliseSymbol, parseServerMessage, type ServerMessage, type Tick } from './market-protocol';

export type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'polling' | 'closed';

type WSLike = {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
};

export interface MarketSocketOptions {
  url: string;
  /** Fallback quotes while the stream is down. Default: GET /api/markets/batch. */
  poll?: (symbols: string[]) => Promise<Tick[]>;
  pollIntervalMs?: number;
  heartbeatMs?: number;
  pongTimeoutMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  WebSocketImpl?: new (url: string) => WSLike;
  random?: () => number;
}

export const OPEN = 1;

/** Delay before reconnect attempt n (0-based): base·2ⁿ capped at max, with ±20% jitter. */
export function backoffDelay(attempt: number, base = 500, max = 30_000, random: () => number = Math.random): number {
  return Math.round(Math.min(max, base * 2 ** attempt) * (0.8 + random() * 0.4));
}

export async function defaultPoll(symbols: string[]): Promise<Tick[]> {
  const res = await fetch(`/api/markets/batch?symbols=${encodeURIComponent(symbols.join(','))}`);
  const data = (await res.json()) as {
    results?: Array<{ symbol: string; quote?: { price: number; change: number | null; volume: number | null; providerTimestamp: string | null } }>;
  };
  return (data.results ?? []).flatMap((r) =>
    r.quote && r.quote.price > 0
      ? [
          {
            symbol: r.symbol.toUpperCase(),
            price: r.quote.price,
            change: r.quote.change,
            volume: r.quote.volume,
            timestamp: r.quote.providerTimestamp ? Date.parse(r.quote.providerTimestamp) || Date.now() : Date.now(),
            source: 'rest-fallback',
          },
        ]
      : [],
  );
}

export class MarketSocket {
  state: ConnectionState = 'closed';
  private ws: WSLike | null = null;
  private symbols = new Set<string>();
  private attempt = 0;
  private stopped = true;
  private timers: {
    reconnect?: ReturnType<typeof setTimeout>;
    heartbeat?: ReturnType<typeof setInterval>;
    pong?: ReturnType<typeof setTimeout>;
    poll?: ReturnType<typeof setInterval>;
  } = {};
  private tickListeners = new Set<(t: Tick) => void>();
  private stateListeners = new Set<(s: ConnectionState) => void>();
  private messageListeners = new Set<(m: ServerMessage) => void>();
  private readonly o: Required<Omit<MarketSocketOptions, 'WebSocketImpl'>> & { WebSocketImpl?: MarketSocketOptions['WebSocketImpl'] };

  constructor(options: MarketSocketOptions) {
    this.o = {
      poll: defaultPoll,
      pollIntervalMs: 30_000,
      heartbeatMs: 20_000,
      pongTimeoutMs: 10_000,
      baseDelayMs: 500,
      maxDelayMs: 30_000,
      random: Math.random,
      ...options,
    };
  }

  onTick(fn: (t: Tick) => void) {
    this.tickListeners.add(fn);
    return () => this.tickListeners.delete(fn);
  }
  onState(fn: (s: ConnectionState) => void) {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }
  onMessage(fn: (m: ServerMessage) => void) {
    this.messageListeners.add(fn);
    return () => this.messageListeners.delete(fn);
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.open();
  }

  stop() {
    this.stopped = true;
    this.clearTimers();
    this.stopPolling();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.close(1000, 'client stop');
    }
    this.setState('closed');
  }

  subscribe(symbols: string[]) {
    const add = symbols.map(normaliseSymbol).filter((s): s is string => !!s && !this.symbols.has(s));
    const room = MAX_SYMBOLS_PER_CLIENT - this.symbols.size;
    const accepted = add.slice(0, Math.max(0, room));
    accepted.forEach((s) => this.symbols.add(s));
    if (accepted.length) this.send({ type: 'subscribe', symbols: accepted });
    return accepted;
  }

  unsubscribe(symbols: string[]) {
    const drop = symbols.map(normaliseSymbol).filter((s): s is string => !!s && this.symbols.delete(s));
    if (drop.length) this.send({ type: 'unsubscribe', symbols: drop });
  }

  get subscribed() {
    return [...this.symbols];
  }

  private open() {
    if (this.stopped) return;
    const Impl = this.o.WebSocketImpl ?? (globalThis.WebSocket as unknown as new (url: string) => WSLike);
    this.setState(this.attempt === 0 ? 'connecting' : this.state === 'polling' ? 'polling' : 'reconnecting');
    let ws: WSLike;
    try {
      ws = new Impl(this.o.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.stopPolling();
      this.setState('open');
      if (this.symbols.size) ws.send(JSON.stringify({ type: 'subscribe', symbols: [...this.symbols] }));
      this.startHeartbeat();
    };
    ws.onmessage = (ev) => this.receive(ev.data);
    ws.onerror = () => {
      /* onclose follows */
    };
    ws.onclose = () => {
      if (this.ws === ws) {
        this.ws = null;
        this.clearTimers();
        this.scheduleReconnect();
      }
    };
  }

  private receive(data: unknown) {
    const msg = parseServerMessage(typeof data === 'string' ? data : String(data));
    if (!msg) return;
    if (msg.type === 'pong') {
      if (this.timers.pong) clearTimeout(this.timers.pong);
      this.timers.pong = undefined;
    }
    if (msg.type === 'tick') {
      const { type: _t, ...tick } = msg;
      this.tickListeners.forEach((fn) => fn(tick));
    }
    this.messageListeners.forEach((fn) => fn(msg));
  }

  private startHeartbeat() {
    this.timers.heartbeat = setInterval(() => {
      if (this.timers.pong) return; // still waiting for the previous pong
      this.send({ type: 'ping', t: Date.now() });
      this.timers.pong = setTimeout(() => {
        this.timers.pong = undefined;
        const ws = this.ws;
        this.ws = null;
        this.clearTimers();
        if (ws) {
          ws.onclose = null;
          ws.close(4000, 'heartbeat timeout');
        }
        this.scheduleReconnect();
      }, this.o.pongTimeoutMs);
    }, this.o.heartbeatMs);
  }

  private scheduleReconnect() {
    if (this.stopped || this.timers.reconnect) return;
    this.startPolling();
    const delay = backoffDelay(this.attempt++, this.o.baseDelayMs, this.o.maxDelayMs, this.o.random);
    this.timers.reconnect = setTimeout(() => {
      this.timers.reconnect = undefined;
      this.open();
    }, delay);
  }

  private startPolling() {
    if (this.timers.poll || this.stopped) return;
    this.setState('polling');
    const run = async () => {
      if (!this.symbols.size) return;
      try {
        (await this.o.poll([...this.symbols])).forEach((t) => this.tickListeners.forEach((fn) => fn(t)));
      } catch {
        /* keep last values */
      }
    };
    void run();
    this.timers.poll = setInterval(() => void run(), this.o.pollIntervalMs);
  }

  private stopPolling() {
    if (this.timers.poll) clearInterval(this.timers.poll);
    this.timers.poll = undefined;
  }

  private clearTimers() {
    if (this.timers.heartbeat) clearInterval(this.timers.heartbeat);
    if (this.timers.pong) clearTimeout(this.timers.pong);
    if (this.timers.reconnect) clearTimeout(this.timers.reconnect);
    this.timers.heartbeat = this.timers.pong = this.timers.reconnect = undefined;
  }

  private send(msg: object) {
    if (this.ws && this.ws.readyState === OPEN) this.ws.send(JSON.stringify(msg));
  }
  private setState(s: ConnectionState) {
    if (s !== this.state) {
      this.state = s;
      this.stateListeners.forEach((fn) => fn(s));
    }
  }
}

/**
 * React hook: latest tick per symbol plus the connection state. Pass a stable list of symbols.
 *   const { ticks, state } = useMarketStream(['RELIANCE.NS', 'AAPL'], import.meta.env.VITE_MARKET_WS_URL);
 */
export function useMarketStream(symbols: string[], url: string | undefined, options: Omit<MarketSocketOptions, 'url'> = {}) {
  const [ticks, setTicks] = useState<Record<string, Tick>>({});
  const [state, setState] = useState<ConnectionState>('closed');
  const socketRef = useRef<MarketSocket | null>(null);
  const key = symbols.join(',');

  useEffect(() => {
    if (!url) return;
    const socket = new MarketSocket({ url, ...options });
    socketRef.current = socket;
    const offTick = socket.onTick((t) => setTicks((prev) => (prev[t.symbol]?.timestamp === t.timestamp ? prev : { ...prev, [t.symbol]: t })));
    const offState = socket.onState(setState);
    socket.start();
    return () => {
      offTick();
      offState();
      socket.stop();
      socketRef.current = null;
    };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const next = new Set(key ? key.split(',') : []);
    socket.unsubscribe(socket.subscribed.filter((s) => !next.has(s)));
    socket.subscribe([...next]);
  }, [key, url]);

  return { ticks, state };
}
