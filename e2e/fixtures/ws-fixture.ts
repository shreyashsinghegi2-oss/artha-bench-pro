/** Market WS service with a deterministic tick source, so e2e never depends on a live exchange. */
import type { Tick } from '../../src/lib/market-protocol';
import { createMarketWsServer } from '../../server/ws-market';
import type { TickHandler, TickSource } from '../../server/ws/sources';

class ScriptedSource implements TickSource {
  readonly name = 'e2e-fixture';
  private handlers: TickHandler[] = [];
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  onTick(h: TickHandler) {
    this.handlers.push(h);
  }
  subscribe(symbol: string) {
    let price = 1000;
    this.timers.set(
      symbol,
      setInterval(() => {
        price += 0.5;
        const t: Tick = { symbol, price, change: price - 1000, volume: 1, timestamp: Date.now(), source: this.name };
        this.handlers.forEach((h) => h(t));
      }, 200),
    );
  }
  unsubscribe(symbol: string) {
    clearInterval(this.timers.get(symbol));
    this.timers.delete(symbol);
  }
  close() {
    this.timers.forEach(clearInterval);
  }
}

const svc = createMarketWsServer({ source: new ScriptedSource() });
svc.listen(Number(process.env.PORT) || 8799).then((port) => console.log(`[e2e] ws fixture on :${port}`));
