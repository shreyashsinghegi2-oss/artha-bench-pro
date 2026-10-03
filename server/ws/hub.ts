/**
 * Fan-out hub: one upstream subscription per symbol, broadcast to every interested client.
 * Clients are abstract (anything with send/close) so the hub is testable without sockets.
 */
import { MarketCache } from '../../src/lib/market-cache';
import { tickMessage, type ClientMessage, type ServerMessage, type Tick } from '../../src/lib/market-protocol';
import { SubscriptionSet, SymbolThrottle } from './limits';
import type { TickSource } from './sources';

export interface HubClient {
  send(data: string): void;
}

interface ClientState {
  client: HubClient;
  subs: SubscriptionSet;
  throttle: SymbolThrottle;
}

export class MarketHub {
  readonly cache: MarketCache;
  private clients = new Map<HubClient, ClientState>();
  private watchers = new Map<string, Set<ClientState>>();

  constructor(
    private readonly source: TickSource,
    opts: { cache?: MarketCache; throttleMs?: number } = {},
  ) {
    this.cache = opts.cache ?? new MarketCache();
    this.throttleMs = opts.throttleMs ?? 1000;
    source.onTick((t) => this.onTick(t));
  }
  private readonly throttleMs: number;

  get clientCount() {
    return this.clients.size;
  }
  watcherCount(symbol: string) {
    return this.watchers.get(symbol)?.size ?? 0;
  }

  connect(client: HubClient) {
    const state: ClientState = {
      client,
      subs: new SubscriptionSet(),
      throttle: new SymbolThrottle((t) => this.safeSend(client, tickMessage(t)), this.throttleMs),
    };
    this.clients.set(client, state);
  }

  disconnect(client: HubClient) {
    const state = this.clients.get(client);
    if (!state) return;
    this.unsubscribe(state, [...state.subs.symbols]);
    state.throttle.close();
    this.clients.delete(client);
  }

  handle(client: HubClient, msg: ClientMessage) {
    const state = this.clients.get(client);
    if (!state) return;
    if (msg.type === 'ping') return this.reply(client, { type: 'pong', t: msg.t ?? Date.now() });
    if (msg.type === 'unsubscribe') {
      this.unsubscribe(state, msg.symbols);
      return this.reply(client, { type: 'subscribed', symbols: [...state.subs.symbols] });
    }
    const { added, refused } = state.subs.add(msg.symbols);
    for (const s of added) {
      let set = this.watchers.get(s);
      if (!set) {
        set = new Set();
        this.watchers.set(s, set);
        this.source.subscribe(s);
      }
      set.add(state);
      const last = this.cache.latest(s);
      if (last) state.throttle.offer(last); // new subscribers get the latest known price immediately
    }
    if (refused.length)
      this.reply(client, { type: 'error', code: 'symbol_limit', message: `Limit is ${state.subs.limit} symbols; not subscribed: ${refused.join(', ')}` });
    this.reply(client, { type: 'subscribed', symbols: [...state.subs.symbols] });
  }

  close() {
    for (const c of [...this.clients.keys()]) this.disconnect(c);
    this.source.close();
  }

  private unsubscribe(state: ClientState, symbols: string[]) {
    for (const s of state.subs.remove(symbols)) {
      state.throttle.drop(s);
      const set = this.watchers.get(s);
      set?.delete(state);
      if (set && set.size === 0) {
        this.watchers.delete(s);
        this.source.unsubscribe(s);
      }
    }
  }

  private onTick(t: Tick) {
    if (!this.cache.push(t)) return; // stale or duplicate
    for (const state of this.watchers.get(t.symbol) ?? []) state.throttle.offer(t);
  }

  private reply(client: HubClient, msg: ServerMessage) {
    this.safeSend(client, JSON.stringify(msg));
  }
  private safeSend(client: HubClient, data: string) {
    try {
      client.send(data);
    } catch {
      /* socket closing */
    }
  }
}
