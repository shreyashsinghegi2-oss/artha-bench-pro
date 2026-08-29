import React, { useState } from 'react';
import { AlertCircle, Database, Globe2, Send, ShieldCheck, Sparkles } from 'lucide-react';
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
}

interface ScenarioAssistantResponse {
  structuredAnswer: StructuredFinancialAnswer;
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

export const ScenarioAssistantPanel: React.FC<ScenarioAssistantPanelProps> = ({
  activeTab,
  inputs,
  profile,
  currency,
  companySymbol,
  useExternalContext,
}) => {
  const [question, setQuestion] = useState(DEFAULT_QUESTIONS[activeTab]);
  const [response, setResponse] = useState<ScenarioAssistantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setResponse(data as ScenarioAssistantResponse);
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
          <p className="mt-1 max-w-3xl text-[11px] leading-5 text-secondary">ArthaMind receives the same inputs, asks the server to recalculate them with Decimal.js, and then explains the verified result. Connected provider data can add current context, but AI cannot replace the deterministic math.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-success-fill/25 bg-success-soft px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-success"><ShieldCheck className="h-3.5 w-3.5" /> Math locked to engine</span>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] text-secondary">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1"><Database className="h-3 w-3" /> Decimal.js result context</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1"><Globe2 className="h-3 w-3" /> {useExternalContext ? `${profile} external context enabled` : 'External context disabled'}</span>
        {companySymbol?.trim() && <span className="rounded-full border border-line bg-canvas px-2.5 py-1">Company context: {companySymbol.trim().toUpperCase()}</span>}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          className="min-h-[84px] flex-1 resize-y rounded-2xl border border-line bg-canvas px-3.5 py-3 text-xs leading-5 text-ink outline-none focus:border-interactive"
          placeholder="Ask ArthaMind to explain, compare assumptions, or connect the result to verified context..."
        />
        <button
          type="button"
          onClick={() => void analyze()}
          disabled={loading || question.trim().length < 3}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-brand-foreground transition-colors hover:bg-brand-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {loading ? 'Analyzing…' : 'Analyze result'}
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
