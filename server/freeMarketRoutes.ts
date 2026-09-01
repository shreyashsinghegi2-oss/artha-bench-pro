import { Router } from 'express';
import { getMarketQuote } from './marketDataService';
import type { NormalizedMarketQuote } from '../src/types';

export const freeMarketRouter = Router();

const MAX_SYMBOLS = 20;
const MAX_CONCURRENCY = 4;

function parseSymbols(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))].slice(0, MAX_SYMBOLS);
}

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, mapper: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(values[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

freeMarketRouter.get('/markets/batch', async (req, res) => {
  const symbols = parseSymbols(req.query.symbols);
  if (!symbols.length) return res.status(400).json({ error: 'Provide at least one symbol.' });

  const rows = await mapWithConcurrency(symbols, MAX_CONCURRENCY, async (symbol) => {
    try {
      const result = await getMarketQuote(symbol);
      return {
        symbol,
        status: 'available' as const,
        quote: result.quote as NormalizedMarketQuote,
        message: result.message || null,
      };
    } catch (error) {
      return {
        symbol,
        status: 'unavailable' as const,
        quote: null,
        message: error instanceof Error ? error.message.slice(0, 240) : 'Market quote unavailable.',
      };
    }
  });

  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=40');
  return res.json({
    providerPolicy: 'Indian NSE/BSE symbols use Yahoo Finance experimental/reference in free mode.',
    requested: symbols.length,
    available: rows.filter((row) => row.status === 'available').length,
    retrievedAt: new Date().toISOString(),
    results: rows,
    requestId: res.getHeader('x-request-id') ?? null,
  });
});
