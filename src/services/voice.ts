/**
 * Voice for the AI CFO, using only what the browser provides: speech recognition to hear the question
 * and speech synthesis to read the answer. Nothing is recorded or stored by ArthaMind; on Chrome and
 * Edge the browser's own speech service turns speech into text.
 */

export interface VoiceLanguage {
  /** BCP-47 tag used for recognition and voices. */
  code: string;
  /** Name sent to the AI (must match REPLY_LANGUAGES on the server). */
  name: string;
  /** Name in its own script, for the picker. */
  native: string;
  /** Site language code from the language selector, when there is one. */
  site?: string;
}

export const VOICE_LANGUAGES: VoiceLanguage[] = [
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी', site: 'hi' },
  { code: 'en-IN', name: 'English', native: 'English', site: 'en' },
  { code: 'bn-IN', name: 'Bengali', native: 'বাংলা', site: 'bn' },
  { code: 'mr-IN', name: 'Marathi', native: 'मराठी', site: 'mr' },
  { code: 'te-IN', name: 'Telugu', native: 'తెలుగు', site: 'te' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்', site: 'ta' },
  { code: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી', site: 'gu' },
  { code: 'ur-IN', name: 'Urdu', native: 'اردو', site: 'ur' },
  { code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ', site: 'kn' },
  { code: 'ml-IN', name: 'Malayalam', native: 'മലയാളം', site: 'ml' },
  { code: 'pa-IN', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', site: 'pa' },
  { code: 'or-IN', name: 'Odia', native: 'ଓଡ଼ିଆ', site: 'or' },
  { code: 'as-IN', name: 'Assamese', native: 'অসমীয়া', site: 'as' },
];

export const voiceLanguageFor = (siteCode: string) => VOICE_LANGUAGES.find((l) => l.site === siteCode);

// ---------------- Speech recognition ----------------

interface RecognitionResultList { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } }
interface RecognitionEvent { resultIndex: number; results: RecognitionResultList }
interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = () => recognitionCtor() !== null;
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

const LISTEN_ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone permission was blocked. Allow the microphone for this site in your browser settings.',
  'service-not-allowed': 'Microphone permission was blocked. Allow the microphone for this site in your browser settings.',
  'no-speech': 'I did not hear anything. Tap the mic and speak a little closer.',
  'audio-capture': 'No microphone was found on this device.',
  network: 'Speech recognition needs an internet connection.',
  'language-not-supported': 'This browser cannot recognise speech in this language yet. Please type your question.',
};

/** Listen once. Calls onText with live text; resolves with the final text ('' if nothing was heard). */
export function listenOnce(lang: string, onText: (text: string) => void): { done: Promise<string>; stop: () => void } {
  const Ctor = recognitionCtor();
  if (!Ctor) return { done: Promise.reject(new Error('Voice input works in Chrome or Edge. Please type your question.')), stop: () => undefined };
  const rec = new Ctor();
  rec.lang = lang; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  let finalText = '', failure: string | null = null;
  const done = new Promise<string>((resolve, reject) => {
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      onText((finalText + interim).trim());
    };
    rec.onerror = (e) => { if (e.error !== 'aborted') failure = LISTEN_ERRORS[e.error] ?? 'Voice input stopped. Please try again or type your question.'; };
    rec.onend = () => (failure && !finalText.trim() ? reject(new Error(failure)) : resolve(finalText.trim()));
  });
  try { rec.start(); } catch { /* already started */ }
  return { done, stop: () => { try { rec.stop(); } catch { /* ignore */ } } };
}

// ---------------- Speech synthesis ----------------

export function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  if (!canSpeak()) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const finish = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
    window.setTimeout(finish, 1500);
  });
}

/** Best installed voice for a language: exact region first, then any voice of that language; Google/natural voices preferred. */
export function pickVoice(voices: SpeechSynthesisVoice[], code: string): SpeechSynthesisVoice | null {
  const norm = (s: string) => s.replace('_', '-').toLowerCase();
  const want = norm(code), base = want.split('-')[0];
  const score = (v: SpeechSynthesisVoice) => (/(google|natural|neural|online)/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  const exact = voices.filter((v) => norm(v.lang) === want);
  const same = exact.length ? exact : voices.filter((v) => norm(v.lang).split('-')[0] === base);
  return same.sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Text that reads well aloud: no markdown, symbols or bracketed references. */
export function speakableText(text: string): string {
  return text
    .replace(/\[[0-9]+\]/g, '')
    .replace(/[*_#`>|]/g, ' ')
    .replace(/\s*[•·–—]\s*/g, '. ')
    .replace(/\(([^)]{0,3})\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split into short pieces on sentence ends (including the Hindi danda) so long answers are not cut off. */
export function speechChunks(text: string, max = 180): string[] {
  const parts = speakableText(text).split(/(?<=[.!?।॥؟])\s+/).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (p.length <= max) { out.push(p); continue; }
    let rest = p;
    while (rest.length > max) {
      const cut = Math.max(rest.lastIndexOf(',', max), rest.lastIndexOf(' ', max));
      const at = cut > 40 ? cut + 1 : max;
      out.push(rest.slice(0, at).trim()); rest = rest.slice(at);
    }
    if (rest.trim()) out.push(rest.trim());
  }
  return out;
}

/** Read text aloud with the given voice. Resolves when finished or stopped. */
export function speak(text: string, voice: SpeechSynthesisVoice, rate = 0.95, onProgress?: (index: number, total: number) => void): Promise<void> {
  const synth = window.speechSynthesis;
  synth.cancel();
  const chunks = speechChunks(text);
  return new Promise((resolve) => {
    let i = 0;
    const next = () => {
      if (i >= chunks.length) return resolve();
      const u = new SpeechSynthesisUtterance(chunks[i]);
      u.voice = voice; u.lang = voice.lang; u.rate = rate; u.pitch = 1;
      onProgress?.(i, chunks.length);
      u.onend = () => { i++; next(); };
      u.onerror = () => resolve();
      synth.speak(u);
    };
    next();
  });
}

export const stopSpeaking = () => { if (canSpeak()) window.speechSynthesis.cancel(); };

// ---------------- Server voice (works on every device) ----------------

/** Two-letter code used by the server voice routes, e.g. 'hi-IN' → 'hi'. */
export const shortCode = (code: string) => code.split('-')[0];

export async function translateFor(text: string, code: string): Promise<string> {
  const res = await fetch('/api/voice/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.slice(0, 3000), lang: shortCode(code) }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.text) throw new Error(data.error || 'Translation is unavailable right now.');
  return String(data.text);
}

/** MP3 voice note for the text, generated on the server (no installed voice needed). */
export async function cloudSpeech(text: string, code: string, rate = 1): Promise<Blob> {
  const res = await fetch('/api/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: speakableText(text).slice(0, 3000), lang: shortCode(code), rate }) });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Voice is unavailable right now.'); }
  const blob = await res.blob();
  if (!blob.size) throw new Error('Voice is unavailable right now.');
  return blob;
}

let currentAudio: HTMLAudioElement | null = null;
/** Play an audio blob; stops anything already playing. Resolves when it ends or is stopped. */
export function playBlob(blob: Blob, onEnd?: () => void): () => void {
  stopAudio();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  const finish = () => { if (currentAudio === audio) currentAudio = null; onEnd?.(); };
  audio.onended = finish; audio.onerror = finish;
  void audio.play().catch(finish);
  return () => { audio.pause(); finish(); };
}
export const stopAudio = () => { if (currentAudio) { currentAudio.pause(); currentAudio = null; } stopSpeaking(); };

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
