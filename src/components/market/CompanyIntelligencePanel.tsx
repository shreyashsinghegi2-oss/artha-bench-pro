import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  Building2,
  CalendarCheck2,
  ExternalLink,
  KeyRound,
  LineChart as LineChartIcon,
  MessageSquareText,
  RefreshCw,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CompanyIntelligence, StructuredFinancialAnswer } from '../../types';
import {
  askCompanyIntelligenceAI,
  fetchMarketHistory,
} from '../../services/learningApi';
import { StructuredFinancialAnswerView } from '../ai/StructuredFinancialAnswer';

interface CompanyIntelligencePanelProps {
  data: CompanyIntelligence | null;
  loading: boolean;
}

type CompanyChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  structuredAnswer?: StructuredFinancialAnswer;
};

const DEFAULT_AI_QUESTIONS = [
  'Explain the valuation ratios in simple language.',
  'What do the latest earnings surprises show?',
  'Summarize the financial strengths and risks visible in this data.',
  'How does the 52-week range compare with the current quote?',
];

function formatNumber(value: number | null, suffix = '') {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

function formatMarketCap(value: number | null | undefined, currency: string | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const prefix = currency === 'USD' ? '$' : `${currency || ''} `;
  // Finnhub company profiles express market capitalization in millions.
  return value >= 1_000
    ? `${prefix}${(value / 1_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}B`
    : `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}M`;
}

export const CompanyIntelligencePanel: React.FC<CompanyIntelligencePanelProps> = ({
  data,
  loading,
}) => {
  const [historyRange, setHistoryRange] = useState('1y');
  const [historyPoints, setHistoryPoints] = useState<Array<{ date: string; price: number }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<CompanyChatMessage[]>([]);
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState(DEFAULT_AI_QUESTIONS);

  useEffect(() => {
    if (!data || data.status !== 'connected') return;
    let active = true;
    setHistoryLoading(true);
    fetchMarketHistory(data.symbol, historyRange)
      .then((response) => {
        if (active) setHistoryPoints(response.points || []);
      })
      .catch(() => {
        if (active) setHistoryPoints([]);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [data?.symbol, data?.status, historyRange]);

  useEffect(() => {
    setChatMessages([]);
    setAssistantQuestion('');
    setAssistantError(null);
    setSuggestedQuestions(DEFAULT_AI_QUESTIONS);
  }, [data?.symbol]);

  const earningsChartData = useMemo(
    () =>
      [...(data?.earnings || [])]
        .reverse()
        .map((earning) => ({
          period: earning.period?.slice(0, 7) || 'Period',
          actual: earning.actual,
          estimate: earning.estimate,
          surprise: earning.surprise,
        })),
    [data?.earnings],
  );

  const recommendationChartData = useMemo(
    () =>
      [...(data?.recommendations || [])]
        .reverse()
        .map((recommendation) => ({
          ...recommendation,
          period: recommendation.period?.slice(0, 7) || 'Period',
        })),
    [data?.recommendations],
  );

  const submitAssistantQuestion = async (question: string) => {
    const normalizedQuestion = question.trim();
    if (!data || data.status !== 'connected' || !normalizedQuestion || assistantLoading) return;

    const priorHistory = chatMessages.slice(-8).map(({ role, content }) => ({ role, content }));
    setChatMessages((current) => [
      ...current,
      { role: 'user', content: normalizedQuestion },
    ]);
    setAssistantQuestion('');
    setAssistantError(null);
    setAssistantLoading(true);

    try {
      const response = await askCompanyIntelligenceAI({
        symbol: data.symbol,
        question: normalizedQuestion,
        history: priorHistory,
      });
      setChatMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: response.answer,
          structuredAnswer: response.structuredAnswer,
        },
      ]);
      if (response.suggestedQuestions?.length) {
        setSuggestedQuestions(response.suggestedQuestions);
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'The company assistant is temporarily unavailable.';
      setAssistantError(message);
    } finally {
      setAssistantLoading(false);
    }
  };

  const handleAssistantSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submitAssistantQuestion(assistantQuestion);
  };

  if (loading) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm min-h-52 flex items-center justify-center text-xs text-secondary">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading Finnhub company intelligence…
      </div>
    );
  }

  if (!data) return null;

  if (data.status === 'not_configured') {
    return (
      <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-interactive-soft border border-interactive text-interactive">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Finnhub Company Intelligence Is Ready</h2>
              <p className="text-xs text-secondary mt-1 leading-relaxed">
                Add the Finnhub credential in Vercel to activate company profiles, fundamentals, earnings surprises, and analyst trends.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-warning-soft/60 border border-warning-fill/60 text-[10px] font-bold text-warning whitespace-nowrap">
            KEY REQUIRED
          </span>
        </div>
        <div className="bg-surface border border-line rounded-xl px-4 py-3">
          <p className="text-[10px] text-secondary uppercase tracking-wider">Vercel environment-variable name</p>
          <code className="text-xs text-interactive font-mono mt-1 block">FINNHUB_API_KEY</code>
        </div>
      </div>
    );
  }

  if (data.status !== 'connected') {
    return (
      <div className="bg-danger-soft/20 border border-danger/60 rounded-2xl p-5 text-xs text-danger">
        <span className="font-bold">Finnhub:</span> {data.message}
      </div>
    );
  }

  const profile = data.profile;
  const metrics = data.metrics;
  const companyUrl = profile?.webUrl?.startsWith('https://') ? profile.webUrl : null;
  const logoUrl = profile?.logoUrl?.startsWith('https://') ? profile.logoUrl : null;

  const metricCards = [
    ['P/E ratio', formatNumber(metrics?.peRatio ?? null)],
    ['Price / book', formatNumber(metrics?.priceToBook ?? null)],
    ['Price / sales', formatNumber(metrics?.priceToSales ?? null)],
    ['Return on equity', formatNumber(metrics?.returnOnEquity ?? null, '%')],
    ['Beta', formatNumber(metrics?.beta ?? null)],
    ['Current ratio', formatNumber(metrics?.currentRatio ?? null)],
    ['Dividend yield', formatNumber(metrics?.dividendYield ?? null, '%')],
    ['EPS growth (3Y)', formatNumber(metrics?.epsGrowth3Y ?? null, '%')],
    ['Revenue growth (3Y)', formatNumber(metrics?.revenueGrowth3Y ?? null, '%')],
  ];

  return (
    <div className="bg-subtle border border-interactive/50 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-11 h-11 rounded-xl bg-surface object-contain p-1" />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-interactive-soft border border-interactive flex items-center justify-center">
              <Building2 className="w-5 h-5 text-interactive" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink truncate">
                {profile?.name || data.symbol}
              </h2>
              <span className="text-[10px] font-mono text-interactive bg-interactive-soft px-2 py-0.5 rounded">
                {data.symbol}
              </span>
            </div>
            <p className="text-[11px] text-secondary mt-1">
              {[profile?.exchange, profile?.industry, profile?.country].filter(Boolean).join(' · ') || 'Company intelligence'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-secondary">Market capitalization</p>
            <p className="text-sm font-bold text-success">
              {formatMarketCap(profile?.marketCapitalization, profile?.currency)}
            </p>
          </div>
          {companyUrl && (
            <a
              href={companyUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-hover text-secondary hover:text-interactive"
              aria-label="Open company website"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-interactive" />
            <h3 className="text-xs font-bold text-ink">Fundamental Metrics</h3>
          </div>
          <span className="text-[9px] text-secondary font-mono">FINNHUB NORMALIZED DATA</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {metricCards.map(([label, value]) => (
            <div key={label} className="bg-surface border border-line rounded-xl p-3.5 min-h-20">
              <p className="text-[10px] text-secondary">{label}</p>
              <p className="text-base font-extrabold text-ink mt-1.5">{value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
          <div className="bg-surface/70 border border-line rounded-xl p-3">
            <p className="text-secondary">52-week low</p>
            <p className="text-ink font-bold mt-1">{formatNumber(metrics?.week52Low ?? null)}</p>
          </div>
          <div className="bg-surface/70 border border-line rounded-xl p-3">
            <p className="text-secondary">52-week high</p>
            <p className="text-ink font-bold mt-1">{formatNumber(metrics?.week52High ?? null)}</p>
          </div>
          <div className="bg-surface/70 border border-line rounded-xl p-3">
            <p className="text-secondary">IPO date</p>
            <p className="text-ink font-bold mt-1">{profile?.ipoDate || '—'}</p>
          </div>
          <div className="bg-surface/70 border border-line rounded-xl p-3">
            <p className="text-secondary">Shares outstanding</p>
            <p className="text-ink font-bold mt-1">{formatNumber(profile?.sharesOutstanding ?? null, 'M')}</p>
          </div>
        </div>
      </section>

      <section className="bg-surface border border-line rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <LineChartIcon className="w-4 h-4 text-success" />
              <h3 className="text-sm font-bold text-ink">Historical Price Trend</h3>
            </div>
            <p className="text-[10px] text-secondary mt-1">Configured market-data provider · Prices may be delayed</p>
          </div>
          <div className="flex items-center gap-1 bg-surface border border-line rounded-xl p-1">
            {['1m', '3m', '6m', '1y'].map((range) => (
              <button
                key={range}
                onClick={() => setHistoryRange(range)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${historyRange === range ? 'bg-interactive-soft text-interactive' : 'text-secondary hover:text-ink'}`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[300px] sm:h-[360px]">
          {historyLoading ? (
            <div className="h-full flex items-center justify-center text-xs text-secondary">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading price history…
            </div>
          ) : historyPoints.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyPoints} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="companyPriceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-primary)" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => String(value).slice(0, 10)}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 9 }}
                  stroke="var(--border-subtle)"
                  minTickGap={38}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 9 }}
                  stroke="var(--border-subtle)"
                  width={52}
                  tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Price']}
                  contentStyle={{ background: 'var(--chart-tooltip)', border: '1px solid var(--border-strong)', borderRadius: 12, color: 'var(--chart-tooltip-foreground)', fontSize: 11 }}
                />
                <Area type="monotone" dataKey="price" stroke="var(--chart-primary)" strokeWidth={2.5} fill="url(#companyPriceGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-secondary">No price history is available.</div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-surface border border-line rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarCheck2 className="w-4 h-4 text-success" />
            <div>
              <h3 className="text-sm font-bold text-ink">Earnings: Actual vs Estimate</h3>
              <p className="text-[10px] text-secondary mt-0.5">Reported earnings per share and consensus estimate</p>
            </div>
          </div>
          {earningsChartData.length > 0 ? (
            <>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={earningsChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} stroke="var(--border-subtle)" />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} stroke="var(--border-subtle)" />
                    <Tooltip contentStyle={{ background: 'var(--chart-tooltip)', border: '1px solid var(--border-strong)', borderRadius: 12, color: 'var(--chart-tooltip-foreground)', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="actual" name="Actual EPS" fill="var(--success)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="estimate" name="Estimated EPS" fill="var(--chart-primary)" radius={[4, 4, 0, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                {data.earnings.map((earning, index) => (
                  <div key={`${earning.period}-${index}`} className="bg-surface border border-line rounded-lg p-2.5 text-[9px]">
                    <p className="text-secondary">{earning.period || 'Period'}</p>
                    <p className={`font-bold mt-1 ${(earning.surprise ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                      Surprise {earning.surprise === null ? '—' : `${earning.surprise >= 0 ? '+' : ''}${formatNumber(earning.surprise)}`}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-[10px] text-secondary">No earnings observations available.</div>
          )}
        </section>

        <section className="bg-surface border border-line rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-interactive" />
            <div>
              <h3 className="text-sm font-bold text-ink">Analyst Recommendation History</h3>
              <p className="text-[10px] text-secondary mt-0.5">Third-party opinion counts—not ArthaBench advice</p>
            </div>
          </div>
          {recommendationChartData.length > 0 ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={recommendationChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="period" tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} stroke="var(--border-subtle)" />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} stroke="var(--border-subtle)" />
                  <Tooltip contentStyle={{ background: 'var(--chart-tooltip)', border: '1px solid var(--border-strong)', borderRadius: 12, color: 'var(--chart-tooltip-foreground)', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Bar dataKey="strongBuy" name="Strong buy" stackId="recommendations" fill="var(--brand-primary)" />
                  <Bar dataKey="buy" name="Buy" stackId="recommendations" fill="var(--success)" />
                  <Bar dataKey="hold" name="Hold" stackId="recommendations" fill="var(--warning)" />
                  <Bar dataKey="sell" name="Sell" stackId="recommendations" fill="var(--danger)" fillOpacity={0.68} />
                  <Bar dataKey="strongSell" name="Strong sell" stackId="recommendations" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-[10px] text-secondary">No analyst recommendation history is available.</div>
          )}
        </section>
      </div>

      <section className="bg-surface border border-line rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-interactive-soft border border-interactive text-interactive">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-ink">ArthaBench Company AI Assistant</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-soft border border-success-fill text-[9px] font-bold text-success">
                  <Sparkles className="w-2.5 h-2.5" /> GROUNDED
                </span>
              </div>
              <p className="text-[11px] text-secondary mt-1 max-w-3xl leading-relaxed">
                Ask for educational explanations of {data.symbol}’s loaded Finnhub fundamentals, earnings, analyst history, and market quote. Company-specific answers are grounded in the current dashboard data.
              </p>
            </div>
          </div>
          <span className="text-[9px] text-secondary lg:text-right">No buy/sell/hold advice<br />No guaranteed forecasts</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-9 bg-surface border border-line rounded-2xl p-4 sm:p-5 min-h-[430px] flex flex-col shadow-sm">
            <div className="flex-1 space-y-4 max-h-[720px] overflow-y-auto pr-1">
              {chatMessages.length === 0 ? (
                <div className="h-full min-h-44 flex flex-col items-center justify-center text-center px-4">
                  <MessageSquareText className="w-8 h-8 text-interactive mb-3" />
                  <p className="text-sm font-bold text-ink">Ask a grounded company-analysis question</p>
                  <p className="text-[11px] text-secondary mt-1 max-w-md leading-relaxed">Each response is organized into a direct answer, numbered steps, formula or method, worked example, interpretation, risks, and sources.</p>
                </div>
              ) : (
                chatMessages.map((message, index) => {
                  if (message.role === 'user') {
                    return (
                      <div key={`${message.role}-${index}`} className="flex justify-end">
                        <div className="max-w-[88%] rounded-2xl rounded-br-md border border-interactive/25 bg-interactive-soft px-4 py-3 text-[12px] font-medium leading-relaxed text-ink shadow-sm">
                          {message.content}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={`${message.role}-${index}`} className="w-full">
                      {message.structuredAnswer ? (
                        <StructuredFinancialAnswerView answer={message.structuredAnswer} compact />
                      ) : (
                        <div className="rounded-2xl border border-line bg-subtle px-4 py-3 text-[12px] leading-relaxed whitespace-pre-wrap text-secondary">
                          {message.content}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {assistantLoading && (
                <div className="flex items-center text-[11px] font-medium text-interactive">
                  <RefreshCw className="w-3 h-3 animate-spin mr-2" /> Analyzing the loaded company evidence…
                </div>
              )}
            </div>

            {assistantError && (
              <div className="mt-3 p-2.5 rounded-lg bg-danger-soft/40 border border-danger text-[10px] text-danger">{assistantError}</div>
            )}

            <form onSubmit={handleAssistantSubmit} className="flex gap-2 mt-4 pt-4 border-t border-line">
              <input
                value={assistantQuestion}
                onChange={(event) => setAssistantQuestion(event.target.value)}
                placeholder={`Ask about ${data.symbol} metrics, earnings, or risks…`}
                maxLength={1200}
                className="min-w-0 flex-1 bg-surface border border-line-strong rounded-xl px-3.5 py-3 text-xs text-ink placeholder:text-secondary focus:outline-none focus:border-interactive focus:ring-2 focus:ring-interactive"
              />
              <button
                type="submit"
                disabled={assistantLoading || !assistantQuestion.trim()}
                className="px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-50 text-brand-foreground hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas"
                aria-label="Ask company assistant"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          <aside className="lg:col-span-3 bg-surface border border-line rounded-2xl p-4 shadow-sm">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-secondary">Suggested questions</h4>
            <div className="space-y-2 mt-3">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  onClick={() => submitAssistantQuestion(question)}
                  disabled={assistantLoading}
                  className="w-full text-left p-3 rounded-xl bg-surface border border-line hover:border-interactive hover:bg-interactive-soft text-[10px] text-secondary leading-relaxed transition-all disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-xl bg-warning-soft/20 border border-warning-fill/50 text-[9px] text-warning leading-relaxed">
              The assistant provides educational analysis only and rejects personalized trading recommendations, target prices, and prompt-injection attempts.
            </div>
          </aside>
        </div>
      </section>

      <div className="flex items-center justify-between gap-4 text-[10px] text-secondary">
        <span>{data.message}</span>
        <span>Source: Finnhub · Educational use only</span>
      </div>
    </div>
  );
};
