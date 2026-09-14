import React, { useState } from 'react';
import { Brain, BookOpen, CheckCircle2, RotateCcw, Send, Settings2, Sparkles, Trash2, Trophy } from 'lucide-react';
import Decimal from 'decimal.js';
import { askTutorAI, TUTOR_MODELS, TutorModelId } from '../../services/learningApi';
import { QuizQuestion, TutorActivity, TutorPreferences } from '../../types';
import { QUESTION_BANK_STATS, selectAdaptiveQuizQuestions } from '../../data/tutorQuestionBank1000';
import { StructuredFinancialAnswerView } from '../ai/StructuredFinancialAnswer';

type Message = { id: string; role: 'user' | 'assistant'; text: string; model?: string; structured?: any; fallback?: boolean };
type QuizState = { questions: QuizQuestion[]; index: number; score: number; selected?: number; finished: boolean };

const activities: Array<[TutorActivity, string]> = [
  ['lesson', 'Explain Concept'], ['quiz', 'Quiz Me'], ['calculation', 'Guided Calculation'],
  ['scenario', 'Practice Scenario'], ['flashcards', 'Flashcards'], ['revision', 'Revision'], ['mock-test', 'Mock Test'],
];
const starterPrompts = [
  'Explain the 50/30/20 rule in Hinglish using INR.',
  'Give me a beginner budgeting quiz.',
  'Calculate EMI for ₹500,000 at 9% annual interest for 5 years.',
  'Explain compound interest with an Indian example.',
];
const defaultPreferences: TutorPreferences = {
  country: 'India', currency: 'INR', language: 'english', level: 'beginner', mode: 'explain', detail: 'detailed',
  useOfficialSources: true, highContrast: false, reducedMotion: false,
  learningGoal: 'Build confident personal-finance fundamentals', learningStyle: 'practical', activityType: 'lesson',
  quizType: 'mcq', quizLength: 10, adaptiveDifficulty: true, sessionLength: 30, learnerProfile: '',
};
const currencyFormat = (value: number, currency: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

const Field: React.FC<{ label: string; value: string; options: string[]; onChange: (value: string) => void }> = ({ label, value, options, onChange }) => (
  <label className="mb-2 block text-[10px] font-bold text-secondary">{label}
    <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-canvas p-2 text-[11px] text-ink">
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  </label>
);
const Toggle: React.FC<{ label: string; value: boolean; onChange: (value: boolean) => void }> = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between py-1 text-[11px] text-ink">{label}<input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /></label>
);

const QuizView: React.FC<{ quiz: QuizState; onAnswer: (index: number) => void; onRetry: () => void }> = ({ quiz, onAnswer, onRetry }) => {
  if (quiz.finished) {
    const percentage = Math.round((quiz.score / quiz.questions.length) * 100);
    return <div className="mx-auto max-w-lg p-8 text-center">
      <Trophy className="mx-auto h-12 w-12 text-interactive" />
      <h2 className="mt-3 text-2xl font-extrabold text-ink">Practice complete</h2>
      <div className="mt-2 text-4xl font-black text-interactive">{percentage}%</div>
      <p className="text-sm text-secondary">{quiz.score} / {quiz.questions.length} correct</p>
      <div className="mt-5 rounded-xl bg-subtle p-3 text-left text-xs text-secondary">Review missed topics and retry. Adaptive sessions can increase difficulty as your performance improves.</div>
      <button onClick={onRetry} className="mt-4 rounded-xl bg-interactive px-4 py-3 text-xs font-bold text-white"><RotateCcw className="mr-1 inline h-4 w-4" /> Retry</button>
    </div>;
  }
  const question = quiz.questions[quiz.index];
  if (!question) return null;
  return <div className="mx-auto max-w-2xl p-2">
    <div className="mb-4 flex items-center justify-between text-[10px] font-bold text-secondary"><span>Question {quiz.index + 1} of {quiz.questions.length}</span><span>Score {quiz.score}</span></div>
    <div className="mb-5 h-2 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-interactive" style={{ width: `${((quiz.index + 1) / quiz.questions.length) * 100}%` }} /></div>
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-2 flex gap-2 text-[9px] font-bold uppercase tracking-wider text-secondary"><span>{question.topic}</span><span>·</span><span>{question.difficulty}</span></div>
      <h2 className="text-lg font-extrabold leading-7 text-ink">{question.question}</h2>
      <div className="mt-5 grid gap-2">
        {question.options.map((option, index) => {
          const answered = quiz.selected !== undefined;
          const correct = index === question.correctAnswer;
          const selected = index === quiz.selected;
          return <button key={`${question.id}-${index}`} disabled={answered} onClick={() => onAnswer(index)} className={`rounded-xl border p-3 text-left text-sm font-semibold ${answered && correct ? 'border-success bg-success-soft text-ink' : answered && selected ? 'border-warning bg-warning-soft text-ink' : 'border-line bg-canvas text-ink hover:border-interactive'}`}>
            <span className="mr-2 font-black">{String.fromCharCode(65 + index)}.</span>{option}
          </button>;
        })}
      </div>
      {quiz.selected !== undefined && <div className="mt-4 rounded-xl bg-subtle p-3 text-xs leading-5 text-secondary"><CheckCircle2 className="mr-1 inline h-4 w-4 text-success" />{quiz.selected === question.correctAnswer ? 'Correct.' : `Correct answer: ${question.options[question.correctAnswer]}.`} {question.explanation}</div>}
    </div>
  </div>;
};

export const TutorView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<TutorModelId>('artha');
  const [advanced, setAdvanced] = useState(false);
  const [activity, setActivity] = useState<TutorActivity>('lesson');
  const [preferences, setPreferences] = useState<TutorPreferences>(defaultPreferences);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const updatePreferences = (changes: Partial<TutorPreferences>) => setPreferences((current) => ({ ...current, ...changes }));

  const startQuiz = (length: 5 | 10 | 20 | 50 = preferences.quizLength || 10, mock = false) => {
    const activityType: TutorActivity = mock ? 'mock-test' : 'quiz';
    setActivity(activityType); updatePreferences({ activityType, mode: 'quiz' });
    setQuiz({ questions: selectAdaptiveQuizQuestions(length, preferences.level, preferences.adaptiveDifficulty !== false), index: 0, score: 0, finished: false });
  };
  const answerQuiz = (selected: number) => {
    if (!quiz || quiz.finished || quiz.selected !== undefined) return;
    const question = quiz.questions[quiz.index];
    const score = quiz.score + (selected === question.correctAnswer ? 1 : 0);
    setQuiz({ ...quiz, selected, score });
    window.setTimeout(() => {
      if (quiz.index + 1 >= quiz.questions.length) setQuiz({ ...quiz, index: quiz.index + 1, score, finished: true, selected: undefined });
      else setQuiz({ ...quiz, index: quiz.index + 1, score, finished: false, selected: undefined });
    }, 650);
  };
  const runCalculation = () => {
    const principal = new Decimal(500000), monthlyRate = new Decimal(0.09).div(12), payments = 60;
    const growth = monthlyRate.add(1).pow(payments), emi = principal.mul(monthlyRate).mul(growth).div(growth.sub(1));
    const total = emi.mul(payments), interest = total.sub(principal);
    const result = `Illustrative monthly EMI: ${currencyFormat(emi.toNumber(), preferences.currency)}. Total payments: ${currencyFormat(total.toNumber(), preferences.currency)}, including approximately ${currencyFormat(interest.toNumber(), preferences.currency)} interest.`;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: result, model: 'ArthaBench Deterministic Finance Engine', structured: {
      title: 'Loan EMI — verified calculation', directAnswer: result,
      steps: [{ title: 'Convert the rate', explanation: '9% annual interest divided by 12 gives a 0.75% monthly rate.' }, { title: 'Apply the EMI equation', explanation: 'Principal, monthly rate and 60 payments are calculated deterministically with Decimal.js.' }],
      formula: { expression: 'EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)', variables: [{ symbol: 'P', meaning: 'principal' }, { symbol: 'r', meaning: 'monthly interest rate' }, { symbol: 'n', meaning: 'number of payments' }], whenToUse: 'Standard amortizing loan calculations.' },
      example: { title: 'Illustrative calculation', dataStatus: 'illustrative', dataAsOf: new Date().toISOString(), inputs: ['₹500,000 principal', '9% annual rate', '60 months'], calculation: ['Monthly rate = 0.75%', 'Payments = 60', 'Decimal.js calculation'], result: `${currencyFormat(emi.toNumber(), preferences.currency)} per month` },
      interpretation: [`Interest over the full schedule is approximately ${currencyFormat(interest.toNumber(), preferences.currency)}.`], risks: ['Actual lender fees, taxes or repayment conventions may change the final schedule.'], keyTakeaways: ['Try another principal, rate or tenure to compare scenarios.'], sources: [],
    } }]);
  };
  const handleActivity = (next: TutorActivity) => {
    setActivity(next);
    if (next === 'quiz') startQuiz(); else if (next === 'mock-test') startQuiz(20, true); else if (next === 'calculation') { setQuiz(null); runCalculation(); }
    else { setQuiz(null); updatePreferences({ activityType: next, mode: next === 'revision' ? 'revision' : next === 'flashcards' ? 'flashcards' : 'explain' }); }
  };
  const send = async (value = input) => {
    if (!value.trim() || busy) return;
    if (/beginner.*quiz|quiz.*beginner/i.test(value)) { startQuiz(); setInput(''); return; }
    const selectedModel = TUTOR_MODELS.find((item) => item.id === model);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text: value, model: selectedModel?.label }]); setInput(''); setBusy(true);
    try {
      const response = await askTutorAI(value, messages.slice(-8).map((message) => ({ role: message.role, content: message.text })), { ...preferences, activityType: activity }, model);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: response.answer, model: response.model || selectedModel?.label, structured: response.structuredAnswer, fallback: response.fallbackMode }]);
    } catch { setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: 'This model is temporarily unavailable. Retry or switch to another available model.', model: selectedModel?.label, fallback: true }]); }
    finally { setBusy(false); }
  };

  return <div className={`mx-auto max-w-[1700px] p-4 sm:p-6 ${preferences.highContrast ? 'contrast-125' : ''}`}>
    <header className="mb-5 rounded-3xl border border-line bg-surface p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-interactive"><Sparkles className="h-4 w-4" /> Adaptive Financial Learning</div>
      <h1 className="mt-1 text-2xl font-extrabold text-ink">Financial Tutor</h1><p className="text-sm text-secondary">Learn through explanation, practice, calculation and feedback — not generic chat.</p>
    </div><div className="flex gap-2"><button onClick={() => { setMessages([]); setQuiz(null); }} className="rounded-xl border border-line px-3 py-2 text-xs font-bold text-secondary"><Trash2 className="mr-1 inline h-4 w-4" /> Clear</button><button onClick={() => setAdvanced((value) => !value)} className="rounded-xl bg-interactive px-3 py-2 text-xs font-bold text-white"><Settings2 className="mr-1 inline h-4 w-4" /> Personalize</button></div></div></header>
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
      <aside className="rounded-3xl border border-line bg-surface p-4"><div className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase text-secondary"><BookOpen className="h-4 w-4" /> Learning path</div>
        {activities.map(([id, label]) => <button key={id} onClick={() => handleActivity(id)} className={`mb-1 flex w-full items-center rounded-xl px-3 py-2.5 text-left text-xs font-bold ${activity === id ? 'bg-interactive-soft text-interactive' : 'text-secondary hover:bg-subtle hover:text-ink'}`}>{label}</button>)}
        <div className="mt-4 rounded-2xl bg-subtle p-3"><div className="text-[9px] font-bold uppercase text-secondary">Validated question bank</div><div className="text-2xl font-black text-ink">{QUESTION_BANK_STATS.total.toLocaleString()}</div><div className="text-[10px] text-secondary">answer-keyed questions</div></div>
      </aside>
      <main className="flex min-h-[720px] flex-col overflow-hidden rounded-3xl border border-line bg-canvas">
        <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3"><div className="flex items-center gap-2 text-xs font-bold text-ink"><Brain className="h-4 w-4 text-interactive" /> {TUTOR_MODELS.find((item) => item.id === model)?.label}</div>
          <select value={model} onChange={(event) => setModel(event.target.value as TutorModelId)} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px] font-bold"><option value="artha">ArthaBench Smart</option><option value="nemotron">NVIDIA Nemotron 3 Ultra</option></select>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {quiz ? <QuizView quiz={quiz} onAnswer={answerQuiz} onRetry={() => startQuiz(quiz.questions.length as 5 | 10 | 20 | 50, activity === 'mock-test')} /> : messages.length === 0 ? <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
            <div className="rounded-3xl bg-interactive-soft p-4"><Sparkles className="h-8 w-8 text-interactive" /></div><h2 className="mt-4 text-xl font-extrabold text-ink">What do you want to master?</h2><p className="mt-2 max-w-md text-sm text-secondary">Your context, learning preferences and selected model are applied to every tutor request.</p>
            <div className="mt-5 grid max-w-xl gap-2 sm:grid-cols-2">{starterPrompts.map((prompt) => <button key={prompt} onClick={() => void send(prompt)} className="rounded-xl border border-line bg-surface p-3 text-left text-xs font-semibold text-ink hover:border-interactive">{prompt}</button>)}</div>
          </div> : messages.map((message) => <div key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[80%] rounded-2xl bg-interactive p-3 text-sm text-white' : 'max-w-[96%]'}>
            {message.role === 'user' ? <><div className="mb-1 text-[9px] font-bold uppercase opacity-70">{message.model}</div>{message.text}</> : <><div className="mb-1 flex gap-2 text-[10px] font-bold text-secondary"><span>{message.model}</span>{message.fallback && <span className="text-warning">Fallback</span>}</div>{message.structured ? <StructuredFinancialAnswerView answer={message.structured} /> : <div className="rounded-2xl border border-line bg-surface p-4 text-sm leading-6 text-ink whitespace-pre-wrap">{message.text}</div>}</>}
          </div>)}
          {busy && <div className="rounded-2xl border border-line bg-surface p-4 text-xs font-bold text-ink">Understanding your context → Preparing the response → Verifying the result<div className="mt-3 h-2 animate-pulse rounded-full bg-interactive-soft" /></div>}
        </div>
        <div className="border-t border-line bg-surface p-3"><div className="flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void send(); }} placeholder="Ask anything about finance…" className="min-w-0 flex-1 rounded-xl border border-line bg-canvas px-4 py-3 text-sm outline-none focus:border-interactive" /><button disabled={busy} onClick={() => void send()} className="rounded-xl bg-interactive px-4 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button></div></div>
      </main>
      <aside className="space-y-4"><div className="rounded-3xl border border-line bg-surface p-4"><div className="mb-3 text-xs font-extrabold text-ink">Learning context</div>
        <Field label="Country" value={preferences.country} options={['India', 'US', 'Global']} onChange={(value) => updatePreferences({ country: value as TutorPreferences['country'], currency: value === 'India' ? 'INR' : value === 'US' ? 'USD' : preferences.currency })} />
        <Field label="Currency" value={preferences.currency} options={['INR', 'USD', 'EUR', 'GBP']} onChange={(value) => updatePreferences({ currency: value as TutorPreferences['currency'] })} />
        <Field label="Language" value={preferences.language} options={['english', 'hindi', 'hinglish']} onChange={(value) => updatePreferences({ language: value as TutorPreferences['language'] })} />
        <Field label="Level" value={preferences.level} options={['beginner', 'intermediate', 'advanced']} onChange={(value) => updatePreferences({ level: value as TutorPreferences['level'] })} />
        <Field label="Response detail" value={preferences.detail} options={['short', 'detailed']} onChange={(value) => updatePreferences({ detail: value as TutorPreferences['detail'] })} />
      </div><div className="rounded-3xl border border-line bg-surface p-4"><div className="mb-2 text-xs font-extrabold text-ink">Session goal</div><select value={preferences.learningGoal} onChange={(event) => updatePreferences({ learningGoal: event.target.value })} className="w-full rounded-lg border border-line bg-canvas p-2 text-xs"><option>Build confident personal-finance fundamentals</option><option>Prepare for an exam</option><option>Improve investing literacy</option><option>Master financial calculations</option></select><div className="mt-2 text-[10px] text-secondary">{preferences.level} · {preferences.language} · {preferences.currency} · {preferences.sessionLength} min</div></div>
        {advanced && <div className="rounded-3xl border border-interactive/30 bg-interactive-soft p-4"><div className="mb-2 text-xs font-extrabold">Advanced preferences</div>
          <label className="flex justify-between py-1 text-[11px]">Learning style<select value={preferences.learningStyle} onChange={(event) => updatePreferences({ learningStyle: event.target.value as TutorPreferences['learningStyle'] })} className="rounded border p-1"><option value="practical">Practical</option><option value="visual">Visual</option><option value="reading">Reading</option><option value="socratic">Socratic</option></select></label>
          <label className="flex justify-between py-1 text-[11px]">Quiz length<select value={preferences.quizLength} onChange={(event) => updatePreferences({ quizLength: Number(event.target.value) as TutorPreferences['quizLength'] })} className="rounded border p-1"><option value="5">5</option><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
          <Toggle label="Adaptive difficulty" value={!!preferences.adaptiveDifficulty} onChange={(value) => updatePreferences({ adaptiveDifficulty: value })} /><Toggle label="Official sources" value={preferences.useOfficialSources} onChange={(value) => updatePreferences({ useOfficialSources: value })} /><Toggle label="High contrast" value={!!preferences.highContrast} onChange={(value) => updatePreferences({ highContrast: value })} /><Toggle label="Reduced motion" value={!!preferences.reducedMotion} onChange={(value) => updatePreferences({ reducedMotion: value })} />
        </div>}
      </aside>
    </div>
  </div>;
};
