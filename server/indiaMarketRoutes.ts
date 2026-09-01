import { Router } from 'express';
import { z } from 'zod';
import {
  getIndiaMarketHistory,
  getIndiaMarketQuotes,
  getIndiaMarketStatus,
  searchIndiaMarketIdentities,
} from './indiaMarketService';

export const indiaMarketRouter = Router();

const assetIdListSchema = z.string().max(600).transform((value) =>
  [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))].slice(0, 20),
);
const searchSchema = z.string().max(120).default('');
const historyRangeSchema = z.enum(['1d', '1w', '1m', '3m', '6m', '1y']).default('1m');

indiaMarketRouter.get('/markets/india/search', (req, res) => {
  const parsed = searchSchema.safeParse(req.query.q ?? req.query.query ?? '');
  if (!parsed.success) return res.status(400).json({ error: 'Search query is invalid.' });
  return res.json({
    results: searchIndiaMarketIdentities(parsed.data),
    requestId: res.getHeader('x-request-id') ?? null,
  });
});

indiaMarketRouter.get('/markets/india/quotes', async (req, res, next) => {
  try {
    const raw = typeof req.query.assetIds === 'string' ? req.query.assetIds : '';
    const parsed = assetIdListSchema.safeParse(raw);
    if (!parsed.success || parsed.data.length === 0) {
      return res.status(400).json({ error: 'Provide between 1 and 20 known asset IDs.' });
    }
    const results = await getIndiaMarketQuotes(parsed.data);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
    return res.json({
      results,
      requestedAssetIds: parsed.data,
      retrievedAt: new Date().toISOString(),
      requestId: res.getHeader('x-request-id') ?? null,
    });
  } catch (error) {
    next(error);
  }
});

indiaMarketRouter.get('/markets/india/history', async (req, res, next) => {
  try {
    const assetId = typeof req.query.assetId === 'string' ? req.query.assetId.trim() : '';
    const range = historyRangeSchema.safeParse(req.query.range ?? '1m');
    if (!assetId || assetId.length > 80 || !range.success) {
      return res.status(400).json({ error: 'A valid assetId and supported range are required.' });
    }
    const result = await getIndiaMarketHistory(assetId, range.data);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=120');
    return res.json({ ...result, range: range.data, requestId: res.getHeader('x-request-id') ?? null });
  } catch (error) {
    next(error);
  }
});

indiaMarketRouter.get('/markets/india/status', (_req, res) => {
  const intradayProvider = process.env.INDIA_INTRADAY_PROVIDER?.trim() || '';
  return res.json({
    ...getIndiaMarketStatus(),
    intradayLicensed: process.env.INDIA_INTRADAY_LICENSED?.trim().toLowerCase() === 'true',
    intradayConfigured: Boolean(intradayProvider && process.env.INDIA_INTRADAY_API_KEY?.trim()),
    intradayProvider: intradayProvider || 'Not configured',
    checkedAt: new Date().toISOString(),
    requestId: res.getHeader('x-request-id') ?? null,
  });
});
