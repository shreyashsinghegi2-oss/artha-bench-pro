/** Browser client for the advisory pipeline: streams layer progress from POST /api/advisor/ask. */
import type { UserProfile } from './context';
import type { AdvisorAnswer, LayerEvent } from './pipeline';
import type { MoneyProfile } from '../services/moneyProfile';

export interface AskResult {
  answer: AdvisorAnswer;
  audit: { id: string; share_id: string } | null;
  audit_note: string | null;
}

/** The on-device money profile, reduced to what the advisor uses. Zero means "not provided" for optional covers. */
export function toAdvisorProfile(p: MoneyProfile): UserProfile {
  const out: UserProfile = {
    age: Math.round(p.age),
    annual_income: p.annualSalary,
    monthly_expenses: p.monthlyExpenses,
    monthly_emi: p.monthlyEmi,
    liquid_savings: p.liquidSavings,
    investments: p.investments,
    dependants: Math.round(p.dependants),
  };
  if (p.termCover !== undefined) out.term_cover = p.termCover;
  if (p.healthCover !== undefined) out.health_cover = p.healthCover;
  if (p.section80C !== undefined) out.section_80c_used = p.section80C;
  if (p.npsExtra !== undefined) out.nps_extra_used = p.npsExtra;
  if (p.retireAge) out.retire_age = Math.round(p.retireAge);
  if (p.goalAmountToday && p.goalYears) out.goals = [{ name: 'Main goal', target_amount: p.goalAmountToday, years: p.goalYears }];
  return out;
}

export async function askAdvisor(
  question: string,
  opts: { token?: string | null; profile?: UserProfile | null; onLayer?: (e: LayerEvent) => void; signal?: AbortSignal },
): Promise<AskResult> {
  const res = await fetch('/api/advisor/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: JSON.stringify({ question, profile: opts.profile ?? null }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(
      body?.error?.message ?? (res.status === 429 ? 'Too many questions at once. Please wait a minute.' : `The advisor is unavailable (HTTP ${res.status}).`),
    );
  }
  if (!res.body) throw new Error('No response from the advisor.');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: AskResult | null = null;
  const handle = (line: string) => {
    if (!line.trim()) return;
    const msg = JSON.parse(line) as { type: string } & Record<string, unknown>;
    if (msg.type === 'layer') opts.onLayer?.(msg as unknown as LayerEvent);
    else if (msg.type === 'answer') result = msg as unknown as AskResult;
    else if (msg.type === 'error') throw new Error(String(msg.message ?? 'The advisor could not answer.'));
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf('\n');
    while (nl >= 0) {
      handle(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
      nl = buffer.indexOf('\n');
    }
  }
  handle(buffer);
  if (!result) throw new Error('The advisor stopped before answering. Please try again.');
  return result;
}

export async function shareAnswer(id: string, token: string): Promise<string> {
  const res = await fetch('/api/advisor/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id }),
  });
  const body = (await res.json().catch(() => null)) as { share_id?: string; error?: { message?: string } } | null;
  if (!res.ok || !body?.share_id) throw new Error(body?.error?.message ?? 'Could not create the share link.');
  return `${window.location.origin}/advice/${body.share_id}`;
}

export interface SharedAdviceView {
  question: string;
  created_at: string;
  answer: AdvisorAnswer;
}

export async function loadShared(shareId: string): Promise<SharedAdviceView> {
  const res = await fetch(`/api/advisor/shared/${encodeURIComponent(shareId)}`);
  const body = (await res.json().catch(() => null)) as (SharedAdviceView & { error?: { message?: string } }) | null;
  if (!res.ok || !body?.answer) throw new Error(body?.error?.message ?? 'Could not load this shared answer.');
  return body;
}
