/**
 * The user's money profile: the answers from guided setup (or a scan), kept on this device only.
 * Every workspace page can read it, so nobody has to type the same amount twice.
 */
import type { MoneyCheckInputs } from './moneyCheck';

export interface MoneyProfile extends MoneyCheckInputs {
  updatedAt: string;
  /** How the numbers were collected, shown back to the user. */
  source: 'questions' | 'scan' | 'sample';
  /** Name to greet the user with (optional). */
  name?: string;
}

const KEY = 'arthamind.moneyProfile.v1';
const EVENT = 'arthamind:money-profile';

export function loadMoneyProfile(): MoneyProfile | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MoneyProfile;
    return typeof parsed?.annualSalary === 'number' && typeof parsed?.age === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveMoneyProfile(profile: MoneyProfile): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* storage unavailable: keep in memory only */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: profile }));
}

export function clearMoneyProfile(): void {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: null }));
}

export function onMoneyProfileChange(listener: (profile: MoneyProfile | null) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<MoneyProfile | null>).detail ?? null);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
