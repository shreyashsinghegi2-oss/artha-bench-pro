/**
 * Speech-to-text with Sarvam AI (Indian languages), for signed-in users only, with a daily limit.
 *
 * Needs SARVAM_API_KEY on the server (never in the browser). The daily limit is counted in Supabase
 * by `public.use_voice_credit` (see migration voice_usage_daily_limit), called with the user's own
 * token, so it holds across every server instance and the user cannot reset it.
 * VOICE_STT_DAILY_LIMIT sets the limit per user per day (default 15).
 */

const STT_URL = 'https://api.sarvam.ai/speech-to-text';
/** Newest model first; the older one is tried if Sarvam rejects the first. */
const MODELS = ['saaras:v3', 'saarika:v2.5'];

/** Languages Sarvam transcribes, as BCP-47 codes. Anything else is sent as "unknown" (auto-detect). */
const SARVAM_LANGS = new Set(['en-IN', 'hi-IN', 'bn-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'od-IN', 'pa-IN', 'ta-IN', 'te-IN']);

export function sarvamLanguage(code: string): string {
  const c = (code || '').trim();
  const norm = c.toLowerCase().startsWith('or') ? 'od-IN' : c.includes('-') ? `${c.split('-')[0].toLowerCase()}-IN` : `${c.toLowerCase()}-IN`;
  return SARVAM_LANGS.has(norm) ? norm : 'unknown';
}

export const sttConfigured = () => Boolean(process.env.SARVAM_API_KEY?.trim());
export const sttDailyLimit = () => Math.max(1, Math.min(200, Number(process.env.VOICE_STT_DAILY_LIMIT) || 15));

export interface Transcript { text: string; language: string | null; model: string }

/** Sends one short recording (under 30 seconds) to Sarvam and returns the text. */
export async function speechToText(audio: Buffer, mime: string, languageCode: string): Promise<Transcript> {
  const key = process.env.SARVAM_API_KEY?.trim();
  if (!key) throw new Error('Speech-to-text is not configured.');
  const type = (mime || 'audio/webm').split(';')[0];
  const ext = type.includes('mp4') || type.includes('m4a') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : type.includes('mpeg') ? 'mp3' : 'webm';
  let lastError = 'Speech-to-text failed.';
  for (const model of MODELS) {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type }), `voice.${ext}`);
    form.append('model', model);
    form.append('language_code', sarvamLanguage(languageCode));
    if (model.startsWith('saaras')) form.append('mode', 'transcribe');
    const res = await fetch(STT_URL, { method: 'POST', headers: { 'api-subscription-key': key }, body: form, signal: AbortSignal.timeout(25_000) });
    const body = await res.json().catch(() => ({})) as { transcript?: string; language_code?: string | null; error?: { message?: string } | string };
    if (res.ok && typeof body.transcript === 'string') return { text: body.transcript.trim(), language: body.language_code ?? null, model };
    lastError = `Sarvam HTTP ${res.status}: ${typeof body.error === 'string' ? body.error : body.error?.message ?? ''}`.trim();
    // Only a request problem (bad model or field) is worth retrying with the older model.
    if (![400, 404, 422].includes(res.status)) break;
  }
  throw new Error(lastError);
}

/** Uses one of today's voice credits for the signed-in user. Throws on an invalid session. */
export async function useVoiceCredit(token: string, kind: 'stt' | 'tts', limit: number): Promise<{ allowed: boolean; used: number; limit: number }> {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://agjbvoosukxfvrritgto.supabase.co').replace(/\/$/, '');
  const anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_KOdXB7LW5Ho5hDjsi3GMiw_xdogy5oR';
  const res = await fetch(`${url}/rest/v1/rpc/use_voice_credit`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_kind: kind, p_limit: limit }),
    signal: AbortSignal.timeout(8_000),
  });
  const body = await res.json().catch(() => null) as { allowed?: boolean; used?: number; limit?: number } | null;
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error('Sign in again to use voice.'), { status: 401 });
  if (!res.ok || !body || typeof body.allowed !== 'boolean') throw new Error(`Voice credit check failed (HTTP ${res.status}).`);
  return { allowed: body.allowed, used: Number(body.used ?? 0), limit: Number(body.limit ?? limit) };
}
