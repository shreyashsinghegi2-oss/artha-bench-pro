import { z } from 'zod';

export const MarketQuoteQuerySchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9^.-]+$/, 'Invalid symbol format'),
  assetType: z.enum(['equity', 'index', 'etf', 'forex', 'crypto']).default('equity'),
});

export const MarketSearchQuerySchema = z.object({
  query: z.string().min(1).max(50),
  assetType: z.enum(['all', 'equity', 'index', 'etf', 'forex', 'crypto']).default('all'),
});

export const MarketHistoryQuerySchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9^.-]+$/),
  range: z.enum(['1d', '1w', '1m', '1y', '5y']).default('1m'),
});

export const PaperTradeOrderSchema = z.object({
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  assetType: z.string().default('equity'),
  side: z.enum(['buy', 'sell']),
  quantity: z.number().positive().max(1000000),
  price: z.number().positive(),
});
