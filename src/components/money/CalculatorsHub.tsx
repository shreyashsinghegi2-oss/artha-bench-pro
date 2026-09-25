import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Calculator } from 'lucide-react';
import { compareTaxRegimes } from '../../services/indiaTaxEngine';
import { createDefaultTaxProfile } from '../../services/taxWorkspaceStorage';
import { buildMoneyCheck } from '../../services/moneyCheck';
import { cagr, DEFAULT_RATES, emi, fdMaturity, hraExemption, lumpsumFutureValue, npsAtSixty, nscMaturity, ppfMaturity, RATES_NOTE, rdMaturity, sipForTarget, sipFutureValue, ssyMaturity } from '../../services/calculators';
import type { MoneyProfile } from '../../services/moneyProfile';
import { inr, parseMoney, shortInr } from './MoneyReport';

type Kind = 'money' | 'pct' | 'years' | 'number' | 'toggle';
interface Field { key: string; label: string; kind: Kind; value: (p: MoneyProfile | null) => number; hint?: string }
interface Output { headline: string; label: string; rows: Array<[string, string]>; formula: string; note?: string }
interface Calc { id: string; name: string; group: 'Grow' | 'Save safely' | 'Tax' | 'Borrow' | 'Retire'; blurb: string; fields: Field[]; run: (v: Record<string, number>) => Output }

const pct = (x: number) => `${(x * 100).toFixed(2).replace(/\.00$/, '')}%`;
const salary = (p: MoneyProfile | null) => p?.annualSalary ?? 1_200_000;

const CALCS: Calc[] = [
  { id: 'sip', name: 'SIP', group: 'Grow', blurb: 'What a monthly investment grows to.', fields: [
    { key: 'monthly', label: 'Monthly SIP', kind: 'money', value: () => 10_000 },
    { key: 'rate', label: 'Expected return a year', kind: 'pct', value: () => DEFAULT_RATES.equity },
    { key: 'years', label: 'Years', kind: 'years', value: () => 15 },
  ], run: (v) => { const fv = sipFutureValue(v.monthly, v.rate, v.years * 12); const inv = v.monthly * v.years * 12; return { headline: shortInr(fv), label: 'Estimated value', rows: [['Invested', inr(inv)], ['Gains', inr(fv - inv)]], formula: 'Each monthly instalment grows at the monthly equivalent of the yearly return, invested at the start of the month.' }; } },
  { id: 'lumpsum', name: 'Lumpsum', group: 'Grow', blurb: 'A one-time investment, compounded.', fields: [
    { key: 'amount', label: 'Amount', kind: 'money', value: (p) => p?.investments || 100_000 },
    { key: 'rate', label: 'Expected return a year', kind: 'pct', value: () => DEFAULT_RATES.equity },
    { key: 'years', label: 'Years', kind: 'years', value: () => 10 },
  ], run: (v) => { const fv = lumpsumFutureValue(v.amount, v.rate, v.years); return { headline: shortInr(fv), label: 'Estimated value', rows: [['Invested', inr(v.amount)], ['Gains', inr(fv - v.amount)]], formula: 'Amount × (1 + return)^years' }; } },
  { id: 'goal', name: 'Goal SIP', group: 'Grow', blurb: 'The SIP a goal needs, after inflation.', fields: [
    { key: 'cost', label: 'Goal cost today', kind: 'money', value: (p) => p?.goalAmountToday || 2_500_000 },
    { key: 'years', label: 'Years to goal', kind: 'years', value: (p) => p?.goalYears || 8 },
    { key: 'inflation', label: 'Inflation', kind: 'pct', value: () => 0.06 },
    { key: 'rate', label: 'Expected return a year', kind: 'pct', value: () => DEFAULT_RATES.equity },
  ], run: (v) => { const future = v.cost * (1 + v.inflation) ** v.years; const sip = sipForTarget(future, v.rate, v.years * 12); return { headline: `${inr(sip)}/mo`, label: 'SIP needed', rows: [['Goal cost then', inr(future)], ['Total invested', inr(sip * v.years * 12)]], formula: 'Cost × (1 + inflation)^years, then the start-of-month SIP that reaches it at the chosen return.' }; } },
  { id: 'cagr', name: 'CAGR', group: 'Grow', blurb: 'The yearly growth rate between two values.', fields: [
    { key: 'start', label: 'Starting value', kind: 'money', value: () => 100_000 },
    { key: 'end', label: 'Ending value', kind: 'money', value: () => 200_000 },
    { key: 'years', label: 'Years', kind: 'years', value: () => 5 },
  ], run: (v) => { const g = cagr(v.start, v.end, v.years); return { headline: Number.isFinite(g) ? pct(g) : '—', label: 'CAGR', rows: [['Total growth', Number.isFinite(g) ? pct(v.end / v.start - 1) : '—']], formula: '(End ÷ Start)^(1 ÷ years) − 1' }; } },
  { id: 'fd', name: 'Fixed deposit', group: 'Save safely', blurb: 'Cumulative FD, compounded quarterly.', fields: [
    { key: 'amount', label: 'Deposit', kind: 'money', value: (p) => p?.liquidSavings || 100_000 },
    { key: 'rate', label: 'Interest rate', kind: 'pct', value: () => DEFAULT_RATES.fd },
    { key: 'years', label: 'Years', kind: 'years', value: () => 3 },
  ], run: (v) => { const m = fdMaturity(v.amount, v.rate, v.years); return { headline: inr(m), label: 'Maturity value', rows: [['Interest earned', inr(m - v.amount)]], formula: 'Deposit × (1 + rate ÷ 4)^(4 × years)', note: 'FD interest is taxed at your slab rate; TDS applies above the yearly limit.' }; } },
  { id: 'rd', name: 'Recurring deposit', group: 'Save safely', blurb: 'Monthly deposits, compounded quarterly.', fields: [
    { key: 'monthly', label: 'Monthly deposit', kind: 'money', value: () => 5_000 },
    { key: 'rate', label: 'Interest rate', kind: 'pct', value: () => DEFAULT_RATES.fd },
    { key: 'months', label: 'Months', kind: 'number', value: () => 24 },
  ], run: (v) => { const m = rdMaturity(v.monthly, v.rate, v.months); return { headline: inr(m), label: 'Maturity value', rows: [['Deposited', inr(v.monthly * v.months)], ['Interest', inr(m - v.monthly * v.months)]], formula: 'Each instalment × (1 + rate ÷ 4)^(4 × months remaining ÷ 12), added up.' }; } },
  { id: 'ppf', name: 'PPF', group: 'Save safely', blurb: '15-year, tax-free government scheme.', fields: [
    { key: 'yearly', label: 'Yearly deposit (max ₹1,50,000)', kind: 'money', value: (p) => Math.min(150_000, p?.section80C || 150_000) },
    { key: 'rate', label: 'PPF rate', kind: 'pct', value: () => DEFAULT_RATES.ppf },
  ], run: (v) => { const r = ppfMaturity(v.yearly, v.rate); return { headline: shortInr(r.maturity), label: 'Value after 15 years', rows: [['Invested', inr(r.invested)], ['Tax-free interest', inr(r.interest)]], formula: 'Deposits at the start of each year, compounded yearly for 15 years.', note: RATES_NOTE }; } },
  { id: 'ssy', name: 'Sukanya Samriddhi', group: 'Save safely', blurb: 'For a daughter’s education or marriage.', fields: [
    { key: 'yearly', label: 'Yearly deposit (₹250 to ₹1,50,000)', kind: 'money', value: () => 100_000 },
    { key: 'rate', label: 'SSY rate', kind: 'pct', value: () => DEFAULT_RATES.ssy },
  ], run: (v) => { const r = ssyMaturity(v.yearly, v.rate); return { headline: shortInr(r.maturity), label: 'Value at maturity (21 years)', rows: [['Invested over 15 years', inr(r.invested)], ['Tax-free interest', inr(r.interest)]], formula: 'Yearly deposits for 15 years, then the balance keeps compounding until year 21.', note: RATES_NOTE }; } },
  { id: 'nsc', name: 'NSC', group: 'Save safely', blurb: '5-year National Savings Certificate.', fields: [
    { key: 'amount', label: 'Investment', kind: 'money', value: () => 100_000 },
    { key: 'rate', label: 'NSC rate', kind: 'pct', value: () => DEFAULT_RATES.nsc },
  ], run: (v) => { const m = nscMaturity(v.amount, v.rate); return { headline: inr(m), label: 'Value after 5 years', rows: [['Interest', inr(m - v.amount)]], formula: 'Amount × (1 + rate)^5, compounded yearly.', note: RATES_NOTE }; } },
  { id: 'tax', name: 'Old vs new tax', group: 'Tax', blurb: 'Which regime costs you less this year.', fields: [
    { key: 'salary', label: 'Annual salary', kind: 'money', value: salary },
    { key: 'c80', label: '80C used', kind: 'money', value: (p) => p?.section80C ?? 150_000 },
    { key: 'd80', label: '80D premium', kind: 'money', value: (p) => p?.section80D ?? 25_000 },
  ], run: (v) => {
    const now = new Date().toISOString();
    const deductions = ([['80c', v.c80], ['health-insurance', v.d80]] as const).filter(([, a]) => a > 0).map(([type, amount]) => ({ id: type, type, amount, description: type, status: 'added' as const, createdAt: now }));
    const c = compareTaxRegimes([{ id: 's', type: 'Salary', amount: v.salary / 12, currency: 'INR', frequency: 'Monthly', description: 'Salary', taxStatus: 'Pre-tax', startDate: now.slice(0, 10), tags: [], createdAt: now, updatedAt: now }], { ...createDefaultTaxProfile(), taxRegime: 'compare' }, deductions, []);
    const oldTax = Number(c.old.totalTaxLiability), newTax = Number(c.new.totalTaxLiability);
    return { headline: c.lowerEstimatedRegime === 'same' ? 'Same' : `${c.lowerEstimatedRegime === 'new' ? 'New' : 'Old'} regime`, label: c.lowerEstimatedRegime === 'same' ? 'Both cost the same' : `saves ${inr(Math.abs(oldTax - newTax))}`, rows: [['Old regime tax', inr(oldTax)], ['New regime tax', inr(newTax)]], formula: 'FY 2025-26 slabs, standard deduction, 87A rebate and 4% cess. 80C/80D reduce only the old-regime figure.', note: 'HRA and home-loan interest are not included; use the HRA calculator for rent.' };
  } },
  { id: 'hra', name: 'HRA exemption', group: 'Tax', blurb: 'How much of your HRA is tax-free.', fields: [
    { key: 'basic', label: 'Monthly basic + DA', kind: 'money', value: (p) => Math.round(salary(p) * 0.4 / 12), hint: 'Estimated at 40% of salary. Check your payslip.' },
    { key: 'hra', label: 'Monthly HRA received', kind: 'money', value: (p) => Math.round(salary(p) * 0.2 / 12), hint: 'Estimated at 20% of salary. Check your payslip.' },
    { key: 'rent', label: 'Monthly rent paid', kind: 'money', value: () => 25_000 },
    { key: 'metro', label: 'Metro city (Delhi, Mumbai, Kolkata, Chennai)', kind: 'toggle', value: () => 1 },
  ], run: (v) => { const r = hraExemption(v.basic, v.hra, v.rent, v.metro === 1); return { headline: `${inr(r.exempt)}/mo`, label: 'Tax-free HRA (old regime)', rows: [['Taxable HRA', `${inr(r.taxable)}/mo`], ['Yearly exemption', inr(r.exempt * 12)], ['Rent − 10% of basic', inr(r.limits.rentLessTenPercent)], [`${v.metro === 1 ? '50' : '40'}% of basic`, inr(r.limits.salaryShare)]], formula: 'The least of: HRA received, rent minus 10% of basic + DA, and 50% (metro) or 40% of basic + DA.' }; } },
  { id: 'emi', name: 'Loan EMI', group: 'Borrow', blurb: 'Monthly EMI and total interest.', fields: [
    { key: 'amount', label: 'Loan amount', kind: 'money', value: (p) => p?.loanOutstanding || 2_500_000 },
    { key: 'rate', label: 'Interest rate', kind: 'pct', value: () => 0.085 },
    { key: 'years', label: 'Tenure in years', kind: 'years', value: () => 20 },
  ], run: (v) => { const e = emi(v.amount, v.rate, v.years * 12); const total = e * v.years * 12; return { headline: `${inr(e)}/mo`, label: 'EMI', rows: [['Total interest', inr(total - v.amount)], ['Total paid', inr(total)]], formula: 'P × r × (1 + r)^n ÷ ((1 + r)^n − 1), with r the monthly rate and n the months.' }; } },
  { id: 'nps', name: 'NPS pension', group: 'Retire', blurb: 'Corpus and pension at 60.', fields: [
    { key: 'monthly', label: 'Monthly contribution', kind: 'money', value: () => 5_000 },
    { key: 'age', label: 'Your age', kind: 'number', value: (p) => p?.age ?? 30 },
    { key: 'rate', label: 'Expected return a year', kind: 'pct', value: () => 0.1 },
    { key: 'annuity', label: 'Share used for annuity (min 40%)', kind: 'pct', value: () => 0.4 },
  ], run: (v) => { const r = npsAtSixty(v.monthly, v.age, v.rate, v.annuity); return { headline: `${inr(r.monthlyPension)}/mo`, label: 'Estimated pension at 60', rows: [['Corpus at 60', inr(r.corpus)], ['Tax-free lump sum', inr(r.lumpsum)], ['Invested', inr(r.invested)]], formula: 'Monthly SIP maths to age 60; at least 40% buys an annuity paying about 6% a year.', note: 'Annuity rates vary by insurer and age; the pension is taxable.' }; } },
  { id: 'fire', name: 'FIRE / freedom', group: 'Retire', blurb: 'When your money can pay for your life.', fields: [
    { key: 'age', label: 'Your age', kind: 'number', value: (p) => p?.age ?? 30 },
    { key: 'spend', label: 'Monthly spending', kind: 'money', value: (p) => p?.monthlyExpenses ?? 50_000 },
    { key: 'emi', label: 'Monthly EMIs', kind: 'money', value: (p) => p?.monthlyEmi ?? 0 },
    { key: 'invested', label: 'Invested today', kind: 'money', value: (p) => p?.investments ?? 500_000 },
    { key: 'salary', label: 'Annual salary', kind: 'money', value: salary },
    { key: 'retire', label: 'Retire at', kind: 'number', value: (p) => p?.retireAge ?? 60 },
  ], run: (v) => {
    const r = buildMoneyCheck({ age: v.age, annualSalary: v.salary, monthlyExpenses: v.spend, monthlyEmi: v.emi, liquidSavings: 0, investments: v.invested, dependants: 0, retireAge: v.retire });
    return { headline: shortInr(r.freedom.corpusNeeded), label: `Freedom number at ${v.retire}`, rows: [['SIP needed', `${inr(r.freedom.monthlySipNeeded)}/mo`], ['Free by age (investing all surplus)', r.freedom.freedomAge ? String(r.freedom.freedomAge) : 'Not within plan'], ['Spending at retirement', `${inr(r.freedom.annualExpenseAtRetirement)}/yr`]], formula: 'Spending grown at 6% inflation, funded to age 85 at 7% while still rising with inflation; investments grow at 10% until then.' };
  } },
];

const GROUPS: Calc['group'][] = ['Grow', 'Save safely', 'Tax', 'Borrow', 'Retire'];

const toText = (kind: Kind, n: number) => (kind === 'pct' ? String(Math.round(n * 10000) / 100) : kind === 'money' ? n.toLocaleString('en-IN') : String(n));
const fromText = (kind: Kind, s: string) => (kind === 'pct' ? Number(s) / 100 : kind === 'money' ? parseMoney(s) : Number(s));

const CalcPanel: React.FC<{ calc: Calc; profile: MoneyProfile | null; onBack: () => void }> = ({ calc, profile, onBack }) => {
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries(calc.fields.map((f) => [f.key, toText(f.kind, f.value(profile))])));
  const values = useMemo(() => Object.fromEntries(calc.fields.map((f) => [f.key, fromText(f.kind, text[f.key] ?? '')])), [calc, text]);
  const bad = calc.fields.find((f) => !Number.isFinite(values[f.key]) || values[f.key] < 0);
  const out = bad ? null : calc.run(values);
  return <div className="ch-panel">
    <button type="button" className="ch-back" onClick={onBack}><ArrowLeft size={15}/> All calculators</button>
    <div className="ch-panel-grid">
      <div>
        <small className="mh-kicker">{calc.group}</small>
        <h3>{calc.name}</h3>
        <p className="ch-blurb">{calc.blurb}{profile ? ' Pre-filled from your profile where it applies.' : ''}</p>
        <div className="ch-fields">{calc.fields.map((f) => f.kind === 'toggle'
          ? <label key={f.key} className="ch-toggle"><input type="checkbox" checked={text[f.key] === '1'} onChange={(e) => setText((t) => ({ ...t, [f.key]: e.target.checked ? '1' : '0' }))}/>{f.label}</label>
          : <label key={f.key} className="ch-field"><span>{f.label}</span><div>{f.kind === 'money' && <i>₹</i>}<input value={text[f.key]} onChange={(e) => setText((t) => ({ ...t, [f.key]: e.target.value }))} inputMode="decimal" aria-label={f.label}/>{f.kind === 'pct' && <i>%</i>}</div>{f.hint && <small>{f.hint}</small>}</label>)}
        </div>
      </div>
      <div className="ch-result" aria-live="polite">
        {out ? <>
          <small>{out.label}</small>
          <motion.b key={out.headline} initial={{ opacity: 0.3, y: 6 }} animate={{ opacity: 1, y: 0 }}>{out.headline}</motion.b>
          <dl>{out.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <p className="ch-formula"><strong>How:</strong> {out.formula}</p>
          {out.note && <p className="ch-note">{out.note}</p>}
        </> : <p className="ch-note">Check “{bad?.label}”. Use numbers like 85,000 or 1,20,000.</p>}
      </div>
    </div>
  </div>;
};

/** Every planning calculator in one place, grouped by what the user is trying to do. */
export const CalculatorsHub: React.FC<{ profile: MoneyProfile | null }> = ({ profile }) => {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  const calc = CALCS.find((c) => c.id === open);
  return <div className="ch">
    <AnimatePresence mode="wait" initial={false}>
      {calc
        ? <motion.div key={calc.id} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -8 }}><CalcPanel calc={calc} profile={profile} onBack={() => setOpen(null)}/></motion.div>
        : <motion.div key="grid" className="ch-groups" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduced ? undefined : { opacity: 0 }}>
            {GROUPS.map((group) => <div key={group} className="ch-group">
              <small>{group}</small>
              <div className="ch-grid">{CALCS.filter((c) => c.group === group).map((c) => <button key={c.id} type="button" className="ch-card" onClick={() => setOpen(c.id)}>
                <span className="ch-icon" aria-hidden="true"><Calculator size={15}/></span><b>{c.name}</b><span>{c.blurb}</span>
              </button>)}</div>
            </div>)}
          </motion.div>}
    </AnimatePresence>
  </div>;
};

export const CALCULATOR_COUNT = CALCS.length;
