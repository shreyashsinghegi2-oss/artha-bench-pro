import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CalendarRange,
  Database,
  HeartPulse,
  Info,
  ShieldCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppNavigationDestination } from '../../navigationTypes';
import { useAuth } from '../../auth/AuthContext';
import {
  buildFinancialHealthSnapshot,
  FinancialHealthDimension,
  FinancialHealthPeriod,
  FinancialHealthStatus,
} from '../../services/financialHealth';
import { formatINR } from '../../services/personalFinanceStorage';

type Props = { onNavigate: (destination: AppNavigationDestination) => void };

const statusClass: Record<FinancialHealthStatus, string> = {
  Stable: 'border-success-fill/25 bg-success-soft text-success',
  Watch: 'border-warning-fill/25 bg-warning-soft text-warning',
  Review: 'border-danger/25 bg-danger-soft text-danger',
  'Data needed': 'border-line bg-subtle text-secondary',
};

export const FinancialHealthView: React.FC<Props> = ({ onNavigate }) => {
  const auth = useAuth();
  const [period, setPeriod] = useState<FinancialHealthPeriod>(6);
  const snapshot = useMemo(() => buildFinancialHealthSnapshot(period), [period]);
  const radarReady = snapshot.dimensions.every((dimension) => dimension.score != null);
  const strongest = [...snapshot.dimensions].filter((item) => item.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 2);
  const review = snapshot.dimensions.filter((item) => item.status === 'Review' || item.status === 'Watch').slice(0, 3);
  const gaps = snapshot.dimensions.filter((item) => item.score == null);

  if (!auth.user) return null;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-7 sm:px-6">
      <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
        <div className="grid gap-0 xl:grid-cols-[1.2fr_.8fr]">
          <div className="p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-interactive/20 bg-interactive-soft px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-interactive"><HeartPulse className="h-3.5 w-3.5" /> ArthaMind Financial Health Intelligence</div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">Financial Health Intelligence</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">A transparent view of your recorded cash flow, savings targets, budgets, commitments, spending consistency, income consistency and data quality.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-[10px] text-secondary">
              <span className="rounded-full border border-line bg-canvas px-3 py-1.5">Private workspace · recorded data only</span>
              <span className="rounded-full border border-line bg-canvas px-3 py-1.5">Deterministic calculations</span>
              <span className="rounded-full border border-line bg-canvas px-3 py-1.5">Not a credit score or lending decision</span>
            </div>
          </div>
          <div className="border-t border-line bg-canvas p-6 xl:border-l xl:border-t-0 sm:p-8">
            <label className="block text-[9px] font-black uppercase tracking-wider text-secondary" htmlFor="health-period">Selected period</label>
            <select id="health-period" value={period} onChange={(event) => setPeriod(Number(event.target.value) as FinancialHealthPeriod)} className="mt-2 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-xs text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/15">
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
            <div className="mt-4 space-y-2 text-[10px] leading-5 text-secondary">
              <div className="flex items-center gap-2"><CalendarRange className="h-3.5 w-3.5 text-interactive" /> {snapshot.periodLabel}</div>
              <div className="flex items-center gap-2"><Database className="h-3.5 w-3.5 text-interactive" /> Data completeness: {snapshot.dataCompleteness}</div>
              <div className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Refreshed {new Date(snapshot.calculatedAt).toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="health-indicator-title">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[.14em] text-brand">Financial Health Profile</div>
            <h2 id="health-indicator-title" className="mt-1 text-xl font-black text-ink">Artha Financial Health Indicator</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-secondary">An explainable workspace indicator based on your recorded data—not a credit score, loan decision, or forecast.</p>
          </div>
          <span className={`self-start rounded-full border px-3 py-1 text-[10px] font-black ${statusClass[snapshot.compositeStatus]}`}>{snapshot.compositeStatus}</span>
        </div>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="text-4xl font-black text-ink">{snapshot.composite == null ? 'Data needed' : `${snapshot.composite}/100`}</div><div className="mt-1 text-[10px] leading-5 text-secondary">{snapshot.compositeReason}</div></div>
          <details className="max-w-xl rounded-2xl border border-line bg-canvas p-4 text-[10px] leading-5 text-secondary"><summary className="cursor-pointer font-black text-ink">How this is calculated</summary><p className="mt-2">Weights: Cash Flow Stability 20%, Savings Resilience 20%, Budget Discipline 15%, Debt and EMI Pressure 20%, Expense Stability 10%, Income Consistency 10%, Data Completeness 5%. A composite is shown only when all seven dimensions have sufficient recorded data.</p></details>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-wider text-interactive">Dimension map</div><h2 className="mt-1 text-lg font-black text-ink">Seven explainable dimensions</h2></div><Info className="h-4 w-4 text-secondary" /></div>
          {radarReady ? (
            <div className="mt-4 h-[330px]" aria-label="Radar chart of seven financial health dimensions">
              <ResponsiveContainer width="100%" height="100%"><RadarChart data={snapshot.dimensions.map((item) => ({ name: item.name, score: item.score }))}><PolarGrid /><PolarAngleAxis dataKey="name" tick={{ fontSize: 9 }} /><Radar dataKey="score" stroke="currentColor" fill="currentColor" fillOpacity={0.12} /><Tooltip /></RadarChart></ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-line-strong bg-canvas p-6 text-center"><AlertTriangle className="mx-auto h-7 w-7 text-warning" /><h3 className="mt-3 text-sm font-black text-ink">Radar waits for complete dimensions</h3><p className="mt-2 text-[10px] leading-5 text-secondary">A complete polygon is not drawn while one or more dimensions are missing. The accessible dimension table below remains the source of truth.</p></div>
          )}
        </div>

        <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
          <div className="text-[10px] font-black uppercase tracking-wider text-brand">ArthaMind Health Analyst</div>
          <h2 className="mt-1 text-lg font-black text-ink">Health Intelligence Brief</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Brief label="Overall signal" value={snapshot.composite == null ? 'Data needed before a reliable composite can be formed.' : `${snapshot.compositeStatus} · ${snapshot.composite}/100 deterministic workspace indicator.`} />
            <Brief label="Strongest dimensions" value={strongest.length ? strongest.map((item) => `${item.name} ${item.score}`).join(' · ') : 'No scored dimensions yet.'} />
            <Brief label="Dimensions needing review" value={review.length ? review.map((item) => item.name).join(' · ') : 'No scored dimensions currently marked Watch or Review.'} />
            <Brief label="Important data gaps" value={gaps.length ? gaps.map((item) => item.name).join(' · ') : 'No dimension gaps in the selected period.'} />
          </div>
          <div className="mt-4 rounded-2xl border border-line bg-canvas p-4"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">Evidence used</div><p className="mt-2 text-[10px] leading-5 text-secondary">Recorded INR income, recorded expenses, configured budgets and savings targets, active EMI records, record dates/categories and the selected {period}-month period. AI must explain these calculations; it does not create the scores.</p></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <DeepLink label="Income" onClick={() => onNavigate('income')} /><DeepLink label="Expenses" onClick={() => onNavigate('expenses')} /><DeepLink label="Budgeting" onClick={() => onNavigate('budgeting')} /><DeepLink label="EMI Manager" onClick={() => onNavigate('emi-manager')} /><DeepLink label="Reports" onClick={() => onNavigate('finance-reports')} /><DeepLink label="Decision Replay" onClick={() => onNavigate('decision-replay')} />
          </div>
          <p className="mt-4 text-[9px] leading-4 text-secondary">Limits: recorded workspace coverage can be incomplete. This intelligence does not assess creditworthiness, lender eligibility, loan approval, or future financial outcomes.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-black text-ink">Dimension evidence and calculation table</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-[10px]">
            <thead><tr className="border-b border-line text-secondary"><th className="px-3 py-3">Dimension</th><th className="px-3 py-3">Score/status</th><th className="px-3 py-3">Weight</th><th className="px-3 py-3">Interpretation</th><th className="px-3 py-3">Calculation</th><th className="px-3 py-3">Evidence / limits</th></tr></thead>
            <tbody>{snapshot.dimensions.map((item) => <DimensionRow key={item.key} item={item} />)}</tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Monthly cash-flow trend" subtitle="Recorded workspace data · selected period">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={snapshot.monthPoints}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip formatter={(value) => formatINR(Number(value))} /><Legend /><Line type="monotone" dataKey="income" name="Income" stroke="currentColor" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="expenses" name="Expenses" stroke="currentColor" strokeDasharray="5 5" dot={false} /><Line type="monotone" dataKey="netCashFlow" name="Net cash flow" stroke="currentColor" dot={false} /></LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Income vs expenses by month" subtitle="Recorded workspace data · selected period">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={snapshot.monthPoints}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip formatter={(value) => formatINR(Number(value))} /><Legend /><Bar dataKey="income" name="Income" fill="currentColor" fillOpacity={0.7} /><Bar dataKey="expenses" name="Expenses" fill="currentColor" fillOpacity={0.35} /></BarChart></ResponsiveContainer>
        </ChartCard>
      </section>

      {snapshot.budgetPressure.length > 0 && <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><h2 className="text-lg font-black text-ink">Current budget pressure by category</h2><p className="mt-1 text-[10px] text-secondary">Recorded workspace data · {snapshot.monthKeys.at(-1)} · categories with configured budgets only</p><div className="mt-4 h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={snapshot.budgetPressure}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="category" tick={{ fontSize: 8 }} interval={0} angle={-15} height={70} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="utilizationPercent" name="Budget utilization %" fill="currentColor" fillOpacity={0.55} /></BarChart></ResponsiveContainer></div></section>}

      <section className="rounded-3xl border border-line bg-canvas p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /><div><div className="text-xs font-black text-ink">Safety and interpretation boundary</div><p className="mt-2 text-[10px] leading-5 text-secondary">These are personal financial health indicators based on the records currently available in your authenticated workspace. They are not CIBIL, Experian, Equifax or CRIF scores; not lender eligibility; not an affordability approval; and not a prediction. Missing data is shown as “Data needed” rather than invented.</p></div></div></section>
    </div>
  );
};

const Brief: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-2xl border border-line bg-canvas p-4"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">{label}</div><p className="mt-2 text-[10px] leading-5 text-ink">{value}</p></div>;
const DeepLink: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-xl border border-line bg-canvas px-3 py-2 text-[10px] font-black text-ink hover:border-interactive/40">{label}<ArrowRight className="h-3 w-3" /></button>;
const ChartCard: React.FC<React.PropsWithChildren<{ title: string; subtitle: string }>> = ({ title, subtitle, children }) => <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><h2 className="text-lg font-black text-ink">{title}</h2><p className="mt-1 text-[10px] text-secondary">{subtitle} · freshness: calculated now from saved records</p><div className="mt-4 h-[300px]">{children}</div></section>;
const DimensionRow: React.FC<{ item: FinancialHealthDimension }> = ({ item }) => <tr className="border-b border-line align-top last:border-0"><td className="px-3 py-4 font-black text-ink">{item.name}</td><td className="px-3 py-4"><span className={`rounded-full border px-2 py-1 font-black ${statusClass[item.status]}`}>{item.score == null ? 'Data needed' : `${item.score}/100 · ${item.status}`}</span></td><td className="px-3 py-4 text-secondary">{item.weight}%</td><td className="px-3 py-4 leading-5 text-secondary">{item.interpretation}<div className="mt-1 font-semibold text-ink">Why it matters: {item.whyItMatters}</div></td><td className="px-3 py-4 leading-5 text-secondary">{item.calculation}</td><td className="px-3 py-4 leading-5 text-secondary">{item.evidence.join(' · ')}{item.limitations.length > 0 && <div className="mt-1">Limits: {item.limitations.join(' ')}</div>}</td></tr>;
