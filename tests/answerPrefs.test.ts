import { describe, expect, it } from 'vitest';
import { numberStyleFor, parsePrefs, NUMBER_STYLE } from '../server/liveGrounding';

describe('answer level and currency', () => {
  it('reads the prefs header safely', () => {
    expect(parsePrefs('{"level":"advanced","country":"United States","currency":"USD"}')).toEqual({ level: 'advanced', country: 'United States', currency: 'USD' });
    expect(parsePrefs('{"level":"hacker","currency":"<x>"}')).toEqual({ level: 'beginner', country: 'India', currency: 'INR' });
    expect(parsePrefs('not json')).toBeUndefined();
  });
  it('uses lakh/crore for rupees, million for dollars, and the question’s currency first', () => {
    const inr = numberStyleFor({ level: 'beginner', country: 'India', currency: 'INR' });
    expect(inr).toContain('12 lakh');
    expect(inr).toContain('10-year-old');
    const usd = numberStyleFor({ level: 'advanced', country: 'United States', currency: 'USD' });
    expect(usd).toContain('1.2 million');
    expect(usd).toContain('answer in THAT currency');
    expect(numberStyleFor(undefined)).toBe(NUMBER_STYLE);
  });
});

describe('answer language', () => {
  it('asks for the chosen language and ignores bad codes', () => {
    expect(numberStyleFor(parsePrefs('{"level":"beginner","country":"India","currency":"INR","language":"hi-IN"}'))).toContain('everyday Hindi');
    expect(parsePrefs('{"language":"<script>"}')?.language).toBeUndefined();
    expect(numberStyleFor(parsePrefs('{"language":"en-IN"}'))).not.toContain('LANGUAGE:');
  });
});
