import React, { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowUp, Bot, ChevronDown, Database, ExternalLink, LoaderCircle, LockKeyhole,
  ShieldCheck, Sparkles, Trash2, User, Wrench,
} from 'lucide-react';
import { askDashboardAssistant } from '../../services/learningApi';
import { askPersonalizedDashboardAssistant } from '../../services/personalAiApi';
import { loadAiDataContext, saveAiDataContext, AiDataContextPreferences } from '../../services/aiDataContext';
import { createAiConversation, deleteAiConversation, deleteAllAiHistory, saveAiMessage } from '../../services/supabaseRest';
import { useAuth } from '../../auth/AuthContext';
import { DashboardAssistantSnapshot, NavigationDestination, StructuredFinancialAnswer } from '../../types';
import { StructuredFinancialAnswerView } from '../ai/StructuredFinancialAnswer';

type AssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
  structuredAnswer?: StructuredFinancialAnswer;
  personalDataUsed?: boolean;
  personalContextReferences?: string[];
};

interface DashboardAssistantProps {
  snapshot: DashboardAssistantSnapshot;
  ready: boolean;
  onNavigate: (destination: NavigationDestination) => void;
}

const STARTER_QUESTIONS = [
  'Summarize the most important signals on this dashboard.',
  'Explain the selected market chart in simple language.',
  'Compare the latest US and India economic indicators.',
  'What data limitations should I notice before interpreting these charts?',
];

export const DashboardAssistant: React.FC<DashboardAssistantProps> = ({ snapshot, ready, onNavigate }) => {
  const auth = useAuth();
  const [messages, setMessages] = useState<AssistantMessage[]>([{
    role: 'assistant',
    content: 'I can explain the live market, economic, provider-health, and reliability data currently visible on this dashboard—grounded in SEBI-compliant Indian data where available. Signed-in users can explicitly enable personal data sources below.',
  }]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState(STARTER_QUESTIONS);
  const [sourceLabels, setSourceLabels] = useState<string[]>([]);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextPreferences, setContextPreferences] = useState<AiDataContextPreferences>(() => loadAiDataContext());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, loading]);

  const updateContext = (key: keyof AiDataContextPreferences, checked: boolean) => {
    const next = { ...contextPreferences, [key]: checked };
    setContextPreferences(next);
    saveAiDataContext(next);
  };

  const personalEnabled = Boolean(auth.session && (
    contextPreferences.personalFinance || contextPreferences.budgetsAndGoals ||
    contextPreferences.paperPortfolio || contextPreferences.learningProgress
  ));

  const submitQuestion = async (nextQuestion: string) => {
    const normalized = nextQuestion.trim();
    if (!normalized || !ready || loading) return;
    const conversationHistory = messages.filter((message, index) => index > 0 && message.content.trim()).slice(-8).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: 'user', content: normalized }]);
    setQuestion(''); setError(null); setLoading(true);

    try {
      const response = personalEnabled && auth.session
        ? await askPersonalizedDashboardAssistant({ token: auth.session.access_token, question: normalized, snapshot, settings: contextPreferences, history: conversationHistory })
        : await askDashboardAssistant({ question: normalized, snapshot, history: conversationHistory });
      const personalDataUsed = 'personalDataUsed' in response ? response.personalDataUsed : false;
      const personalContextReferences = 'personalContextReferences' in response ? response.personalContextReferences : [];
      setMessages((current) => [...current, { role: 'assistant', content: response.answer, structuredAnswer: response.structuredAnswer, personalDataUsed, personalContextReferences }]);
      if (response.suggestedQuestions.length > 0) setSuggestions(response.suggestedQuestions);
      setSourceLabels(response.sourceLabels);

      if (contextPreferences.saveConversation && auth.session && auth.user) {
        let conversationId = conversationIdRef.current;
        if (!conversationId) {
          conversationId = await createAiConversation(auth.session.access_token, auth.user.id, normalized);
          conversationIdRef.current = conversationId;
        }
        const reference = personalContextReferences.join('; ') || 'Public dashboard context';
        await saveAiMessage(auth.session.access_token, auth.user.id, conversationId, 'user', normalized, reference);
        await saveAiMessage(auth.session.access_token, auth.user.id, conversationId, 'assistant', response.answer, reference);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'ArthaMind AI is temporarily unavailable.');
    } finally { setLoading(false); }
  };

  const handleSubmit = (event: FormEvent) => { event.preventDefault(); void submitQuestion(question); };

  const deleteCurrentConversation = async () => {
    if (!auth.session || !conversationIdRef.current) return;
    try {
      await deleteAiConversation(auth.session.access_token, conversationIdRef.current);
      conversationIdRef.current = null;
      setError(null);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not delete conversation.'); }
  };
  const deleteAllHistory = async () => {
    if (!auth.session) return;
    try { await deleteAllAiHistory(auth.session.access_token); conversationIdRef.current = null; setError(null); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not delete AI history.'); }
  };

  return (
    <section className="flex h-full min-h-[740px] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
      <div className="border-b border-line bg-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/25 bg-brand-soft text-brand"><Sparkles className="h-5 w-5" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold text-ink">Ask ArthaMind AI</h2>
                <span className="rounded-full border border-success-fill/30 bg-success-fill/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success">Data grounded</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-interactive/30 bg-interactive-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-interactive"><Wrench className="h-3 w-3" /> Tool-Calling Enabled</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-secondary">Explains the current dashboard snapshot without inventing missing values.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-line bg-subtle px-2.5 py-1 text-[9px] font-semibold text-secondary"><span className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-success-fill' : 'bg-warning-fill'}`} />{ready ? 'Ready' : 'Loading data'}</div>
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-canvas">
          <button type="button" onClick={() => setContextOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left" aria-expanded={contextOpen}>
            <span><span className="block text-[10px] font-black text-ink">AI Data Context</span><span className="block text-[9px] text-secondary">Public market & economic data: Enabled · Personal sources: {personalEnabled ? 'Enabled by you' : 'Off'}</span></span>
            <ChevronDown className={`h-4 w-4 text-secondary transition ${contextOpen ? 'rotate-180' : ''}`} />
          </button>
          {contextOpen && <div className="grid gap-2 border-t border-line p-3 sm:grid-cols-2">
            <ContextRow label="Public market & economic data" checked disabled />
            <ContextRow label="My income and expenses" checked={contextPreferences.personalFinance} disabled={!auth.user} onChange={(v) => updateContext('personalFinance', v)} />
            <ContextRow label="My budgets and savings goals" checked={contextPreferences.budgetsAndGoals} disabled={!auth.user} onChange={(v) => updateContext('budgetsAndGoals', v)} />
            <ContextRow label="My paper portfolio" checked={contextPreferences.paperPortfolio} disabled={!auth.user} onChange={(v) => updateContext('paperPortfolio', v)} />
            <ContextRow label="My learning progress" checked={contextPreferences.learningProgress} disabled={!auth.user} onChange={(v) => updateContext('learningProgress', v)} />
            <ContextRow label="Save this conversation" checked={contextPreferences.saveConversation} disabled={!auth.user} onChange={(v) => updateContext('saveConversation', v)} />
            {!auth.user && <button type="button" onClick={() => auth.openAuth('login')} className="sm:col-span-2 rounded-xl border border-interactive/25 bg-interactive-soft px-3 py-2 text-[10px] font-bold text-interactive">Sign in to authorize personal context</button>}
          </div>}
        </div>
      </div>

      <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto bg-canvas p-4 sm:p-5" aria-live="polite">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex items-start gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-interactive/30 bg-interactive/10 text-interactive">{message.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}</div>
            <div className="min-w-0 max-w-[95%] flex-1">
              {message.role === 'assistant' && message.structuredAnswer ? <StructuredFinancialAnswerView answer={message.structuredAnswer} compact /> : <div className={`max-w-full whitespace-pre-wrap rounded-2xl px-3.5 py-3 text-[12px] leading-6 shadow-sm ${message.role === 'user' ? 'ml-auto rounded-tr-md border border-interactive/25 bg-interactive-soft text-ink' : 'rounded-tl-md border border-line bg-surface text-ink'}`}>{message.content}</div>}
              {message.role === 'assistant' && message.personalDataUsed && <div className="mt-2 rounded-xl border border-success-fill/25 bg-success-soft px-3 py-2 text-[9px] leading-4 text-success"><div className="font-black">Personal data used</div><div className="text-secondary">{message.personalContextReferences?.join(' · ') || 'Authorized personal workspace context'}</div></div>}
            </div>
          </div>
        ))}
        {loading && <div className="flex items-center gap-2.5 text-xs text-secondary"><div className="flex h-7 w-7 items-center justify-center rounded-lg border border-interactive/30 bg-interactive/10 text-interactive"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /></div>Reading enabled evidence and context…</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-line bg-surface p-4 sm:p-5">
        {error && <div className="mb-3 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-[11px] leading-relaxed text-danger">{error}</div>}
        <div className="scrollbar-thin mb-3 flex gap-2 overflow-x-auto pb-1">{suggestions.slice(0, 4).map((suggestion) => <button key={suggestion} type="button" disabled={!ready || loading} onClick={() => void submitQuestion(suggestion)} className="shrink-0 rounded-full border border-line bg-subtle px-3 py-1.5 text-[10px] font-semibold text-secondary transition hover:border-interactive/40 hover:bg-interactive-soft hover:text-interactive disabled:opacity-45">{suggestion}</button>)}</div>
        <form onSubmit={handleSubmit} className="relative">
          <label htmlFor="dashboard-assistant-question" className="sr-only">Ask ArthaMind AI about this dashboard</label>
          <textarea id="dashboard-assistant-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submitQuestion(question); } }} rows={3} maxLength={1200} disabled={!ready || loading} placeholder="Ask about public data or your explicitly enabled personal context…" className="w-full resize-none rounded-2xl border border-line-strong bg-surface px-4 py-3 pr-12 text-xs leading-5 text-ink outline-none placeholder:text-secondary focus:border-interactive focus:ring-2 focus:ring-interactive disabled:opacity-60" />
          <button type="submit" disabled={!ready || loading || !question.trim()} aria-label="Send dashboard question" className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-brand-foreground hover:text-white transition hover:bg-brand-hover disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button>
        </form>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[9px] text-secondary"><div className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-success" />Educational analysis only — not investment, tax, legal, or financial advice.</div><button type="button" onClick={() => onNavigate('tutor')} className="inline-flex items-center gap-1 font-semibold text-interactive">Open full tutor <ExternalLink className="h-3 w-3" /></button></div>
        {auth.user && <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={!conversationIdRef.current} onClick={() => void deleteCurrentConversation()} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[9px] text-secondary disabled:opacity-40"><Trash2 className="h-3 w-3" />Delete conversation</button><button type="button" onClick={() => void deleteAllHistory()} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[9px] text-secondary"><Trash2 className="h-3 w-3" />Delete all AI history</button></div>}
        {sourceLabels.length > 0 && <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[9px] text-secondary"><Database className="h-3 w-3 shrink-0" /><span className="truncate">Grounded in {sourceLabels.join(' · ')}</span></div>}
      </div>
    </section>
  );
};

const ContextRow: React.FC<{ label: string; checked: boolean; disabled?: boolean; onChange?: (value: boolean) => void }> = ({ label, checked, disabled, onChange }) => (
  <label className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[10px] ${checked ? 'border-success-fill/20 bg-success-soft text-ink' : 'border-line bg-surface text-secondary'} ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
    <span className="flex items-center gap-2">{checked ? <ShieldCheck className="h-3.5 w-3.5 text-success" /> : <LockKeyhole className="h-3.5 w-3.5" />}{label}</span>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange?.(event.target.checked)} />
  </label>
);
