import React, { useMemo, useState } from 'react';
import { ArrowRight, Bot, RotateCcw, SkipForward } from 'lucide-react';
import type { AppNavigationDestination } from '../../navigationTypes';
import type { StructuredFinancialAnswer } from '../../types';
import { buildPagePrompt, guideFor } from '../../data/assistantGuides';
import { StructuredFinancialAnswerView } from './StructuredFinancialAnswer';
import { WebSearchToggle } from './WebSearchToggle';
import { MicButton } from './MicButton';
import { ThinkingSteps } from './ThinkingSteps';
import { ListenBar } from '../voice/ListenBar';
import './pageAssistant.css';

interface Reply { structured: StructuredFinancialAnswer | null; text: string; offline: boolean; sources: string[] }

async function askPage(prompt: string, task: string, history: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<Reply> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt.slice(0, 4000), task, history: history.slice(-6), context: { country: 'India', currency: 'INR', language: 'english', detail: 'standard' } }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) throw new Error(data.error || 'You are asking quickly. Please wait a minute and try again.');
  if (!res.ok) throw new Error(data.error || 'The assistant could not answer right now. Please try again.');
  return {
    structured: data.structuredAnswer ?? null,
    text: String(data.answer || data.structuredAnswer?.directAnswer || ''),
    offline: data.ok === false,
    sources: Array.isArray(data.structuredAnswer?.sources) ? data.structuredAnswer.sources.map((s: { name: string }) => s.name).slice(0, 4) : [],
  };
}

/**
 * The AI assistant inside a feature page. It asks a few multiple-choice questions (goal, horizon,
 * detail) so the user can answer in taps, then answers using what the page shows plus live data.
 */
export const PageAssistant: React.FC<{ destination: AppNavigationDestination; snapshot: () => string; title?: string }> = ({ destination, snapshot, title }) => {
  const guide = useMemo(() => guideFor(destination), [destination]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Array<[string, string]>>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [turns, setTurns] = useState<Array<{ q: string; reply: Reply }>>([]);
  const question = guide.questions[step];
  const doneAsking = step >= guide.questions.length;

  const choose = (option: string | null) => {
    if (option && question) setAnswers((a) => [...a.filter(([k]) => k !== question.ask), [question.ask, option]]);
    setStep((s) => s + 1);
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true); setError(''); setDraft('');
    try {
      const prompt = buildPagePrompt(title ?? guide.title, snapshot(), answers, q);
      const history = turns.flatMap((t) => [{ role: 'user' as const, content: t.q }, { role: 'assistant' as const, content: t.reply.text.slice(0, 1500) }]);
      const reply = await askPage(prompt, guide.task, history);
      setTurns((t) => [...t, { q, reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  // The first question can be sent straight from the "goal" answer.
  const goal = answers.find(([k]) => /what would you like/i.test(k))?.[1];

  return <section className="pa" aria-label={`${guide.title} assistant`}>
    <header className="pa-head">
      <span className="pa-icon"><Bot size={18}/></span>
      <div><b>{guide.title} assistant</b><small>{guide.intro}</small></div>
      {(answers.length > 0 || turns.length > 0) && <button type="button" className="pa-reset" onClick={() => { setStep(0); setAnswers([]); setTurns([]); setError(''); }}><RotateCcw size={13}/> Start over</button>}
    </header>

    {!doneAsking && question && <div className="pa-q">
      <p><span>Question {step + 1} of {guide.questions.length}</span>{question.ask}</p>
      <div className="pa-opts">{question.options.map((o) => <button key={o} type="button" onClick={() => choose(o)}>{o}</button>)}</div>
      <button type="button" className="pa-skip" onClick={() => choose(null)}><SkipForward size={13}/> Skip</button>
    </div>}

    {answers.length > 0 && <ul className="pa-answers">{answers.map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b></li>)}</ul>}

    {doneAsking && !turns.length && <div className="pa-starters">
      {goal && <button type="button" className="pa-primary" onClick={() => void send(goal)} disabled={busy}>{goal} <ArrowRight size={14}/></button>}
      {guide.starters.map((s) => <button key={s} type="button" onClick={() => void send(s)} disabled={busy}>{s}</button>)}
    </div>}

    {turns.map((t, i) => <div key={i} className="pa-turn">
      <p className="pa-you">{t.q}</p>
      {t.reply.offline && <p className="pa-offline">AI is offline right now; this is a basic answer.</p>}
      {t.reply.structured ? <StructuredFinancialAnswerView answer={t.reply.structured} compact/> : <><p className="pa-text">{t.reply.text}</p><ListenBar text={t.reply.text} compact/></>}
    </div>)}

    <ThinkingSteps active={busy} compact/>
    {error && <p className="pa-error" role="alert">{error}</p>}

    {(doneAsking || turns.length > 0) && <form className="pa-form" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about this page, or paste any link to analyse…" aria-label="Ask the assistant" maxLength={600} disabled={busy}/>
      <MicButton onText={setDraft} onFinal={(t) => void send(t)} disabled={busy}/>
      <button type="submit" disabled={!draft.trim() || busy}>Ask</button>
    </form>}
    <div className="pa-foot"><WebSearchToggle compact/><small>Education only, not investment advice.</small></div>
  </section>;
};
