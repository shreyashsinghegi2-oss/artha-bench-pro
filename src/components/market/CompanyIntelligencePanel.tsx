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
import { CompanyIntelligence } from '../../types';
import {
  askCompanyIntelligenceAI,
  fetchMarketHistory,
} from '../../services/learningApi';

interface CompanyIntelligencePanelProps {
  data: CompanyIntelligence | null;
  loading: boolean;
}

type CompanyChatMessage = {
  role: 'user' | 'assistant';
  content: string;
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

    const priorHistory = chatMessages.slice(-8);
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
        { role: 'assistant', content: response.answer },
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl min-h-52 flex items-center justify-center text-xs text-slate-400">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading Finnhub company intelligence…
      </div>
    );
  }

  if (!data) return null;

  if (data.status === 'not_configured') {
    return (
      <div className="bg-gradient-to-br from-cyan-950/35 via-slate-900 to-slate-900 border border-cyan-800/50 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Finnhub Company Intelligence Is Ready</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Add the Finnhub credential in Vercel to activate company profiles, fundamentals, earnings surprises, and analyst trends.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-800/60 text-[10px] font-bold text-amber-300 whitespace-nowrap">
            KEY REQUIRED
          </span>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Vercel environment-variable name</p>
          <code className="text-xs text-cyan-300 font-mono mt-1 block">FINNHUB_API_KEY</code>
        </div>
      </div>
    );
  }

  if (data.status !== 'connected') {
    return (
      <div className="bg-rose-950/20 border border-rose-900/60 rounded-2xl p-5 text-xs text-rose-300">
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
    <div className="bg-slate-900 border border-cyan-900/50 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-11 h-11 rounded-xl bg-white object-contain p-1" />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-cyan-400" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100 truncate">
                {profile?.name || data.symbol}
              </h2>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded">
                {data.symbol}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {[profile?.exchange, profile?.industry, profile?.country].filter(Boolean).join(' · ') || 'Company intelligence'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-slate-500">Market capitalization</p>
            <p className="text-sm font-bold text-emerald-400">
              {formatMarketCap(profile?.marketCapitalization, profile?.currency)}
            </p>
          </div>
          {companyUrl && (
            <a
              href={companyUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-cyan-300"
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
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-slate-200">Fundamental Metrics</h3>
          </div>
          <span className="text-[9px] text-slate-500 font-mono">FINNHUB NORMALIZED DATA</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {metricCards.map(([label, value]) => (
            <div key={label} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 min-h-20">
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className="text-base font-extrabold text-slate-100 mt-1.5">{value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <p className="text-slate-500">52-week low</p>
            <p className="text-slate-200 font-bold mt-1">{formatNumber(metrics?.week52Low ?? null)}</p>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <p className="text-slate-500">52-week high</p>
            <p className="text-slate-200 font-bold mt-1">{formatNumber(metrics?.week52High ?? null)}</p>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <p className="text-slate-500">IPO date</p>
            <p className="text-slate-200 font-bold mt-1">{profile?.ipoDate || '—'}</p>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <p className="text-slate-500">Shares outstanding</p>
            <p className="text-slate-200 font-bold mt-1">{formatNumber(profile?.sharesOutstanding ?? null, 'M')}</p>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <LineChartIcon className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-100">Historical Price Trend</h3>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Configured market-data provider · Prices may be delayed</p>
          </div>
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            {['1m', '3m', '6m', '1y'].map((range) => (
              <button
                key={range}
                onClick={() => setHistoryRange(range)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${historyRange === range ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-100'}`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[300px] sm:h-[360px]">
          {historyLoading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading price history…
            </div>
          ) : historyPoints.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyPoints} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="companyPriceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => String(value).slice(0, 10)}
                  tick={{ fill: '#64748B', fontSize: 9 }}
                  stroke="#334155"
                  minTickGap={38}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fill: '#64748B', fontSize: 9 }}
                  stroke="#334155"
                  width={52}
                  tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Price']}
                  contentStyle={{ background: '#020617', border: '1px solid #334155', borderRadius: 12, fontSize: 11 }}
                />
                <Area type="monotone" dataKey="price" stroke="#10B981" strokeWidth={2.5} fill="url(#companyPriceGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">No price history is available.</div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarCheck2 className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">Earnings: Actual vs Estimate</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Reported earnings per share and consensus estimate</p>
            </div>
          </div>
          {earningsChartData.length > 0 ? (
            <>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={earningsChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" tick={{ fill: '#64748B', fontSize: 9 }} stroke="#334155" />
                    <YAxis tick={{ fill: '#64748B', fontSize: 9 }} stroke="#334155" />
                    <Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', borderRadius: 12, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="actual" name="Actual EPS" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="estimate" name="Estimated EPS" fill="#22D3EE" radius={[4, 4, 0, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                {data.earnings.map((earning, index) => (
                  <div key={`${earning.period}-${index}`} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-[9px]">
                    <p className="text-slate-500">{earning.period || 'Period'}</p>
                    <p className={`font-bold mt-1 ${(earning.surprise ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      Surprise {earning.surprise === null ? '—' : `${earning.surprise >= 0 ? '+' : ''}${formatNumber(earning.surprise)}`}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-[10px] text-slate-500">No earnings observations available.</div>
          )}
        </section>

        <section className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-violet-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">Analyst Recommendation History</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Third-party opinion counts—not ArthaBench advice</p>
            </div>
          </div>
          {recommendationChartData.length > 0 ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={recommendationChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="period" tick={{ fill: '#64748B', fontSize: 9 }} stroke="#334155" />
                  <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 9 }} stroke="#334155" />
                  <Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', borderRadius: 12, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Bar dataKey="strongBuy" name="Strong buy" stackId="recommendations" fill="#34D399" />
                  <Bar dataKey="buy" name="Buy" stackId="recommendations" fill="#10B981" />
                  <Bar dataKey="hold" name="Hold" stackId="recommendations" fill="#FBBF24" />
                  <Bar dataKey="sell" name="Sell" stackId="recommendations" fill="#FB7185" />
                  <Bar dataKey="strongSell" name="Strong sell" stackId="recommendations" fill="#E11D48" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-[10px] text-slate-500">No analyst recommendation history is available.</div>
          )}
        </section>
      </div>

      <section className="bg-gradient-to-br from-violet-950/45 via-slate-950 to-cyan-950/25 border border-violet-800/50 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-violet-950 border border-violet-700 text-violet-300">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">ArthaBench Company AI Assistant</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-[9px] font-bold text-emerald-300">
                  <Sparkles className="w-2.5 h-2.5" /> GROUNDED
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 max-w-3xl leading-relaxed">
                Ask for educational explanations of {data.symbol}’s loaded Finnhub fundamentals, earnings, analyst history, and market quote. Company-specific answers are grounded in the current dashboard data.
              </p>
            </div>
          </div>
          <span className="text-[9px] text-slate-500 lg:text-right">No buy/sell/hold advice<br />No guaranteed forecasts</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 bg-slate-950/80 border border-slate-800 rounded-xl p-4 min-h-[330px] flex flex-col">
            <div className="flex-1 space-y-3 max-h-[390px] overflow-y-auto pr-1">
              {chatMessages.length === 0 ? (
                <div className="h-full min-h-44 flex flex-col items-center justify-center text-center px-4">
                  <MessageSquareText className="w-8 h-8 text-violet-500 mb-3" />
                  <p className="text-xs font-semibold text-slate-300">Ask a grounded company-analysis question</p>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-md">The assistant explains the evidence shown above and identifies missing information instead of inventing it.</p>
                </div>
              ) : (
                chatMessages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] rounded-xl px-3.5 py-3 text-[11px] leading-relaxed whitespace-pre-wrap ${message.role === 'user' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 border border-slate-800 text-slate-300'}`}>
                      {message.content}
                    </div>
                  </div>
                ))
              )}
              {assistantLoading && (
                <div className="flex items-center text-[10px] text-violet-300">
                  <RefreshCw className="w-3 h-3 animate-spin mr-2" /> Analyzing the loaded company evidence…
                </div>
              )}
            </div>

            {assistantError && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-950/40 border border-rose-900 text-[10px] text-rose-300">{assistantError}</div>
            )}

            <form onSubmit={handleAssistantSubmit} className="flex gap-2 mt-4 pt-4 border-t border-slate-800">
              <input
                value={assistantQuestion}
                onChange={(event) => setAssistantQuestion(event.target.value)}
                placeholder={`Ask about ${data.symbol} metrics, earnings, or risks…`}
                maxLength={1200}
                className="min-w-0 flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-600"
              />
              <button
                type="submit"
                disabled={assistantLoading || !assistantQuestion.trim()}
                className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white transition-all"
                aria-label="Ask company assistant"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          <aside className="lg:col-span-4 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Suggested questions</h4>
            <div className="space-y-2 mt-3">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  onClick={() => submitAssistantQuestion(question)}
                  disabled={assistantLoading}
                  className="w-full text-left p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-violet-700 text-[10px] text-slate-300 leading-relaxed transition-all disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-xl bg-amber-950/20 border border-amber-900/50 text-[9px] text-amber-200/80 leading-relaxed">
              The assistant provides educational analysis only and rejects personalized trading recommendations, target prices, and prompt-injection attempts.
            </div>
          </aside>
        </div>
      </section>

      <div className="flex items-center justify-between gap-4 text-[10px] text-slate-500">
        <span>{data.message}</span>
        <span>Source: Finnhub · Educational use only</span>
      </div>
    </div>
  );
};
