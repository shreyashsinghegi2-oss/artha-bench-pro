import { describe, expect, it } from 'vitest';
import { currentDateContext, withDateContext } from '../server/dateContext';

describe('AI current-date context', () => {
  it('states the IST date and the running Indian financial year', () => {
    const text = currentDateContext(new Date('2026-09-23T10:00:00Z'));
    expect(text).toContain('23 September 2026');
    expect(text).toContain('FY 2026-27');
    expect(text).toContain('assessment year 2027-28');
  });

  it('rolls the financial year on 1 April IST, not UTC', () => {
    // 31 March 2026 20:00 UTC is already 1 April 01:30 in India.
    expect(currentDateContext(new Date('2026-03-31T20:00:00Z'))).toContain('FY 2026-27');
    expect(currentDateContext(new Date('2026-03-31T10:00:00Z'))).toContain('FY 2025-26');
  });

  it('prefixes the system prompt without changing it', () => {
    const out = withDateContext('You are ArthaMind.', new Date('2026-09-23T10:00:00Z'));
    expect(out.endsWith('\n\nYou are ArthaMind.')).toBe(true);
    expect(out.startsWith('Current date:')).toBe(true);
  });
});
