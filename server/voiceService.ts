/**
 * Voice for every assistant, on every device: translation into the listener's language and
 * speech audio (MP3) generated on the server, so it works even when a phone has no Hindi or
 * Marathi voice installed, and the user can download it as a voice note.
 *
 * Speech: Google Cloud Text-to-Speech when GOOGLE_TTS_API_KEY is set (official, recommended);
 * otherwise Google Translate's public speech endpoint (no key, unofficial, may be rate-limited).
 * Translation: the AI model (Groq) when configured; otherwise Google Translate's public endpoint.
 */
import { callGroqChat } from './groqService';

export const VOICE_LANGS: Record<string, { name: string; tts: string; cloud: string }> = {
  en: { name: 'English', tts: 'en', cloud: 'en-IN' },
  hi: { name: 'Hindi', tts: 'hi', cloud: 'hi-IN' },
  bn: { name: 'Bengali', tts: 'bn', cloud: 'bn-IN' },
  mr: { name: 'Marathi', tts: 'mr', cloud: 'mr-IN' },
  te: { name: 'Telugu', tts: 'te', cloud: 'te-IN' },
  ta: { name: 'Tamil', tts: 'ta', cloud: 'ta-IN' },
  gu: { name: 'Gujarati', tts: 'gu', cloud: 'gu-IN' },
  ur: { name: 'Urdu', tts: 'ur', cloud: 'ur-IN' },
  kn: { name: 'Kannada', tts: 'kn', cloud: 'kn-IN' },
  ml: { name: 'Malayalam', tts: 'ml', cloud: 'ml-IN' },
  pa: { name: 'Punjabi', tts: 'pa', cloud: 'pa-IN' },
  or: { name: 'Odia', tts: 'or', cloud: 'or-IN' },
  as: { name: 'Assamese', tts: 'as', cloud: 'as-IN' },
};

const MAX_TEXT = 3000;

/** Short pieces on sentence ends (including the danda), then commas, then spaces. */
export function ttsChunks(text: string, max = 180): string[] {
  const clean = text.replace(/[*_#`>|[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  const out: string[] = [];
  for (const sentence of clean.split(/(?<=[.!?।॥؟])\s+/)) {
    let rest = sentence.trim();
    while (rest.length > max) {
      const cut = Math.max(rest.lastIndexOf(',', max), rest.lastIndexOf(' ', max));
      const at = cut > 30 ? cut + 1 : max;
      out.push(rest.slice(0, at).trim()); rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

async function cloudTts(chunk: string, languageCode: string, rate: number): Promise<Buffer> {
  const key = process.env.GOOGLE_TTS_API_KEY!.trim();
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ input: { text: chunk }, voice: { languageCode }, audioConfig: { audioEncoding: 'MP3', speakingRate: rate } }),
  });
  if (!res.ok) throw new Error(`Cloud TTS HTTP ${res.status}`);
  const body = await res.json() as { audioContent?: string };
  if (!body.audioContent) throw new Error('Cloud TTS returned no audio');
  return Buffer.from(body.audioContent, 'base64');
}

async function publicTts(chunk: string, tl: string, rate: number): Promise<Buffer> {
  const url = new URL('https://translate.google.com/translate_tts');
  url.searchParams.set('ie', 'UTF-8'); url.searchParams.set('client', 'tw-ob'); url.searchParams.set('tl', tl);
  url.searchParams.set('q', chunk); url.searchParams.set('ttsspeed', rate < 0.9 ? '0.24' : '1');
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Referer: 'https://translate.google.com/' }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Speech service HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!type.includes('audio')) throw new Error('Speech service did not return audio');
  return Buffer.from(await res.arrayBuffer());
}

/** MP3 audio for the text. MP3 frames can be joined, so chunks become one voice note. */
export async function synthesize(text: string, lang: string, rate = 1): Promise<{ audio: Buffer; provider: string }> {
  const l = VOICE_LANGS[lang];
  if (!l) throw new Error('Unsupported language.');
  const chunks = ttsChunks(text);
  if (!chunks.length) throw new Error('Nothing to read.');
  const useCloud = Boolean(process.env.GOOGLE_TTS_API_KEY?.trim());
  const parts: Buffer[] = [];
  // Sequential, so long answers do not trip the speech service's limits.
  for (const c of chunks) parts.push(useCloud ? await cloudTts(c, l.cloud, rate) : await publicTts(c, l.tts, rate));
  return { audio: Buffer.concat(parts), provider: useCloud ? 'Google Cloud Text-to-Speech' : 'Google Translate speech' };
}

async function publicTranslate(text: string, tl: string): Promise<string> {
  const pieces: string[] = [];
  // The public endpoint accepts short texts; translate paragraph by paragraph.
  for (const para of text.split(/\n{1,}/).filter((p) => p.trim())) {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx'); url.searchParams.set('sl', 'auto'); url.searchParams.set('tl', tl); url.searchParams.set('dt', 't'); url.searchParams.set('q', para.slice(0, 1800));
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`Translation HTTP ${res.status}`);
    const body = await res.json() as unknown[];
    const segs = Array.isArray(body[0]) ? (body[0] as unknown[][]).map((s) => String(s[0] ?? '')).join('') : '';
    if (!segs) throw new Error('Translation returned nothing');
    pieces.push(segs);
  }
  return pieces.join('\n');
}

/** Translate for a listener; numbers keep Indian grouping. */
export async function translateText(text: string, lang: string): Promise<{ text: string; provider: string }> {
  const l = VOICE_LANGS[lang];
  if (!l) throw new Error('Unsupported language.');
  const src = text.trim().slice(0, MAX_TEXT);
  if (lang === 'en' && /^[\x00-\x7F₹\s]*$/.test(src)) return { text: src, provider: 'none' };
  if (process.env.GROQ_API_KEY?.trim()) {
    try {
      const out = await callGroqChat(
        `You translate personal-finance answers for Indian families. Translate the user's text into simple, everyday ${l.name}${lang === 'en' ? '' : ` in its own script`}, the way a patient family elder would say it aloud. Keep every number and amount exactly, in digits with Indian grouping (₹12,00,000). Keep names of funds, companies and schemes as they are. Output only the translation, no notes.`,
        src,
      );
      if (out && out.trim().length > 5 && !/unavailable|fallback/i.test(out.slice(0, 80))) return { text: out.trim(), provider: 'AI translation' };
    } catch { /* fall back */ }
  }
  return { text: await publicTranslate(src, l.tts), provider: 'Google Translate' };
}
