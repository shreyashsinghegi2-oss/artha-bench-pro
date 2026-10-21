import { buildCompleteDashboard } from './completeDashboard';
import { loadEmiRecords } from './emiStorage';
import { loadIncomeSources } from './incomeStorage';
import { loadMoneyProfile } from './moneyProfile';
import { MONEY_CHECK_ASSUMPTIONS } from './moneyCheck';
import { loadExpenses } from './personalFinanceStorage';

/** The freedom figures the dashboard shows, so every other answer can quote the same ones. */
export interface VerifiedFreedom {
  freedomAge: number | null;
  corpus: number;
  preRetirementReturn: number;
  inflation: number;
}

/** Null when the person has no saved money profile yet. */
export function verifiedFreedomFromStorage(): VerifiedFreedom | null {
  const profile = loadMoneyProfile();
  if (!profile) return null;
  try {
    const d = buildCompleteDashboard({ profile, loans: loadEmiRecords(), income: loadIncomeSources(), expenses: loadExpenses() });
    return {
      freedomAge: d.report.freedom.freedomAge,
      corpus: d.report.freedom.corpusNeeded,
      preRetirementReturn: MONEY_CHECK_ASSUMPTIONS.preRetirementReturn,
      inflation: MONEY_CHECK_ASSUMPTIONS.inflation,
    };
  } catch {
    return null;
  }
}

/**
 * Compares the age and the return an answer states with the verified figures. Returns a short correction
 * to show under the answer when they differ, or null when nothing conflicts.
 */
export function freedomConflict(answer: string, verified: VerifiedFreedom | null): string | null {
  if (!verified) return null;
  const notes: string[] = [];
  if (verified.freedomAge !== null) {
    const ages = [...answer.matchAll(/\bage\s+(\d{2})\b/gi)].map((m) => Number(m[1]));
    if (ages.some((a) => a !== verified.freedomAge)) {
      notes.push(`your verified financial-freedom age is ${verified.freedomAge}`);
    }
  }
  const returns = [...answer.matchAll(/(\d+(?:\.\d+)?)\s*%\s*(?:a year|annual|yearly|per year|return)/gi)].map((m) => Number(m[1]));
  const want = Math.round(verified.preRetirementReturn * 100);
  if (returns.some((r) => Math.abs(r - want) > 0.01)) {
    notes.push(`the platform uses ${want}% a year for pre-retirement growth`);
  }
  if (!notes.length) return null;
  return `Note: ${notes.join('; ')}. Figures on your dashboard are the verified ones.`;
}

/** Lines for the CFO prompt: quote these exactly, or state that no verified plan exists. */
export function freedomPromptLines(verified: VerifiedFreedom | null): string {
  if (!verified) return 'No verified freedom plan is available. Do not state a financial-freedom age, a freedom number or a return rate.';
  const age = verified.freedomAge === null ? 'not reached within the planning horizon' : `age ${verified.freedomAge}`;
  return `Verified freedom plan from the platform (quote exactly; never recalculate, invent or change it): freedom age ${age}, freedom number ₹${Math.round(verified.corpus).toLocaleString('en-IN')}, growth ${Math.round(verified.preRetirementReturn * 100)}% a year, inflation ${Math.round(verified.inflation * 100)}% a year.`;
}
