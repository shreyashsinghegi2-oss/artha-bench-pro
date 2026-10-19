import { describe, expect, it } from 'vitest';
import { groupWords, speakNumbers } from '../src/lib/spokenNumbers';

describe('amounts read aloud', () => {
  it('uses lakh and crore for rupees', () => {
    expect(speakNumbers('You need ₹12,00,000 now.')).toBe('You need 12 lakh rupees now.');
    expect(speakNumbers('EMI ₹1,20,200 a month')).toBe('EMI 1 lakh 20 thousand 200 rupees a month');
    expect(speakNumbers('Corpus ₹2,50,00,000')).toBe('Corpus 2 crore 50 lakh rupees');
    expect(speakNumbers('Pay ₹64,145.72')).toBe('Pay 64 thousand 145 rupees 72 paise');
    expect(speakNumbers('Save ₹5 lakh and Rs. 50k')).toBe('Save 5 lakh rupees and 50 thousand rupees');
    expect(speakNumbers('INR 100000')).toBe('1 lakh rupees');
    expect(speakNumbers('₹1')).toBe('1 rupee');
  });
  it('uses million, billion and trillion for other currencies', () => {
    expect(speakNumbers('$1,200,000 saved')).toBe('1 million 200 thousand dollars saved');
    expect(speakNumbers('$2.5M fund')).toBe('2.5 million dollars fund');
    expect(speakNumbers('£3,000,000,000,000')).toBe('3 trillion pounds');
  });
  it('reads plain numbers by their grouping, long ones by the home system', () => {
    expect(speakNumbers('12,00,000 people')).toBe('12 lakh people');
    expect(speakNumbers('1,500,000 people')).toBe('1 million 500 thousand people');
    expect(speakNumbers('100000 users', 'indian')).toBe('1 lakh users');
    expect(speakNumbers('100000 users', 'international')).toBe('100 thousand users');
  });
  it('leaves years, percentages and small numbers alone', () => {
    expect(speakNumbers('In 2026, returns were 12.5% over 15 years')).toBe('In 2026, returns were 12.5% over 15 years');
    expect(speakNumbers('₹500 to spend')).toBe('500 rupees to spend');
  });
  it('splits large values exactly', () => {
    expect(groupWords(12_34_56_789, 'indian')).toBe('12 crore 34 lakh 56 thousand 789');
    expect(groupWords(1_234_567_890, 'international')).toBe('1 billion 234 million 567 thousand 890');
  });
});
