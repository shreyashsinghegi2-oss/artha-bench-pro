import React, { useState } from 'react';
import { Plus, ReceiptIndianRupee, Trash2 } from 'lucide-react';
import { getIndiaTaxRules } from '../../../config/taxRules/india';
import { createDeduction } from '../../../services/taxWorkspaceStorage';
import { IndianTaxProfile, TaxDeductionEntry } from '../../../types/taxTypes';

interface Props { profile: IndianTaxProfile; entries: TaxDeductionEntry[]; onChange: (entries: TaxDeductionEntry[]) => void; }
const fieldClass = 'w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-interactive';

export const TaxDeductionsPanel: React.FC<Props> = ({ profile, entries, onChange }) => {
  const rules = getIndiaTaxRules(profile.financialYear);
  const [type, setType] = useState<TaxDeductionEntry['type']>('80c');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaxDeductionEntry['status']>('not-added');
  const addEntry = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    onChange([createDeduction(type, value, description.trim() || rules.deductions.find((item) => item.type === type)?.label || type, status), ...entries]);
    setAmount(''); setDescription('');
  };
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2"><ReceiptIndianRupee className="h-5 w-5 text-brand" /><h2 className="text-lg font-black text-ink">Tax Savings, Deductions & Exemptions</h2></div>
      <p className="mt-1 text-sm text-secondary">Eligibility and caps come from {rules.ruleVersion}. Review-only entries are recorded but not deducted automatically.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1.4fr_1fr_auto]">
        <select aria-label="Deduction type" className={fieldClass} value={type} onChange={(event) => setType(event.target.value as TaxDeductionEntry['type'])}>{rules.deductions.map((rule) => <option key={rule.type} value={rule.type}>{rule.label}</option>)}</select>
        <input aria-label="Deduction amount" className={fieldClass} type="number" min="0" placeholder="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <input aria-label="Deduction description" className={fieldClass} placeholder="Policy / investment note" value={description} onChange={(event) => setDescription(event.target.value)} />
        <select aria-label="Deduction document status" className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value as TaxDeductionEntry['status'])}><option value="not-added">Not added</option><option value="added">Added</option><option value="verified">Verified</option><option value="needs-review">Needs review</option></select>
        <button type="button" onClick={addEntry} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Add</button>
      </div>
      <div className="mt-4 space-y-2">
        {entries.map((entry) => {
          const rule = rules.deductions.find((item) => item.type === entry.type);
          const applies = profile.taxRegime === 'compare' ? rule?.oldRegime || rule?.newRegime : profile.taxRegime === 'old' ? rule?.oldRegime : rule?.newRegime;
          return <div key={entry.id} className="grid gap-2 rounded-xl border border-line p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><div><p className="font-bold text-ink">{entry.description}</p><p className="text-xs text-secondary">{rule?.note} · {applies ? 'Potentially applicable' : 'Not applicable under selected regime'} · {entry.status}</p></div><span className="font-mono font-bold text-ink">₹{entry.amount.toLocaleString('en-IN')}</span><button type="button" aria-label={`Delete ${entry.description}`} onClick={() => window.confirm('Delete this device-local deduction entry?') && onChange(entries.filter((item) => item.id !== entry.id))} className="rounded-lg p-2 text-danger hover:bg-danger-soft"><Trash2 className="h-4 w-4" /></button></div>;
        })}
        {!entries.length ? <p className="rounded-xl bg-canvas p-4 text-sm text-secondary">No deductions added. New-regime estimates can still use the configured salary standard deduction.</p> : null}
      </div>
    </section>
  );
};
