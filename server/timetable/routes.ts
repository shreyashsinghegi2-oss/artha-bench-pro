/**
 * POST /api/timetable/extract { password, image } → { rows }
 * Reads a timetable image (PNG/JPEG data URL; PDFs are rendered to an image in the browser first) with a Groq
 * vision model and returns rows for the admin to check. The admin password is verified by the database
 * (timetable_login) first, so only the admin can spend AI credits. Called from the timetable site, so CORS
 * allows that site's origin (TIMETABLE_ORIGINS, comma-separated; *.vercel.app deployments of term-timetable).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { createRateLimiter } from '../rateLimiter';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://agjbvoosukxfvrritgto.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_KOdXB7LW5Ho5hDjsi3GMiw_xdogy5oR';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export interface TimetableRow {
  day: (typeof DAYS)[number];
  start: string;
  end: string;
  subject: string;
  teacher?: string;
  room?: string;
}

const bodySchema = z.object({
  password: z.string().min(1).max(100),
  image: z
    .string()
    .max(1_900_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,/),
});

export function allowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const extra = (process.env.TIMETABLE_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return extra.includes(origin) || /^https:\/\/term-timetable(-[a-z0-9-]+)?\.vercel\.app$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin);
}

const time = (v: unknown): string | null => {
  const m = /^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i.exec(String(v ?? '').trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : null;
};

/** Keeps only well-formed rows from the model's JSON (never trusts it blindly). */
export function cleanRows(raw: unknown): TimetableRow[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows)
      ? (raw as { rows: unknown[] }).rows
      : [];
  const out: TimetableRow[] = [];
  for (const r of list.slice(0, 400)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const dayRaw = String(o.day ?? '')
      .trim()
      .slice(0, 3);
    const day = DAYS.find((d) => d.toLowerCase() === dayRaw.toLowerCase());
    const start = time(o.start);
    const end = time(o.end);
    const subject = String(o.subject ?? '')
      .trim()
      .slice(0, 80);
    if (!day || !start || !end || !subject || end <= start) continue;
    const row: TimetableRow = { day, start, end, subject };
    const teacher = String(o.teacher ?? '')
      .trim()
      .slice(0, 60);
    const room = String(o.room ?? '')
      .trim()
      .slice(0, 40);
    if (teacher) row.teacher = teacher;
    if (room) row.room = room;
    out.push(row);
  }
  return out.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.start.localeCompare(b.start));
}

export const EXTRACT_PROMPT = [
  'This image is a class timetable. Read it exactly; do not invent classes.',
  'Return ONLY JSON: {"rows":[{"day":"Mon","start":"09:00","end":"09:50","subject":"Mathematics","teacher":"","room":""}]}',
  'day is one of Mon Tue Wed Thu Fri Sat Sun. Times are 24-hour HH:MM. One row per class period per day.',
  'Skip breaks and lunch unless they are named periods. Leave teacher and room empty if not shown.',
].join('\n');

async function verifyPassword(password: string, fetchImpl: typeof fetch): Promise<{ ok: boolean; error?: string }> {
  const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/timetable_login`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_password: password }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return { ok: false, error: 'Could not check the password right now.' };
  return (await res.json()) as { ok: boolean; error?: string };
}

export function createTimetableRouter(deps: { fetchImpl?: typeof fetch } = {}): Router {
  const router = Router();
  const doFetch = deps.fetchImpl ?? fetch;
  const limiter = createRateLimiter({ windowMs: 10 * 60_000, max: 10, message: 'Too many reads. Please wait a few minutes.' });

  const cors = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.header('origin');
    if (allowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin as string);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
  router.options('/extract', cors);

  router.post('/extract', cors, limiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const body = bodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'Send the admin password and a PNG, JPG or WebP image under 1.4 MB.' });
      return;
    }
    try {
      const auth = await verifyPassword(body.data.password, doFetch);
      if (!auth.ok) {
        res.status(401).json({ error: auth.error ?? 'Wrong password.' });
        return;
      }
      const key = process.env.GROQ_API_KEY?.trim();
      if (!key) {
        res.status(503).json({ error: 'Automatic reading is not set up. Enter the rows by hand.' });
        return;
      }
      const ai = await doFetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(40_000),
        body: JSON.stringify({
          model: process.env.GROQ_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL,
          temperature: 0,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: EXTRACT_PROMPT },
                { type: 'image_url', image_url: { url: body.data.image } },
              ],
            },
          ],
        }),
      });
      if (!ai.ok) {
        console.warn('[timetable/extract] Groq HTTP', ai.status, (await ai.text()).slice(0, 300));
        res.status(502).json({ error: 'The timetable could not be read automatically. Enter the rows by hand.' });
        return;
      }
      const data = (await ai.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const content = data.choices?.[0]?.message?.content;
      const rows = cleanRows(typeof content === 'string' ? JSON.parse(content) : null);
      res.json({
        rows,
        note: rows.length
          ? 'Read by AI. Check every row against the timetable before publishing.'
          : 'No classes could be read from this image. Enter the rows by hand.',
      });
    } catch (e) {
      console.warn('[timetable/extract] failed', e instanceof Error ? e.message : e);
      res.status(502).json({ error: 'The timetable could not be read automatically. Enter the rows by hand.' });
    }
  });
  return router;
}

export const timetableRouter = createTimetableRouter();
