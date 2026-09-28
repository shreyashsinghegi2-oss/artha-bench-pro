/**
 * Tick sources (upstreams). The hub keeps ONE upstream subscription per symbol however many clients watch it.
 *
 *  - FinnhubSource: one WebSocket to wss://ws.finnhub.io for US stocks and exchange-prefixed crypto
 *    (e.g. AAPL, BINANCE:BTCUSDT). Reconnects with backoff and re-subscribes.
 *  - PollingSource: REST quotes on an interval (default 15 s) for symbols Finnhub's stream does not cover
 *    (NSE/BSE like RELIANCE.NS, indices like ^NSEI, forex like INR=X). Also the fallback when no key is set.
 *  - RoutedSource: sends each symbol to the right source.
 */
import WebSocket from 'ws';
import type { Tick } from '../../src/lib/market-protocol';

export type TickHandler = (t: Tick) => void;

export interface TickSource {
  subscribe(symbol: string): void;
  unsubscribe(symbol: string): void;
  onTick(handler: TickHandler): void;
  close(): void;
  readonly name: string;
}

abstract class BaseSource implements TickSource {
  abstract readonly name: string;
  protected handlers: TickHandler[] = [];
  onTick(handler: TickHandler) {
    this.handlers.push(handler);
  }
  protected emit(t: Tick) {
    for (const h of this.handlers) h(t);
  }
  abstract subscribe(symbol: string): void;
  abstract unsubscribe(symbol: string): void;
  abstract close(): void;
}

export interface QuoteLike {
  price: number;
  previousClose: number | null;
  change: number | null;
  volume: number | null;
  providerTimestamp: string | null;
}
export type QuoteFetcher = (symbol: string) => Promise<QuoteLike>;

export class PollingSource extends BaseSource {
  readonly name = 'rest-poll';
  private symbols = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private inflight = false;

  constructor(
    private readonly fetchQuote: QuoteFetcher,
    readonly intervalMs = 15_000,
  ) {
    super();
  }

  subscribe(symbol: string) {
    this.symbols.add(symbol);
    void this.pollOne(symbol);
    if (!this.timer) this.timer = setInterval(() => void this.pollAll(), this.intervalMs);
  }

  unsubscribe(symbol: string) {
    this.symbols.delete(symbol);
    if (!this.symbols.size && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  close() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.symbols.clear();
  }

  private async pollAll() {
    if (this.inflight) return; // never overlap polls when the provider is slow
    this.inflight = true;
    try {
      await Promise.all([...this.symbols].map((s) => this.pollOne(s)));
    } finally {
      this.inflight = false;
    }
  }

  private async pollOne(symbol: string) {
    try {
      const q = await this.fetchQuote(symbol);
      if (!this.symbols.has(symbol) || !(q.price > 0)) return;
      const ts = q.providerTimestamp ? Date.parse(q.providerTimestamp) : NaN;
      this.emit({
        symbol,
        price: q.price,
        change: q.change ?? (q.previousClose ? q.price - q.previousClose : null),
        volume: q.volume,
        timestamp: Number.isFinite(ts) ? ts : Date.now(),
        source: this.name,
      });
    } catch {
      /* provider error: keep the last good tick, try again next interval */
    }
  }
}

export interface FinnhubOptions {
  token: string;
  url?: string;
  reference?: QuoteFetcher;
  socketFactory?: (url: string) => WebSocket;
}

export class FinnhubSource extends BaseSource {
  readonly name = 'finnhub';
  private ws: WebSocket | null = null;
  private symbols = new Set<string>();
  private prevClose = new Map<string, number>();
  private attempt = 0;
  private closed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly opts: FinnhubOptions) {
    super();
    this.connect();
  }

  private connect() {
    if (this.closed) return;
    const url = `${this.opts.url ?? 'wss://ws.finnhub.io'}?token=${encodeURIComponent(this.opts.token)}`;
    const ws = this.opts.socketFactory ? this.opts.socketFactory(url) : new WebSocket(url);
    this.ws = ws;
    ws.on('open', () => {
      this.attempt = 0;
      for (const s of this.symbols) this.send({ type: 'subscribe', symbol: s });
    });
    ws.on('message', (raw) => this.handle(raw.toString()));
    ws.on('close', () => this.scheduleReconnect());
    ws.on('error', () => {
      /* 'close' follows and schedules the reconnect */
    });
  }

  private scheduleReconnect() {
    if (this.closed || this.reconnectTimer) return;
    const delay = Math.min(30_000, 500 * 2 ** this.attempt++) * (0.8 + Math.random() * 0.4);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  handle(text: string) {
    let msg: any;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg?.type !== 'trade' || !Array.isArray(msg.data)) return;
    for (const d of msg.data) {
      const symbol = String(d.s ?? '').toUpperCase();
      if (!this.symbols.has(symbol) || !(d.p > 0) || !Number.isFinite(d.t)) continue;
      const ref = this.prevClose.get(symbol);
      this.emit({ symbol, price: d.p, change: ref ? d.p - ref : null, volume: Number.isFinite(d.v) ? d.v : null, timestamp: d.t, source: this.name });
    }
  }

  subscribe(symbol: string) {
    this.symbols.add(symbol);
    this.send({ type: 'subscribe', symbol });
    this.opts
      .reference?.(symbol)
      .then((q) => {
        if (q.previousClose) this.prevClose.set(symbol, q.previousClose);
      })
      .catch(() => undefined);
  }

  unsubscribe(symbol: string) {
    this.symbols.delete(symbol);
    this.prevClose.delete(symbol);
    this.send({ type: 'unsubscribe', symbol });
  }

  close() {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}

/** Finnhub's stream covers US tickers and exchange-prefixed crypto/forex; everything else is polled. */
export const streamable = (symbol: string) => /^[A-Z]{1,5}$/.test(symbol) || /^[A-Z]+:[A-Z0-9_]+$/.test(symbol);

export class RoutedSource extends BaseSource {
  readonly name = 'routed';
  constructor(
    private readonly stream: TickSource | null,
    private readonly poll: TickSource,
  ) {
    super();
    stream?.onTick((t) => this.emit(t));
    poll.onTick((t) => this.emit(t));
  }
  private pick(symbol: string) {
    return this.stream && streamable(symbol) ? this.stream : this.poll;
  }
  subscribe(symbol: string) {
    this.pick(symbol).subscribe(symbol);
  }
  unsubscribe(symbol: string) {
    this.pick(symbol).unsubscribe(symbol);
  }
  close() {
    this.stream?.close();
    this.poll.close();
  }
}
