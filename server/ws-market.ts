/**
 * Market WebSocket service. Runs OUTSIDE Vercel (Vercel functions cannot hold long-lived WebSocket
 * connections): deploy to Fly.io, Render or any Node host.
 *
 *   npm run ws:dev                          # standalone: upstream + in-process fan-out
 *   WS_ROLE=ingest REDIS_URL=... node ...   # the single upstream connection, publishes to Redis
 *   WS_ROLE=edge   REDIS_URL=... node ...   # N client-facing instances fed from Redis
 *
 * Env: PORT (8787), FINNHUB_API_KEY (stream for US/crypto; without it everything is REST-polled),
 *      WS_POLL_MS (15000), WS_REQUIRE_AUTH=true (Supabase access token as ?token=), WS_ALLOWED_ORIGINS (comma list).
 * Endpoints: GET /health, WS /stream
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { parseClientMessage, type ServerMessage } from '../src/lib/market-protocol';
import { WindowLimiter } from './ws/limits';
import { MarketHub } from './ws/hub';
import { FinnhubSource, PollingSource, RoutedSource, type QuoteFetcher, type TickSource } from './ws/sources';
import { RedisEdgeSource, runIngest } from './ws/redisBridge';

export interface MarketWsOptions {
  port?: number;
  source: TickSource;
  throttleMs?: number;
  heartbeatMs?: number;
  allowedOrigins?: string[];
  verifyToken?: (token: string) => Promise<boolean>;
}

export function createMarketWsServer(opts: MarketWsOptions) {
  const hub = new MarketHub(opts.source, { throttleMs: opts.throttleMs });
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, clients: hub.clientCount, symbols: hub.cache.symbols().length, source: opts.source.name }));
      return;
    }
    res.writeHead(404).end();
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const alive = new WeakMap<WebSocket, boolean>();

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const origin = req.headers.origin;
    if (url.pathname !== '/stream' || (opts.allowedOrigins?.length && origin && !opts.allowedOrigins.includes(origin))) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    if (opts.verifyToken) {
      const ok = await opts.verifyToken(url.searchParams.get('token') ?? '').catch(() => false);
      if (!ok) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket) => {
    const limiter = new WindowLimiter(30, 10_000);
    const client = {
      send: (d: string) => {
        if (ws.readyState === ws.OPEN) ws.send(d);
      },
    };
    const reply = (m: ServerMessage) => client.send(JSON.stringify(m));
    alive.set(ws, true);
    hub.connect(client);
    ws.on('pong', () => alive.set(ws, true));
    ws.on('message', (raw) => {
      if (!limiter.allow()) return reply({ type: 'error', code: 'rate_limited', message: 'Too many messages; slow down.' });
      const parsed = parseClientMessage(raw.toString());
      if ('code' in parsed) return reply({ type: 'error', code: parsed.code, message: parsed.message });
      hub.handle(client, parsed.value);
    });
    ws.on('close', () => hub.disconnect(client));
    ws.on('error', () => hub.disconnect(client));
  });

  // Protocol-level heartbeat: drop connections that stop answering pings (half-open TCP).
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, opts.heartbeatMs ?? 25_000);

  return {
    hub,
    server,
    wss,
    listen: (port = opts.port ?? 8787) => new Promise<number>((resolve) => server.listen(port, () => resolve((server.address() as { port: number }).port))),
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(heartbeat);
        for (const ws of wss.clients) ws.terminate();
        hub.close();
        wss.close();
        server.close(() => resolve());
      }),
  };
}

async function supabaseTokenCheck(token: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || !token) return false;
  const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(4000),
  });
  return res.ok;
}

async function defaultUpstream(): Promise<TickSource> {
  const { getMarketQuote } = await import('./marketDataService');
  const fetchQuote: QuoteFetcher = async (symbol) => (await getMarketQuote(symbol)).quote;
  const poll = new PollingSource(fetchQuote, Number(process.env.WS_POLL_MS) || 15_000);
  const key = process.env.FINNHUB_API_KEY?.trim();
  return new RoutedSource(key ? new FinnhubSource({ token: key, reference: fetchQuote }) : null, poll);
}

async function main() {
  const role = process.env.WS_ROLE ?? 'standalone';
  const redisUrl = process.env.REDIS_URL;
  if (role === 'ingest') {
    if (!redisUrl) throw new Error('WS_ROLE=ingest needs REDIS_URL');
    await runIngest(redisUrl, await defaultUpstream());
    console.log('[ws] ingest running');
    return;
  }
  const source = role === 'edge' ? await RedisEdgeSource.create(redisUrl ?? '', randomUUID()) : await defaultUpstream();
  const svc = createMarketWsServer({
    source,
    allowedOrigins: process.env.WS_ALLOWED_ORIGINS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    verifyToken: process.env.WS_REQUIRE_AUTH === 'true' ? supabaseTokenCheck : undefined,
  });
  const port = await svc.listen(Number(process.env.PORT) || 8787);
  console.log(`[ws] ${role} listening on :${port} (source: ${source.name})`);
  const stop = () => {
    void svc.close().then(() => process.exit(0));
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

if (process.argv[1] && /ws-market\.(ts|js|cjs|mjs)$/.test(process.argv[1])) void main();
