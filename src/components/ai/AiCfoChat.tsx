import { ListenBar } from '../voice/ListenBar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WebSearchToggle } from './WebSearchToggle';
import { ArrowRight, ArrowUp, BriefcaseBusiness, CircleAlert, ClipboardList, Globe, ListChecks, RotateCcw, ShieldAlert, Sparkles, UserRound } from 'lucide-react';
import { askAiCfo, type CfoLanguage, type CfoReply, type CfoTurn } from '../../services/cfoApi';
import { buildCfoHealthReport, cfoPlanPrompt, formatInr, type CfoHealthReport } from '../../services/cfoAnalysis';
import { CFO_QUESTIONS, CfoIntake, type CfoProfile } from './CfoIntake';
import './aiCfo.css';
import { MicButton } from './MicButton';
import { ThinkingSteps } from './ThinkingSteps';

export const CFO_STARTER_PROMPTS = [
  'Old vs new tax regime for a ₹18,00,000 salary',
  'Should I prepay my ₹40,00,000 home loan or invest?',
  'Build a budget for ₹85,000 take-home',
  'How big should my emergency fund be?',
  'Plan a ₹50,00,000 house down payment in 5 years',
  'My EMIs are 45% of salary. What should I do?',
];

const THINKING_STEPS = ['Reading your numbers…', 'Checking cash flow and EMIs…', 'Looking at tax angles…', 'Drafting your action plan…'];

export interface CfoSuggestion { label: string; onOpen: () => void }

interface Message { id: number; role: 'user' | 'assistant'; text: string; reply?: CfoReply; error?: string; prompt?: string; display?: string; profile?: { profile: CfoProfile; report: CfoHealthReport } }

interface Props {
  /** Optional workspace suggestion shown under an answer, derived from the question. */
  suggestFor?: (question: string) => CfoSuggestion | null;
  /** A prompt pushed in from outside (e.g. the health check); sent once whenever it changes. */
  externalPrompt?: { id: number; text: string } | null;
  compact?: boolean;
  autoFocus?: boolean;
  /** Offer the built-in question-by-question CFO plan. Off where a money profile already exists (workspace Home). */
  offerPlan?: boolean;
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
      {!offline && (structured?.sources?.length ?? 0) > 0 && <section className="cfo-block cfo-block-sources" style={{ '--d': 3 } as React.CSSProperties}>
        <h4><Globe size={13}/>Live sources used</h4>
        <ul>{structured!.sources.slice(0, 6).map((src, index) => <li key={index}><span>{clean(src.name)}</span>{src.dataDate && <small>{clean(src.dataDate).slice(0, 25)}</small>}</li>)}</ul>
      </section>}
      <footer className="cfo-brief-foot" style={{ '--d': 4 } as React.CSSProperties}>
        {offline && <button type="button" className="cfo-link" onClick={onRetry}><RotateCcw size={13}/>Ask again</button>}
        {suggestion && <button type="button" className="cfo-open" onClick={suggestion.onOpen}>{suggestion.label}<ArrowRight size={13}/></button>}
        <span>Educational guidance, not personalised investment, tax or legal advice.</span>
      </footer>
    </div>}
  {done && bottomLine && <ListenBar compact text={[bottomLine, ...actions.map(clean)].join('\n')}/>}
  </article>;
};

const ProfileCard: React.FC<{ profile: CfoProfile; report: CfoHealthReport }> = ({ profile, report }) => <article className="cfo-msg cfo-msg-ai cfo-profile">
  <header className="cfo-brief-head"><span className="cfo-brief-icon"><UserRound size={15}/></span><div><small>Your money snapshot</small><b>{profile.name ? `${profile.name}'s profile` : 'Your profile'}</b></div><span className={`cfo-tag ${report.score >= 60 ? 'cfo-tag-ok' : 'cfo-tag-warn'}`}>Score {report.score}/100 · {report.status}</span></header>
  <dl className="cfo-profile-grid">
    <div><dt>Age</dt><dd>{profile.age}</dd></div><div><dt>Income type</dt><dd>{profile.work}</dd></div>
    <div><dt>Take-home</dt><dd>{formatInr(profile.monthlyIncome)}/mo</dd></div><div><dt>Spending</dt><dd>{formatInr(profile.monthlyExpenses)}/mo</dd></div>
    <div><dt>EMIs</dt><dd>{formatInr(profile.monthlyEmi)}/mo</dd></div><div><dt>Monthly surplus</dt><dd className={report.surplus >= 0 ? 'pos' : 'neg'}>{formatInr(report.surplus)}</dd></div>
    {report.metrics.map((metric) => <div key={metric.key}><dt>{metric.label}</dt><dd>{metric.display}</dd></div>)}
    <div><dt>Savings today</dt><dd>{formatInr(profile.savings)}</dd></div><div><dt>Dependants</dt><dd>{profile.dependents}</dd></div>
    <div><dt>Insurance</dt><dd>{profile.insurance}</dd></div><div><dt>Goal</dt><dd>{profile.goal} · {profile.goalYears}</dd></div>
  </dl>
  <p className="cfo-profile-note">Calculated on your device from your answers. Your CFO plan is being drafted below.</p>
</article>;

export const AiCfoChat: React.FC<Props> = ({ suggestFor, externalPrompt, compact = false, autoFocus = false, offerPlan = true }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(0);
  const [language, setLanguage] = useState<CfoLanguage>('english');
  const [intake, setIntake] = useState(false);
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

  const send = useCallback(async (text: string, display?: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history: CfoTurn[] = messages.filter((message) => !message.error && !message.reply?.fallback && !message.profile).map((message) => ({ role: message.role, content: message.role === 'user' ? message.text : (message.reply?.answer || message.text) }));
    setMessages((current) => [...current, { id: nextId.current++, role: 'user', text: display || question }]);
    setDraft('');
    setBusy(true);
    try {
      const reply = await askAiCfo(question, history, language);
      setMessages((current) => [...current, { id: nextId.current++, role: 'assistant', text: reply.answer, reply, prompt: question }]);
    } catch (error) {
      setMessages((current) => [...current, { id: nextId.current++, role: 'assistant', text: '', error: error instanceof Error ? error.message : 'Something went wrong. Please try again.', prompt: question, display }]);
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

  const completeIntake = (profile: CfoProfile) => {
    setIntake(false);
    const report = buildCfoHealthReport({ monthlyIncome: profile.monthlyIncome, monthlyExpenses: profile.monthlyExpenses, monthlyEmi: profile.monthlyEmi, emergencySavings: profile.savings });
    setMessages((current) => [...current, { id: nextId.current++, role: 'assistant', text: '', profile: { profile, report } }]);
    void send(cfoPlanPrompt(profile, report), 'Draft my personal CFO plan');
  };

  const retry = (message: Message) => {
    // Drop the failed answer and the question that produced it; send() re-adds the question.
    setMessages((current) => {
      const index = current.findIndex((item) => item.id === message.id);
      if (index < 0) return current;
      const start = index > 0 && current[index - 1].role === 'user' ? index - 1 : index;
      return [...current.slice(0, start), ...current.slice(index + 1)];
    });
    if (message.prompt) void send(message.prompt, message.display);
  };

  return <div className={`cfo-chat ${compact ? 'is-compact' : ''}`}>
    <div className="cfo-chat-bar">
      <span className="cfo-live"><i aria-hidden="true"/>AI CFO online</span>
      <label className="cfo-lang">Reply in
        <select value={language} onChange={(event) => setLanguage(event.target.value as CfoLanguage)} aria-label="Answer language">
          <option value="english">English</option><option value="hinglish">Hinglish</option><option value="hindi">हिंदी</option>
        </select>
      </label>
      {offerPlan && !intake && messages.length > 0 && <button type="button" className="cfo-link" onClick={() => setIntake(true)} disabled={busy}><ClipboardList size={13}/>CFO plan</button>}
      {(messages.length > 0 || intake) && <button type="button" className="cfo-link" onClick={() => { setMessages([]); setIntake(false); }} disabled={busy}><RotateCcw size={13}/>New chat</button>}
    </div>
    <div className="cfo-thread" ref={scroller} aria-label="Conversation with the AI CFO">
      {intake && <CfoIntake onComplete={completeIntake} onCancel={() => setIntake(false)}/>}
      {!intake && messages.length === 0 && <div className="cfo-empty">
        <span className="cfo-orb" aria-hidden="true"><BriefcaseBusiness size={22}/></span>
        <b>Ask anything a CFO would answer.</b>
        <p>Salary, tax regime, EMIs, emergency fund, goals or your business cash flow, answered in ₹ with a clear action plan.</p>
        {offerPlan && <button type="button" className="cfo-plan-cta" onClick={() => setIntake(true)}><ClipboardList size={16}/>Build my CFO plan<span>{CFO_QUESTIONS.length} quick questions · about 2 minutes</span></button>}
        {offerPlan && <small className="cfo-or">or ask directly</small>}
        <div className="cfo-chips">{CFO_STARTER_PROMPTS.map((prompt, index) => <button key={prompt} type="button" style={{ '--i': index } as React.CSSProperties} onClick={() => void send(prompt)}>{prompt}</button>)}</div>
      </div>}
      {messages.map((message, index) => message.profile
        ? <ProfileCard key={message.id} profile={message.profile.profile} report={message.profile.report}/>
        : message.role === 'user'
        ? <div key={message.id} className="cfo-msg cfo-msg-user">{message.text}</div>
        : <CfoAnswer key={message.id} message={message} latest={index === messages.length - 1} suggestion={message.prompt && suggestFor ? suggestFor(message.prompt) : null} onRetry={() => retry(message)}/>)}
      {busy && <div className="cfo-msg cfo-msg-ai cfo-thinking-steps" role="status"><ThinkingSteps active compact/></div>}
    </div>
    <div className="cfo-web"><WebSearchToggle/></div>
    <form className="cfo-compose" onSubmit={(event) => { event.preventDefault(); void send(draft); }}>
      <textarea ref={input} value={draft} rows={1} disabled={intake} maxLength={4000} placeholder="Ask your AI CFO… e.g. Can I afford a ₹12,00,000 car on ₹1,10,000 salary?" aria-label="Ask your AI CFO"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(draft); } }}/>
      <MicButton onText={setDraft} onFinal={(t) => void send(t)} disabled={busy || intake}/>
      <button type="submit" disabled={!draft.trim() || busy} aria-label="Send question"><ArrowUp size={17}/></button>
    </form>
  </div>;
};
