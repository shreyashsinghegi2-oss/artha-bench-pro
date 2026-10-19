/**
 * The user's reading preferences: knowledge level (beginner / intermediate / advanced), country and home
 * currency. Saved on this device from the required sign-up questions (and Account settings), sent with every
 * AI request so answers use the right words and the right currency, and used by voice to read amounts aloud.
 * Not personal financial data, so it is attached even when "Use my data" is off.
 */
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type NumberSystem = 'indian' | 'international';

export interface UserPrefs {
  level: Level;
  country: string;
  currency: string;
}

const KEY = 'arthamind.prefs.v1';
export const PREFS_EVENT = 'arthamind:prefs';
const DEFAULT: UserPrefs = { level: 'beginner', country: 'India', currency: 'INR' };

export function loadPrefs(): UserPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const p = JSON.parse(raw) as Partial<UserPrefs>;
    const level: Level = p.level === 'intermediate' || p.level === 'advanced' ? p.level : 'beginner';
    return { level, country: typeof p.country === 'string' && p.country ? p.country : DEFAULT.country, currency: typeof p.currency === 'string' && p.currency ? p.currency : DEFAULT.currency };
  } catch {
    return DEFAULT;
  }
}

export function savePrefs(next: Partial<UserPrefs>): UserPrefs {
  const merged = { ...loadPrefs(), ...next };
  try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* storage blocked */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: merged }));
  return merged;
}

/** Lakh/crore for rupees (and India's neighbours that use them); million/billion everywhere else. */
export function numberSystemFor(currency: string): NumberSystem {
  return ['INR', 'NPR', 'PKR', 'BDT', 'LKR'].includes(currency.toUpperCase()) ? 'indian' : 'international';
}

/** Countries offered in the sign-up questions, with their currency and symbol. */
export const COUNTRIES: Array<{ country: string; currency: string; symbol: string }> = [
  { country: 'India', currency: 'INR', symbol: '₹' },
  { country: 'United States', currency: 'USD', symbol: '$' },
  { country: 'United Kingdom', currency: 'GBP', symbol: '£' },
  { country: 'United Arab Emirates', currency: 'AED', symbol: 'AED ' },
  { country: 'Canada', currency: 'CAD', symbol: 'C$' },
  { country: 'Australia', currency: 'AUD', symbol: 'A$' },
  { country: 'Singapore', currency: 'SGD', symbol: 'S$' },
  { country: 'Germany', currency: 'EUR', symbol: '€' },
  { country: 'Saudi Arabia', currency: 'SAR', symbol: 'SAR ' },
  { country: 'Nepal', currency: 'NPR', symbol: 'Rs ' },
];

export const symbolFor = (currency: string) => COUNTRIES.find((c) => c.currency === currency)?.symbol ?? `${currency} `;

/** Rough rupees per unit, ONLY to scale the "does this number look real?" checks. Never shown as a price. */
export const ROUGH_INR_PER_UNIT: Record<string, number> = { INR: 1, USD: 85, GBP: 110, EUR: 95, AED: 23, CAD: 62, AUD: 56, SGD: 64, SAR: 23, NPR: 0.63 };

/** Full amount with the right grouping: ₹12,00,000 / $1,200,000. */
export function formatMoney(value: number, currency: string): string {
  const locale = numberSystemFor(currency) === 'indian' ? 'en-IN' : 'en-US';
  const sign = value < 0 ? '-' : '';
  return `${sign}${symbolFor(currency)}${Math.round(Math.abs(value)).toLocaleString(locale)}`;
}

/** Amount in easy words: "12 lakh", "1.5 crore", "1.2 million". */
export function moneyInWords(value: number, currency: string): string {
  const v = Math.abs(value);
  const fmt = (n: number) => (Math.round(n * 100) / 100).toString();
  if (numberSystemFor(currency) === 'indian') {
    if (v >= 1e7) return `${fmt(v / 1e7)} crore`;
    if (v >= 1e5) return `${fmt(v / 1e5)} lakh`;
    if (v >= 1e3) return `${fmt(v / 1e3)} thousand`;
    return fmt(v);
  }
  if (v >= 1e12) return `${fmt(v / 1e12)} trillion`;
  if (v >= 1e9) return `${fmt(v / 1e9)} billion`;
  if (v >= 1e6) return `${fmt(v / 1e6)} million`;
  if (v >= 1e3) return `${fmt(v / 1e3)} thousand`;
  return fmt(v);
}
