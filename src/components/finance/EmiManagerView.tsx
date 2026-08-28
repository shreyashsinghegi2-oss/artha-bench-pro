import React, { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, IndianRupee, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { formatINR } from '../../services/personalFinanceStorage';
import {
  buildEmiSchedule,
  daysFromToday,
  EmiDraft,
  EmiRecord,
  loadEmiRecords,
  markNextEmiPaid,
  saveEmiDraft,
  saveEmiRecords,
} from '../../services/emiStorage';

const EMPTY_DRAFT: EmiDraft = {
  name: '',
  lender: '',
  originalLoanAmount: null,
  outstandingBalance: null,
  annualInterestRate: null,
  emiAmount: null,
  startDate: '',
  nextDueDate: '',
  tenureMonths: null,
  remainingInstallments: null,
  paymentFrequency: 'monthly',
  notes: '',
  status: 'active',
};

const inputClass = 'w-full rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-xs text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/20';

function dueLabel(date: string) {
  const days = daysFromToday(date);
  if (days == null) return 'Due date not recorded';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export const EmiManagerView: React.FC = () => {
  const auth = useAuth();
  const [records, setRecords] = useState<EmiRecord[]>(loadEmiRecords);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmiRecord | null>(null);
  const [draft, setDraft] = useState<EmiDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(() => records.filter((record) => record.status === 'active'), [records]);
  const monthlyOutflow = active.reduce((sum, record) => sum + (record.emiAmount ?? 0), 0);
  const totalOutstanding = active.reduce((sum, record) => sum + (record.outstandingBalance ?? 0), 0);
  const nextDue = active.filter((record) => record.nextDueDate).sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))[0] ?? null;

  const commit = (next: EmiRecord[]) => {
    setRecords(next);
    saveEmiRecords(next);
  };

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (record: EmiRecord) => {
    setEditing(record);
    const { id: _id, payments: _payments, createdAt: _createdAt, updatedAt: _updatedAt, ...editable } = record;
    setDraft(editable);
    setError(null);
    setFormOpen(true);
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return setError('Loan / EMI name is required.');
    const numericValues = [draft.originalLoanAmount, draft.outstandingBalance, draft.annualInterestRate, draft.emiAmount, draft.tenureMonths, draft.remainingInstallments];
    if (numericValues.some((value) => value != null && (!Number.isFinite(value) || value < 0))) return setError('Amounts, rates and instalment counts cannot be negative.');
    if (draft.remainingInstallments != null && !Number.isInteger(draft.remainingInstallments)) return setError('Remaining instalments must be a whole number.');
    if (draft.tenureMonths != null && !Number.isInteger(draft.tenureMonths)) return setError('Tenure must be a whole number of months.');
    if (draft.nextDueDate && draft.startDate && draft.nextDueDate < draft.startDate) return setError('Next due date cannot be before the start date.');

    const saved = saveEmiDraft(draft, editing ?? undefined);
    commit(editing ? records.map((record) => record.id === editing.id ? saved : record) : [saved, ...records]);
    setFormOpen(false);
    setEditing(null);
  };

  const remove = (record: EmiRecord) => {
    if (!window.confirm(`Delete EMI “${record.name}”? This removes its saved payment history from your Artha Bench workspace.`)) return;
    commit(records.filter((item) => item.id !== record.id));
  };

  const markPaid = (record: EmiRecord) => {
    if (!record.emiAmount || !record.nextDueDate) return;
    if (!window.confirm(`Mark ${record.name} payment of ${formatINR(record.emiAmount)} due ${record.nextDueDate} as paid? Principal/interest split is estimated when rate and balance are available.`)) return;
    const updated = markNextEmiPaid(record);
    commit(records.map((item) => item.id === record.id ? updated : item));
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-7 sm:px-6">
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-interactive">Personal finance · existing commitments</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">EMI Manager</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">Organize existing EMIs and understand monthly commitments. This is an educational money-management tool, not lending, underwriting, or loan approval.</p>
            <p className="mt-2 text-[10px] text-secondary">{auth.user ? 'Records are included in your authenticated user-scoped workspace sync.' : 'Guest records stay on this device until you sign in and sync.'}</p>
          </div>
          <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-white transition-transform duration-150 hover:-translate-y-0.5 hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive"><Plus className="h-4 w-4" /> Add EMI</button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Active EMIs', String(active.length), 'User-entered active commitments'],
          ['Monthly EMI outflow', formatINR(monthlyOutflow), 'From recorded EMI amounts'],
          ['Next payment due', nextDue?.nextDueDate || 'Not recorded', nextDue ? `${nextDue.name} · ${dueLabel(nextDue.nextDueDate)}` : 'Add a due date to track'],
          ['Outstanding balance', formatINR(totalOutstanding), 'Sum of recorded outstanding balances'],
        ].map(([label, value, note]) => <div key={label} className="rounded-2xl border border-line bg-surface p-4 shadow-sm"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-secondary">{label}</p><p className="mt-2 text-xl font-black text-ink">{value}</p><p className="mt-1 text-[10px] leading-4 text-secondary">{note}</p></div>)}
      </section>

      {records.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-line-strong bg-surface p-10 text-center">
          <CalendarClock className="mx-auto h-8 w-8 text-secondary" />
          <h2 className="mt-4 text-lg font-black text-ink">Add an EMI to track upcoming payments and monthly commitments.</h2>
          <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-secondary">You can enter partial information. Calculated principal/interest values appear only when enough fields are available and are clearly labelled as estimates.</p>
          <button type="button" onClick={openCreate} className="mt-5 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-white">Add first EMI</button>
        </section>
      ) : (
        <section className="space-y-4">
          {records.map((record) => {
            const schedule = buildEmiSchedule(record, 6);
            return (
              <article key={record.id} className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-ink">{record.name}</h2><span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${record.status === 'active' ? 'border-success-fill/25 bg-success-soft text-success' : 'border-line bg-subtle text-secondary'}`}>{record.status === 'active' ? 'Active' : 'Closed'}</span></div>
                    <p className="mt-1 text-xs text-secondary">{record.lender || 'Lender not recorded'}{record.notes ? ` · ${record.notes}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-2"><button type="button" onClick={() => openEdit(record)} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-bold text-ink hover:border-interactive/40"><Pencil className="h-3.5 w-3.5" /> Edit</button><button type="button" onClick={() => remove(record)} className="inline-flex items-center gap-1.5 rounded-xl border border-danger/25 px-3 py-2 text-xs font-bold text-danger hover:bg-danger-soft"><Trash2 className="h-3.5 w-3.5" /> Delete</button></div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="EMI amount" value={record.emiAmount == null ? 'Not recorded' : formatINR(record.emiAmount)} />
                  <Metric label="Outstanding" value={record.outstandingBalance == null ? 'Not recorded' : formatINR(record.outstandingBalance)} />
                  <Metric label="Annual interest" value={record.annualInterestRate == null ? 'Not recorded' : `${record.annualInterestRate.toFixed(2)}%`} />
                  <Metric label="Remaining instalments" value={record.remainingInstallments == null ? 'Not recorded' : String(record.remainingInstallments)} />
                </div>
                {record.status === 'active' && record.nextDueDate && <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-line bg-canvas p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-black text-ink">Next payment · {record.nextDueDate}</div><div className={`mt-1 text-[10px] ${((daysFromToday(record.nextDueDate) ?? 0) < 0) ? 'text-danger' : 'text-secondary'}`}>{dueLabel(record.nextDueDate)}</div></div><button type="button" disabled={!record.emiAmount} onClick={() => markPaid(record)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-success-fill/30 bg-success-soft px-4 py-2.5 text-xs font-black text-success disabled:opacity-40"><CheckCircle2 className="h-4 w-4" /> Mark as paid</button></div>}
                <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
                  <table className="w-full min-w-[680px] text-left text-xs"><caption className="sr-only">Upcoming estimated payment schedule for {record.name}</caption><thead className="bg-subtle text-[9px] uppercase tracking-wider text-secondary"><tr><th className="px-3 py-3">Due date</th><th className="px-3 py-3 text-right">EMI</th><th className="px-3 py-3 text-right">Est. principal</th><th className="px-3 py-3 text-right">Est. interest</th><th className="px-3 py-3">Basis</th></tr></thead><tbody className="divide-y divide-line">{schedule.map((row) => <tr key={row.dueDate}><td className="px-3 py-3 font-semibold text-ink">{row.dueDate}</td><td className="px-3 py-3 text-right font-mono text-ink">{row.amount == null ? '—' : formatINR(row.amount)}</td><td className="px-3 py-3 text-right font-mono text-ink">{row.estimatedPrincipal == null ? '—' : formatINR(row.estimatedPrincipal)}</td><td className="px-3 py-3 text-right font-mono text-ink">{row.estimatedInterest == null ? '—' : formatINR(row.estimatedInterest)}</td><td className="px-3 py-3 text-[10px] text-secondary">{row.estimatedInterest == null ? 'Insufficient fields' : 'Estimate from recorded rate/balance'}</td></tr>)}</tbody></table>
                </div>
                {record.payments.length > 0 && <div className="mt-4"><h3 className="text-xs font-black text-ink">Recent marked payments</h3><div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{record.payments.slice(0, 6).map((payment) => <div key={payment.id} className="rounded-xl border border-line bg-canvas p-3"><div className="text-[10px] font-bold text-ink">{payment.dueDate} · {formatINR(payment.amount)}</div><div className="mt-1 text-[9px] text-secondary">Marked paid {payment.paidAt.slice(0, 10)}{payment.estimatedInterest == null ? '' : ` · estimated interest ${formatINR(payment.estimatedInterest)}`}</div></div>)}</div></div>}
              </article>
            );
          })}
        </section>
      )}

      <section className="rounded-2xl border border-warning-fill/25 bg-warning-soft p-4 text-xs leading-5 text-secondary"><strong className="text-ink">Calculation note:</strong> repayment splits are estimates based on user-entered balance, annual rate and EMI amount. Artha Bench is not connected to a lender and does not claim lender-confirmed balances, schedules, approvals or repayment advice.</section>

      {formOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
          <form onSubmit={save} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-line bg-surface p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-black text-ink">{editing ? 'Edit EMI' : 'Add EMI'}</h2><p className="mt-1 text-[10px] text-secondary">Enter only information you know. Blank optional fields remain unknown.</p></div><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-secondary hover:bg-subtle" aria-label="Close EMI form"><X className="h-4 w-4" /></button></div>
            {error && <div className="mt-4 rounded-xl border border-danger/25 bg-danger-soft p-3 text-xs text-danger">{error}</div>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Loan / EMI name *"><input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Education loan" /></Field>
              <Field label="Lender name"><input className={inputClass} value={draft.lender} onChange={(e) => setDraft({ ...draft, lender: e.target.value })} /></Field>
              <NumberField label="Original loan amount (INR)" value={draft.originalLoanAmount} onChange={(value) => setDraft({ ...draft, originalLoanAmount: value })} />
              <NumberField label="Outstanding balance (INR)" value={draft.outstandingBalance} onChange={(value) => setDraft({ ...draft, outstandingBalance: value })} />
              <NumberField label="Annual interest rate (%)" value={draft.annualInterestRate} onChange={(value) => setDraft({ ...draft, annualInterestRate: value })} step="0.01" />
              <NumberField label="EMI amount (INR)" value={draft.emiAmount} onChange={(value) => setDraft({ ...draft, emiAmount: value })} />
              <Field label="Start date"><input type="date" className={inputClass} value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></Field>
              <Field label="Next due date"><input type="date" className={inputClass} value={draft.nextDueDate} onChange={(e) => setDraft({ ...draft, nextDueDate: e.target.value })} /></Field>
              <NumberField label="Tenure (months)" value={draft.tenureMonths} onChange={(value) => setDraft({ ...draft, tenureMonths: value })} step="1" />
              <NumberField label="Remaining instalments" value={draft.remainingInstallments} onChange={(value) => setDraft({ ...draft, remainingInstallments: value })} step="1" />
              <Field label="Payment frequency"><select className={inputClass} value={draft.paymentFrequency} onChange={() => setDraft({ ...draft, paymentFrequency: 'monthly' })}><option value="monthly">Monthly</option></select></Field>
              <Field label="Status"><select className={inputClass} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as EmiRecord['status'] })}><option value="active">Active</option><option value="closed">Closed</option></select></Field>
            </div>
            <Field label="Optional notes"><textarea rows={3} className={`${inputClass} mt-1`} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Avoid bank credentials, card details, UPI PINs or lender passwords." /></Field>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-line px-4 py-2.5 text-xs font-bold text-secondary">Cancel</button><button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-white"><IndianRupee className="h-4 w-4" /> Save EMI</button></div>
          </form>
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-xl border border-line bg-canvas p-3"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">{label}</div><div className="mt-1.5 text-sm font-black text-ink">{value}</div></div>;
const Field: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => <label className="block"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-secondary">{label}</span>{children}</label>;
const NumberField: React.FC<{ label: string; value: number | null; onChange: (value: number | null) => void; step?: string }> = ({ label, value, onChange, step = '0.01' }) => <Field label={label}><input type="number" min="0" step={step} className={inputClass} value={value ?? ''} onChange={(e) => onChange(numberOrNull(e.target.value))} /></Field>;
