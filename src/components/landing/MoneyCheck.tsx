import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { buildMoneyCheck, validateMoneyCheck, type MoneyCheckInputs, type MoneyCheckReport } from '../../services/moneyCheck';
import { MoneyReportView, moneyAskPrompt, parseMoney } from '../money/MoneyReport';
import './moneyCheck.css';

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
            <MoneyReportView report={report} onAsk={() => onAsk(moneyAskPrompt(inputs, report))}/>
          </> : <div className="mc-empty">Enter your numbers to see your report.</div>}
        </div>
      </div>
    </div>
  </section>;
};
