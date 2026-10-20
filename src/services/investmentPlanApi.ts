import type { InvestmentPlan, PlanInput } from '../../server/investmentPlan';
import type { CompleteDashboard } from './completeDashboard';
import type { MoneyProfile } from './moneyProfile';
import type { OnboardingRecord } from './onboarding';

export type { InvestmentPlan, PlanInput };

/** Reads the person's own answers into the plan's inputs. Nothing here is guessed: missing answers use plain defaults. */
export function planInputFrom(profile: MoneyProfile, d: CompleteDashboard, record: OnboardingRecord | null): PlanInput {
  const a = record?.answers ?? {};
  const risk = record?.result.risk === 'careful' ? 'low' : record?.result.risk === 'bold' ? 'high' : 'moderate';
  const retireYears = Math.max(1, (profile.retireAge ?? 60) - profile.age);
  return {
    age: profile.age,
    monthlySurplus: Math.round(d.monthlySurplus.value),
    risk,
    horizonYears: Math.min(40, Math.max(1, a.goalYears ?? retireYears)),
    emergencyGap: Math.max(0, Math.round(d.report.emergency.gap)),
    highCostDebt: (a.creditCardDue ?? 0) > 0,
  };
}

const CACHE_KEY = 'arthamind.investmentPlan.v1';
const CACHE_MS = 6 * 60 * 60 * 1000;

/** The same answers give the same plan for six hours, so visiting the dashboard again costs no network call. */
export async function fetchInvestmentPlan(input: PlanInput, signal?: AbortSignal): Promise<InvestmentPlan> {
  const key = JSON.stringify(input);
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as { key: string; at: number; plan: InvestmentPlan } | null;
    if (cached && cached.key === key && Date.now() - cached.at < CACHE_MS) return cached.plan;
  } catch { /* storage unavailable: fetch again */ }
  const res = await fetch('/api/plan/investments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as InvestmentPlan & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Fund data is unavailable right now. Try again shortly.');
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ key, at: Date.now(), plan: data })); } catch { /* storage full */ }
  return data;
}
