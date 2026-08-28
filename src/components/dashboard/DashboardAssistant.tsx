import React, { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Bot,
  Database,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  User,
  Wrench,
} from 'lucide-react';
import { askDashboardAssistant } from '../../services/learningApi';
import {
  DashboardAssistantSnapshot,
  NavigationDestination,
  StructuredFinancialAnswer,
} from '../../types';
import { StructuredFinancialAnswerView } from '../ai/StructuredFinancialAnswer';

type AssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
  structuredAnswer?: StructuredFinancialAnswer;
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

export const DashboardAssistant: React.FC<DashboardAssistantProps> = ({
  snapshot,
  ready,
  onNavigate,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: 'assistant',
      content:
        'I can explain the live market, economic, provider-health, and reliability data currently visible on this dashboard—grounded in SEBI-compliant Indian data where available. Ask me about a chart, comparison, or limitation.',
    },
  ]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState(STARTER_QUESTIONS);
  const [sourceLabels, setSourceLabels] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loading]);

  const submitQuestion = async (nextQuestion: string) => {
    const normalized = nextQuestion.trim();
    if (!normalized || !ready || loading) return;

    const conversationHistory = messages
      .filter((message, index) => index > 0 && message.content.trim())
      .slice(-8);
    setMessages((current) => [...current, { role: 'user', content: normalized }]);
    setQuestion('');
    setError(null);
    setLoading(true);

    try {
      const response = await askDashboardAssistant({
        question: normalized,
        snapshot,
        history: conversationHistory,
      });
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: response.answer,
          structuredAnswer: response.structuredAnswer,
        },
      ]);
      if (response.suggestedQuestions.length > 0) {
        setSuggestions(response.suggestedQuestions);
      }
      setSourceLabels(response.sourceLabels);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'ArthaMind AI is temporarily unavailable.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitQuestion(question);
  };

  return (
    <section className="flex h-full min-h-[740px] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
      <div className="border-b border-line bg-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/25 bg-brand-soft text-brand">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold text-ink">Ask ArthaMind AI</h2>
                <span className="rounded-full border border-success-fill/30 bg-success-fill/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success">
                  Data grounded
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-interactive/30 bg-interactive-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-interactive">
                  <Wrench className="h-3 w-3" /> Tool-Calling Enabled
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-secondary">
                Explains the current dashboard snapshot without inventing missing values.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-line bg-subtle px-2.5 py-1 text-[9px] font-semibold text-secondary">
            <span className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-success-fill' : 'bg-warning-fill'}`} />
            {ready ? 'Ready' : 'Loading data'}
          </div>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto bg-canvas p-4 sm:p-5" aria-live="polite">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex items-start gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-interactive/30 bg-interactive/10 text-interactive"
            >
              {message.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </div>
            {message.role === 'assistant' && message.structuredAnswer ? (
              <div className="min-w-0 max-w-[95%] flex-1">
                <StructuredFinancialAnswerView answer={message.structuredAnswer} compact />
              </div>
            ) : (
              <div
                className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-3 text-[12px] leading-6 shadow-sm ${
                  message.role === 'user'
                    ? 'rounded-tr-md border border-interactive/25 bg-interactive-soft text-ink'
                    : 'rounded-tl-md border border-line bg-surface text-ink'
                }`}
              >
                {message.content}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2.5 text-xs text-secondary">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-interactive/30 bg-interactive/10 text-interactive">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            </div>
            Reading the selected charts and verified data…
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-line bg-surface p-4 sm:p-5">
        {error && (
          <div className="mb-3 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-[11px] leading-relaxed text-danger">
            {error}
          </div>
        )}

        <div className="scrollbar-thin mb-3 flex gap-2 overflow-x-auto pb-1">
          {suggestions.slice(0, 4).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={!ready || loading}
              onClick={() => void submitQuestion(suggestion)}
              className="shrink-0 rounded-full border border-line bg-subtle px-3 py-1.5 text-[10px] font-semibold text-secondary transition hover:border-interactive/40 hover:bg-interactive-soft hover:text-interactive disabled:cursor-not-allowed disabled:opacity-45"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="relative">
          <label htmlFor="dashboard-assistant-question" className="sr-only">
            Ask ArthaMind AI about this dashboard
          </label>
          <textarea
            id="dashboard-assistant-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submitQuestion(question);
              }
            }}
            rows={3}
            maxLength={1200}
            disabled={!ready || loading}
            placeholder="I can explain the live market... grounded in SEBI-compliant Indian data."
            className="w-full resize-none rounded-2xl border border-line-strong bg-surface px-4 py-3 pr-12 text-xs leading-5 text-ink outline-none placeholder:text-secondary focus:border-interactive focus:ring-2 focus:ring-interactive disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!ready || loading || !question.trim()}
            aria-label="Send dashboard question"
            className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-brand-foreground hover:text-white transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[9px] text-secondary">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-success" />
            Educational analysis only — not investment advice.
          </div>
          <button
            type="button"
            onClick={() => onNavigate('tutor')}
            className="inline-flex items-center gap-1 font-semibold text-interactive hover:text-interactive/80"
          >
            Open full tutor <ExternalLink className="h-3 w-3" />
          </button>
        </div>

        {sourceLabels.length > 0 && (
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[9px] text-secondary">
            <Database className="h-3 w-3 shrink-0" />
            <span className="truncate">Grounded in {sourceLabels.join(' · ')}</span>
          </div>
        )}
      </div>
    </section>
  );
};
