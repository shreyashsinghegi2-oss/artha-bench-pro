import { describe, expect, it } from 'vitest';
import { inr, parseMoney, shortInr } from '../src/components/money/MoneyReport';
import { formatMarketAxis } from '../src/lib/charts/marketChartTheme';

describe('money display', () => {
  it('shows amounts in full Indian grouping, never k, L or Cr', () => {
    expect(shortInr(1_200_000)).toBe('₹12,00,000');
    expect(shortInr(20_000)).toBe('₹20,000');
    expect(shortInr(120_200)).toBe('₹1,20,200');
    expect(shortInr(-5_000)).toBe('−₹5,000');
    expect(inr(25_000_000)).toBe('₹2,50,00,000');
    expect(formatMarketAxis(24_512, 'INR')).toBe('₹24,512');
  });
  it('still accepts typed shorthand and grouped input', () => {
    expect(parseMoney('12,00,000')).toBe(1_200_000);
    expect(parseMoney('₹1,20,200')).toBe(120_200);
    expect(parseMoney('85k')).toBe(85_000);
    expect(parseMoney('1.2 lakh')).toBe(120_000);
  });
});
