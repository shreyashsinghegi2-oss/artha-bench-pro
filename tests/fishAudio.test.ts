import { afterEach, describe, expect, it, vi } from 'vitest';
import { fishConfigured, fishLanguages, fishTts, synthesize } from '../server/voiceService';

const MP3 = new Uint8Array(2048).fill(0xff);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Fish Audio TTS', () => {
  it('is used only when the key is set, for the configured languages (default en, hi)', () => {
    vi.stubEnv('FISH_AUDIO_API_KEY', '');
    expect(fishConfigured('en')).toBe(false);
    vi.stubEnv('FISH_AUDIO_API_KEY', 'k');
    expect(fishConfigured('en')).toBe(true);
    expect(fishConfigured('hi')).toBe(true);
    expect(fishConfigured('ta')).toBe(false);
    vi.stubEnv('FISH_AUDIO_LANGS', 'en, ta, xx');
    expect([...fishLanguages()]).toEqual(['en', 'ta']);
  });

  it('sends the key, text, MP3 format, speed and optional voice and model', async () => {
    vi.stubEnv('FISH_AUDIO_API_KEY', 'fish-key');
    vi.stubEnv('FISH_AUDIO_VOICE_ID', 'voice-123');
    vi.stubEnv('FISH_AUDIO_MODEL', 's1');
    let url = '';
    let init: RequestInit | undefined;
    const fetchImpl = (async (u: string | URL | Request, i?: RequestInit) => {
      url = String(u);
      init = i;
      return new Response(MP3, { headers: { 'content-type': 'audio/mpeg' } });
    }) as typeof fetch;
    const audio = await fishTts('**Your EMI** is ₹8,678.23 a month.', 1.1, fetchImpl);
    expect(audio.length).toBe(2048);
    expect(url).toBe('https://api.fish.audio/v1/tts');
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer fish-key');
    expect(headers.model).toBe('s1');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ text: 'Your EMI is ₹8,678.23 a month.', format: 'mp3', reference_id: 'voice-123', prosody: { speed: 1.1 } });
  });

  it('omits the voice and model when not configured', async () => {
    vi.stubEnv('FISH_AUDIO_API_KEY', 'fish-key');
    let init: RequestInit | undefined;
    await fishTts('Hello', 1, (async (_u: string | URL | Request, i?: RequestInit) => {
      init = i;
      return new Response(MP3, { headers: { 'content-type': 'audio/mpeg' } });
    }) as typeof fetch);
    expect((init?.headers as Record<string, string>).model).toBeUndefined();
    expect(JSON.parse(String(init?.body)).reference_id).toBeUndefined();
  });

  it('rejects errors, JSON replies and empty clips', async () => {
    vi.stubEnv('FISH_AUDIO_API_KEY', 'k');
    await expect(fishTts('Hi', 1, (async () => new Response('{}', { status: 402 })) as typeof fetch)).rejects.toThrow(/402/);
    await expect(fishTts('Hi', 1, (async () => new Response('{"error":"x"}', { headers: { 'content-type': 'application/json' } })) as typeof fetch)).rejects.toThrow(/did not return audio/);
    await expect(fishTts('Hi', 1, (async () => new Response(new Uint8Array(10), { headers: { 'content-type': 'audio/mpeg' } })) as typeof fetch)).rejects.toThrow(/empty/);
  });

  it('synthesize uses Fish Audio first and falls back to Google speech if it fails', async () => {
    vi.stubEnv('FISH_AUDIO_API_KEY', 'k');
    vi.stubEnv('GOOGLE_TTS_API_KEY', '');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', async (u: string | URL | Request) => (String(u).includes('fish.audio') ? new Response(MP3, { headers: { 'content-type': 'audio/mpeg' } }) : new Response('no', { status: 500 })));
    expect((await synthesize('Your plan is on track.', 'en')).provider).toBe('Fish Audio');

    vi.stubGlobal('fetch', async (u: string | URL | Request) => (String(u).includes('fish.audio') ? new Response('{}', { status: 402 }) : new Response(MP3, { headers: { 'content-type': 'audio/mpeg' } })));
    expect((await synthesize('Your plan is on track.', 'en')).provider).toBe('Google Translate speech');
  });

  it('languages outside FISH_AUDIO_LANGS go straight to Google', async () => {
    vi.stubEnv('FISH_AUDIO_API_KEY', 'k');
    vi.stubEnv('GOOGLE_TTS_API_KEY', '');
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (u: string | URL | Request) => {
      calls.push(String(u));
      return new Response(MP3, { headers: { 'content-type': 'audio/mpeg' } });
    });
    expect((await synthesize('வணக்கம்', 'ta')).provider).toBe('Google Translate speech');
    expect(calls.some((c) => c.includes('fish.audio'))).toBe(false);
  });
});
