/**
 * Market-alert webhooks: "POST to my URL when NIFTY goes above 25,000".
 *
 * Storage: Supabase table public.api_webhooks (migration 20260930100000_api_webhooks.sql), written only by the
 * server with the service-role key. Alerts are edge-triggered: a webhook fires when its condition becomes true
 * and fires again only after the condition has been false in between.
 *
 * Checking runs on GET/POST /api/v1/webhooks/run with `Authorization: Bearer <CRON_SECRET>` (Vercel Cron, a
 * GitHub Actions schedule or any external scheduler). Deliveries are signed:
 *   X-ArthaBench-Signature: sha256=<hex HMAC-SHA256 of the raw body with the webhook secret>
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { assertPublic } from '../webReader';
import { btcQuote, niftyQuote } from './market';

export class WebhookError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const WEBHOOK_SYMBOLS = ['nifty', 'btc'] as const;
export const MAX_WEBHOOKS_PER_KEY = 10;

export const createWebhookSchema = z.object({
  url: z.string().trim().url().max(500),
  symbol: z.enum(WEBHOOK_SYMBOLS),
  condition: z.enum(['above', 'below']),
  threshold: z.number().finite().positive(),
});

export interface WebhookRow {
  id: string;
  key_id: string;
  url: string;
  symbol: (typeof WEBHOOK_SYMBOLS)[number];
  condition: 'above' | 'below';
  threshold: number;
  secret: string;
  last_state: boolean | null;
  last_fired_at: string | null;
  last_status: number | null;
  active: boolean;
  created_at: string;
}

export type PublicWebhook = Omit<WebhookRow, 'secret' | 'key_id'>;
const publicView = ({ secret: _s, key_id: _k, ...rest }: WebhookRow): PublicWebhook => rest;

function store() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new WebhookError('Webhooks are not configured on this server (Supabase service key missing).', 503);
  return async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers },
      signal: AbortSignal.timeout(8_000),
    });
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 404 || /PGRST205|api_webhooks/.test(text))
        throw new WebhookError('Webhook storage is not set up yet (apply migration 20260930100000_api_webhooks.sql).', 503);
      throw new WebhookError(`Webhook storage error (HTTP ${res.status}).`, 502);
    }
    return (text ? JSON.parse(text) : null) as T;
  };
}

/** Rejects non-https URLs and hosts that resolve to private or internal addresses (SSRF protection). */
export async function assertDeliverable(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new WebhookError('Webhook URLs must use https.', 422);
  try {
    await assertPublic(url);
  } catch {
    throw new WebhookError('Webhook URLs must point to a public internet address.', 422);
  }
  return url;
}

export async function createWebhook(keyId: string, input: z.infer<typeof createWebhookSchema>): Promise<PublicWebhook & { secret: string }> {
  await assertDeliverable(input.url);
  const db = store();
  const existing = await db<Array<{ id: string }>>(`api_webhooks?select=id&key_id=eq.${encodeURIComponent(keyId)}&active=eq.true`);
  if (existing.length >= MAX_WEBHOOKS_PER_KEY) throw new WebhookError(`Each API key can have at most ${MAX_WEBHOOKS_PER_KEY} active webhooks.`, 409);
  const secret = `whsec_${randomBytes(24).toString('base64url')}`;
  const rows = await db<WebhookRow[]>('api_webhooks', { method: 'POST', body: JSON.stringify({ key_id: keyId, ...input, secret }) });
  const row = rows[0];
  if (!row) throw new WebhookError('Webhook could not be saved.', 502);
  return { ...publicView(row), secret };
}

export async function listWebhooks(keyId: string): Promise<PublicWebhook[]> {
  const rows = await store()<WebhookRow[]>(`api_webhooks?key_id=eq.${encodeURIComponent(keyId)}&order=created_at.desc`);
  return rows.map(publicView);
}

export async function deleteWebhook(keyId: string, id: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new WebhookError('Unknown webhook id.', 404);
  const rows = await store()<WebhookRow[]>(`api_webhooks?id=eq.${id}&key_id=eq.${encodeURIComponent(keyId)}`, { method: 'DELETE' });
  return rows.length > 0;
}

export const signPayload = (secret: string, body: string): string => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

export function cronAuthorized(header: string | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Decides which webhooks fire for the given prices (pure; exported for tests). */
export function evaluate(
  rows: WebhookRow[],
  prices: Partial<Record<WebhookRow['symbol'], number>>,
): Array<{ row: WebhookRow; state: boolean; fire: boolean; price: number }> {
  const out = [];
  for (const row of rows) {
    const price = prices[row.symbol];
    if (price === undefined) continue;
    const state = row.condition === 'above' ? price > row.threshold : price < row.threshold;
    out.push({ row, state, fire: state && row.last_state !== true, price });
  }
  return out;
}

export async function runWebhooks(): Promise<{ checked: number; fired: number; failed: number; prices: Record<string, number> }> {
  const db = store();
  const rows = await db<WebhookRow[]>('api_webhooks?active=eq.true&limit=500');
  const prices: Partial<Record<WebhookRow['symbol'], number>> = {};
  const asOf: Record<string, string | null> = {};
  if (rows.some((r) => r.symbol === 'nifty')) {
    try {
      const q = await niftyQuote();
      prices.nifty = q.data.price;
      asOf.nifty = q.data.as_of;
    } catch {
      /* skip this round */
    }
  }
  if (rows.some((r) => r.symbol === 'btc')) {
    try {
      const q = await btcQuote();
      prices.btc = q.data.price;
      asOf.btc = q.data.as_of;
    } catch {
      /* skip this round */
    }
  }
  let fired = 0;
  let failed = 0;
  for (const { row, state, fire, price } of evaluate(rows, prices)) {
    const patch: Partial<WebhookRow> = { last_state: state };
    if (fire) {
      const body = JSON.stringify({
        event: 'price_alert',
        webhook_id: row.id,
        symbol: row.symbol,
        condition: row.condition,
        threshold: row.threshold,
        price,
        as_of: asOf[row.symbol] ?? null,
        sent_at: new Date().toISOString(),
      });
      let status = 0;
      try {
        await assertDeliverable(row.url);
        const res = await fetch(row.url, {
          method: 'POST',
          redirect: 'manual',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'ArthaBench-Webhooks/1.0', 'X-ArthaBench-Signature': signPayload(row.secret, body) },
          body,
          signal: AbortSignal.timeout(5_000),
        });
        status = res.status;
      } catch {
        status = 0;
      }
      if (status >= 200 && status < 300) fired += 1;
      else failed += 1;
      patch.last_fired_at = new Date().toISOString();
      patch.last_status = status;
    }
    if (patch.last_state !== row.last_state || fire) await db(`api_webhooks?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }
  return { checked: rows.length, fired, failed, prices: prices as Record<string, number> };
}
