import { describe, expect, it } from 'vitest';
import { ttsChunks, VOICE_LANGS } from '../server/voiceService';
import { VOICE_LANGUAGES } from '../src/services/voice';

describe('server voice', () => {
  it('splits long text into short speech pieces, danda-aware, without symbols', () => {
    const hi = 'पहले इमरजेंसी फंड बनाइए। फिर SIP शुरू कीजिए। **कर्ज़** जल्दी चुकाइए।';
    expect(ttsChunks(hi)).toEqual(['पहले इमरजेंसी फंड बनाइए।', 'फिर SIP शुरू कीजिए।', 'कर्ज़ जल्दी चुकाइए।']);
    const long = ttsChunks('word '.repeat(200));
    expect(long.every((c) => c.length <= 180)).toBe(true);
    expect(ttsChunks('x'.repeat(5000)).join('').length).toBeLessThanOrEqual(3000);
  });
  it('supports every language in the voice picker', () => {
    for (const l of VOICE_LANGUAGES) expect(VOICE_LANGS[l.code.split('-')[0]], l.name).toBeTruthy();
  });
});
