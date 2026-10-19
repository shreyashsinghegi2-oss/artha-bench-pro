/**
 * Makes amounts sound right when read aloud. Speech engines read "₹12,00,000" as "twelve, zero zero,
 * zero zero zero" and "100000" as "one hundred thousand". This rewrites them first:
 *   ₹12,00,000   → "12 lakh rupees"            (lakh / crore for rupees)
 *   ₹1,20,200    → "1 lakh 20 thousand 200 rupees"
 *   $1,200,000   → "1 million 200 thousand dollars"   (million / billion / trillion elsewhere)
 *   ₹64,145.72   → "64 thousand 145 rupees 72 paise"
 *   ₹5 lakh, $2.5M, ₹50k → "5 lakh rupees", "2.5 million dollars", "50 thousand rupees"
 * Plain numbers with 2-digit groups (12,00,000) use lakh/crore, 3-digit groups (1,200,000) use million;
 * long ungrouped numbers (100000) follow the user's home system. Years (1900–2100) and percentages stay.
 */
import type { NumberSystem } from '../services/userPrefs';

const CURRENCY: Array<{ re: string; name: [string, string]; cents: string; system: NumberSystem }> = [
  { re: '₹|Rs\\.?|INR', name: ['rupee', 'rupees'], cents: 'paise', system: 'indian' },
  { re: 'US\\$|\\$|USD', name: ['dollar', 'dollars'], cents: 'cents', system: 'international' },
  { re: '£|GBP', name: ['pound', 'pounds'], cents: 'pence', system: 'international' },
  { re: '€|EUR', name: ['euro', 'euros'], cents: 'cents', system: 'international' },
  { re: 'AED', name: ['dirham', 'dirhams'], cents: 'fils', system: 'international' },
];

const UNITS: Record<string, number> = {
  k: 1e3, thousand: 1e3, l: 1e5, lac: 1e5, lacs: 1e5, lakh: 1e5, lakhs: 1e5, cr: 1e7, crore: 1e7, crores: 1e7,
  m: 1e6, mn: 1e6, million: 1e6, millions: 1e6, b: 1e9, bn: 1e9, billion: 1e9, billions: 1e9, t: 1e12, tn: 1e12, trillion: 1e12,
};
const UNIT_RE = '(?:\\s?(k|thousand|lakhs?|lacs?|l|crores?|cr|mn|m|millions?|bn|b|billions?|tn|t|trillion))?\\b';

/** Whole number in words-with-digits: 1234567 → "12 lakh 34 thousand 567" or "1 million 234 thousand 567". */
export function groupWords(n: number, system: NumberSystem): string {
  let rest = Math.round(Math.abs(n));
  if (rest === 0) return '0';
  const scale: Array<[number, string]> = system === 'indian'
    ? [[1e7, 'crore'], [1e5, 'lakh'], [1e3, 'thousand']]
    : [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
  const parts: string[] = [];
  for (const [size, word] of scale) {
    if (rest >= size) {
      const count = Math.floor(rest / size);
      // Above 99 crore keep the crore count readable: "1,250 crore" → "1 thousand 250 crore".
      parts.push(`${size === 1e7 && count >= 1000 ? groupWords(count, 'international') : count} ${word}`);
      rest -= count * size;
    }
  }
  if (rest > 0) parts.push(String(rest));
  return parts.join(' ');
}

/** A decimal amount with a unit ("2.5 lakh") stays short; otherwise the full grouped form. */
function amountWords(value: number, system: NumberSystem, unitWord?: string): string {
  if (unitWord) {
    const shown = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
    const u = UNITS[unitWord.toLowerCase()];
    const word = u === 1e3 ? 'thousand' : u === 1e5 ? 'lakh' : u === 1e7 ? 'crore' : u === 1e6 ? 'million' : u === 1e9 ? 'billion' : 'trillion';
    return `${shown} ${word}`;
  }
  return groupWords(value, system);
}

const toNumber = (digits: string) => Number(digits.replace(/,/g, ''));

export function speakNumbers(text: string, home: NumberSystem = 'indian'): string {
  let out = text;
  // 1) Amounts with a currency sign or code, before or after the number.
  for (const c of CURRENCY) {
    const before = new RegExp(`(?:${c.re})\\s?(-?\\d[\\d,]*)(?:\\.(\\d{1,2}))?${UNIT_RE}`, 'gi');
    out = out.replace(before, (_m, whole: string, frac: string | undefined, unit: string | undefined) => {
      const value = toNumber(whole);
      if (!Number.isFinite(value)) return _m;
      if (unit) {
        const full = Number(`${whole.replace(/,/g, '')}${frac ? `.${frac}` : ''}`);
        return `${amountWords(full, c.system, unit)} ${c.name[1]}`;
      }
      const words = `${groupWords(value, c.system)} ${value === 1 ? c.name[0] : c.name[1]}`;
      const cents = frac ? Number(frac.padEnd(2, '0')) : 0;
      return cents ? `${words} ${cents} ${c.cents}` : words;
    });
  }
  // 2) Plain grouped numbers: 12,00,000 (Indian groups) or 1,200,000 (international groups).
  out = out.replace(/\b\d{1,3}(?:,\d{2})+,\d{3}\b|\b\d{1,3}(?:,\d{3})+\b/g, (m) => {
    const indian = /^\d{1,3}(?:,\d{2})+,\d{3}$/.test(m) && !/^\d{1,3}(?:,\d{3})+$/.test(m);
    return groupWords(toNumber(m), indian ? 'indian' : 'international');
  });
  // 3) Long ungrouped whole numbers (5+ digits, not part of a decimal or code): home system.
  out = out.replace(/(?<![\d.,])\d{5,15}(?![\d.,]\d)/g, (m) => groupWords(Number(m), home));
  return out;
}
