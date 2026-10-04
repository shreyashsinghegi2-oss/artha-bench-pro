import { describe, expect, it } from 'vitest';
import { offlineSnapshot, readAmount } from '../server/offlineSnapshot';

describe('offline snapshot', () => {
  it('reads grouped and shorthand amounts', () => {
    expect(readAmount('12,00,000')).toBe(1_200_000);
    expect(readAmount('₹5,000')).toBe(5_000);
    expect(readAmount('1.2 lakh')).toBe(120_000);
    expect(readAmount('85k')).toBe(85_000);
  });
  it('works out surplus and EMI load from the question', () => {
    const s = offlineSnapshot('I earn 12,00,000 a year, spend 20,000 a month, EMI 5,000. What should I do first?')!;
    expect(s.lines[0]).toContain('₹1,00,000');
    expect(s.lines.join(' ')).toContain('EMI load: ₹5,000 is 5.0%');
    expect(s.lines.join(' ')).toContain('= ₹75,000 (savings rate 75.0%');
    expect(s.lines.join(' ')).toContain('₹1,50,000');
    expect(s.lines.join(' ')).not.toMatch(/\d\s?(k|L|lakh|Cr)\b/);
  });
  it('returns nothing when there is no income in the question', () => {
    expect(offlineSnapshot('What is CAGR?')).toBeNull();
  });
});

describe('offline snapshot in Hindi', () => {
  it('understands Hindi words for salary, spending and EMI', () => {
    const s = offlineSnapshot('मेरी सैलरी 50,000 महीना है, खर्च 30,000 और ईएमआई 5,000 है')!;
    expect(s.lines.join(' ')).toContain('= ₹15,000');
  });
});
