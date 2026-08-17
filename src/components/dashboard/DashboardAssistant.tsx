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
        'I can explain the live market, economic, provider-health, and reliability data currently visible on this dashboard. Ask me about a chart, comparison, or limitation.',
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
          : 'Ask Artha AI is temporarily unavailable.',
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
    <section className="flex h-full min-h-[740px] flex-col overflow-hidden rounded-3xl border border-slate-300 bg-[#F4F6FB] shadow-2xl shadow-[#4F32FF]/10">
      <div className="border-b border-white/10 bg-[linear-gradient(135deg,#111827,#17123A)] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#7D6BFF]/40 bg-[#5B47FF]/20 text-[#9A8DFF]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold text-white">Ask Artha AI</h2>
                <span className="rounded-full border border-[#00D68F]/30 bg-[#00D68F]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#00D68F]">
                  Data grounded
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#9898AE]">
                Explains the current dashboard snapshot without inventing missing values.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[9px] font-semibold text-[#B8B3D8]">
            <span className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-[#00D68F]' : 'bg-[#F5B800]'}`} />
            {ready ? 'Ready' : 'Loading data'}
          </div>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto bg-[#F4F6FB] p-4 sm:p-5" aria-live="polite">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex items-start gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                message.role === 'user'
                  ? 'border-[#16C7E8]/30 bg-[#16C7E8]/10 text-[#16C7E8]'
                  : 'border-[#665CFF]/30 bg-[#665CFF]/10 text-[#8B7CFF]'
              }`}
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
                    ? 'rounded-tr-md bg-[#4F32FF] text-white'
                    : 'rounded-tl-md border border-slate-200 bg-white text-slate-700'
                }`}
              >
                {message.content}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2.5 text-xs text-slate-500">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#665CFF]/30 bg-[#665CFF]/10 text-[#8B7CFF]">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            </div>
            Reading the selected charts and verified data…
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
        {error && (
          <div className="mb-3 rounded-xl border border-[#FF3B65]/25 bg-[#FF3B65]/10 px-3 py-2 text-[11px] leading-relaxed text-[#FF8BA1]">
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
              className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:border-[#665CFF]/40 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="relative">
          <label htmlFor="dashboard-assistant-question" className="sr-only">
            Ask Artha AI about this dashboard
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
            placeholder="Ask what changed, compare indicators, or explain a chart…"
            className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 pr-12 text-xs leading-5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#665CFF] focus:ring-2 focus:ring-[#665CFF]/10 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!ready || loading || !question.trim()}
            aria-label="Send dashboard question"
            className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-xl bg-[#665CFF] text-white transition hover:bg-[#7A6AFF] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[9px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-[#00D68F]" />
            Educational analysis only — not investment advice.
          </div>
          <button
            type="button"
            onClick={() => onNavigate('tutor')}
            className="inline-flex items-center gap-1 font-semibold text-[#8B7CFF] hover:text-white"
          >
            Open full tutor <ExternalLink className="h-3 w-3" />
          </button>
        </div>

        {sourceLabels.length > 0 && (
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-[9px] text-slate-500">
            <Database className="h-3 w-3 shrink-0" />
            <span className="truncate">Grounded in {sourceLabels.join(' · ')}</span>
          </div>
        )}
      </div>
    </section>
  );
};
