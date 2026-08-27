import { useCallback, useEffect, useRef, useState } from 'react';
import { getCryptoKlines, getCryptoMarkets } from '../../services/cryptoApi';
import {
  CRYPTO_SYMBOLS,
  CryptoCandle,
  CryptoDiagnostics,
  CryptoFeedStatus,
  CryptoInterval,
  CryptoQuote,
  CryptoSymbol,
} from './cryptoTypes';

const BINANCE_SOCKET_BASES = [
  'wss://data-stream.binance.vision/ws',
  'wss://stream.binance.com:9443/ws',
  'wss://stream.binance.com:443/ws',
] as const;
const STALE_THRESHOLD_MS = 60_000;
const TRACKED_SYMBOLS = new Set<string>(CRYPTO_SYMBOLS);

export function emptyCryptoDiagnostics(): CryptoDiagnostics {
  return {
    restSnapshotAt: null,
    socketState: 'idle',
    socketEndpoint: null,
    lastRawMessageAt: null,
    lastValidMessageAt: null,
    retryAttempt: 0,
    nextRetryAt: null,
    staleThresholdMs: STALE_THRESHOLD_MS,
    lastError: null,
  };
}

function retryDelay(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** attempt) + Math.floor(Math.random() * 350);
}

export function normalizeTickerMessage(value: unknown): CryptoQuote | null {
  if (!value || typeof value !== 'object') return null;
  const ticker = value as Record<string, unknown>;
  const symbol = String(ticker.s || '').toUpperCase();
  if (!TRACKED_SYMBOLS.has(symbol)) return null;
  const numberValue = (key: string) => Number(ticker[key]);
  const numericKeys = ['c', 'p', 'P', 'h', 'l', 'v', 'q', 'b', 'a'];
  if (numericKeys.map(numberValue).some((number) => !Number.isFinite(number))) return null;

  return {
    symbol: symbol as CryptoSymbol,
    baseAsset: symbol.replace(/USDT$/, ''),
    quoteAsset: 'USDT',
    price: numberValue('c'),
    change: numberValue('p'),
    changePercent: numberValue('P'),
    high24h: numberValue('h'),
    low24h: numberValue('l'),
    volume24h: numberValue('v'),
    quoteVolume24h: numberValue('q'),
    bid: numberValue('b'),
    ask: numberValue('a'),
    providerTimestamp: new Date(Number(ticker.E) || Date.now()).toISOString(),
  };
}

export function normalizeKlineMessage(value: unknown): CryptoCandle | null {
  if (!value || typeof value !== 'object') return null;
  const kline = (value as { k?: Record<string, unknown> }).k;
  if (!kline) return null;
  const values = [kline.t, kline.T, kline.o, kline.h, kline.l, kline.c, kline.v, kline.q, kline.n].map(Number);
  if (values.some((number) => !Number.isFinite(number))) return null;

  return {
    openTime: Number(kline.t),
    closeTime: Number(kline.T),
    open: Number(kline.o),
    high: Number(kline.h),
    low: Number(kline.l),
    close: Number(kline.c),
    volume: Number(kline.v),
    quoteVolume: Number(kline.q),
    trades: Math.max(0, Math.trunc(Number(kline.n))),
  };
}

export function useCryptoMarkets() {
  const [quotes, setQuotes] = useState<CryptoQuote[]>([]);
  const [status, setStatus] = useState<CryptoFeedStatus>('connecting');
  const [diagnostics, setDiagnostics] = useState<CryptoDiagnostics>(emptyCryptoDiagnostics);
  const [retryToken, setRetryToken] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const retry = useCallback(() => setRetryToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;
    let retryTimer: number | undefined;
    let staleTimer: number | undefined;
    let retryAttempt = 0;
    let endpointIndex = 0;
    let hasVerifiedData = false;
    const controller = new AbortController();

    setStatus('connecting');
    setDiagnostics(emptyCryptoDiagnostics());
    getCryptoMarkets(controller.signal)
      .then((response) => {
        if (!active) return;
        hasVerifiedData = true;
        setQuotes(response.markets);
        setStatus((current) => current === 'live' ? 'live' : 'cached');
        setDiagnostics((current) => ({ ...current, restSnapshotAt: response.retrievedAt, lastError: null }));
      })
      .catch(() => {
        if (!active) return;
        setStatus((current) => current === 'live' ? 'live' : 'unavailable');
        setDiagnostics((current) => ({ ...current, lastError: 'Binance market snapshot unavailable' }));
      });

    const connect = () => {
      if (!active) return;
      const endpoint = BINANCE_SOCKET_BASES[endpointIndex];
      setStatus(hasVerifiedData ? 'cached' : retryAttempt ? 'reconnecting' : 'connecting');
      setDiagnostics((current) => ({
        ...current,
        socketState: 'connecting',
        socketEndpoint: endpoint,
        retryAttempt,
        nextRetryAt: null,
      }));
      const socket = new WebSocket(`${endpoint}/!ticker@arr`);
      socketRef.current = socket;
      socket.onopen = () => active && setDiagnostics((current) => ({ ...current, socketState: 'open', lastError: null, nextRetryAt: null }));
      socket.onmessage = (event) => {
        if (!active) return;
        const receivedAt = new Date().toISOString();
        setDiagnostics((current) => ({ ...current, lastRawMessageAt: receivedAt }));
        try {
          const payload = JSON.parse(String(event.data));
          if (!Array.isArray(payload)) return;
          const nextQuotes = payload.map(normalizeTickerMessage).filter((quote): quote is CryptoQuote => Boolean(quote));
          if (!nextQuotes.length) return;
          setQuotes((currentQuotes) => {
            const bySymbol = new Map<CryptoSymbol, CryptoQuote>(
              currentQuotes.map((quote) => [quote.symbol, quote] as const),
            );
            nextQuotes.forEach((quote) => bySymbol.set(quote.symbol, quote));
            return [...bySymbol.values()].sort((a, b) => CRYPTO_SYMBOLS.indexOf(a.symbol) - CRYPTO_SYMBOLS.indexOf(b.symbol));
          });
          hasVerifiedData = true;
          retryAttempt = 0;
          setStatus('live');
          setDiagnostics((current) => ({ ...current, lastValidMessageAt: receivedAt, retryAttempt: 0 }));
        } catch {
          // Ignore malformed public stream messages; status only changes after validated data.
        }
      };
      socket.onclose = () => {
        if (!active) return;
        endpointIndex = (endpointIndex + 1) % BINANCE_SOCKET_BASES.length;
        const delay = retryDelay(retryAttempt);
        retryAttempt += 1;
        setStatus(hasVerifiedData ? 'reconnecting' : 'unavailable');
        setDiagnostics((current) => ({ ...current, socketState: 'closed', retryAttempt, nextRetryAt: new Date(Date.now() + delay).toISOString() }));
        retryTimer = window.setTimeout(connect, delay);
      };
      socket.onerror = () => {
        if (!active) return;
        setDiagnostics((current) => ({ ...current, socketState: 'error', lastError: 'Binance ticker stream failed; trying the next official endpoint' }));
        socket.close();
      };
    };

    connect();
    staleTimer = window.setInterval(() => {
      setDiagnostics((current) => {
        const lastValidAt = current.lastValidMessageAt ? Date.parse(current.lastValidMessageAt) : 0;
        if (lastValidAt && Date.now() - lastValidAt > STALE_THRESHOLD_MS) setStatus('stale');
        return current;
      });
    }, 5_000);

    return () => {
      active = false;
      controller.abort();
      if (retryTimer) window.clearTimeout(retryTimer);
      if (staleTimer) window.clearInterval(staleTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [retryToken]);

  return { quotes, status, diagnostics, retry };
}

export function useCryptoKlines(symbol: CryptoSymbol, interval: CryptoInterval) {
  const [candles, setCandles] = useState<CryptoCandle[]>([]);
  const [status, setStatus] = useState<CryptoFeedStatus>('connecting');
  const [diagnostics, setDiagnostics] = useState<CryptoDiagnostics>(emptyCryptoDiagnostics);
  const [retryToken, setRetryToken] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const retry = useCallback(() => setRetryToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;
    let retryTimer: number | undefined;
    let staleTimer: number | undefined;
    let retryAttempt = 0;
    let endpointIndex = 0;
    let hasVerifiedData = false;
    const controller = new AbortController();

    setStatus('connecting');
    setDiagnostics(emptyCryptoDiagnostics());
    getCryptoKlines(symbol, interval, controller.signal)
      .then((response) => {
        if (!active) return;
        hasVerifiedData = true;
        setCandles(response.candles);
        setStatus((current) => current === 'live' ? 'live' : 'cached');
        setDiagnostics((current) => ({ ...current, restSnapshotAt: response.retrievedAt }));
      })
      .catch(() => {
        if (!active) return;
        setStatus((current) => current === 'live' ? 'live' : 'unavailable');
        setDiagnostics((current) => ({ ...current, lastError: 'Binance candle snapshot unavailable' }));
      });

    const connect = () => {
      if (!active) return;
      const endpoint = BINANCE_SOCKET_BASES[endpointIndex];
      setStatus(hasVerifiedData ? 'cached' : retryAttempt ? 'reconnecting' : 'connecting');
      setDiagnostics((current) => ({ ...current, socketState: 'connecting', socketEndpoint: endpoint, retryAttempt, nextRetryAt: null }));
      const socket = new WebSocket(`${endpoint}/${symbol.toLowerCase()}@kline_${interval}`);
      socketRef.current = socket;
      socket.onopen = () => active && setDiagnostics((current) => ({ ...current, socketState: 'open', lastError: null }));
      socket.onmessage = (event) => {
        if (!active) return;
        const receivedAt = new Date().toISOString();
        setDiagnostics((current) => ({ ...current, lastRawMessageAt: receivedAt }));
        try {
          const candle = normalizeKlineMessage(JSON.parse(String(event.data)));
          if (!candle) return;
          setCandles((currentCandles) => {
            const latest = currentCandles.at(-1);
            return latest?.openTime === candle.openTime
              ? [...currentCandles.slice(0, -1), candle]
              : [...currentCandles.slice(-499), candle];
          });
          hasVerifiedData = true;
          retryAttempt = 0;
          setStatus('live');
          setDiagnostics((current) => ({ ...current, lastValidMessageAt: receivedAt, retryAttempt: 0 }));
        } catch {
          // Ignore malformed public stream messages.
        }
      };
      socket.onclose = () => {
        if (!active) return;
        endpointIndex = (endpointIndex + 1) % BINANCE_SOCKET_BASES.length;
        const delay = retryDelay(retryAttempt);
        retryAttempt += 1;
        setStatus(hasVerifiedData ? 'reconnecting' : 'unavailable');
        setDiagnostics((current) => ({ ...current, socketState: 'closed', retryAttempt, nextRetryAt: new Date(Date.now() + delay).toISOString() }));
        retryTimer = window.setTimeout(connect, delay);
      };
      socket.onerror = () => {
        if (!active) return;
        setDiagnostics((current) => ({ ...current, socketState: 'error', lastError: 'Binance kline stream failed; trying the next official endpoint' }));
        socket.close();
      };
    };

    connect();
    staleTimer = window.setInterval(() => {
      setDiagnostics((current) => {
        const lastValidAt = current.lastValidMessageAt ? Date.parse(current.lastValidMessageAt) : 0;
        if (lastValidAt && Date.now() - lastValidAt > STALE_THRESHOLD_MS) setStatus('stale');
        return current;
      });
    }, 5_000);

    return () => {
      active = false;
      controller.abort();
      if (retryTimer) window.clearTimeout(retryTimer);
      if (staleTimer) window.clearInterval(staleTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [interval, retryToken, symbol]);

  return { candles, status, diagnostics, retry };
}
