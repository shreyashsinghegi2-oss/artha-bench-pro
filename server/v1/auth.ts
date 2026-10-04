/**
 * API keys for /api/v1. Keys are never stored: the server holds only their SHA-256 hashes in
 * API_V1_KEY_HASHES (comma-separated hex). Create a key with `npx tsx scripts/create-api-key.ts`.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { errorBody } from './envelope';

export const hashKey = (key: string): string => createHash('sha256').update(key, 'utf8').digest('hex');

export function newApiKey(): { key: string; hash: string } {
  const key = `ab_live_${randomBytes(24).toString('base64url')}`;
  return { key, hash: hashKey(key) };
}

function configuredHashes(): Buffer[] {
  return (process.env.API_V1_KEY_HASHES ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => /^[0-9a-f]{64}$/.test(h))
    .map((h) => Buffer.from(h, 'hex'));
}

/** Returns a short, non-secret key id (first 12 hex chars of the hash) when the key is valid. */
export function verifyApiKey(key: string | undefined): string | null {
  if (!key || key.length > 200) return null;
  const digest = Buffer.from(hashKey(key), 'hex');
  let match = false;
  for (const h of configuredHashes()) if (timingSafeEqual(h, digest)) match = true;
  return match ? digest.toString('hex').slice(0, 12) : null;
}

export interface ApiLocals {
  apiKeyId?: string;
}

const headerKey = (req: Request): string | undefined => {
  const v = req.header('x-api-key');
  return v ? v.trim() : undefined;
};

/** Accepts requests without a key; rejects a key that is present but wrong (so callers notice typos). */
export function optionalApiKey(req: Request, res: Response<unknown, ApiLocals>, next: NextFunction): void {
  const key = headerKey(req);
  if (key === undefined) return next();
  const id = verifyApiKey(key);
  if (!id) {
    res.status(401).json(errorBody('invalid_api_key', 'The x-api-key header is not a valid ArthaBench API key.'));
    return;
  }
  res.locals.apiKeyId = id;
  next();
}

export function requireApiKey(req: Request, res: Response<unknown, ApiLocals>, next: NextFunction): void {
  if (res.locals.apiKeyId) return next();
  const id = verifyApiKey(headerKey(req));
  if (!id) {
    res.status(401).json(errorBody('api_key_required', 'This endpoint needs an API key in the x-api-key header.'));
    return;
  }
  res.locals.apiKeyId = id;
  next();
}
