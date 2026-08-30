import React, { useEffect, useState } from 'react';
import { AlertCircle, Calculator, Database, Globe2, Send, ShieldCheck, Sparkles } from 'lucide-react';
import type { StructuredFinancialAnswer } from '../../types';
import { StructuredFinancialAnswerView } from '../ai/StructuredFinancialAnswer';

export type CalculatorTab = 'compound' | 'quick-ratio' | 'cagr' | 'break-even' | 'dti';
export type ScenarioProfile = 'US' | 'India' | 'Global';
export type ScenarioCurrency = 'USD' | 'INR' | 'EUR' | 'GBP';

interface ScenarioAssistantPanelProps {
  activeTab: CalculatorTab;
  inputs: Record<string, number>;
  profile: ScenarioProfile;
  currency: ScenarioCurrency;
  companySymbol?: string;
  useExternalContext: boolean;
  hasVerifiedResult?: boolean;
  onVerifiedResult?: (result: Record<string, unknown>) => void;
}

interface ScenarioAssistantResponse {
  structuredAnswer: StructuredFinancialAnswer;
  deterministicResult?: Record<string, unknown>;
  sourceLabels?: string[];
  contextNotes?: string[];
  suggestedQuestions?: string[];
  groundedAt?: string;
  engine?: string;
  disclaimer?: string;
}

const DEFAULT_QUESTIONS: Record<CalculatorTab, string> = {
  compound: 'Explain this compound-interest result and which assumption changes it the most.',
  'quick-ratio': 'Explain this quick ratio, what it measures, and how I should interpret it carefully.',
  cagr: 'Explain this CAGR and why it should not be treated as a forecast.',
  'break-even': 'Explain this break-even result and which cost or price assumption matters most.',
  dti: 'Explain this DTI result and why lender definitions or thresholds can differ.',
};

const FEATURE_CONTEXT: Record<CalculatorTab, string> = {
  compound: 'The entered principal, rate, contribution, time and compounding frequency remain the calculation inputs. Connected macro data is context only and never replaces the rate you entered.',
  'quick-ratio': 'If you enter a company symbol, connected company/quote data can provide separate business context. It is never treated as the source of the balance-sheet values you entered unless the provider explicitly supplies the same metric and period.',
  cagr: 'If you enter a company symbol, connected company and market context can help explain the surrounding business/market picture. The CAGR itself always comes from your entered start value, end value and period.',
  'break-even': 'If you enter a company symbol, connected company context can be discussed separately. Fixed cost, selling price and variable cost remain your modeled assumptions.',
  dti: 'The DTI calculation always uses the income and debt values you entered. Connected macro observations may add educational context but do not become lender thresholds or approval criteria.',
};

export const ScenarioAssistantPanel: React.FC<ScenarioAssistantPanelProps> = ({
  activeTab,
  inputs,
  profile,
  currency,
  companySymbol,
  useExternalContext,
  hasVerifiedResult = false,
  onVerifiedResult,
}) => {
  const [question, setQuestion] = useState(DEFAULT_QUESTIONS[activeTab]);
  const [response, setResponse] = useState<ScenarioAssistantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuestion(DEFAULT_QUESTIONS[activeTab]);
    setResponse(null);
    setError(null);
  }, [activeTab]);

  const analyze = async (nextQuestion = question) => {
    if (nextQuestion.trim().length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/scenario-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: activeTab,
          question: nextQuestion.trim(),
          profile,
          currency,
          companySymbol: companySymbol?.trim() || '',
          useExternalContext,
          inputs,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'ArthaMind could not analyze this scenario.');
      const nextResponse = data as ScenarioAssistantResponse;
      setResponse(nextResponse);

      if (nextResponse.deterministicResult && onVerifiedResult) {
        onVerifiedResult({
          ...nextResponse.deterministicResult,
          engine: nextResponse.engine || 'Decimal.js',
          calculatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      setResponse(null);
      setError(err instanceof Error ? err.message : 'ArthaMind analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-interactive/25 bg-surface p-5 shadow-sm sm:p-6" aria-label="ArthaMind scenario assistant">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-ink"><Sparkles className="h-4 w-4 text-interactive" /> ArthaMind Scenario Assistant</div>
          <p className="mt-1 max-w-3xl text-[11px] leading-5 text-secondary">Available for every calculator. When you analyze, the server first recalculates the current inputs with Decimal.js and then asks ArthaMind to explain that verified result. Connected provider data is a separate evidence layer and never replaces the deterministic inputs.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-success-fill/25 bg-success-soft px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-success"><ShieldCheck className="h-3.5 w-3.5" /> Math locked to engine</span>
      </div>

      <div className="rounded-2xl border border-line bg-canvas p-3 text-[10px] leading-5 text-secondary">
        <div className="flex items-center gap-2 font-black uppercase tracking-wider text-ink"><Calculator className="h-3.5 w-3.5 text-interactive" /> Feature evidence rule</div>
        <p className="mt-1.5">{FEATURE_CONTEXT[activeTab]}</p>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] text-secondary">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1"><Database className="h-3 w-3" /> Decimal.js input/result context</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1"><Globe2 className="h-3 w-3" /> {useExternalContext ? `${profile} connected context enabled` : 'External context disabled'}</span>
        {companySymbol?.trim() && <span className="rounded-full border border-line bg-canvas px-2.5 py-1">Company context: {companySymbol.trim().toUpperCase()}</span>}
        <span className={`rounded-full border px-2.5 py-1 ${hasVerifiedResult ? 'border-success-fill/25 bg-success-soft text-success' : 'border-warning-fill/25 bg-warning-soft text-warning'}`}>{hasVerifiedResult ? 'Deterministic result calculated' : 'Assistant will calculate before analysis'}</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          className="min-h-[84px] flex-1 resize-y rounded-2xl border border-line bg-canvas px-3.5 py-3 text-xs leading-5 text-ink outline-none focus:border-interactive"
          placeholder="Ask ArthaMind to calculate, explain, compare assumptions, or connect the result to verified context..."
        />
        <button
          type="button"
          onClick={() => void analyze()}
          disabled={loading || question.trim().length < 3}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-brand-foreground transition-colors hover:bg-brand-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {loading ? 'Calculating & analyzing…' : hasVerifiedResult ? 'Analyze result' : 'Calculate & analyze'}
        </button>
      </div>

      {error && <div className="flex items-start gap-2 rounded-xl border border-danger bg-danger-soft p-3 text-xs text-danger"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}

      {response && (
        <div className="space-y-3">
          <StructuredFinancialAnswerView answer={response.structuredAnswer} compact disclaimer={response.disclaimer} />
          {(response.sourceLabels?.length || response.contextNotes?.length) ? (
            <div className="rounded-2xl border border-line bg-canvas p-3.5 text-[10px] leading-5 text-secondary">
              <div className="font-black uppercase tracking-wider text-ink">Connected context used</div>
              {response.sourceLabels?.length ? <div className="mt-2 flex flex-wrap gap-2">{response.sourceLabels.map((source) => <span key={source} className="rounded-full border border-line bg-surface px-2.5 py-1">{source}</span>)}</div> : null}
              {response.contextNotes?.map((note) => <p key={note} className="mt-2">{note}</p>)}
              {response.groundedAt && <p className="mt-2">Context retrieved: {new Date(response.groundedAt).toLocaleString()}</p>}
            </div>
          ) : null}
          {response.suggestedQuestions?.length ? (
            <div className="flex flex-wrap gap-2">{response.suggestedQuestions.map((item) => <button key={item} type="button" onClick={() => { setQuestion(item); void analyze(item); }} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[10px] font-bold text-secondary hover:border-interactive hover:text-interactive">{item}</button>)}</div>
          ) : null}
        </div>
      )}
    </section>
  );
};
