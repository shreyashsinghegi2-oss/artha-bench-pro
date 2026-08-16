import { z } from 'zod';

export const NewsQuerySchema = z.object({
  query: z.string().max(200).optional().default(''),
  category: z.string().max(50).optional().default('all'),
  region: z.string().max(50).optional().default('global'),
  page: z.coerce.number().int().min(1).max(10).default(1),
});

export const NewsExplainRequestSchema = z.object({
  articleId: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  summary: z.string().max(1000).optional().default(''),
  sourceName: z.string().max(100).default('News Outlet'),
  sourceUrl: z.string().url(),
  publishedAt: z.string().nullable().optional(),
});
