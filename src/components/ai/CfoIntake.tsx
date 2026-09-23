import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, SkipForward } from 'lucide-react';

/** A short, human intake: one plain question at a time, chips for quick answers, numbers where needed. */
export interface CfoProfile {
  name: string;
  age: string;
  work: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyEmi: number;
  savings: number;
  dependents: string;
  insurance: string;
  goal: string;
  goalYears: string;
}

type Question =
  | { key: keyof CfoProfile; kind: 'text'; ask: (p: Partial<CfoProfile>) => string; hint: string; optional?: boolean }
  | { key: keyof CfoProfile; kind: 'money'; ask: (p: Partial<CfoProfile>) => string; hint: string; allowZero?: boolean }
  | { key: keyof CfoProfile; kind: 'choice'; ask: (p: Partial<CfoProfile>) => string; hint?: string; options: string[] };

export const CFO_QUESTIONS: Question[] = [
  { key: 'name', kind: 'text', optional: true, ask: () => "Hi! I'm your ArthaMind CFO. I'll ask a few quick questions, then draft a complete money plan for you. What should I call you?", hint: 'First name is enough (optional)' },
  { key: 'age', kind: 'choice', ask: (p) => `Nice to meet you${p.name ? `, ${p.name}` : ''}. Which age group are you in?`, options: ['Under 25', '25–34', '35–44', '45–54', '55+'] },
  { key: 'work', kind: 'choice', ask: () => 'How do you earn your income?', options: ['Salaried', 'Self-employed / freelancer', 'Business owner', 'Retired', 'Student'] },
  { key: 'monthlyIncome', kind: 'money', ask: () => 'Roughly how much reaches your bank account each month, after tax?', hint: 'Monthly take-home in ₹, e.g. 85000' },
  { key: 'monthlyExpenses', kind: 'money', ask: () => 'And how much do you usually spend in a month, not counting loan EMIs?', hint: 'Rent, groceries, bills, lifestyle, in ₹' },
  { key: 'monthlyEmi', kind: 'money', allowZero: true, ask: () => 'Do you pay any EMIs? Enter the monthly total, or 0 if none.', hint: 'Home, car, personal, credit-card EMIs, in ₹' },
  { key: 'savings', kind: 'money', allowZero: true, ask: () => 'About how much do you have saved or invested today?', hint: 'Bank, FDs, mutual funds, PPF, stocks, in ₹' },
  { key: 'dependents', kind: 'choice', ask: () => 'How many people depend on your income?', options: ['None', '1', '2', '3 or more'] },
  { key: 'insurance', kind: 'choice', ask: () => 'Which insurance do you have today?', options: ['Term + health', 'Health only', 'Term only', 'Neither', 'Not sure'] },
  { key: 'goal', kind: 'choice', ask: () => "What's the most important money goal for you right now?", options: ['Build an emergency fund', 'Buy a home', "Children's education", 'Retirement', 'Clear my debts', 'Grow my wealth'] },
  { key: 'goalYears', kind: 'choice', ask: (p) => `When would you like to reach "${p.goal?.toLowerCase()}"?`, options: ['Within 1 year', '1–3 years', '3–5 years', '5–10 years', '10+ years'] },
];

const parseMoney = (value: string) => {
  const clean = value.replace(/[₹,\s]/g, '').toLowerCase();
  const match = clean.match(/^(\d+(?:\.\d+)?)(k|l|lakh|lac|cr|crore)?$/);
  if (!match) return Number.NaN;
  const unit = match[2];
  const multiplier = unit === 'k' ? 1e3 : unit && unit.startsWith('l') ? 1e5 : unit && unit.startsWith('c') ? 1e7 : 1;
  return Number(match[1]) * multiplier;
};
const rupees = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

export const CfoIntake: React.FC<{ onComplete: (profile: CfoProfile) => void; onCancel: () => void }> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<CfoProfile>>({});
  const [log, setLog] = useState<Array<{ q: string; a: string }>>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const question = CFO_QUESTIONS[step];

  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(''); setError('');
    // Keep the current question in view inside the chat thread without scrolling the page.
    const thread = root.current?.closest('.cfo-thread');
    if (thread) thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
    window.setTimeout(() => input.current?.focus({ preventScroll: true }), 60);
  }, [step]);

  const answer = (value: string | number, display: string) => {
    const next = { ...answers, [question.key]: value } as Partial<CfoProfile>;
    setAnswers(next);
    setLog((current) => [...current, { q: question.ask(answers), a: display }]);
    if (step + 1 < CFO_QUESTIONS.length) setStep(step + 1);
    else onComplete(next as CfoProfile);
  };

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (question.kind === 'money') {
      const amount = parseMoney(draft);
      if (!Number.isFinite(amount) || amount < 0 || (!question.allowZero && amount === 0)) { setError('Please enter an amount like 85000, 85k or 1.2 lakh.'); return; }
      answer(amount, rupees(amount));
    } else if (question.kind === 'text') {
      answer(draft.trim().slice(0, 40), draft.trim() || 'Skipped');
    }
  };

  return <div className="cfo-intake" aria-live="polite" ref={root}>
    {log.map((entry, index) => <React.Fragment key={index}>
      <div className="cfo-msg cfo-msg-ai cfo-ask">{entry.q}</div>
      <div className="cfo-msg cfo-msg-user">{entry.a}</div>
    </React.Fragment>)}
    <div className="cfo-msg cfo-msg-ai cfo-ask" key={step}>
      <span className="cfo-progress" aria-label={`Question ${step + 1} of ${CFO_QUESTIONS.length}`}><i style={{ transform: `scaleX(${(step + 1) / CFO_QUESTIONS.length})` }}/></span>
      {question.ask(answers)}
      {question.kind === 'choice'
        ? <div className="cfo-chips cfo-chips-left">{question.options.map((option, index) => <button key={option} type="button" style={{ '--i': index } as React.CSSProperties} onClick={() => answer(option, option)}>{option}</button>)}</div>
        : <form className="cfo-intake-form" onSubmit={submit}>
            <input ref={input} value={draft} onChange={(event) => { setDraft(event.target.value); setError(''); }} inputMode={question.kind === 'money' ? 'decimal' : 'text'} placeholder={question.hint} aria-label={question.hint} aria-invalid={Boolean(error)}/>
            <button type="submit" disabled={question.kind === 'money' && !draft.trim()}>Next <ArrowRight size={14}/></button>
            {question.kind === 'text' && question.optional && <button type="button" className="cfo-link" onClick={() => answer('', 'Skipped')}><SkipForward size={13}/>Skip</button>}
          </form>}
      {error && <p className="cfo-intake-error" role="alert">{error}</p>}
    </div>
    <button type="button" className="cfo-link cfo-intake-cancel" onClick={onCancel}>Cancel and ask a question instead</button>
  </div>;
};
