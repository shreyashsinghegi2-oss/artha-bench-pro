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
  return `## Selected Data
- ${context.symbol.replace('USDT', '/USDT')} · ${context.interval} · ${context.candleStatus}
- ${context.timeUtc} UTC · ${context.timeIst} IST
- Source: ${context.provider} · Feed: ${context.streamStatus.toUpperCase()}

## Price Summary
| Open | ${formattedNumber(context.open)} USDT |
| Close | ${formattedNumber(context.close)} USDT |
| High / Low | ${formattedNumber(context.high)} / ${formattedNumber(context.low)} USDT |
| Candle change | ${context.absoluteChange >= 0 ? '+' : ''}${formattedNumber(context.absoluteChange)} (${context.percentChange >= 0 ? '+' : ''}${context.percentChange.toFixed(2)}%) |
| Base volume / trades | ${formattedNumber(context.baseVolume, 4)} / ${context.tradeCount.toLocaleString('en-US')} |

## What the Data Shows
- This candle is ${direction}; its body uses ${bodyToRange.toFixed(1)}% of the observed high-low range.
- Volume and trade count describe activity, not the identity or intent of buyers and sellers.

## Educational Interpretation
- The question was: ${question.trim()}
- One candle cannot establish a durable trend. Compare it with several closed candles, volume, volatility, and broader market conditions.

## Purchase Decision Framework
- Research further only if the asset, venue, custody risk, fees, liquidity, and downside limits fit a written plan.
- Avoid acting when the decision depends on one forming candle, urgency, leverage, borrowed money, or a promised return.
- ArthaBench does not issue a buy, sell, hold, or target-price instruction.

## Scenario Analysis
- Bullish: follow-through closes above the observed high with consistent participation.
- Neutral: price remains inside the candle range and evidence stays mixed.
- Bearish: follow-through closes below the observed low or liquidity weakens.

## Risk and Limitations
- USDT may not equal USD exactly; crypto prices differ across venues and forming candles can change before close.
- Educational research guidance only—not personalized investment advice.`;
}

export async function answerCryptoQuestion(question: string, context: CryptoAssistantContext) {
  const fallback = buildCryptoAssistantFallback(question, context);
  if (!process.env.GROQ_API_KEY?.trim()) return { answer: fallback, provider: 'deterministic' as const, model: null };

  const systemPrompt = `You are ArthaBench Crypto Assistant, an evidence-grounded financial educator.
Use only the supplied Binance candle context for specific numbers. Return Markdown with exactly these section headings: Selected Data, Price Summary, What the Data Shows, Educational Interpretation, Purchase Decision Framework, Scenario Analysis, Risk and Limitations. Use ## headings, short bullets, and a two-column pipe table under Price Summary. Never provide personalized buy/sell/hold instructions, target prices, guaranteed returns, or certainty. A purchase/avoid request must receive a conditional due-diligence checklist, not an order. Explicitly label forming candles and data freshness. Keep the response under 650 words.`;
  try {
    const answer = await callGroqChat(
      systemPrompt,
      `Question: ${question}\n\nVerified Binance candle context:\n${JSON.stringify(context)}`,
      getGroqModels().tutorModel,
    );
    return { answer: answer.includes('## ') ? answer : fallback, provider: 'groq' as const, model: getGroqModels().tutorModel };
  } catch {
    return { answer: fallback, provider: 'deterministic' as const, model: null };
  }
}

export function resetCryptoCachesForTests() {
  quoteCache = undefined;
  klineCache.clear();
}
