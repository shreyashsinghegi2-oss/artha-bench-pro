import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, ClipboardPaste, FileUp, Loader2, Pencil, ScanLine, X } from 'lucide-react';
import { applySuggestions, scanFile, scanText, type ScanResult, type ScanSuggestion } from '../../services/documentScan';
import { validateMoneyCheck, type MoneyCheckInputs } from '../../services/moneyCheck';
import type { MoneyProfile } from '../../services/moneyProfile';
import { inr, parseMoney, shortInr } from './MoneyReport';

type Answers = Partial<MoneyCheckInputs> & { name?: string };
type Chip = { label: string; value: number };

interface Step {
  key: keyof Answers;
  title: (a: Answers) => string;
  help: string;
  kind: 'money' | 'number' | 'choice' | 'text';
  chips?: Chip[];
  optional?: boolean;
  /** Monthly/annual toggle for salary. */
  periodToggle?: boolean;
  skip?: (a: Answers) => boolean;
  format?: (value: number) => string;
}

const L = 1e5;
const STEPS: Step[] = [
  { key: 'name', kind: 'text', optional: true, title: () => 'First, what should we call you?', help: 'Optional. Only used to greet you on this device.' },
  { key: 'age', kind: 'number', title: (a) => `${a.name ? `Nice to meet you, ${a.name}. ` : ''}How old are you?`, help: 'Your age sets how long your money has to grow.', chips: [25, 30, 35, 40, 45, 50].map((v) => ({ label: String(v), value: v })), format: (v) => `${v} years` },
  { key: 'annualSalary', kind: 'money', periodToggle: true, title: () => 'What is your salary before tax?', help: 'Gross pay from your payslip or offer letter. Switch to monthly if that is easier.', chips: [6, 10, 15, 25, 40].map((v) => ({ label: `${inr(v * L)} / yr`, value: v * L })) },
  { key: 'monthlyExpenses', kind: 'money', title: () => 'Roughly how much do you spend in a month?', help: 'Rent, food, bills, travel and shopping. Leave out loan EMIs; we ask for those next.', chips: [[25, 25_000], [40, 40_000], [60, 60_000], [80, 80_000], [100, L]].map(([, v]) => ({ label: inr(v), value: v })) },
  { key: 'monthlyEmi', kind: 'money', title: () => 'Do you pay any loan EMIs?', help: 'Add up home, car, personal and credit-card EMIs for one month.', chips: [{ label: 'No EMIs', value: 0 }, { label: inr(10_000), value: 10_000 }, { label: inr(25_000), value: 25_000 }, { label: inr(50_000), value: 50_000 }] },
  { key: 'loanOutstanding', kind: 'money', optional: true, skip: (a) => !a.monthlyEmi, title: () => 'About how much is still left to repay on those loans?', help: 'Principal outstanding across all loans. Skip if unsure.', chips: [{ label: 'Not sure', value: 0 }, { label: inr(5 * L), value: 5 * L }, { label: inr(20 * L), value: 20 * L }, { label: inr(50 * L), value: 50 * L }] },
  { key: 'liquidSavings', kind: 'money', title: () => 'How much do you keep in savings and FDs?', help: 'Money you could use within a few days: bank balance, FDs, liquid funds.', chips: [{ label: 'Almost none', value: 0 }, { label: inr(L), value: L }, { label: inr(3 * L), value: 3 * L }, { label: inr(5 * L), value: 5 * L }, { label: inr(10 * L), value: 10 * L }] },
  { key: 'investments', kind: 'money', title: () => 'And how much is invested for the long term?', help: 'Mutual funds, stocks, PPF, EPF and NPS together.', chips: [{ label: 'Nothing yet', value: 0 }, { label: inr(2 * L), value: 2 * L }, { label: inr(5 * L), value: 5 * L }, { label: inr(10 * L), value: 10 * L }, { label: inr(25 * L), value: 25 * L }] },
  { key: 'dependants', kind: 'choice', title: () => 'How many people depend on your income?', help: 'Spouse, children or parents you support.', chips: [0, 1, 2, 3, 4].map((v) => ({ label: v === 4 ? '4 or more' : v === 0 ? 'Just me' : String(v), value: v })), format: (v) => (v ? `${v}` : 'Just me') },
  { key: 'termCover', kind: 'money', title: () => 'Do you have term life insurance?', help: 'The sum assured on pure term plans. Employer group cover counts only while you stay in the job.', chips: [{ label: 'No', value: 0 }, { label: inr(50 * L), value: 50 * L }, { label: inr(100 * L), value: 100 * L }, { label: inr(200 * L), value: 200 * L }] },
  { key: 'healthCover', kind: 'money', title: () => 'How much health insurance cover do you have?', help: 'Your family floater plus any top-up. Include employer cover if you have nothing else.', chips: [{ label: 'None', value: 0 }, { label: inr(5 * L), value: 5 * L }, { label: inr(10 * L), value: 10 * L }, { label: inr(25 * L), value: 25 * L }] },
  { key: 'section80C', kind: 'money', title: () => 'How much have you put into 80C this year?', help: 'EPF, PPF, ELSS, life insurance premiums, children’s tuition. It only matters in the old tax regime.', chips: [{ label: 'Nothing', value: 0 }, { label: `About ${inr(75_000)}`, value: 75_000 }, { label: `Full ${inr(150_000)}`, value: 150_000 }, { label: 'Not sure', value: 0 }] },
  { key: 'retireAge', kind: 'number', title: () => 'At what age would you like to stop working?', help: 'We plan your freedom number around this age.', chips: [45, 50, 55, 60, 65].map((v) => ({ label: String(v), value: v })), format: (v) => `${v}` },
  { key: 'goalAmountToday', kind: 'money', optional: true, title: () => 'Is there one big goal you are saving for?', help: 'A home down payment, a child’s education, a car. Enter today’s cost, or skip.', chips: [{ label: 'No goal now', value: 0 }, { label: inr(10 * L), value: 10 * L }, { label: inr(25 * L), value: 25 * L }, { label: inr(50 * L), value: 50 * L }] },
  { key: 'goalYears', kind: 'number', skip: (a) => !a.goalAmountToday, title: () => 'In how many years do you need it?', help: 'We add inflation and work out the monthly SIP.', chips: [3, 5, 8, 10, 15].map((v) => ({ label: `${v} years`, value: v })), format: (v) => `${v} years` },
];

const display = (step: Step, value: unknown) => {
  if (value === undefined || value === '') return 'Skipped';
  if (step.kind === 'text') return String(value);
  const n = Number(value);
  if (step.format) return step.format(n);
  return step.kind === 'money' ? (n === 0 ? '₹0' : shortInr(n)) : String(n);
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Name', age: 'Age', annualSalary: 'Salary (yearly, before tax)', monthlyExpenses: 'Monthly spending', monthlyEmi: 'Monthly EMIs',
  loanOutstanding: 'Loans left to repay', liquidSavings: 'Savings & FDs', investments: 'Long-term investments', dependants: 'People who depend on you',
  termCover: 'Term cover', healthCover: 'Health cover', section80C: '80C this year', section80D: '80D premium', retireAge: 'Stop working at',
  goalAmountToday: 'Goal (today’s cost)', goalYears: 'Goal in',
};

export const MoneySetup: React.FC<{
  initial?: Partial<MoneyProfile> | null;
  startWithScan?: boolean;
  onDone: (profile: MoneyProfile) => void;
  onCancel: () => void;
}> = ({ initial, startWithScan, onDone, onCancel }) => {
  const reduced = useReducedMotion();
  const [answers, setAnswers] = useState<Answers>(() => ({ ...(initial ?? {}) }));
  const [scanned, setScanned] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<'scan' | 'ask' | 'review'>(startWithScan ? 'scan' : 'ask');
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [monthly, setMonthly] = useState(false);
  const [error, setError] = useState('');
  // Values found across every document scanned in this session; a later document wins for the same field.
  const [found, setFound] = useState<Array<ScanSuggestion & { source: string }>>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [scan, setScan] = useState<{ busy: boolean; notes: string[]; paste: string; showPaste: boolean; file?: string }>({ busy: false, notes: [], paste: '', showPaste: false });
  const input = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => STEPS.filter((s) => !s.skip?.(answers)), [answers]);
  const step = visible[Math.min(index, visible.length - 1)];
  const progress = phase === 'review' ? 1 : (index + 1) / (visible.length + 1);

  useEffect(() => {
    if (phase !== 'ask' || !step) return;
    const v = answers[step.key];
    setDraft(v === undefined ? '' : step.kind === 'money' ? (Number(v) ? Number(v).toLocaleString('en-IN') : '0') : String(v));
    setMonthly(false);
    setError('');
    window.setTimeout(() => input.current?.focus({ preventScroll: true }), 80);
  }, [index, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (value: number | string | undefined) => {
    const next = { ...answers, [step.key]: value } as Answers;
    setAnswers(next);
    const nextVisible = STEPS.filter((s) => !s.skip?.(next));
    const pos = nextVisible.findIndex((s) => s.key === step.key);
    if (pos + 1 < nextVisible.length) setIndex(pos + 1);
    else setPhase('review');
  };

  const submitDraft = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (step.kind === 'text') return commit(draft.trim().slice(0, 30) || undefined);
    if (!draft.trim()) {
      if (step.optional) return commit(step.kind === 'money' ? 0 : undefined);
      return setError('Please enter a number, or tap one of the options.');
    }
    const n = step.kind === 'money' ? parseMoney(draft) : Number(draft);
    if (!Number.isFinite(n) || n < 0) return setError('That doesn’t look like a number. Try 85,000 or 1,20,000.');
    if (step.key === 'age' && (n < 18 || n > 75)) return setError('Enter an age between 18 and 75.');
    if (step.key === 'retireAge' && answers.age && n <= answers.age) return setError(`Pick an age after ${answers.age}.`);
    commit(step.periodToggle && monthly ? n * 12 : n);
  };

  const back = () => {
    if (phase === 'review') { setPhase('ask'); setIndex(visible.length - 1); return; }
    if (index === 0) { if (startWithScan) setPhase('scan'); else onCancel(); return; }
    setIndex(index - 1);
  };

  // Scanning
  const merge = (result: ScanResult, source: string) => {
    setFound((cur) => [...cur.filter((f) => !result.suggestions.some((s) => s.field === f.field)), ...result.suggestions.map((s) => ({ ...s, source }))]);
    setPicked((cur) => new Set([...cur, ...result.suggestions.map((s) => s.field)]));
    setScan((s) => ({ ...s, busy: false, notes: result.notes, file: source }));
  };
  const runScan = async (file: File) => {
    setScan((s) => ({ ...s, busy: true, notes: [], file: file.name }));
    try {
      merge(await scanFile(file), file.name);
    } catch {
      setScan((s) => ({ ...s, busy: false, notes: ['This file could not be read. Try a different PDF or CSV, or type the amounts in.'] }));
    }
  };
  const runPaste = () => merge(scanText(scan.paste), 'pasted text');
  const useScan = () => {
    const chosen: ScanSuggestion[] = found.filter((f) => picked.has(f.field));
    setAnswers((a) => applySuggestions(a, chosen) as Answers);
    setScanned(new Set(chosen.map((c) => c.field)));
    setIndex(0);
    setPhase('ask');
  };

  const finish = () => {
    const inputs = { ...answers, dependants: answers.dependants ?? 0, retireAge: answers.retireAge ?? 60 } as MoneyCheckInputs;
    const problem = validateMoneyCheck(inputs);
    if (problem) { setError(problem); return; }
    onDone({ ...inputs, name: answers.name, updatedAt: new Date().toISOString(), source: scanned.size ? 'scan' : 'questions' });
  };

  const motionProps = reduced ? {} : { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.28, ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number] } };

  return <div className="ms" role="dialog" aria-modal="false" aria-labelledby="ms-title">
    <div className="ms-top">
      <button type="button" className="ms-icon" onClick={phase === 'scan' ? onCancel : back} aria-label={phase === 'scan' ? 'Close' : 'Back'}>{phase === 'scan' ? <X size={18}/> : <ArrowLeft size={18}/>}</button>
      <div className="ms-progress" aria-hidden="true"><i style={{ transform: `scaleX(${phase === 'scan' ? 0.02 : progress})` }}/></div>
      <button type="button" className="ms-link" onClick={onCancel}>Save for later</button>
    </div>

    <AnimatePresence mode="wait" initial={false}>
      {phase === 'scan' && <motion.div key="scan" className="ms-body" {...motionProps}>
        <small className="ms-kicker">Fill from a document</small>
        <h2 id="ms-title">Upload a payslip, Form 16 or bank statement.</h2>
        <p className="ms-help">It is read on this device, never uploaded. You confirm every number before it is used.</p>
        <input ref={fileInput} type="file" accept=".pdf,.csv,.txt,application/pdf,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void runScan(f); e.target.value = ''; }}/>
        <button type="button" className="ms-drop" onClick={() => fileInput.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void runScan(f); }}>
          {scan.busy ? <Loader2 className="spin" size={22}/> : <FileUp size={22}/>}
          <b>{scan.busy ? `Reading ${scan.file}…` : 'Choose a file or drop it here'}</b>
          <span>PDF payslip or Form 16 · CSV bank statement</span>
        </button>
        <button type="button" className="ms-link" onClick={() => setScan((s) => ({ ...s, showPaste: !s.showPaste }))}><ClipboardPaste size={14}/> Or paste text from a payslip</button>
        {scan.showPaste && <div className="ms-paste"><textarea value={scan.paste} onChange={(e) => setScan((s) => ({ ...s, paste: e.target.value }))} rows={4} placeholder="Paste the lines that show Gross earnings, deductions and net pay" aria-label="Payslip text"/><button type="button" className="ms-secondary" onClick={runPaste} disabled={!scan.paste.trim()}><ScanLine size={14}/> Read text</button></div>}
        {(found.length > 0 || scan.notes.length > 0) && <div className="ms-found">
          <b>{found.length ? 'Found so far. Add another document or continue.' : 'Nothing to fill yet'}</b>
          {found.map((f) => <label key={f.field} className="ms-found-row">
            <input type="checkbox" checked={picked.has(f.field)} onChange={() => setPicked((cur) => { const next = new Set(cur); if (next.has(f.field)) next.delete(f.field); else next.add(f.field); return next; })}/>
            <span><strong>{f.label}: {inr(f.value)}</strong><small>{f.source} · “{f.evidence}”</small></span>
          </label>)}
          {scan.notes.map((n) => <p key={n} className="ms-note">{n}</p>)}
        </div>}
        <div className="ms-actions">
          {found.length ? <button type="button" className="ms-primary" onClick={useScan} disabled={!picked.size}>Use {picked.size} value{picked.size === 1 ? '' : 's'} and continue <ArrowRight size={16}/></button> : null}
          <button type="button" className="ms-secondary" onClick={() => { setIndex(0); setPhase('ask'); }}>Answer questions instead</button>
        </div>
      </motion.div>}

      {phase === 'ask' && step && <motion.div key={`q-${step.key}`} className="ms-body" {...motionProps}>
        <small className="ms-kicker">Question {index + 1} of {visible.length}{scanned.has(step.key as string) ? ' · filled from your document' : ''}</small>
        <h2 id="ms-title">{step.title(answers)}</h2>
        <p className="ms-help">{step.help}</p>
        {step.chips && <div className="ms-chips" role="group" aria-label="Quick answers">
          {step.chips.map((chip) => <button key={chip.label} type="button" className={answers[step.key] !== undefined && answers[step.key] === chip.value ? 'on' : ''} onClick={() => commit(chip.value)}>{chip.label}</button>)}
        </div>}
        <form className="ms-form" onSubmit={submitDraft}>
          <div className="ms-input">
            {step.kind === 'money' && <span aria-hidden="true">₹</span>}
            <input ref={input} value={draft} onChange={(e) => { setDraft(e.target.value); setError(''); }} inputMode={step.kind === 'text' ? 'text' : step.kind === 'money' ? 'text' : 'numeric'} placeholder={step.kind === 'text' ? 'Your first name' : step.kind === 'money' ? (step.chips ? 'Or type an amount, e.g. 45,000' : 'Amount') : 'Or type a number'} aria-label={step.title(answers)} aria-invalid={Boolean(error)}/>
            {step.periodToggle && <div className="ms-period" role="group" aria-label="Salary period"><button type="button" className={!monthly ? 'on' : ''} onClick={() => setMonthly(false)}>per year</button><button type="button" className={monthly ? 'on' : ''} onClick={() => setMonthly(true)}>per month</button></div>}
          </div>
          {error && <p className="ms-error" role="alert">{error}</p>}
          <div className="ms-actions">
            <button type="submit" className="ms-primary">{step.optional && !draft.trim() ? 'Skip' : 'Next'} <ArrowRight size={16}/></button>
          </div>
        </form>
      </motion.div>}

      {phase === 'review' && <motion.div key="review" className="ms-body" {...motionProps}>
        <small className="ms-kicker">Almost done</small>
        <h2 id="ms-title">Check your answers.</h2>
        <p className="ms-help">Tap any answer to change it. Your report is built the moment you confirm.</p>
        <ul className="ms-review">{visible.map((s, i) => <li key={s.key}>
          <button type="button" onClick={() => { setIndex(i); setPhase('ask'); }}>
            <span>{FIELD_LABELS[s.key as string]}</span>
            <b>{display(s, answers[s.key])}{scanned.has(s.key as string) && <em>scanned</em>}</b>
            <Pencil size={13} aria-hidden="true"/>
          </button>
        </li>)}</ul>
        {error && <p className="ms-error" role="alert">{error}</p>}
        <div className="ms-actions"><button type="button" className="ms-primary" onClick={finish}><Check size={16}/> Build my money report</button></div>
      </motion.div>}
    </AnimatePresence>
  </div>;
};
