import { callGroqChat, getGroqModels } from './groqService';
import type {
  CryptoAssistantContext,
  CryptoCandle,
  CryptoInterval,
  CryptoMarketsResponse,
  CryptoQuote,
  CryptoSymbol,
} from '../src/components/crypto/cryptoTypes';
import { CRYPTO_SYMBOLS } from '../src/components/crypto/cryptoTypes';

const BINANCE_REST_BASES = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api1.binance.com',
] as const;
const SOURCE_LABEL = 'Binance Public Market Data' as const;
const QUOTE_CACHE_MS = 5_000;
const KLINE_CACHE_MS = 10_000;

interface CacheValue<T> {
  expiresAt: number;
  value: T;
}

let quoteCache: CacheValue<CryptoMarketsResponse> | undefined;
const klineCache = new Map<string, CacheValue<{ retrievedAt: string; candles: CryptoCandle[] }>>();

async function fetchBinanceJson(path: string): Promise<unknown> {
  let lastStatus: number | undefined;
  for (const baseUrl of BINANCE_REST_BASES) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'ArthaBench-Pro/2.0' },
        signal: AbortSignal.timeout(7_000),
      });
      lastStatus = response.status;
      if (!response.ok) continue;
      return await response.json();
    } catch {
      // Try the next official Binance public market-data endpoint.
    }
  }
  throw new Error(`Binance public market data is unavailable${lastStatus ? ` (HTTP ${lastStatus})` : ''}.`);
}

function normalizeRestQuote(value: unknown): CryptoQuote | null {
  if (!value || typeof value !== 'object') return null;
  const quote = value as Record<string, unknown>;
  const symbol = String(quote.symbol || '').toUpperCase();
  if (!CRYPTO_SYMBOLS.includes(symbol as CryptoSymbol)) return null;
  const numericKeys = ['lastPrice', 'priceChange', 'priceChangePercent', 'highPrice', 'lowPrice', 'volume', 'quoteVolume', 'bidPrice', 'askPrice'];
  if (numericKeys.some((key) => !Number.isFinite(Number(quote[key])))) return null;
  return {
    symbol: symbol as CryptoSymbol,
    baseAsset: symbol.replace(/USDT$/, ''),
    quoteAsset: 'USDT',
    price: Number(quote.lastPrice),
    change: Number(quote.priceChange),
    changePercent: Number(quote.priceChangePercent),
    high24h: Number(quote.highPrice),
    low24h: Number(quote.lowPrice),
    volume24h: Number(quote.volume),
    quoteVolume24h: Number(quote.quoteVolume),
    bid: Number(quote.bidPrice),
    ask: Number(quote.askPrice),
    providerTimestamp: new Date(Number(quote.closeTime) || Date.now()).toISOString(),
  };
}

export async function getCryptoMarkets(): Promise<CryptoMarketsResponse> {
  if (quoteCache && quoteCache.expiresAt > Date.now()) return quoteCache.value;
  const symbols = encodeURIComponent(JSON.stringify(CRYPTO_SYMBOLS));
  const payload = await fetchBinanceJson(`/api/v3/ticker/24hr?symbols=${symbols}`);
  if (!Array.isArray(payload)) throw new Error('Binance returned an invalid market response.');
  const markets = payload.map(normalizeRestQuote).filter((quote): quote is CryptoQuote => Boolean(quote));
  if (markets.length !== CRYPTO_SYMBOLS.length) throw new Error('Binance returned an incomplete tracked-market response.');
  markets.sort((a, b) => CRYPTO_SYMBOLS.indexOf(a.symbol) - CRYPTO_SYMBOLS.indexOf(b.symbol));
  const value: CryptoMarketsResponse = { sourceLabel: SOURCE_LABEL, retrievedAt: new Date().toISOString(), markets };
  quoteCache = { expiresAt: Date.now() + QUOTE_CACHE_MS, value };
  return value;
}

export function normalizeRestCandle(value: unknown): CryptoCandle | null {
  if (!Array.isArray(value) || value.length < 9) return null;
  const numericValues = value.slice(0, 9).map(Number);
  if (numericValues.some((number) => !Number.isFinite(number))) return null;
  return {
    openTime: Number(value[0]),
    open: Number(value[1]),
    high: Number(value[2]),
    low: Number(value[3]),
    close: Number(value[4]),
    volume: Number(value[5]),
    closeTime: Number(value[6]),
    quoteVolume: Number(value[7]),
    trades: Math.max(0, Math.trunc(Number(value[8]))),
  };
}

export async function getCryptoKlines(symbol: CryptoSymbol, interval: CryptoInterval) {
  const cacheKey = `${symbol}:${interval}`;
  const cached = klineCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { sourceLabel: SOURCE_LABEL, symbol, interval, ...cached.value };
  }
  const payload = await fetchBinanceJson(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=500`);
  if (!Array.isArray(payload)) throw new Error('Binance returned an invalid candle response.');
  const candles = payload.map(normalizeRestCandle).filter((candle): candle is CryptoCandle => Boolean(candle));
  if (!candles.length) throw new Error('Binance returned no valid candles.');
  const value = { retrievedAt: new Date().toISOString(), candles };
  klineCache.set(cacheKey, { expiresAt: Date.now() + KLINE_CACHE_MS, value });
  return { sourceLabel: SOURCE_LABEL, symbol, interval, ...value };
}

function formattedNumber(value: number, maximumFractionDigits = 6) {
  return value.toLocaleString('en-US', { maximumFractionDigits });
}

export function buildCryptoAssistantFallback(question: string, context: CryptoAssistantContext): string {
  const direction = context.absoluteChange > 0 ? 'up' : context.absoluteChange < 0 ? 'down' : 'flat';
  const range = context.high - context.low;
  const bodyToRange = range ? Math.abs(context.absoluteChange) / range * 100 : 0;
  const direct = `${context.symbol.replace('USDT', '/USDT')} is ${direction} by ${context.absoluteChange >= 0 ? '+' : ''}${formattedNumber(context.absoluteChange)} USDT (${context.percentChange >= 0 ? '+' : ''}${context.percentChange.toFixed(2)}%) in the selected ${context.interval} ${context.candleStatus.toLowerCase()} candle.`;
  return `## Direct answer
${direct}

## Assumptions and context
- Instrument: ${context.symbol.replace('USDT', '/USDT')} · interval: ${context.interval} · candle: ${context.candleStatus}
- Time: ${context.timeUtc} UTC · ${context.timeIst} IST
- Source: ${context.provider} · feed status: ${context.streamStatus.toUpperCase()}
- Question: ${question.trim()}

## Formula or rule
Candle change = Close − Open
Percentage change = (Close − Open) / Open × 100
Range = High − Low

## Step-by-step calculation or reasoning
1. Open = ${formattedNumber(context.open)} USDT; Close = ${formattedNumber(context.close)} USDT.
2. High = ${formattedNumber(context.high)} USDT; Low = ${formattedNumber(context.low)} USDT; Range = ${formattedNumber(range)} USDT.
3. Absolute change = ${context.absoluteChange >= 0 ? '+' : ''}${formattedNumber(context.absoluteChange)} USDT; Percentage change = ${context.percentChange >= 0 ? '+' : ''}${context.percentChange.toFixed(2)}%.
4. The candle body uses ${bodyToRange.toFixed(1)}% of the observed high-low range. Volume is ${formattedNumber(context.baseVolume, 4)} base units across ${context.tradeCount.toLocaleString('en-US')} trades.
5. One candle describes a measured interval; it does not establish a durable trend or identify buyer/seller intent.

## Final result and interpretation
Final result: the selected candle is ${direction}, with a ${context.percentChange >= 0 ? '+' : ''}${context.percentChange.toFixed(2)}% open-to-close move.
This is a measured candle observation, not a forecast or a buy/sell/hold signal.

## If needed
- Compare several closed candles, volume, volatility, liquidity, fees, and broader market conditions before drawing a research conclusion.
- Bullish, neutral, and bearish scenarios should be framed conditionally around follow-through evidence rather than price targets.

## Limitations and verification
- ${context.candleStatus === 'Forming' ? 'This candle is still forming and can change before close.' : 'This candle is closed, but later market conditions can differ.'}
- USDT may not equal USD exactly, and crypto prices can differ across venues.
- Verify consequential decisions independently; ArthaBench does not issue personalized buy, sell, hold, leverage, or target-price instructions.`;
}

export async function answerCryptoQuestion(question: string, context: CryptoAssistantContext) {
  const fallback = buildCryptoAssistantFallback(question, context);
  if (!process.env.GROQ_API_KEY?.trim()) return { answer: fallback, provider: 'deterministic' as const, model: null };

  const systemPrompt = `You are ArthaMind Crypto Assistant, an evidence-grounded financial educator. Use only the supplied Binance candle context for specific numbers. Follow these Markdown headings in this exact order: Direct answer; Assumptions and context; Formula or rule; Step-by-step calculation or reasoning; Final result and interpretation; If needed; Limitations and verification. The Direct answer must be one sentence. Show only formulas supported by the supplied candle data. Keep independent factual claims in separate sentences. Preserve exact Binance source, feed status, candle status, UTC/IST timestamps, OHLC, volume and trade-count values. Never provide personalized buy/sell/hold instructions, target prices, leverage instructions, guaranteed returns, or certainty. A purchase/avoid request receives an educational due-diligence framework, not an order. Explicitly label forming candles and data freshness. Keep the response under 650 words.`;
  try {
    const answer = await callGroqChat(
      systemPrompt,
      `Question: ${question}

Verified Binance candle context:
${JSON.stringify(context)}`,
      getGroqModels().tutorModel,
    );
    const required = ['## Direct answer', '## Assumptions and context', '## Formula or rule', '## Step-by-step calculation or reasoning', '## Final result and interpretation', '## Limitations and verification'];
    return { answer: required.every((heading) => answer.includes(heading)) ? answer : fallback, provider: 'groq' as const, model: getGroqModels().tutorModel };
  } catch {
    return { answer: fallback, provider: 'deterministic' as const, model: null };
  }
}

export function resetCryptoCachesForTests() {
  quoteCache = undefined;
  klineCache.clear();
}
