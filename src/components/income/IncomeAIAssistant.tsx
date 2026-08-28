import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Lightbulb,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { askTutorAI } from '../../services/learningApi';
import { CurrencyIncomeSummary, IncomeSource } from '../../services/incomeStorage';
import { StructuredFinancialAnswer } from '../../types';
import { TaxWorkspaceState } from '../../types/taxTypes';
import { StructuredFinancialAnswerView } from '../ai/StructuredFinancialAnswer';

type AssistantMode = 'income-health' | 'tax-readiness' | 'missing-data' | 'planning';

interface IncomeAIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  structuredAnswer?: StructuredFinancialAnswer;
  createdAt: string;
}

interface IncomeAIAssistantProps {
  sources: IncomeSource[];
  summaries: CurrencyIncomeSummary[];
  taxWorkspace: TaxWorkspaceState;
  taxEstimate: unknown;
  taxComparison: unknown;
  onAddIncomeSource: () => void;
}

const MODE_LABELS: Record<AssistantMode, string> = {
  'income-health': 'Income health',
  'tax-readiness': 'Tax readiness',
  'missing-data': 'Missing data',
  planning: 'Planning',
};

function buildAdaptiveQuestions(sources: IncomeSource[], summaries: CurrencyIncomeSummary[]): string[] {
  if (!sources.length) {
    return [
      'What are your current income sources, and how often are you paid from each one?',
      'Do you receive any freelance, business, rental, interest, dividend, pension, or one-time income that is not recorded yet?',
    ];
  }

  const questions: string[] = [];
  const types = new Set(sources.map((source) => source.type));
  const hasIrregularIncome = sources.some((source) =>
    source.frequency === 'One-time' || source.type === 'Freelance' || source.type === 'Business',
  );
  const hasInvestmentReturns = types.has('Investment Returns');
  const hasPreTaxIncome = sources.some((source) => source.taxStatus === 'Pre-tax');
  const activeRecurringTypes = new Set(
    sources.filter((source) => source.frequency !== 'One-time').map((source) => source.type),
  );

  if (hasIrregularIncome) {
    questions.push('Is your freelance, business, or one-time income complete for the period, including months with unusually high or low receipts?');
  }
  if (hasInvestmentReturns) {
    questions.push('Are the recorded Investment Returns realised income such as interest, dividends, or realised gains—not unrealised portfolio value changes?');
  }
  if (hasPreTaxIncome) {
    questions.push('For each pre-tax source, have you recorded the gross amount consistently rather than mixing gross and net receipts?');
  }
  if (summaries.length > 1) {
    questions.push('You have multiple currencies recorded. Should each currency remain a separate planning bucket? No FX conversion is applied automatically.');
  }
  if (activeRecurringTypes.size <= 1) {
    questions.push('Is there any secondary recurring income that has not been recorded, or is one category genuinely your only recurring source?');
  }
  if (!types.has('Rental')) {
    questions.push('Do you receive any actual rental income that should be recorded separately, including periods of vacancy?');
  }

  return [...new Set(questions)].slice(0, 3);
}

function compactIncomeContext(
  sources: IncomeSource[],
  summaries: CurrencyIncomeSummary[],
  taxWorkspace: TaxWorkspaceState,
  taxEstimate: unknown,
  taxComparison: unknown,
) {
  const compactSources = sources.slice(0, 10).map((source) => ({
    type: source.type,
    amount: source.amount,
    currency: source.currency,
    frequency: source.frequency,
    taxStatus: source.taxStatus,
    description: source.description.slice(0, 70),
    tags: source.tags.slice(0, 4),
  }));

  return {
    recordCount: sources.length,
    sourcesShown: compactSources,
    additionalSourceCount: Math.max(0, sources.length - compactSources.length),
    summaries: summaries.map((summary) => ({
      currency: summary.currency,
      monthlyRecurring: summary.monthlyRecurring,
      annualProjected: summary.annualProjected,
      oneTimeThisYear: summary.oneTimeThisYear,
      byType: summary.byType,
    })),
    taxProfile: taxWorkspace.profile,
    deductionEntryCount: taxWorkspace.deductions.length,
    taxCreditEntryCount: taxWorkspace.credits.length,
    taxDocumentCount: taxWorkspace.documents.length,
    deterministicTaxEstimate: taxEstimate,
    deterministicRegimeComparison: taxComparison,
  };
}

function buildIncomePrompt(
  question: string,
  mode: AssistantMode,
  sources: IncomeSource[],
  summaries: CurrencyIncomeSummary[],
  taxWorkspace: TaxWorkspaceState,
  taxEstimate: unknown,
  taxComparison: unknown,
) {
  const context = compactIncomeContext(sources, summaries, taxWorkspace, taxEstimate, taxComparison);
  const compactContext = JSON.stringify(context);
  const modeInstruction: Record<AssistantMode, string> = {
    'income-health': 'Assess income stability, concentration, recurring-vs-irregular mix, and data quality.',
    'tax-readiness': 'Explain the deterministic tax-workspace outputs and identify records the user should verify. Do not replace or override the deterministic calculation.',
    'missing-data': 'Act like an intelligent financial intake reviewer. Identify missing or ambiguous records and ask only the most relevant follow-up questions.',
    planning: 'Explain what the recorded income baseline can and cannot support for cash-flow or goal planning. Use conservative educational framing.',
  };

  const prefix = `You are ArthaMind Income Intelligence inside ArthaBench Pro. ${modeInstruction[mode]}
Use ONLY the user-entered snapshot below for specific personal amounts. Never invent income, silently convert currencies, estimate missing tax liability, or change legal income classification to create a tax benefit. Keep realised investment income separate from unrealised holdings. Treat deterministic tax outputs as authoritative app calculations to explain, not AI values to overwrite. If a missing fact could materially change the answer, ask up to 2 targeted follow-up questions and explain why each matters. Do not modify, save, delete, or reclassify records. Clearly separate recorded facts, deterministic calculations, AI interpretation, and items requiring professional review. Educational personal-finance guidance only; no guaranteed outcomes or personalized investment instructions.
Question: ${question.trim().slice(0, 420)}
Snapshot:`;

  const roomForContext = Math.max(250, 1950 - prefix.length);
  return `${prefix}${compactContext.slice(0, roomForContext)}`;
}

export const IncomeAIAssistant: React.FC<IncomeAIAssistantProps> = ({
  sources,
  summaries,
  taxWorkspace,
  taxEstimate,
  taxComparison,
  onAddIncomeSource,
}) => {
  const [mode, setMode] = useState<AssistantMode>('income-health');
  const [messages, setMessages] = useState<IncomeAIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const adaptiveQuestions = useMemo(
    () => buildAdaptiveQuestions(sources, summaries),
    [sources, summaries],
  );

  const starterPrompts = useMemo(() => [
    'Analyze my income stability and concentration using only my recorded data.',
    'What income records or details may be missing from this workspace?',
    'Explain my deterministic tax estimate and the assumptions I should verify.',
    'What should I verify before using this income baseline for monthly planning?',
  ], []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isThinking]);

  const sendQuestion = async (override?: string) => {
    const question = (override ?? input).trim();
    if (!question || isThinking) return;

    const userMessage: IncomeAIMessage = {
      id: `income-user-${Date.now()}`,
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };
    const history = messages.slice(-8).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setError(null);
    setIsThinking(true);

    try {
      const groundedPrompt = buildIncomePrompt(
        question,
        mode,
        sources,
        summaries,
        taxWorkspace,
        taxEstimate,
        taxComparison,
      );
      const response = await askTutorAI(groundedPrompt, history, {
        country: 'India',
        currency: 'INR',
        language: 'english',
        level: 'advanced',
        mode: 'explain',
        detail: 'detailed',
        useOfficialSources: false,
      });

      setMessages((current) => [
        ...current,
        {
          id: `income-ai-${Date.now()}`,
          role: 'assistant',
          content: response.answer,
          structuredAnswer: response.structuredAnswer,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (requestError) {
      console.error('Income AI request failed:', requestError);
      setError('Artha Income AI could not complete this request. Your recorded income data has not been changed.');
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-interactive/25 bg-surface shadow-sm" aria-labelledby="income-ai-heading">
      <header className="border-b border-line bg-gradient-to-r from-interactive-soft/80 via-surface to-brand-soft/60 p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-interactive/25 bg-surface px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-interactive">
                <BrainCircuit className="h-3.5 w-3.5" /> Artha AI · Income Intelligence
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success-fill/25 bg-success-soft px-2.5 py-1 text-[10px] font-bold text-success">
                <ShieldCheck className="h-3.5 w-3.5" /> Grounded on your workspace
              </span>
            </div>
            <h2 id="income-ai-heading" className="mt-3 text-2xl font-black tracking-tight text-ink">Advanced personal income assistant</h2>
            <p className="mt-2 text-sm leading-6 text-secondary">
              Ask about income stability, missing records, tax-readiness, or planning. The assistant receives a compact snapshot of the records already in this workspace and cannot silently change them.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(MODE_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value as AssistantMode)}
                className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                  mode === value
                    ? 'border-interactive bg-interactive text-white shadow-sm'
                    : 'border-line bg-surface text-secondary hover:border-interactive/40 hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-[560px] flex-col bg-canvas">
          <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
            {messages.length === 0 ? (
              <div className="mx-auto flex min-h-[360px] max-w-2xl flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-interactive/25 bg-surface shadow-sm">
                  <Sparkles className="h-8 w-8 text-interactive" />
                </div>
                <h3 className="mt-5 text-xl font-black text-ink">Ask Artha about your recorded income</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">
                  It can reason over the income baseline, explain deterministic outputs, spot data-quality gaps, and ask targeted questions before giving a conclusion.
                </p>
                <div className="mt-5 grid w-full gap-2 sm:grid-cols-2">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendQuestion(prompt)}
                      className="rounded-xl border border-line bg-surface p-3 text-left text-xs font-semibold leading-5 text-secondary transition-all hover:border-interactive/40 hover:text-ink"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                {!sources.length ? (
                  <button type="button" onClick={onAddIncomeSource} className="mt-4 rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-white hover:bg-brand-hover">
                    Add an income source first
                  </button>
                ) : null}
              </div>
            ) : (
              messages.map((message) => (
                <article key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[85%]' : 'mr-auto w-full max-w-4xl'}>
                  {message.role === 'user' ? (
                    <div className="rounded-2xl rounded-br-md bg-interactive px-4 py-3 text-sm leading-6 text-white shadow-sm">
                      {message.content}
                    </div>
                  ) : message.structuredAnswer ? (
                    <StructuredFinancialAnswerView
                      answer={message.structuredAnswer}
                      compact
                      disclaimer="Educational personal-finance guidance only. Verify tax and legal decisions with a qualified professional."
                    />
                  ) : (
                    <div className="rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3 text-sm leading-6 text-secondary shadow-sm whitespace-pre-wrap">
                      {message.content}
                    </div>
                  )}
                </article>
              ))
            )}

            {isThinking ? (
              <div className="mr-auto inline-flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-secondary shadow-sm">
                <RefreshCw className="h-4 w-4 animate-spin text-interactive" /> Reviewing the recorded income context…
              </div>
            ) : null}
            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm text-danger">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="border-t border-line bg-surface p-4">
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-canvas p-2 focus-within:border-interactive/50">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendQuestion();
                  }
                }}
                rows={2}
                maxLength={700}
                placeholder="Ask about your income records, stability, tax-readiness, missing information, or planning…"
                className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-ink outline-none placeholder:text-secondary/70"
                aria-label="Ask Artha Income AI"
              />
              <button
                type="button"
                onClick={() => void sendQuestion()}
                disabled={!input.trim() || isThinking}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-interactive text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send question"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-secondary">
              <span>{sources.length} income record{sources.length === 1 ? '' : 's'} available to this session · currencies stay separate</span>
              {messages.length ? (
                <button type="button" onClick={() => { setMessages([]); setError(null); }} className="inline-flex items-center gap-1 font-bold hover:text-danger">
                  <Trash2 className="h-3 w-3" /> Clear conversation
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="border-t border-line bg-surface p-5 xl:border-l xl:border-t-0">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-interactive" />
            <h3 className="font-black text-ink">AI review queue</h3>
          </div>
          <p className="mt-2 text-xs leading-5 text-secondary">Questions are generated from gaps or patterns in the records already present. Choose one to continue the interview.</p>

          <div className="mt-4 space-y-2">
            {adaptiveQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => void sendQuestion(question)}
                className="w-full rounded-xl border border-line bg-canvas p-3 text-left text-xs font-semibold leading-5 text-secondary transition-all hover:border-interactive/40 hover:text-ink"
              >
                {question}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-brand/20 bg-brand-soft/60 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-ink"><CheckCircle2 className="h-4 w-4 text-brand" /> Intelligence boundaries</div>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-secondary">
              <li className="flex gap-2"><Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-premium" /> Recorded amounts are treated as user-provided facts, not independently verified bank data.</li>
              <li className="flex gap-2"><Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-premium" /> Tax estimates remain deterministic engine outputs; AI explains but does not overwrite them.</li>
              <li className="flex gap-2"><Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-premium" /> AI cannot save, delete, reclassify, or silently change income records.</li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
};
