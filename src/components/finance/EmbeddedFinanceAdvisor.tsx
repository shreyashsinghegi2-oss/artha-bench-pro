import React, { useMemo, useState } from 'react';
import { ArrowRight, BrainCircuit, ChevronDown, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { AppNavigationDestination } from '../../navigationTypes';
import { useAuth } from '../../auth/AuthContext';
import { askTutorAI } from '../../services/learningApi';

type AdvisorMessage = { id: string; role: 'user' | 'assistant'; text: string; at: string };

type Props = {
  module: AppNavigationDestination;
  title: string;
  description: string;
  questions: string[];
  evidence: Record<string, unknown>;
  evidenceNote?: string;
  responseSections: string[];
};

export const EmbeddedFinanceAdvisor: React.FC<Props> = ({ module, title, description, questions, evidence, evidenceNote, responseSections }) => {
  const auth = useAuth();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const evidenceJson = useMemo(() => JSON.stringify(evidence), [evidence]);

  const ask = async (preset?: string) => {
    const next = (preset ?? question).trim();
    if (!next || busy) return;
    const userMessage: AdvisorMessage = { id: crypto.randomUUID(), role: 'user', text: next, at: new Date().toISOString() };
    setMessages((rows) => [...rows, userMessage]);
    setQuestion('');
    if (!auth.user || !auth.session) {
      setMessages((rows) => [...rows, { id: crypto.randomUUID(), role: 'assistant', text: 'Sign in to use the AI Financial Advisor with your private finance workspace.', at: new Date().toISOString() }]);
      return;
    }
    setBusy(true);
    const prompt = `You are ArthaMind AI Financial Advisor inside Artha Bench Pro module: ${module}. Analyze ONLY the deterministic calculations and recorded evidence supplied below. Give useful decision-support and review guidance, not generic finance tutoring. Do not invent amounts, balances, repayment status, credit scores, lender offers, eligibility, approval, market data or missing facts. Do not give investment/trading advice, tax/legal conclusions, lending approval, refinancing instructions, debt-collection advice, guarantees, or predictions. Do not tell the user to take a loan, refinance, prepay, buy, sell, or invest. You may say review, compare, verify, consider testing a scenario, or check terms with the relevant provider. If data is missing, state what is missing and how the user can improve the analysis inside Artha Bench. Distinguish Recorded facts | Deterministic calculations | AI interpretation | Data limitations. Use these section headings when relevant: ${responseSections.join(' | ')}. Question: ${next.slice(0, 500)}. Evidence snapshot: ${evidenceJson}`.slice(0, 6500);
    try {
      const response = await askTutorAI(prompt, messages.slice(-6).map((row) => ({ role: row.role, content: row.text })), { country: 'India', currency: 'INR', language: 'english', level: 'advanced', mode: 'explain', detail: 'detailed', useOfficialSources: false });
      setMessages((rows) => [...rows, { id: crypto.randomUUID(), role: 'assistant', text: response.answer, at: new Date().toISOString() }]);
    } catch {
      setMessages((rows) => [...rows, { id: crypto.randomUUID(), role: 'assistant', text: 'ArthaMind could not complete this analysis right now. Your stored finance records were not changed.', at: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-interactive/20 bg-surface p-5 shadow-sm sm:p-6" aria-labelledby={`${module}-advisor-title`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-interactive"><BrainCircuit className="h-4 w-4" /> ArthaMind AI Financial Advisor</div>
          <h2 id={`${module}-advisor-title`} className="mt-2 text-xl font-black text-ink">{title}</h2>
          <p className="mt-2 text-xs leading-5 text-secondary">{description}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success-fill/25 bg-success-soft px-3 py-1.5 text-[9px] font-black text-success"><ShieldCheck className="h-3 w-3" /> Evidence-grounded</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {questions.map((item) => <button key={item} type="button" disabled={busy} onClick={() => void ask(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-2 text-left text-[10px] font-bold text-secondary transition hover:border-interactive/35 hover:text-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-interactive">{item}<ArrowRight className="h-3 w-3" /></button>)}
      </div>

      <div className="mt-4 flex gap-2">
        <textarea rows={2} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about the calculations, pressure points, missing data, or scenarios to review…" className="min-w-0 flex-1 resize-none rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-xs text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/15" aria-label={`Ask ${title}`} />
        <button type="button" disabled={busy || !question.trim()} onClick={() => void ask()} className="min-w-12 rounded-xl bg-brand px-3 text-white disabled:opacity-40" aria-label="Send advisor question"><Send className="mx-auto h-4 w-4" /></button>
      </div>

      {messages.length > 0 && <div className="mt-4 max-h-[440px] space-y-3 overflow-y-auto rounded-2xl border border-line bg-canvas p-3" aria-live="polite">
        {messages.map((message) => message.role === 'user'
          ? <div key={message.id} className="ml-8 rounded-xl bg-interactive-soft p-3 text-xs leading-5 text-ink"><div className="mb-1 text-[9px] font-black uppercase">You</div>{message.text}</div>
          : <article key={message.id} className="rounded-xl border border-line bg-surface p-3 text-xs leading-5 text-secondary"><div className="mb-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-interactive"><Sparkles className="h-3 w-3" /> ArthaMind advisor</div><div className="whitespace-pre-wrap">{message.text}</div></article>)}
        {busy && <div className="rounded-xl border border-line bg-surface p-3 text-xs text-secondary">ArthaMind is analyzing the supplied recorded evidence…</div>}
      </div>}

      <details className="mt-4 rounded-xl border border-line bg-canvas p-3 text-[9px] leading-4 text-secondary">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-black text-ink">What data can this advisor use? <ChevronDown className="h-3 w-3" /></summary>
        <p className="mt-2">{evidenceNote ?? 'Only the deterministic snapshot supplied by this page and the authenticated workspace context used to create it. AI cannot silently edit records or override a calculation.'}</p>
        <p className="mt-1">Snapshot generated: {String(evidence.generatedAt ?? evidence.calculatedAt ?? 'on page load')}</p>
      </details>
    </section>
  );
};
