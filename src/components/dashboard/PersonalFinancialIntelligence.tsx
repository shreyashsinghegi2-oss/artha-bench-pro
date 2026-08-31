import React, { useMemo } from 'react';
import { ArrowRight, BookOpen, CircleDollarSign, PiggyBank, Target, WalletCards, Eye, Sparkles } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { NavigationDestination } from '../../types';
import { getMarketWatchlist, getOverallProgressPercentage } from '../../services/learningStorage';
import {
  currentMonthKey,
  expensesForMonth,
  formatINR,
  loadBudgets,
  loadExpenses,
  monthlyIncomeEstimate,
  totalExpenses,
} from '../../services/personalFinanceStorage';

interface Props { onNavigate: (destination: NavigationDestination) => void; }

export const PersonalFinancialIntelligence: React.FC<Props> = ({ onNavigate }) => {
  const auth = useAuth();
  const snapshot = useMemo(() => {
    if (!auth.user) return null;
    const month = currentMonthKey();
    const expenses = expensesForMonth(loadExpenses(), month);
    const expenseTotal = totalExpenses(expenses);
    const income = monthlyIncomeEstimate(month);
    const budget = loadBudgets().find((item) => item.month === month) ?? null;
    const planned = budget?.categories.reduce((sum, item) => sum + item.plannedAmount, 0) ?? 0;
    const usage = planned > 0 ? (expenseTotal / planned) * 100 : null;
    const budgetStatus = usage == null ? 'No monthly budget' : usage > 100 ? 'Over budget' : usage >= 80 ? 'Near limit' : 'On track';
    const recurring = expenses.filter((item) => item.recurring).slice(0, 3);
    return {
      month,
      income,
      expenseTotal,
      netCashFlow: income - expenseTotal,
      budgetStatus,
      usage,
      recurring,
      learningProgress: getOverallProgressPercentage(),
      watchlist: getMarketWatchlist().slice(0, 4),
    };
  }, [auth.user]);

  if (!auth.user || !snapshot) return null;
  const firstName = (auth.profile?.full_name || auth.user.email || 'there').trim().split(/\s|@/)[0];

  return (
    <section className="rounded-3xl border border-interactive/20 bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="my-financial-intelligence-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-interactive">My Financial Intelligence</div>
          <h2 id="my-financial-intelligence-title" className="mt-1 text-xl font-black text-ink">Welcome back, {firstName}</h2>
          <p className="mt-1 text-[11px] text-secondary">Private account snapshot · {snapshot.month} · only recorded data is shown.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onNavigate('decision-replay')} className="inline-flex items-center gap-2 rounded-xl border border-interactive/30 bg-interactive-soft px-3 py-2 text-xs font-black text-interactive hover:border-interactive/50">
            <Sparkles className="h-3.5 w-3.5" /> Decision Replay
          </button>
          <button type="button" onClick={() => onNavigate('account')} className="inline-flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2 text-xs font-bold text-ink hover:border-interactive/40">
            Data & privacy <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Summary icon={CircleDollarSign} label="Net cash flow" value={snapshot.income > 0 || snapshot.expenseTotal > 0 ? formatINR(snapshot.netCashFlow) : 'No data yet'} note={snapshot.income > 0 ? `${formatINR(snapshot.income)} income · ${formatINR(snapshot.expenseTotal)} expenses` : 'Add INR income and expenses'} onClick={() => onNavigate(snapshot.income > 0 ? 'expenses' : 'income')} />
        <Summary icon={WalletCards} label="Budget status" value={snapshot.budgetStatus} note={snapshot.usage == null ? 'Create your first monthly budget' : `${snapshot.usage.toFixed(0)}% utilized`} onClick={() => onNavigate('budgeting')} />
        <Summary icon={CircleDollarSign} label="Recurring payments" value={snapshot.recurring.length ? `${snapshot.recurring.length} recorded` : 'None recorded'} note={snapshot.recurring.length ? snapshot.recurring.map((item) => item.merchant || item.category).join(' · ') : 'Mark recurring expenses to track them'} onClick={() => onNavigate('expenses')} />
        <Summary icon={Target} label="Savings goal" value={auth.profile?.financial_goal ? 'Goal configured' : 'Not set'} note={auth.profile?.financial_goal || 'Add an optional goal in Account'} onClick={() => onNavigate('account')} />
        <Summary icon={BookOpen} label="Learning progress" value={`${snapshot.learningProgress}%`} note="Recorded lesson completion" onClick={() => onNavigate('learning')} />
        <Summary icon={Eye} label="Watchlist" value={snapshot.watchlist.length ? `${snapshot.watchlist.length} shown` : 'Empty'} note={snapshot.watchlist.length ? snapshot.watchlist.join(' · ') : 'Add companies or assets to monitor'} onClick={() => onNavigate('markets')} />
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-canvas px-4 py-3 text-[10px] text-secondary sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2"><PiggyBank className="h-4 w-4 text-brand" /><span><span className="font-semibold text-ink">ArthaMind prompt:</span> Ask about your {new Date(`${snapshot.month}-01`).toLocaleDateString('en-IN', { month: 'long' })} budget after enabling the relevant AI Data Context.</span></div>
        <button type="button" onClick={() => onNavigate('decision-replay')} className="inline-flex shrink-0 items-center gap-1.5 font-black text-interactive">Replay a what-if <ArrowRight className="h-3.5 w-3.5" /></button>
      </div>
    </section>
  );
};

const Summary: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string; note: string; onClick: () => void }> = ({ icon: Icon, label, value, note, onClick }) => (
  <button type="button" onClick={onClick} className="min-h-32 rounded-2xl border border-line bg-canvas p-4 text-left transition hover:border-interactive/35 hover:bg-subtle">
    <Icon className="h-4 w-4 text-interactive" />
    <div className="mt-3 text-[9px] font-bold uppercase tracking-wider text-secondary">{label}</div>
    <div className="mt-1 text-sm font-black text-ink">{value}</div>
    <div className="mt-1 line-clamp-2 text-[9px] leading-4 text-secondary">{note}</div>
  </button>
);
