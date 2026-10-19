import React, { useEffect, useState } from 'react';
import { openAnswersEditor } from '../../services/answersEditor';
import { Link2, Sparkles } from 'lucide-react';
import type { AppNavigationDestination } from '../../navigationTypes';
import { loadMoneyProfile, onMoneyProfileChange } from '../../services/moneyProfile';
import { WORKSPACE_SYNC_EVENT } from '../../services/workspaceSync';
import { loadIncomeSources } from '../../services/incomeStorage';
import { loadExpenses, loadBudgets } from '../../services/personalFinanceStorage';
import { loadEmiRecords } from '../../services/emiStorage';

/** Pages that read income, spending, loans or budgets. */
const CONNECTED: AppNavigationDestination[] = ['income', 'expenses', 'budgeting', 'emi-manager', 'financial-health', 'finance-reports', 'financial-twin'];

function seedsInUse(): string[] {
  const out: string[] = [];
  if (loadIncomeSources().some((s) => s.id === 'profile-salary')) out.push('salary');
  if (loadExpenses().some((e) => e.id.startsWith('profile-spend-'))) out.push('monthly spending');
  if (loadEmiRecords().some((r) => r.id === 'profile-emi')) out.push('EMIs');
  if (loadBudgets().some((b) => b.id.startsWith('profile-budget-'))) out.push('this month’s budget');
  return out;
}

/**
 * One line on connected pages: either which numbers came from the money profile (and where to change
 * them), or, with no profile yet, an invitation to fill every page at once.
 */
export const ConnectedNote: React.FC<{ destination: AppNavigationDestination; onNavigate: (d: AppNavigationDestination) => void }> = ({ destination, onNavigate }) => {
  const [, bump] = useState(0);
  useEffect(() => {
    const refresh = () => bump((n) => n + 1);
    window.addEventListener(WORKSPACE_SYNC_EVENT, refresh);
    const off = onMoneyProfileChange(refresh);
    return () => { window.removeEventListener(WORKSPACE_SYNC_EVENT, refresh); off(); };
  }, []);
  if (!CONNECTED.includes(destination)) return null;
  const profile = loadMoneyProfile();
  const seeds = profile && profile.source !== 'sample' ? seedsInUse() : [];

  if (!profile || profile.source === 'sample') {
    return <div className="ws-connected">
      <Sparkles size={16} aria-hidden="true" />
      <span><b>Your answers fill every page.</b> Open your saved answers and income, spending, EMIs, budget and tax fill in here automatically.</span>
      <button type="button" onClick={openAnswersEditor}>Open my answers</button>
    </div>;
  }
  if (!seeds.length) return null;
  return <div className="ws-connected">
    <Link2 size={16} aria-hidden="true" />
    <span><b>Filled in from your answers.</b> Your {seeds.join(', ')} {seeds.length > 1 ? 'come' : 'comes'} from your sign-up answers and update when you edit them. Add your own records any time and they take over.</span>
    <button type="button" onClick={openAnswersEditor}>Edit my answers</button>
  </div>;
};
