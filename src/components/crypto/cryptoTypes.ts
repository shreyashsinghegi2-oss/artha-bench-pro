export const CRYPTO_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
] as const;

export const CRYPTO_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

export type CryptoSymbol = (typeof CRYPTO_SYMBOLS)[number];
export type CryptoInterval = (typeof CRYPTO_INTERVALS)[number];
export type CryptoFeedStatus =
  | 'connecting'
  | 'cached'
  | 'live'
  | 'reconnecting'
  | 'stale'
  | 'unavailable';

export interface CryptoQuote {
  symbol: CryptoSymbol;
  baseAsset: string;
  quoteAsset: 'USDT';
  price: number;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  bid: number;
  ask: number;
  providerTimestamp: string;
}

export interface CryptoCandle {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  trades: number;
}

export interface CryptoDiagnostics {
  restSnapshotAt: string | null;
  socketState: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  socketEndpoint: string | null;
  lastRawMessageAt: string | null;
  lastValidMessageAt: string | null;
  retryAttempt: number;
  nextRetryAt: string | null;
  staleThresholdMs: number;
  lastError: string | null;
}

export interface CryptoMarketsResponse {
  sourceLabel: 'Binance Public Market Data';
  retrievedAt: string;
  markets: CryptoQuote[];
}

export interface CryptoKlinesResponse {
  sourceLabel: 'Binance Public Market Data';
  retrievedAt: string;
  symbol: CryptoSymbol;
  interval: CryptoInterval;
  candles: CryptoCandle[];
}

export interface CryptoChartContext {
  symbol: CryptoSymbol;
  interval: CryptoInterval;
  candle: CryptoCandle | null;
  status: CryptoFeedStatus;
  updatedAt: string | null;
}

export interface CryptoAssistantContext {
  symbol: CryptoSymbol;
  interval: CryptoInterval;
  candleStatus: 'Forming' | 'Closed';
  timeUtc: string;
  timeIst: string;
  open: number;
  high: number;
  low: number;
  close: number;
  absoluteChange: number;
  percentChange: number;
  baseVolume: number;
  quoteVolume: number;
  tradeCount: number;
  provider: 'Binance Public Market Data';
  streamStatus: CryptoFeedStatus;
  lastUpdatedAt: string | null;
}

export interface CryptoObservation {
  id: string;
  symbol: CryptoSymbol;
  interval: CryptoInterval;
  note: string;
  tag: 'trend' | 'volatility' | 'support-resistance' | 'risk';
  recordedAt: string;
}
