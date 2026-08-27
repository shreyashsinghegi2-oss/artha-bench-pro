import React, { useState } from 'react';
import { FileSpreadsheet, Plus, Scale, Trash2 } from 'lucide-react';
import { createTaxCredit } from '../../../services/taxWorkspaceStorage';
import { DocumentStatus, TaxCreditEntry, TaxWorkspaceState } from '../../../types/taxTypes';

interface Props {
  credits: TaxCreditEntry[];
  documents: TaxWorkspaceState['documents'];
  onCreditsChange: (credits: TaxCreditEntry[]) => void;
  onDocumentsChange: (documents: TaxWorkspaceState['documents']) => void;
}
const fieldClass = 'w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-interactive';

export const TaxCreditsPanel: React.FC<Props> = ({ credits, documents, onCreditsChange, onDocumentsChange }) => {
  const [type, setType] = useState<TaxCreditEntry['type']>('tds');
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [reportedIncome, setReportedIncome] = useState('');
  const addCredit = () => {
    const value = Number(amount);
    if (!source.trim() || !Number.isFinite(value) || value <= 0) return;
    onCreditsChange([createTaxCredit({ type, source: source.trim(), amount: value, reportedIncome: reportedIncome ? Number(reportedIncome) : undefined, status: 'needs-review', confidence: 'medium', confirmed: true }), ...credits]);
    setSource(''); setAmount(''); setReportedIncome('');
  };
  const documentLabels: Array<[keyof TaxWorkspaceState['documents'], string]> = [['form16', 'Form 16'], ['form26as', 'Form 26AS'], ['ais', 'AIS / TIS'], ['broker', 'Broker gains CSV'], ['bank', 'Bank interest CSV']];
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2"><Scale className="h-5 w-5 text-brand" /><h2 className="text-lg font-black text-ink">Tax Credits & Reconciliation</h2></div>
      <p className="mt-1 text-sm text-secondary"><span title="Tax Deducted at Source">TDS</span> and <span title="Tax Collected at Source">TCS</span> are credits—not expenses. Only entries you confirm reduce the estimated balance.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.3fr_1fr_1fr_auto]">
        <select aria-label="Tax credit type" className={fieldClass} value={type} onChange={(event) => setType(event.target.value as TaxCreditEntry['type'])}><option value="tds">TDS</option><option value="tcs">TCS</option><option value="advance-tax">Advance tax</option><option value="self-assessment">Self-assessment tax</option></select>
        <input aria-label="Tax credit source" className={fieldClass} placeholder="Employer / bank / challan" value={source} onChange={(event) => setSource(event.target.value)} />
        <input aria-label="Tax credit amount" className={fieldClass} type="number" min="0" placeholder="Credit amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <input aria-label="Income reported for tax credit" className={fieldClass} type="number" min="0" placeholder="Income reported" value={reportedIncome} onChange={(event) => setReportedIncome(event.target.value)} />
        <button type="button" onClick={addCredit} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Add</button>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-line text-xs uppercase tracking-wide text-secondary"><th className="py-2">Source</th><th>Income reported</th><th>TDS/TCS/tax paid</th><th>Match</th><th>Confidence</th><th>Confirmed</th><th /></tr></thead><tbody>{credits.map((credit) => <tr key={credit.id} className="border-b border-line/70"><td className="py-3 font-semibold text-ink">{credit.source}<span className="ml-2 rounded bg-canvas px-2 py-0.5 text-[10px] uppercase text-secondary">{credit.type}</span></td><td>{credit.reportedIncome ? `₹${credit.reportedIncome.toLocaleString('en-IN')}` : '—'}</td><td className="font-mono">₹{credit.amount.toLocaleString('en-IN')}</td><td>{credit.status}</td><td>{credit.confidence}</td><td><input aria-label={`Confirm tax credit from ${credit.source}`} type="checkbox" checked={credit.confirmed} onChange={(event) => onCreditsChange(credits.map((item) => item.id === credit.id ? { ...item, confirmed: event.target.checked } : item))} /></td><td><button type="button" aria-label={`Delete tax credit from ${credit.source}`} onClick={() => window.confirm('Delete this device-local tax credit?') && onCreditsChange(credits.filter((item) => item.id !== credit.id))} className="p-2 text-danger"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table>
        {!credits.length ? <p className="py-5 text-center text-sm text-secondary">No manual tax credits added.</p> : null}
      </div>

      <div className="mt-5 border-t border-line pt-4"><div className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-brand" /><h3 className="font-black text-ink">Document and import readiness</h3></div><p className="mt-1 text-xs text-secondary">MVP placeholders only. No document leaves this browser and no credit is claimed automatically.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{documentLabels.map(([key, label]) => <label key={key} className="rounded-xl border border-line p-3 text-xs font-bold text-ink">{label}<select className={`${fieldClass} mt-2`} value={documents[key]} onChange={(event) => onDocumentsChange({ ...documents, [key]: event.target.value as DocumentStatus })}><option value="not-added">Not added</option><option value="added">Added</option><option value="verified">Verified</option><option value="needs-review">Needs review</option></select></label>)}</div>
      </div>
    </section>
  );
};
