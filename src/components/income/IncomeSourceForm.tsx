import React, { FormEvent, useState } from 'react';
import { CalendarRange, IndianRupee, Tag, X } from 'lucide-react';
import {
  INCOME_FREQUENCIES,
  INCOME_TAX_STATUSES,
  INCOME_TYPES,
  IncomeSource,
  IncomeSourceDraft,
} from '../../services/incomeStorage';

interface IncomeSourceFormProps {
  source?: IncomeSource;
  onCancel: () => void;
  onSave: (draft: IncomeSourceDraft) => void;
}

type FormErrors = Partial<Record<'amount' | 'currency' | 'description' | 'dates' | 'tags', string>>;

const today = () => new Date().toISOString().slice(0, 10);

export const IncomeSourceForm: React.FC<IncomeSourceFormProps> = ({
  source,
  onCancel,
  onSave,
}) => {
  const [type, setType] = useState<IncomeSourceDraft['type']>(source?.type ?? 'Salary');
  const [amount, setAmount] = useState(source ? String(source.amount) : '');
  const [currency, setCurrency] = useState(source?.currency ?? 'INR');
  const [frequency, setFrequency] = useState<IncomeSourceDraft['frequency']>(
    source?.frequency ?? 'Monthly',
  );
  const [description, setDescription] = useState(source?.description ?? '');
  const [taxStatus, setTaxStatus] = useState<IncomeSourceDraft['taxStatus']>(
    source?.taxStatus ?? 'Post-tax',
  );
  const [startDate, setStartDate] = useState(source?.startDate ?? today());
  const [endDate, setEndDate] = useState(source?.endDate ?? '');
  const [tagText, setTagText] = useState(source?.tags.join(', ') ?? '');
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    const parsedAmount = Number(amount);
    const tags = tagText.split(',').map((tag) => tag.trim()).filter(Boolean);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1_000_000_000_000) {
      nextErrors.amount = 'Enter an amount greater than 0 and below 1 trillion.';
    }
    if (!/^[A-Za-z]{3}$/.test(currency.trim())) {
      nextErrors.currency = 'Use a 3-letter currency code such as INR or USD.';
    }
    if (description.trim().length < 2 || description.trim().length > 120) {
      nextErrors.description = 'Describe the source in 2–120 characters.';
    }
    if (!startDate || (endDate && endDate < startDate)) {
      nextErrors.dates = 'Choose a start date; the end date must be later.';
    }
    if (tags.length > 10 || tags.some((tag) => tag.length > 24)) {
      nextErrors.tags = 'Use up to 10 tags, with 24 characters per tag.';
    }
    return nextErrors;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    onSave({
      type,
      amount: Number(amount),
      currency: currency.trim().toUpperCase(),
      frequency,
      description: description.trim(),
      taxStatus,
      startDate,
      endDate: endDate || undefined,
      tags: tagText.split(',').map((tag) => tag.trim()).filter(Boolean),
    });
  };

  const fieldClass =
    'mt-1.5 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition focus:border-interactive focus:ring-2 focus:ring-interactive/15';

  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="income-form-title">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Income source</p>
          <h2 id="income-form-title" className="mt-1 text-xl font-black text-ink">
            {source ? 'Edit income source' : 'Add income source'}
          </h2>
          <p className="mt-1 text-sm text-secondary">Saved privately in this browser for the MVP.</p>
        </div>
        <button type="button" onClick={onCancel} className="rounded-xl border border-line p-2 text-secondary hover:text-ink" aria-label="Close income form">
          <X className="h-4 w-4" />
        </button>
      </header>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-ink">
            Income type
            <select className={fieldClass} value={type} onChange={(event) => setType(event.target.value as IncomeSourceDraft['type'])}>
              {INCOME_TYPES.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink">
            Frequency
            <select className={fieldClass} value={frequency} onChange={(event) => setFrequency(event.target.value as IncomeSourceDraft['frequency'])}>
              {INCOME_FREQUENCIES.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(120px,1fr)]">
          <label className="text-sm font-semibold text-ink">
            <span className="inline-flex items-center gap-1.5"><IndianRupee className="h-4 w-4 text-brand" /> Amount</span>
            <input className={fieldClass} type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-describedby={errors.amount ? 'income-amount-error' : undefined} placeholder="75,000" />
            {errors.amount ? <span id="income-amount-error" className="mt-1 block text-xs text-danger">{errors.amount}</span> : null}
          </label>
          <label className="text-sm font-semibold text-ink">
            Currency
            <input className={fieldClass} value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value)} aria-describedby={errors.currency ? 'income-currency-error' : undefined} placeholder="INR" />
            {errors.currency ? <span id="income-currency-error" className="mt-1 block text-xs text-danger">{errors.currency}</span> : null}
          </label>
        </div>

        <label className="block text-sm font-semibold text-ink">
          Source description
          <input className={fieldClass} value={description} maxLength={120} onChange={(event) => setDescription(event.target.value)} aria-describedby={errors.description ? 'income-description-error' : undefined} placeholder="Monthly salary from ABC Pvt Ltd" />
          {errors.description ? <span id="income-description-error" className="mt-1 block text-xs text-danger">{errors.description}</span> : null}
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-semibold text-ink">
            Tax status
            <select className={fieldClass} value={taxStatus} onChange={(event) => setTaxStatus(event.target.value as IncomeSourceDraft['taxStatus'])}>
              {INCOME_TAX_STATUSES.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink">
            <span className="inline-flex items-center gap-1.5"><CalendarRange className="h-4 w-4 text-brand" /> Start date</span>
            <input className={fieldClass} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="text-sm font-semibold text-ink">
            End date <span className="font-normal text-secondary">(optional)</span>
            <input className={fieldClass} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
        {errors.dates ? <p className="text-xs text-danger">{errors.dates}</p> : null}

        <label className="block text-sm font-semibold text-ink">
          <span className="inline-flex items-center gap-1.5"><Tag className="h-4 w-4 text-brand" /> Tags</span>
          <input className={fieldClass} value={tagText} onChange={(event) => setTagText(event.target.value)} aria-describedby="income-tags-help" placeholder="primary, taxable, household" />
          <span id="income-tags-help" className={`mt-1 block text-xs ${errors.tags ? 'text-danger' : 'text-secondary'}`}>{errors.tags ?? 'Separate tags with commas.'}</span>
        </label>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-secondary hover:text-ink">Cancel</button>
          <button type="submit" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-hover">{source ? 'Save changes' : 'Add income source'}</button>
        </div>
      </form>
    </section>
  );
};
