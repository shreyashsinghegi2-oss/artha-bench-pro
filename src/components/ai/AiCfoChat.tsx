import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, BriefcaseBusiness, CircleAlert, ListChecks, RotateCcw, ShieldAlert, Sparkles } from 'lucide-react';
import { askAiCfo, type CfoLanguage, type CfoReply, type CfoTurn } from '../../services/cfoApi';
import './aiCfo.css';

export const CFO_STARTER_PROMPTS = [
  'Old vs new tax regime for a ₹18 lakh salary',
  'Should I prepay my ₹40 lakh home loan or invest?',
  'Build a budget for ₹85,000 take-home',
  'How big should my emergency fund be?',
  'Plan a ₹50 lakh house down payment in 5 years',
  'My EMIs are 45% of salary. What should I do?',
];

const THINKING_STEPS = ['Reading your numbers…', 'Checking cash flow and EMIs…', 'Looking at tax angles…', 'Drafting your action plan…'];

export interface CfoSuggestion { label: string; onOpen: () => void }

interface Message { id: number; role: 'user' | 'assistant'; text: string; reply?: CfoReply; error?: string; prompt?: string }

interface Props {
  /** Optional workspace suggestion shown under an answer, derived from the question. */
  suggestFor?: (question: string) => CfoSuggestion | null;
  /** A prompt pushed in from outside (e.g. the health check); sent once whenever it changes. */
  externalPrompt?: { id: number; text: string } | null;
  compact?: boolean;
  autoFocus?: boolean;
}

const clean = (value: string) => value.replace(/\\\[|\\\]|```/g, '').replace(/^\s*#+\s*/gm, '').replace(/\*\*/g, '').trim();

function useTypewriter(text: string, enabled: boolean): string {
  const [shown, setShown] = useState(enabled ? '' : text);
  useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(text); return; }
    setShown('');
    let index = 0;
    const step = Math.max(1, Math.ceil(text.length / 120));
    const id = window.setInterval(() => {
      index += step;
      setShown(text.slice(0, index));
      if (index >= text.length) window.clearInterval(id);
    }, 16);
    return () => window.clearInterval(id);
  }, [text, enabled]);
  return shown;
}

const CfoAnswer: React.FC<{ message: Message; latest: boolean; suggestion: CfoSuggestion | null; onRetry: () => void }> = ({ message, latest, suggestion, onRetry }) => {
  const structured = message.reply?.structured ?? null;
  const bottomLine = clean(structured?.directAnswer || message.reply?.answer || '');
  const typed = useTypewriter(bottomLine, latest);
  const done = typed.length >= bottomLine.length;
  if (message.error) {
    return <div className="cfo-msg cfo-msg-ai cfo-msg-error" role="alert">
      <CircleAlert size={16} aria-hidden="true"/><span>{message.error}</span>
      <button type="button" className="cfo-link" onClick={onRetry}><RotateCcw size={13}/>Try again</button>
    </div>;
  }
  // An offline fallback carries generic template steps; show only its message and a retry.
  const offline = Boolean(message.reply?.fallback);
  const steps = offline ? [] : structured?.steps ?? [];
  const actions = offline ? [] : structured?.keyTakeaways ?? [];
  const risks = offline ? [] : structured?.risks ?? [];
  return <article className="cfo-msg cfo-msg-ai" aria-live={latest ? 'polite' : undefined}>
    <header className="cfo-brief-head">
      <span className="cfo-brief-icon"><BriefcaseBusiness size={15}/></span>
      <div><small>ArthaMind AI CFO</small><b>{offline ? 'AI CFO is reconnecting' : clean(structured?.title || 'CFO brief')}</b></div>
      {message.reply?.fallback && <span className="cfo-tag cfo-tag-warn">Offline guidance</span>}
    </header>
    <p className="cfo-bottom-line">{typed}{!done && <i className="cfo-caret" aria-hidden="true"/>}</p>
    {done && <div className="cfo-brief-body">
      {steps.length > 0 && <section className="cfo-block" style={{ '--d': 0 } as React.CSSProperties}>
        <h4><Sparkles size={13}/>Analysis</h4>
        <ol className="cfo-steps">{steps.slice(0, 5).map((step, index) => <li key={index}><b>{clean(step.title)}</b><span>{clean(step.explanation)}</span></li>)}</ol>
      </section>}
      {actions.length > 0 && <section className="cfo-block cfo-block-actions" style={{ '--d': 1 } as React.CSSProperties}>
        <h4><ListChecks size={13}/>Action plan</h4>
        <ul>{actions.slice(0, 5).map((action, index) => <li key={index}><span className="cfo-num">{index + 1}</span>{clean(action)}</li>)}</ul>
      </section>}
      {risks.length > 0 && <section className="cfo-block cfo-block-risks" style={{ '--d': 2 } as React.CSSProperties}>
        <h4><ShieldAlert size={13}/>Watch-outs</h4>
        <ul>{risks.slice(0, 3).map((risk, index) => <li key={index}>{clean(risk)}</li>)}</ul>
      </section>}
      <footer className="cfo-brief-foot" style={{ '--d': 3 } as React.CSSProperties}>
        {offline && <button type="button" className="cfo-link" onClick={onRetry}><RotateCcw size={13}/>Ask again</button>}
        {suggestion && <button type="button" className="cfo-open" onClick={suggestion.onOpen}>{suggestion.label}<ArrowRight size={13}/></button>}
        <span>Educational guidance, not personalised investment, tax or legal advice.</span>
      </footer>
    </div>}
  </article>;
};

export const AiCfoChat: React.FC<Props> = ({ suggestFor, externalPrompt, compact = false, autoFocus = false }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(0);
  const [language, setLanguage] = useState<CfoLanguage>('english');
  const nextId = useRef(1);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const lastExternal = useRef<number | null>(null);

  useEffect(() => { if (autoFocus) window.setTimeout(() => input.current?.focus(), 80); }, [autoFocus]);
  useEffect(() => {
    if (!busy) return;
    setThinking(0);
    const id = window.setInterval(() => setThinking((value) => (value + 1) % THINKING_STEPS.length), 1400);
    return () => window.clearInterval(id);
  }, [busy]);
  useEffect(() => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  const send = useCallback(async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history: CfoTurn[] = messages.filter((message) => !message.error && !message.reply?.fallback).map((message) => ({ role: message.role, content: message.role === 'user' ? message.text : (message.reply?.answer || message.text) }));
    setMessages((current) => [...current, { id: nextId.current++, role: 'user', text: question }]);
    setDraft('');
    setBusy(true);
    try {
      const reply = await askAiCfo(question, history, language);
      setMessages((current) => [...current, { id: nextId.current++, role: 'assistant', text: reply.answer, reply, prompt: question }]);
    } catch (error) {
      setMessages((current) => [...current, { id: nextId.current++, role: 'assistant', text: '', error: error instanceof Error ? error.message : 'Something went wrong. Please try again.', prompt: question }]);
    } finally {
      setBusy(false);
    }
  }, [busy, language, messages]);

  useEffect(() => {
    // Wait until the current answer finishes so a question pushed in mid-answer is not dropped.
    if (!externalPrompt || externalPrompt.id === lastExternal.current || busy) return;
    lastExternal.current = externalPrompt.id;
    void send(externalPrompt.text);
  }, [externalPrompt, send, busy]);

  const retry = (message: Message) => {
    // Drop the failed answer and the question that produced it; send() re-adds the question.
    setMessages((current) => {
      const index = current.findIndex((item) => item.id === message.id);
      if (index < 0) return current;
      const start = index > 0 && current[index - 1].role === 'user' ? index - 1 : index;
      return [...current.slice(0, start), ...current.slice(index + 1)];
    });
    if (message.prompt) void send(message.prompt);
  };

  return <div className={`cfo-chat ${compact ? 'is-compact' : ''}`}>
    <div className="cfo-chat-bar">
      <span className="cfo-live"><i aria-hidden="true"/>AI CFO online</span>
      <label className="cfo-lang">Reply in
        <select value={language} onChange={(event) => setLanguage(event.target.value as CfoLanguage)} aria-label="Answer language">
          <option value="english">English</option><option value="hinglish">Hinglish</option><option value="hindi">हिंदी</option>
        </select>
      </label>
      {messages.length > 0 && <button type="button" className="cfo-link" onClick={() => setMessages([])} disabled={busy}><RotateCcw size={13}/>New chat</button>}
    </div>
    <div className="cfo-thread" ref={scroller} aria-label="Conversation with the AI CFO">
      {messages.length === 0 && <div className="cfo-empty">
        <span className="cfo-orb" aria-hidden="true"><BriefcaseBusiness size={22}/></span>
        <b>Ask anything a CFO would answer.</b>
        <p>Salary, tax regime, EMIs, emergency fund, goals or your business cash flow, answered in ₹ with a clear action plan.</p>
        <div className="cfo-chips">{CFO_STARTER_PROMPTS.map((prompt, index) => <button key={prompt} type="button" style={{ '--i': index } as React.CSSProperties} onClick={() => void send(prompt)}>{prompt}</button>)}</div>
      </div>}
      {messages.map((message, index) => message.role === 'user'
        ? <div key={message.id} className="cfo-msg cfo-msg-user">{message.text}</div>
        : <CfoAnswer key={message.id} message={message} latest={index === messages.length - 1} suggestion={message.prompt && suggestFor ? suggestFor(message.prompt) : null} onRetry={() => retry(message)}/>)}
      {busy && <div className="cfo-msg cfo-msg-ai cfo-thinking" role="status"><span className="cfo-dots" aria-hidden="true"><i/><i/><i/></span>{THINKING_STEPS[thinking]}</div>}
    </div>
    <form className="cfo-compose" onSubmit={(event) => { event.preventDefault(); void send(draft); }}>
      <textarea ref={input} value={draft} rows={1} maxLength={4000} placeholder="Ask your AI CFO… e.g. Can I afford a ₹12 lakh car on ₹1.1 lakh salary?" aria-label="Ask your AI CFO"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(draft); } }}/>
      <button type="submit" disabled={!draft.trim() || busy} aria-label="Send question"><ArrowUp size={17}/></button>
    </form>
  </div>;
};
