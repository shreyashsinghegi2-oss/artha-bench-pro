import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitRecord>();

// Periodically clean up old records every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.resetTime) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);
// Do not keep a process (tests, CLI builds) alive just for this housekeeping timer.
cleanupTimer.unref?.();

/** The caller's address (first hop of x-forwarded-for when behind a proxy). */
export function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
}

export function createRateLimiter(options: { windowMs: number; max: number; message?: string; keyFor?: (req: Request) => string }) {
  const { windowMs, max, message = 'Too many requests from this IP, please try again later.', keyFor } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();

    const key = `${windowMs}:${max}:${keyFor ? keyFor(req) : clientIp(req)}`;
    let record = store.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      store.set(key, record);
    }

    record.count++;

    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());

    if (record.count > max) {
      return res.status(429).json({
        error: message,
        reqId: (req as any).reqId || `req-${Date.now()}`,
      });
    }

    next();
  };
}
