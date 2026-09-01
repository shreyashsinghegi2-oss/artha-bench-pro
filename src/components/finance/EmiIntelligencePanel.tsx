import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  Database,
  FileUp,
  Link2,
  Radar as RadarIcon,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
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
import {
  buildEmiIntelligenceSnapshot,
  EmiHealthDimension,
  EmiHealthStatus,
  saveEmiReplayIntent,
} from '../../services/emiIntelligence';
import { EmiDraft, EmiRecord, EMI_LOAN_TYPES, saveEmiDraft } from '../../services/emiStorage';
import { formatINR } from '../../services/personalFinanceStorage';

type Props = {
  records: EmiRecord[];
  onNavigate: (destination: AppNavigationDestination) => void;
  onImportRecords: (records: EmiRecord[]) => void;
};

type ImportRow = { draft: EmiDraft; issues: string[]; selected: boolean; sourceLine: number };

const statusClass: Record<EmiHealthStatus, string> = {
  Stable: 'border-success-fill/25 bg-success-soft text-success',
  Watch: 'border-warning-fill/25 bg-warning-soft text-warning',
  Review: 'border-danger/25 bg-danger-soft text-danger',
  'Data needed': 'border-line bg-subtle text-secondary',
};

const emptyDraft = (): EmiDraft => ({
  name: '', lender: '', loanType: 'Other', originalLoanAmount: null, outstandingBalance: null,
  annualInterestRate: null, emiAmount: null, startDate: '', nextDueDate: '', tenureMonths: null,
  remainingInstallments: null, paymentFrequency: 'monthly', notes: '', status: 'active', typeDetails: {},
});

const numberOrNull = (value: string | undefined) => {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim()); current = '';
    } else current += char;
  }
  values.push(current.trim());
  return values;
}

function parseImportCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const index = (names: string[]) => headers.findIndex((header) => names.includes(header));
  const positions = {
    name: index(['name', 'eminame', 'loanname']), lender: index(['lender', 'bank', 'institution']), loanType: index(['loantype', 'category', 'type']),
    emiAmount: index(['emiamount', 'monthlyemi', 'amount']), nextDueDate: index(['nextduedate', 'duedate']), startDate: index(['startdate']),
    tenureMonths: index(['tenuremonths', 'tenure']), remainingInstallments: index(['remaininginstallments', 'remainingmonths']),
    annualInterestRate: index(['annualinterestrate', 'interestrate', 'rate']), outstandingBalance: index(['outstandingbalance', 'balance']),
    originalLoanAmount: index(['originalloanamount', 'principal']), status: index(['status']),
  };
  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const at = (position: number) => position >= 0 ? values[position]?.trim() ?? '' : '';
    const draft = emptyDraft();
    draft.name = at(positions.name);
    draft.lender = at(positions.lender);
    const requestedType = at(positions.loanType);
    draft.loanType = EMI_LOAN_TYPES.includes(requestedType as any) ? requestedType as EmiDraft['loanType'] : 'Other';
    draft.emiAmount = numberOrNull(at(positions.emiAmount));
    draft.nextDueDate = at(positions.nextDueDate);
    draft.startDate = at(positions.startDate);
    draft.tenureMonths = numberOrNull(at(positions.tenureMonths));
    draft.remainingInstallments = numberOrNull(at(positions.remainingInstallments));
    draft.annualInterestRate = numberOrNull(at(positions.annualInterestRate));
    draft.outstandingBalance = numberOrNull(at(positions.outstandingBalance));
    draft.originalLoanAmount = numberOrNull(at(positions.originalLoanAmount));
    draft.status = at(positions.status).toLowerCase() === 'closed' ? 'closed' : 'active';
    const issues: string[] = [];
    if (!draft.name) issues.push('Name missing');
    if (draft.emiAmount == null) issues.push('EMI amount missing or invalid');
    if (!draft.nextDueDate) issues.push('Due date not recorded');
    if (!draft.lender) issues.push('Lender not recorded');
    draft.notes = `Reviewed CSV import · source row ${rowIndex + 2}`;
    return { draft, issues, selected: issues.every((issue) => !issue.includes('Name') && !issue.includes('amount')), sourceLine: rowIndex + 2 };
  });
}

export const EmiIntelligencePanel: React.FC<Props> = ({ records, onNavigate, onImportRecords }) => {
  const snapshot = useMemo(() => buildEmiIntelligenceSnapshot(records), [records]);
  const [chartHorizon, setChartHorizon] = useState<3 | 6 | 12>(6);
  const [scenarioAmount, setScenarioAmount] = useState('8000');
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const radarReady = snapshot.dimensions.every((item) => item.score != null);
  const timeline = snapshot.monthlyTimeline.slice(0, chartHorizon);
  const upcoming = snapshot.upcomingTimeline.slice(0, 16);

  const openReplay = (label: string, changes: Parameters<typeof saveEmiReplayIntent>[0]['changes'], horizonMonths: 1 | 3 | 6 | 12) => {
    const accepted = window.confirm('You are opening a temporary scenario. No EMI record or saved finance data will be changed.');
    if (!accepted) return;
    saveEmiReplayIntent({ label, horizonMonths, changes, createdAt: new Date().toISOString() });
    onNavigate('decision-replay');
  };

  const scenarioValue = Number(scenarioAmount);
  const validScenarioAmount = Number.isFinite(scenarioValue) && scenarioValue >= 0 ? scenarioValue : 0;

  const readImport = async (file: File | null) => {
    if (!file) return;
    setImportFileName(file.name);
    if (!file.name.toLowerCase().endsWith('.csv')) { setImportRows([]); return; }
    const text = await file.text();
    setImportRows(parseImportCsv(text));
  };

  const saveReviewedImport = () => {
    const selected = importRows.filter((row) => row.selected && row.draft.name && row.draft.emiAmount != null);
    if (!selected.length) return;
    if (!window.confirm(`Save ${selected.length} reviewed EMI record${selected.length === 1 ? '' : 's'} to your workspace?`)) return;
    const now = new Date().toISOString();
    const created = selected.map((row) => saveEmiDraft({ ...row.draft, notes: `${row.draft.notes} · imported ${now}` }));
    onImportRecords(created);
    try {
      const key = 'arthabench_emi_import_audit_v1';
      const current = JSON.parse(localStorage.getItem(key) || '[]');
      const audit = Array.isArray(current) ? current : [];
      localStorage.setItem(key, JSON.stringify([{ id: crypto.randomUUID(), fileName: importFileName, importedAt: now, recordIds: created.map((record) => record.id), sourceType: 'reviewed-csv' }, ...audit].slice(0, 50)));
    } catch { /* audit metadata must not block the confirmed import */ }
    setImportRows([]); setImportFileName('');
  };

  return <div className="space-y-6">
    <section className="rounded-3xl border border-interactive/20 bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="emi-intelligence-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[.14em] text-interactive">EMI Intelligence</div><h2 id="emi-intelligence-title" className="mt-1 text-xl font-black text-ink">Recorded commitment intelligence dashboard</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-secondary">Based on recorded workspace data. Not a lender affordability decision, credit score, loan recommendation or repayment guarantee.</p></div><div className="text-right text-[9px] leading-4 text-secondary">Last refreshed<br/><span className="font-black text-ink">{new Date(snapshot.calculatedAt).toLocaleString('en-IN')}</span></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Active commitments" value={String(snapshot.activeCount)} note="Recorded active EMI/commitment entries"/><Metric label="Monthly commitment" value={formatINR(snapshot.activeMonthlyCommitment)} note="Recorded active monthly EMI amounts"/><Metric label="Next recorded due date" value={snapshot.nextRecordedDueDate ?? 'Not recorded'} note="Payment status is not inferred"/><Metric label="Schedule completeness" value={snapshot.scheduleCompletenessPercent == null ? 'Data needed' : `${snapshot.scheduleCompletenessPercent}%`} note="Amount, next due date and remaining instalments"/></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Upcoming 30 days" value={formatINR(snapshot.upcoming30)} note="Derived from recorded monthly schedules"/><Metric label="Upcoming 60 days" value={formatINR(snapshot.upcoming60)} note="Derived from recorded monthly schedules"/><Metric label="Upcoming 90 days" value={formatINR(snapshot.upcoming90)} note="Derived from recorded monthly schedules"/><Metric label="Commitment / income" value={snapshot.commitmentToIncomePercent == null ? 'Data needed' : `${snapshot.commitmentToIncomePercent}%`} note="Internal descriptive ratio only"/></div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-wider text-brand">EMI Health Profile</div><h2 className="mt-1 text-lg font-black text-ink">EMI Health Indicator</h2></div><span className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusClass[snapshot.compositeStatus]}`}>{snapshot.composite == null ? 'Data needed' : `${snapshot.composite}/100 · ${snapshot.compositeStatus}`}</span></div><p className="mt-2 text-[10px] leading-5 text-secondary">An internal workspace metric, not a credit score, lender assessment or repayment guarantee. A composite is shown only when all seven EMI dimensions have adequate recorded data.</p>{radarReady?<div className="mt-4 h-[300px]" aria-label="EMI health radar chart"><ResponsiveContainer width="100%" height="100%"><RadarChart data={snapshot.dimensions.map((item)=>({name:item.name,score:item.score}))}><PolarGrid/><PolarAngleAxis dataKey="name" tick={{fontSize:8}}/><Radar dataKey="score" stroke="currentColor" fill="currentColor" fillOpacity={0.12}/><Tooltip/></RadarChart></ResponsiveContainer></div>:<div className="mt-5 rounded-2xl border border-dashed border-line-strong bg-canvas p-6 text-center"><RadarIcon className="mx-auto h-7 w-7 text-secondary"/><h3 className="mt-3 text-sm font-black text-ink">Complete radar not shown</h3><p className="mt-2 text-[10px] leading-5 text-secondary">One or more dimensions need recorded data. Missing axes are not filled with invented values.</p></div>}</div>
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><div className="text-[10px] font-black uppercase tracking-wider text-interactive">Commitment Analyst</div><h2 className="mt-1 text-lg font-black text-ink">EMI Intelligence Brief</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Brief label="Commitment snapshot" value={`${snapshot.activeCount} active recorded commitment${snapshot.activeCount===1?'':'s'} totaling ${formatINR(snapshot.activeMonthlyCommitment)} per month.`}/><Brief label="Upcoming recorded obligations" value={`${formatINR(snapshot.upcoming30)} across the next 30 days based on recorded schedules.`}/><Brief label="Monthly cash-flow context" value={snapshot.commitmentToIncomePercent==null?'Recorded income is needed for commitment-to-income context.':`${snapshot.commitmentToIncomePercent}% of current recorded monthly income is represented by active commitments.`}/><Brief label="Calendar / data gaps" value={snapshot.dimensions.filter((item)=>item.status==='Data needed').map((item)=>item.name).join(' · ')||'No dimension is currently missing.'}/></div><div className="mt-4 rounded-2xl border border-line bg-canvas p-4"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">Limits and exclusions</div><p className="mt-2 text-[10px] leading-5 text-secondary">No bank account, bureau, lender eligibility, repayment status or external offer is inferred. Payment status remains “not recorded” unless the workspace explicitly contains a paid record. Ask the floating ArthaMind assistant for an evidence-led Commitment Analyst explanation using only enabled finance context.</p></div></div>
    </section>

    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><h2 className="text-lg font-black text-ink">EMI health evidence table</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-[10px]"><thead><tr className="border-b border-line text-secondary"><th className="px-3 py-3">Dimension</th><th className="px-3 py-3">Score/status</th><th className="px-3 py-3">Interpretation</th><th className="px-3 py-3">Calculation</th><th className="px-3 py-3">Evidence / limits</th></tr></thead><tbody>{snapshot.dimensions.map((item)=><DimensionRow key={item.key} item={item}/>)}</tbody></table></div></section>

    <section className="grid gap-5 xl:grid-cols-2">
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black text-ink">Upcoming commitment explorer</h2><p className="mt-1 text-[10px] text-secondary">Recorded monthly schedules only · no payment status inference</p></div><select value={chartHorizon} onChange={(event)=>setChartHorizon(Number(event.target.value) as 3|6|12)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink"><option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option></select></div><div className="mt-4 h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={timeline}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month" tick={{fontSize:9}}/><YAxis tick={{fontSize:9}}/><Tooltip formatter={(value)=>formatINR(Number(value))}/><Bar dataKey="amount" name="Upcoming commitments" fill="currentColor" fillOpacity={0.55}/></BarChart></ResponsiveContainer></div></div>
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><h2 className="text-lg font-black text-ink">Commitment mix</h2><p className="mt-1 text-[10px] text-secondary">By recorded loan category. Lender mix is shown only where lender labels exist.</p>{snapshot.mixByCategory.length?<div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr]"><div className="h-[220px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={snapshot.mixByCategory} dataKey="amount" nameKey="name" innerRadius={55} outerRadius={88} fill="currentColor" fillOpacity={0.55}/><Tooltip formatter={(value)=>formatINR(Number(value))}/></PieChart></ResponsiveContainer></div><div className="space-y-2">{snapshot.mixByCategory.map((item)=><div key={item.name} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3 py-2 text-[10px]"><span className="text-secondary">{item.name}</span><span className="font-black text-ink">{formatINR(item.amount)}</span></div>)}</div></div>:<p className="mt-4 text-xs text-secondary">Add categorized EMI records to view commitment mix.</p>}</div>
    </section>

    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-interactive"/><h2 className="text-lg font-black text-ink">Payment timeline and maturity explorer</h2></div><div className="mt-4 grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><div className="max-h-[360px] overflow-y-auto rounded-2xl border border-line bg-canvas"><div className="divide-y divide-line">{upcoming.length?upcoming.map((item)=><div key={`${item.recordId}-${item.dueDate}`} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[10px] font-black text-ink">{item.dueDate} · {item.name}</div><div className="mt-1 text-[9px] text-secondary">{item.lender||'Lender not recorded'} · {item.loanType}</div></div><div className="text-left sm:text-right"><div className="text-[10px] font-black text-ink">{item.amount==null?'Amount not recorded':formatINR(item.amount)}</div><div className={`mt-1 text-[9px] ${item.isPastDate&&item.paymentStatus!=='Paid'?'text-warning':'text-secondary'}`}>{item.isPastDate&&item.paymentStatus!=='Paid'?'Past due date · ':''}{item.paymentStatus}</div></div></div>):<p className="p-6 text-center text-xs text-secondary">No upcoming recorded schedules are available.</p>}</div></div><div className="space-y-3"><div className="rounded-2xl border border-line bg-canvas p-4"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">Average remaining tenure</div><div className="mt-2 text-xl font-black text-ink">{snapshot.averageRemainingTenureMonths==null?'Data needed':`${snapshot.averageRemainingTenureMonths} months`}</div></div><div className="rounded-2xl border border-line bg-canvas p-4"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">Recorded maturity estimates</div><div className="mt-2 space-y-2">{snapshot.maturityDates.length?snapshot.maturityDates.slice(0,5).map((item)=><div key={`${item.name}-${item.date}`} className="text-[10px]"><div className="font-black text-ink">{item.name} · {item.date}</div><div className="mt-0.5 text-[9px] text-secondary">{item.basis}</div></div>):<div className="text-[10px] text-secondary">Remaining tenure/end-date data is needed.</div>}</div></div></div></div></section>

    <section className="rounded-3xl border border-interactive/20 bg-surface p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-interactive"/><h2 className="text-lg font-black text-ink">Decision Replay connection</h2></div><p className="mt-2 text-xs leading-5 text-secondary">These actions only prefill temporary Decision Replay assumptions after confirmation. They never create, edit or save an EMI.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><label className="text-[10px] font-black text-secondary">Temporary EMI amount (₹)<input type="number" min="0" step="500" value={scenarioAmount} onChange={(event)=>setScenarioAmount(event.target.value)} className="mt-1 block w-44 rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink"/></label><div className="flex flex-wrap gap-2 sm:pt-5"><button type="button" onClick={()=>openReplay('Test a new EMI',{monthlyIncomeDelta:0,expenseReductionPercent:0,additionalMonthlyExpense:0,newMonthlyEmi:validScenarioAmount,savingsTargetDelta:0},6)} className="rounded-xl border border-interactive/30 bg-interactive-soft px-3 py-2 text-[10px] font-black text-interactive">Test a new EMI</button><button type="button" onClick={()=>openReplay('Test an EMI increase',{monthlyIncomeDelta:0,expenseReductionPercent:0,additionalMonthlyExpense:0,newMonthlyEmi:validScenarioAmount,savingsTargetDelta:0},3)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-[10px] font-black text-ink">Test an EMI increase</button><button type="button" disabled={snapshot.monthlyIncome<=0} onClick={()=>openReplay('Test a delayed income month',{monthlyIncomeDelta:-snapshot.monthlyIncome,expenseReductionPercent:0,additionalMonthlyExpense:0,newMonthlyEmi:0,savingsTargetDelta:0},1)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-[10px] font-black text-ink disabled:opacity-40">Test a delayed income month</button><button type="button" onClick={()=>openReplay('View cash-flow impact',{monthlyIncomeDelta:0,expenseReductionPercent:0,additionalMonthlyExpense:0,newMonthlyEmi:0,savingsTargetDelta:0},6)} className="rounded-xl border border-line bg-canvas px-3 py-2 text-[10px] font-black text-ink">View cash-flow impact</button></div></div></section>

    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-interactive"/><h2 className="text-lg font-black text-ink">EMI Connections</h2></div><p className="mt-2 text-xs leading-5 text-secondary">External finance data is connected only through explicit consent and a real supported provider. No bank credentials, UPI PIN, OTP, ATM PIN, CVV or full card number should ever be entered here.</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Connection title="Manual records" status="Available" consent="Workspace entry" freshness="Current saved records" details="Manual EMI entry remains the primary working source."/><Connection title="Statement import" status="CSV review available" consent="User confirmation required" freshness="Imported only after review" details="CSV rows are staged below before saving. PDF extraction is not simulated."/><Connection title="Account Aggregator" status="Not connected" consent="Explicit consent required" freshness="No provider sync" details="No licensed Account Aggregator provider is configured in this build."/><Connection title="Lender / partner API" status="Not configured" consent="Explicit consent required" freshness="No provider sync" details="No lender API data is presented as live or available."/></div></section>

    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><FileUp className="h-4 w-4 text-interactive"/><h2 className="text-lg font-black text-ink">Statement import review</h2></div><p className="mt-2 text-xs leading-5 text-secondary">CSV only in this build. Supported columns include name, lender, loanType, emiAmount, nextDueDate, tenureMonths, remainingInstallments, annualInterestRate, outstandingBalance and status. Nothing is saved until you review and confirm.</p><input type="file" accept=".csv,text/csv" onChange={(event)=>void readImport(event.target.files?.[0]??null)} className="mt-4 block w-full max-w-xl text-xs text-secondary file:mr-3 file:rounded-xl file:border file:border-line file:bg-canvas file:px-3 file:py-2 file:text-xs file:font-black file:text-ink"/>{importFileName&&!importRows.length&&<div className="mt-3 rounded-xl border border-warning-fill/25 bg-warning-soft p-3 text-[10px] text-warning">No reviewable CSV rows were found, or this file type is not supported. PDF extraction is intentionally unavailable until a verified parser is configured.</div>}{importRows.length>0&&<div className="mt-4 space-y-3"><div className="overflow-x-auto rounded-2xl border border-line"><table className="w-full min-w-[850px] text-left text-[10px]"><thead><tr className="border-b border-line bg-canvas text-secondary"><th className="px-3 py-3">Save</th><th className="px-3 py-3">Row</th><th className="px-3 py-3">Name / lender</th><th className="px-3 py-3">Monthly EMI</th><th className="px-3 py-3">Due date</th><th className="px-3 py-3">Review flags</th></tr></thead><tbody>{importRows.map((row,index)=><tr key={row.sourceLine} className="border-b border-line last:border-0"><td className="px-3 py-3"><input type="checkbox" checked={row.selected} onChange={(event)=>setImportRows((current)=>current.map((item,itemIndex)=>itemIndex===index?{...item,selected:event.target.checked}:item))} aria-label={`Select import row ${row.sourceLine}`}/></td><td className="px-3 py-3 text-secondary">{row.sourceLine}</td><td className="px-3 py-3"><div className="font-black text-ink">{row.draft.name||'Missing name'}</div><div className="text-secondary">{row.draft.lender||'Lender not recorded'}</div></td><td className="px-3 py-3 font-black text-ink">{row.draft.emiAmount==null?'Missing':formatINR(row.draft.emiAmount)}</td><td className="px-3 py-3 text-secondary">{row.draft.nextDueDate||'Not recorded'}</td><td className="px-3 py-3 text-secondary">{row.issues.length?row.issues.join(' · '):'Ready for review'}</td></tr>)}</tbody></table></div><button type="button" onClick={saveReviewedImport} className="rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-white">Save confirmed rows</button></div>}</section>

    <section className="rounded-3xl border border-line bg-canvas p-5"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning"/><div><div className="text-xs font-black text-ink">EMI Market Context</div><p className="mt-2 text-[10px] leading-5 text-secondary">No verified official or licensed lender-product feed is configured, so Artha Bench Pro is not displaying bank offers, interest-rate rankings, “best loans,” eligibility claims or simulated real-time financing data. When a verified provider is added, every item must include institution, product category, source, timestamp, freshness and final-terms disclosure.</p></div></div></section>

    <section className="rounded-3xl border border-line bg-canvas p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success"/><div><div className="text-xs font-black text-ink">Privacy and credit boundary</div><p className="mt-2 text-[10px] leading-5 text-secondary">EMI Health Indicators are internal personal-finance descriptors from recorded workspace data. They are not CIBIL, Experian, Equifax or CRIF scores; not underwriting; not approval; and not a prediction of repayment outcomes.</p></div></div></section>
  </div>;
};

const Metric:React.FC<{label:string;value:string;note:string}>=({label,value,note})=><div className="rounded-2xl border border-line bg-canvas p-4"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">{label}</div><div className="mt-2 text-xl font-black text-ink">{value}</div><div className="mt-1 text-[9px] leading-4 text-secondary">{note}</div></div>;
const Brief:React.FC<{label:string;value:string}>=({label,value})=><div className="rounded-2xl border border-line bg-canvas p-4"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">{label}</div><div className="mt-2 text-[10px] leading-5 text-ink">{value}</div></div>;
const Connection:React.FC<{title:string;status:string;consent:string;freshness:string;details:string}>=({title,status,consent,freshness,details})=><div className="rounded-2xl border border-line bg-canvas p-4"><div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-interactive"/><div className="text-xs font-black text-ink">{title}</div></div><div className="mt-3 space-y-1 text-[9px] leading-4 text-secondary"><div><span className="font-black text-ink">Status:</span> {status}</div><div><span className="font-black text-ink">Consent:</span> {consent}</div><div><span className="font-black text-ink">Freshness:</span> {freshness}</div><div className="pt-1">{details}</div></div></div>;
const DimensionRow:React.FC<{item:EmiHealthDimension}>=({item})=><tr className="border-b border-line align-top last:border-0"><td className="px-3 py-4 font-black text-ink">{item.name}</td><td className="px-3 py-4"><span className={`rounded-full border px-2 py-1 font-black ${statusClass[item.status]}`}>{item.score==null?'Data needed':`${item.score}/100 · ${item.status}`}</span></td><td className="px-3 py-4 leading-5 text-secondary">{item.interpretation}</td><td className="px-3 py-4 leading-5 text-secondary">{item.calculation}</td><td className="px-3 py-4 leading-5 text-secondary">{item.evidence.join(' · ')}{item.limitations.length>0&&<div className="mt-1">Limits: {item.limitations.join(' ')}</div>}</td></tr>;
