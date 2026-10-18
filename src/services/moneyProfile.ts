/**
 * The user's money profile: the answers from guided setup (or a scan), kept on this device only.
 * Every workspace page can read it, so nobody has to type the same amount twice.
 */
import type { MoneyCheckInputs } from './moneyCheck';
import { clearProfileSeeds, syncProfileToWorkspace } from './workspaceSync';

export interface MoneyProfile extends MoneyCheckInputs {
  updatedAt: string;
  /** How the numbers were collected, shown back to the user. */
  source: 'questions' | 'scan' | 'sample';
  /** Name to greet the user with (optional). */
  name?: string;
}

const KEY = 'arthamind.moneyProfile.v1';
/** Landing Money Check numbers waiting for sign-in (sessionStorage, this tab only). */
export const PENDING_MONEY_CHECK_KEY = 'arthamind.pendingMoneyCheck.v1';
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
  // Fill Income, Expenses, Budget, EMIs and Tax from the profile so no module asks for the same numbers.
  try { if (profile.source !== 'sample') syncProfileToWorkspace(profile); } catch { /* a module's storage is unavailable */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: profile }));
}

export function clearMoneyProfile(): void {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
  try { clearProfileSeeds(); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: null }));
}

export function onMoneyProfileChange(listener: (profile: MoneyProfile | null) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<MoneyProfile | null>).detail ?? null);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/**
 * Portfolio → profile: investments, cash/FDs and loans from the portfolio replace the typed estimates, so
 * Money Home, the dashboard and every planner use the real holdings. Does nothing without a profile.
 */
export function updateProfileFromPortfolio(totals: { investments: number; liquid: number; loans: number }): void {
  const p = loadMoneyProfile();
  if (!p || p.source === 'sample') return;
  const next: MoneyProfile = {
    ...p,
    investments: totals.investments > 0 ? Math.round(totals.investments) : p.investments,
    liquidSavings: totals.liquid > 0 ? Math.round(totals.liquid) : p.liquidSavings,
    loanOutstanding: totals.loans > 0 ? Math.round(totals.loans) : p.loanOutstanding,
  };
  if (next.investments === p.investments && next.liquidSavings === p.liquidSavings && next.loanOutstanding === p.loanOutstanding) return;
  saveMoneyProfile({ ...next, updatedAt: new Date().toISOString() });
}

/** After sign-in: a Money Check saved from the landing page becomes the profile (if there is none yet). */
export function importPendingMoneyCheck(): boolean {
  try {
    const raw = window.sessionStorage.getItem(PENDING_MONEY_CHECK_KEY);
    if (!raw) return false;
    window.sessionStorage.removeItem(PENDING_MONEY_CHECK_KEY);
    const inputs = JSON.parse(raw) as MoneyCheckInputs;
    if (typeof inputs?.annualSalary !== 'number' || typeof inputs?.age !== 'number') return false;
    const current = loadMoneyProfile();
    if (current && current.source !== 'sample') return false;
    saveMoneyProfile({ ...inputs, source: 'questions', updatedAt: new Date().toISOString() });
    return true;
  } catch {
    return false;
  }
}
