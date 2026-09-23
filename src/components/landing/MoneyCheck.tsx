import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { buildMoneyCheck, MONEY_CHECK_ASSUMPTIONS, validateMoneyCheck, type MoneyCheckInputs, type MoneyCheckReport } from '../../services/moneyCheck';
import './moneyCheck.css';

const pct = (rate: number) => `${Math.round(rate * 1000) / 10}%`;
const inr = (v: number) => `${v < 0 ? '−' : ''}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`;
const short = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(1)} L`;
  return inr(v);
};
const parseMoney = (value: string) => {
  const clean = value.replace(/[₹,\s]/g, '').toLowerCase();
  if (!clean) return 0;
  const match = clean.match(/^(\d+(?:\.\d+)?)(k|l|lakh|lac|cr|crore)?$/);
  if (!match) return Number.NaN;
  const unit = match[2];
  return Number(match[1]) * (unit === 'k' ? 1e3 : unit?.startsWith('l') ? 1e5 : unit?.startsWith('c') ? 1e7 : 1);
};

type Field = { key: keyof MoneyCheckInputs; label: string; hint: string; money?: boolean };
const MAIN: Field[] = [
  { key: 'age', label: 'Your age', hint: 'Years' },
  { key: 'annualSalary', label: 'Annual salary (before tax)', hint: 'e.g. 18 lakh', money: true },
  { key: 'monthlyExpenses', label: 'Monthly spending', hint: 'Excluding EMIs', money: true },
  { key: 'monthlyEmi', label: 'Monthly EMIs', hint: '0 if none', money: true },
  { key: 'liquidSavings', label: 'Cash & FDs', hint: 'Bank, FDs, liquid funds', money: true },
  { key: 'investments', label: 'Investments', hint: 'MF, stocks, PPF, EPF, NPS', money: true },
];
const MORE: Field[] = [
  { key: 'loanOutstanding', label: 'Loans outstanding', hint: 'Total principal left', money: true },
  { key: 'termCover', label: 'Term insurance cover', hint: 'Sum assured', money: true },
  { key: 'healthCover', label: 'Health insurance cover', hint: 'Family floater + top-up', money: true },
  { key: 'section80C', label: '80C invested this year', hint: 'EPF, PPF, ELSS, LIC… (max 1.5 L)', money: true },
  { key: 'section80D', label: '80D health premium', hint: 'Premium paid (max 25k)', money: true },
  { key: 'retireAge', label: 'Retire at age', hint: 'Default 60' },
  { key: 'goalAmountToday', label: 'A goal, in today’s ₹', hint: 'e.g. 25 lakh home down payment', money: true },
  { key: 'goalYears', label: 'Goal in how many years', hint: 'Years' },
];

const START: Record<string, string> = { age: '30', annualSalary: '15 lakh', monthlyExpenses: '45k', monthlyEmi: '12k', liquidSavings: '2 lakh', investments: '5 lakh', retireAge: '60' };

const Tile: React.FC<{ label: string; value: string; sub?: string; tone?: 'neg' | 'pos'; how: string; i: number }> = ({ label, value, sub, tone, how, i }) => {
  const [open, setOpen] = useState(false);
  return <motion.div className={`mc-tile ${tone ?? ''}`} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.35 }}>
    <small>{label}</small>
    <motion.b key={value} initial={{ opacity: 0.2, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>{value}</motion.b>
    {sub && <span className="mc-sub">{sub}</span>}
    <button type="button" className="mc-how" aria-expanded={open} onClick={() => setOpen((v) => !v)}>How it’s calculated <ChevronDown size={12}/></button>
    {open && <p className="mc-how-text">{how}</p>}
  </motion.div>;
};

export const MoneyCheck: React.FC<{ onAsk: (prompt: string) => void }> = ({ onAsk }) => {
  const reduced = useReducedMotion();
  const [values, setValues] = useState<Record<string, string>>(START);
  const [dependants, setDependants] = useState(1);
  const [more, setMore] = useState(false);
  const [touched, setTouched] = useState(false);

  const { inputs, fieldError } = useMemo(() => {
    const out: Record<string, number> = {};
    let bad: string | null = null;
    for (const f of [...MAIN, ...MORE]) {
      const raw = values[f.key] ?? '';
      const n = f.money ? parseMoney(raw) : raw.trim() ? Number(raw) : 0;
      if (!Number.isFinite(n) || n < 0) { bad = `Check “${f.label}”. Use numbers like 85000, 85k or 1.2 lakh.`; continue; }
      out[f.key] = n;
    }
    const built = { ...out, dependants, retireAge: out.retireAge || 60 } as unknown as MoneyCheckInputs;
    return { inputs: built, fieldError: bad };
  }, [values, dependants]);

  const error = fieldError ?? validateMoneyCheck(inputs);
  const report: MoneyCheckReport | null = useMemo(() => (error ? null : buildMoneyCheck(inputs)), [error, inputs]);

  const set = (key: string, v: string) => { setTouched(true); setValues((cur) => ({ ...cur, [key]: v })); };
  const field = (f: Field) => <label key={f.key} className="mc-field">
    <span>{f.label}</span>
    <input value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} placeholder={f.hint} inputMode={f.money ? 'text' : 'numeric'} aria-label={f.label}/>
    <small>{f.hint}</small>
  </label>;

  const askPrompt = report ? [
    'Review my Money Check and tell me what to do first, in plain language.',
    `Age ${inputs.age}, salary ${inr(inputs.annualSalary)}/yr, take-home ${inr(report.tax.monthlyTakeHome)}/mo, spending ${inr(inputs.monthlyExpenses)}/mo, EMIs ${inr(inputs.monthlyEmi)}/mo, ${dependants} dependant(s).`,
    `Verified results: health score ${report.health.score}/100; ${report.tax.better} tax regime saves ${inr(report.tax.saving)}; emergency gap ${inr(report.emergency.gap)}; freedom number ${inr(report.freedom.corpusNeeded)} needing ${inr(report.freedom.monthlySipNeeded)}/mo SIP; term cover gap ${inr(report.protection.termGap)}; health cover gap ${inr(report.protection.healthGap)}.`,
  ].join(' ') : '';

  return <section id="money-check" className="mc-section" aria-labelledby="mc-title">
    <div className="cl-wrap">
      <div className="cl-eyebrow mc-eyebrow">Money Check</div>
      <h2 id="mc-title">Six numbers. Your complete money report.</h2>
      <p className="mc-lead">Fill it once. Tax, freedom number, insurance, emergency fund and net worth update instantly as you type. Nothing is stored or sent.</p>

      <div className="mc-grid">
        <form className="mc-form" onSubmit={(e) => e.preventDefault()} aria-label="Your numbers">
          <div className="mc-fields">{MAIN.map(field)}</div>
          <div className="mc-deps" role="group" aria-label="People who depend on your income">
            <span>People who depend on you</span>
            <div>{[0, 1, 2, 3, 4].map((n) => <button key={n} type="button" className={dependants === n ? 'on' : ''} aria-pressed={dependants === n} onClick={() => { setTouched(true); setDependants(n); }}>{n === 4 ? '4+' : n}</button>)}</div>
          </div>
          <button type="button" className="mc-more" aria-expanded={more} onClick={() => setMore((v) => !v)}>{more ? 'Fewer details' : 'Add insurance, 80C and a goal (optional)'} <ChevronDown size={14} className={more ? 'up' : ''}/></button>
          <AnimatePresence initial={false}>{more && <motion.div className="mc-fields mc-fields-more" initial={reduced ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={reduced ? undefined : { opacity: 0, height: 0 }}>{MORE.map(field)}</motion.div>}</AnimatePresence>
          {!touched && <p className="mc-example">Example values are filled in. Replace them with yours.</p>}
          {error && <p className="mc-error" role="alert">{error}</p>}
        </form>

        <div className="mc-report">
          {report ? <>
            <div className="mc-score" aria-live="polite">
              <div className="mc-ring" style={{ '--deg': `${report.health.score * 3.6}deg` } as React.CSSProperties}><b>{report.health.score}</b><span>/100</span></div>
              <div><small>Money health</small><b>{report.health.status}</b><p>{report.health.summary}</p></div>
            </div>
            <div className="mc-tiles">
              <Tile i={0} label="Better tax regime" value={report.tax.better === 'same' ? 'Same either way' : `${report.tax.better === 'new' ? 'New' : 'Old'} · saves ${short(report.tax.saving)}`} sub={`Old ${short(report.tax.oldRegimeTax)} · New ${short(report.tax.newRegimeTax)}`} how="Both regimes use FY 2025-26 slabs, the standard deduction, the section 87A rebate and 4% cess. Your 80C, 80D and NPS amounts count only under the old regime, within their caps. Surcharge applies above ₹50 lakh; HRA and home-loan interest are not included."/>
              <Tile i={1} label="Monthly take-home" value={inr(report.tax.monthlyTakeHome)} sub={`Surplus ${inr(report.cashflow.surplus)}/mo`} tone={report.cashflow.surplus < 0 ? 'neg' : undefined} how="Annual salary minus the lower of the two tax figures, divided by 12. Employee PF and professional tax are not deducted, so your payslip may be slightly lower."/>
              <Tile i={2} label="Freedom number" value={short(report.freedom.corpusNeeded)} sub={`SIP ${inr(report.freedom.monthlySipNeeded)}/mo${report.freedom.freedomAge ? ` · free by ${report.freedom.freedomAge}` : ''}`} how={`Today's spending grown at ${pct(MONEY_CHECK_ASSUMPTIONS.inflation)} inflation to retirement, then funded to age ${MONEY_CHECK_ASSUMPTIONS.lifeExpectancy} with a ${pct(MONEY_CHECK_ASSUMPTIONS.postRetirementReturn)} return while it keeps rising with inflation. Investments grow at ${pct(MONEY_CHECK_ASSUMPTIONS.preRetirementReturn)} before retirement. 'Free by' assumes you invest your whole monthly surplus.`}/>
              <Tile i={3} label="Emergency fund" value={report.emergency.gap > 0 ? `Gap ${short(report.emergency.gap)}` : 'Covered'} sub={`Target ${short(report.emergency.target)} · ${Number.isFinite(report.emergency.months) ? report.emergency.months.toFixed(1) : '∞'} months now`} tone={report.emergency.gap > 0 ? 'neg' : 'pos'} how="Six months of spending plus EMIs, kept in cash, sweep FDs or liquid funds. 'Months now' is your cash and FDs divided by monthly spending plus EMIs."/>
              <Tile i={4} label="Term insurance" value={report.protection.termGap > 0 ? `Gap ${short(report.protection.termGap)}` : report.protection.termCoverNeeded > 0 ? 'Covered' : 'Not essential now'} sub={`Need ${short(report.protection.termCoverNeeded)}`} tone={report.protection.termGap > 0 ? 'neg' : 'pos'} how={`Present value of your household's spending until retirement (rising ${pct(MONEY_CHECK_ASSUMPTIONS.inflation)} a year, discounted at ${pct(MONEY_CHECK_ASSUMPTIONS.protectionDiscountRate)}), plus loans outstanding, minus the cash and investments your family could use. Zero when nobody depends on your income.`}/>
              <Tile i={5} label="Health insurance" value={report.protection.healthGap > 0 ? `Gap ${short(report.protection.healthGap)}` : 'Covered'} sub={`Suggested ${short(report.protection.healthCoverSuggested)}`} tone={report.protection.healthGap > 0 ? 'neg' : 'pos'} how="A rule of thumb for city hospital costs: ₹10 lakh for up to two people, ₹15 lakh for three or four, ₹20 lakh for five or more. A super top-up is the cheapest way to add cover."/>
              <Tile i={6} label="Net worth" value={short(report.netWorth)} tone={report.netWorth < 0 ? 'neg' : undefined} how="Cash and FDs plus investments, minus loans outstanding. Property and gold are not included."/>
              {report.goal && <Tile i={7} label="Your goal" value={`${short(report.goal.futureCost)} then`} sub={`SIP ${inr(report.goal.monthlySip)}/mo`} how={`Today's cost grown at ${pct(MONEY_CHECK_ASSUMPTIONS.inflation)} a year, and the monthly SIP that reaches it at a ${pct(MONEY_CHECK_ASSUMPTIONS.preRetirementReturn)} return.`}/>}
            </div>
            {report.actions.length > 0 && <div className="mc-actions">
              <b>Do these first</b>
              <ol>{report.actions.map((a) => <li key={a.title}><strong>{a.title}</strong><span>{a.detail}</span></li>)}</ol>
            </div>}
            <div className="mc-foot">
              <button type="button" className="mc-ask" onClick={() => onAsk(askPrompt)}><Sparkles size={15}/> Ask the AI CFO about this report</button>
              <small>Estimates for planning, not tax filing or investment advice. Returns and inflation are assumptions, not guarantees.</small>
            </div>
          </> : <div className="mc-empty">Enter your numbers to see your report.</div>}
        </div>
      </div>
    </div>
  </section>;
};
