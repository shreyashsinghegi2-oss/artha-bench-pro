import { describe, expect, it } from 'vitest';
import { sarvamLanguage, sttDailyLimit } from '../server/sarvamService';

describe('voice limits', () => {
  it('maps app language codes to Sarvam codes', () => {
    expect(sarvamLanguage('hi-IN')).toBe('hi-IN');
    expect(sarvamLanguage('or-IN')).toBe('od-IN');
    expect(sarvamLanguage('ta')).toBe('ta-IN');
    expect(sarvamLanguage('ur-IN')).toBe('unknown');
    expect(sarvamLanguage('as-IN')).toBe('unknown');
  });

  it('defaults to 15 voice questions a day and caps the setting', () => {
    const before = process.env.VOICE_STT_DAILY_LIMIT;
    delete process.env.VOICE_STT_DAILY_LIMIT;
    expect(sttDailyLimit()).toBe(15);
    process.env.VOICE_STT_DAILY_LIMIT = '5000';
    expect(sttDailyLimit()).toBe(200);
    if (before === undefined) delete process.env.VOICE_STT_DAILY_LIMIT; else process.env.VOICE_STT_DAILY_LIMIT = before;
  });
});
