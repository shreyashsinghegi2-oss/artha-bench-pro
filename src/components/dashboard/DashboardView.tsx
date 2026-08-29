import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, BookOpen,
  BrainCircuit, CircleGauge, Clock3, Database, FileCheck2, FlaskConical,
  Globe2, GraduationCap, LineChart as LineChartIcon, Newspaper,
  RefreshCw, ServerCog, ShieldCheck, Sparkles, TrendingDown,
  TrendingUp, WalletCards, Zap,
} from 'lucide-react';
import {
  DashboardAssistantSnapshot, EconomicIndicator, NavigationDestination,
  NormalizedMarketQuote, NormalizedNewsItem, ProviderDiagnostic,
  StoredEvaluationRecord,
} from '../../types';
import {
  fetchBusinessNews, fetchEconomicOverview, fetchIndiaEconomicOverview,
  fetchMarketHistory, fetchMarketOverview, getProviderDiagnostics,
} from '../../services/learningApi';
import { getOverallProgressPercentage, getPaperPortfolio } from '../../services/learningStorage';
import { SafetyBanner } from '../SafetyBanner';
import { DashboardAssistant } from './DashboardAssistant';
import { IndiaMarketTicker } from './IndiaMarketTicker';

interface DashboardViewProps {
  onNavigate: (destination: NavigationDestination) => void;
}

type MarketHistoryPoint = { date: string; price: number; volume?: number };
type EconomicCountry = 'us' | 'india';

const MARKET_SYMBOLS = ['SPY', 'AAPL', 'NVDA', 'MSFT'];
const MARKET_RANGES = ['1w', '1m', '3m', '6m', '1y'] as const;
const MarketPerformanceChart = lazy(() =>
  import('./DashboardCharts').then((module) => ({ default: module.MarketPerformanceChart })),
);
const EconomicPulseChart = lazy(() =>
  import('./DashboardCharts').then((module) => ({ default: module.EconomicPulseChart })),
);
const ReliabilityAnalyticsChart = lazy(() =>
  import('./DashboardCharts').then((module) => ({ default: module.ReliabilityAnalyticsChart })),
);

function formatCurrency(value: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Date unavailable';
  const yearOnly = /^\d{4}$/.test(value);
  const date = new Date(yearOnly ? `${value}-01-01` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: yearOnly ? undefined : 'numeric',
    month: yearOnly ? undefined : 'short',
    year: 'numeric',
  }).format(date);
}

function statusColor(status: ProviderDiagnostic['status']) {
  if (status === 'connected') return 'bg-success-fill';
  if (status === 'rate_limited' || status === 'stale_data') return 'bg-warning-fill';
  return 'bg-danger';
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [quotes, setQuotes] = useState<NormalizedMarketQuote[]>([]);
  const [marketHistory, setMarketHistory] = useState<MarketHistoryPoint[]>([]);
  const [usIndicators, setUsIndicators] = useState<EconomicIndicator[]>([]);
  const [indiaIndicators, setIndiaIndicators] = useState<EconomicIndicator[]>([]);
  const [diagnostics, setDiagnostics] = useState<ProviderDiagnostic[]>([]);
  const [news, setNews] = useState<NormalizedNewsItem[]>([]);
  const [reports, setReports] = useState<StoredEvaluationRecord[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('SPY');
  const [selectedRange, setSelectedRange] = useState<(typeof MARKET_RANGES)[number]>('1m');
  const [selectedCountry, setSelectedCountry] = useState<EconomicCountry>('us');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [progress] = useState(() => getOverallProgressPercentage());
  const [portfolio] = useState(() => getPaperPortfolio());
  const [economicSummaryOpen, setEconomicSummaryOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [quotesResult, usResult, indiaResult, diagnosticResult, newsResult, reportsResult] =
      await Promise.allSettled([
        fetchMarketOverview(MARKET_SYMBOLS),
        fetchEconomicOverview(),
        fetchIndiaEconomicOverview(),
        getProviderDiagnostics(),
        fetchBusinessNews(),
        fetch('/api/reports').then(async (response) => {
          if (!response.ok) throw new Error('Reports request failed.');
          return response.json() as Promise<{ reports?: StoredEvaluationRecord[] }>;
        }),
      ]);

    if (quotesResult.status === 'fulfilled') setQuotes(quotesResult.value);
    if (usResult.status === 'fulfilled') setUsIndicators(usResult.value);
    if (indiaResult.status === 'fulfilled') setIndiaIndicators(indiaResult.value);
    if (diagnosticResult.status === 'fulfilled') setDiagnostics(diagnosticResult.value);
    if (newsResult.status === 'fulfilled') setNews(newsResult.value.slice(0, 4));
    if (reportsResult.status === 'fulfilled') {
      setReports(Array.isArray(reportsResult.value.reports) ? reportsResult.value.reports : []);
    }
    const failures = [quotesResult, usResult, indiaResult, diagnosticResult]
      .filter((result) => result.status === 'rejected').length;
    if (failures === 4) {
      setLoadError('Provider-backed dashboard data is temporarily unavailable. Please refresh shortly.');
    }
    setLastUpdated(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    fetchMarketHistory(selectedSymbol, selectedRange)
      .then((response) => {
        if (active) setMarketHistory(Array.isArray(response.points) ? response.points : []);
      })
      .catch(() => { if (active) setMarketHistory([]); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [selectedRange, selectedSymbol]);

  const selectedQuote = quotes.find((quote) => quote.symbol === selectedSymbol) ?? quotes[0];
  const connectedDiagnostics = diagnostics.filter((item) => item.status === 'connected');
  const unavailableDiagnostics = diagnostics.filter((item) => item.status !== 'connected');
  const connectedEconomicCount = [...usIndicators, ...indiaIndicators]
    .filter((item) => item.status === 'connected' && item.value !== null).length;
  const economicIndicatorTotal = usIndicators.length + indiaIndicators.length;
  const gainers = quotes.filter((quote) => (quote.changePercent ?? 0) >= 0).length;
  const latestReport = useMemo(
    () => [...reports].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null,
    [reports],
  );

  const historyMetrics = useMemo(() => {
    if (marketHistory.length === 0) return null;
    const start = marketHistory[0];
    const latest = marketHistory.at(-1)!;
    const prices = marketHistory.map((point) => point.price).filter(Number.isFinite);
    return {
      pointCount: marketHistory.length,
      startDate: start.date,
      endDate: latest.date,
      startPrice: start.price,
      latestPrice: latest.price,
      high: Math.max(...prices),
      low: Math.min(...prices),
      returnPercent: start.price !== 0 ? ((latest.price / start.price) - 1) * 100 : null,
    };
  }, [marketHistory]);

  const selectedEconomicIndicators = selectedCountry === 'us' ? usIndicators : indiaIndicators;
  const economicChartData = selectedEconomicIndicators
    .filter((item) => item.value !== null && item.unit.includes('%'))
    .map((item) => ({
      label: item.label.replace('US ', '').replace('India ', '')
        .replace('Federal Funds Rate', 'Fed funds').replace('10-Year Treasury', '10Y Treasury'),
      value: item.value, unit: item.unit, date: item.date, source: item.sourceName,
    }));
  const reliabilityChartData = latestReport ? [
    { dimension: 'Numerical', score: latestReport.metrics.formulaAccuracyScore },
    { dimension: 'Consensus', score: latestReport.metrics.dualModelConsensusScore },
    { dimension: 'Evidence', score: latestReport.metrics.evidenceVerificationScore },
    { dimension: 'Safety', score: latestReport.metrics.safetyComplianceScore },
    { dimension: 'Overall', score: latestReport.metrics.overallReliabilityScore },
  ] : [];

  const assistantSnapshot: DashboardAssistantSnapshot = useMemo(() => ({
    capturedAt: lastUpdated || new Date().toISOString(),
    selectedSymbol, selectedRange, selectedCountry,
    quotes: quotes.map((quote) => ({
      symbol: quote.symbol, price: quote.price, changePercent: quote.changePercent,
      freshness: quote.freshness, providerName: quote.providerName,
    })),
    marketHistory: historyMetrics ? { symbol: selectedSymbol, range: selectedRange, ...historyMetrics } : null,
    economicIndicators: [...usIndicators, ...indiaIndicators].map((item) => ({
      label: item.label, value: item.value, unit: item.unit, date: item.date,
      sourceName: item.sourceName, status: item.status,
    })),
    providerHealth: {
      connected: connectedDiagnostics.length, total: diagnostics.length,
      connectedProviders: connectedDiagnostics.map((item) => item.name),
      unavailableProviders: unavailableDiagnostics.map((item) => item.name),
    },
    latestEvaluation: latestReport ? {
      verificationCode: latestReport.verificationCode, timestamp: latestReport.timestamp,
      verdict: latestReport.verdict,
      overallReliabilityScore: latestReport.metrics.overallReliabilityScore,
      formulaAccuracyScore: latestReport.metrics.formulaAccuracyScore,
      dualModelConsensusScore: latestReport.metrics.dualModelConsensusScore,
      evidenceVerificationScore: latestReport.metrics.evidenceVerificationScore,
      safetyComplianceScore: latestReport.metrics.safetyComplianceScore,
    } : null,
  }), [connectedDiagnostics, diagnostics.length, historyMetrics, indiaIndicators, lastUpdated,
    latestReport, quotes, selectedCountry, selectedRange, selectedSymbol,
    unavailableDiagnostics, usIndicators]);

  const groundingValue = latestReport ? `${latestReport.metrics.overallReliabilityScore}%` : 'No run';
  const groundingDetail = latestReport ? latestReport.verdict.replaceAll('_', ' ') : 'Run an evaluation to populate';
  const latestHeadline = news[0] ?? null;

  return (
    <div className="mx-auto max-w-[1700px] space-y-7 px-4 py-7 sm:px-6 sm:py-9">
      <section className="relative overflow-hidden rounded-[30px] border border-line bg-surface p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-1" aria-hidden="true">
          <span className="flex-1 bg-[#FF9933]" />
          <span className="flex-1 bg-white/80" />
          <span className="flex-1 bg-[#138808]" />
        </div>
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#FF9933]/5 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-[#138808]/5 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-success-fill/25 bg-success-fill/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success-fill" /> Intelligence command centre
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-subtle px-3 py-1 text-[10px] text-secondary">
                <Clock3 className="h-3 w-3" />
                {lastUpdated ? `Refreshed ${new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Loading provider sources'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF9933]/25 bg-[#FF9933]/10 px-3 py-1 text-[10px] font-bold text-[#FF9933]">
                7B Capital Markets SLM
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl lg:text-5xl">ArthaMind Pro Analytics</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-secondary sm:text-base">
              India’s first 7B-parameter SLM for Capital Markets | Evidence-linked insights with an AI assistant that explains the exact data on screen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={() => void loadDashboard()} disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-bold text-ink transition hover:bg-subtle disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh intelligence
            </button>
            <button type="button" onClick={() => onNavigate('evaluation-lab')}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-brand-foreground hover:text-white shadow-sm transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas">
              <FlaskConical className="h-4 w-4" /> Run evaluation
            </button>
          </div>
        </div>
      </section>

      <IndiaMarketTicker />

      {loadError && <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-xs text-danger">{loadError}</div>}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">Market breadth</p><p className="mt-2 text-2xl font-black text-ink">{quotes.length ? `${gainers}/${quotes.length}` : '—'}</p><p className="mt-1 text-[10px] text-secondary">{quotes.length ? 'provider-backed tracked assets advancing' : 'Market quotes unavailable'}</p></div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-subtle text-success"><TrendingUp className="h-4 w-4" /></div>
          </div>
        </div>

        <div className="relative rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">Economic coverage</p>
                <button
                  type="button"
                  onClick={() => setEconomicSummaryOpen((open) => !open)}
                  onMouseEnter={() => setEconomicSummaryOpen(true)}
                  onMouseLeave={() => setEconomicSummaryOpen(false)}
                  className="inline-flex items-center gap-1 rounded-full border border-interactive/25 bg-interactive-soft px-1.5 py-0.5 text-[8px] font-bold text-interactive"
                  aria-expanded={economicSummaryOpen}
                >
                  <Sparkles className="h-2.5 w-2.5" /> Data Summary
                </button>
              </div>
              <p className="mt-2 text-2xl font-black text-ink">{economicIndicatorTotal ? `${connectedEconomicCount}/${economicIndicatorTotal}` : '—'}</p>
              <p className="mt-1 text-[10px] text-secondary">US + India latest official indicators</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-subtle text-interactive"><Globe2 className="h-4 w-4" /></div>
          </div>
          {economicSummaryOpen && (
            <div className="absolute left-3 top-[calc(100%-2px)] z-30 w-[min(320px,calc(100vw-3rem))] rounded-xl border border-line bg-canvas p-3 text-[10px] leading-5 text-secondary shadow-xl">
              <strong className="text-ink">Coverage summary:</strong> {economicIndicatorTotal ? `${connectedEconomicCount} of ${economicIndicatorTotal} latest official observations are currently available. Release dates differ by indicator.` : 'Economic observations are currently unavailable.'}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">Provider health</p><p className="mt-2 text-2xl font-black text-ink">{diagnostics.length ? `${connectedDiagnostics.length}/${diagnostics.length}` : '—'}</p><p className="mt-1 text-[10px] text-secondary">{diagnostics.length ? (unavailableDiagnostics.length ? `${unavailableDiagnostics.length} need attention` : 'all reported checks connected') : 'Diagnostics unavailable'}</p></div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-subtle" style={{ color: unavailableDiagnostics.length ? 'var(--warning)' : 'var(--success)' }}><ServerCog className="h-4 w-4" /></div>
          </div>
          <button type="button" onClick={() => onNavigate('connections')} className="mt-3 w-full rounded-lg border border-line bg-canvas px-2.5 py-2 text-left text-[8px] font-semibold leading-4 text-secondary hover:border-interactive/30 hover:text-ink">
            View source status, timestamps and provider diagnostics →
          </button>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">AI Grounding Score</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-2xl font-black text-ink">{groundingValue}</p>
                {!latestReport && (
                  <button
                    type="button"
                    onClick={() => onNavigate('evaluation-lab')}
                    className="inline-flex items-center gap-1 rounded-lg border border-interactive/25 bg-interactive-soft px-2 py-1 text-[8px] font-bold text-interactive hover:bg-interactive/15"
                  >
                    <FlaskConical className="h-3 w-3" /> Run Evaluation
                  </button>
                )}
              </div>
              <p className="mt-1 text-[10px] text-secondary">{groundingDetail}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-subtle text-interactive"><ShieldCheck className="h-4 w-4" /></div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">Learning workspace</p><p className="mt-2 text-2xl font-black text-ink">{progress}%</p><p className="mt-1 text-[10px] text-secondary">{formatCurrency(portfolio.cashBalance)} paper cash</p></div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-subtle text-interactive"><GraduationCap className="h-4 w-4" /></div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="min-w-0 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7 xl:col-span-7">
          <div className="flex flex-col gap-5 border-b border-line pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-interactive"><LineChartIcon className="h-3.5 w-3.5" /> Market performance</div>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <h2 className="text-2xl font-black text-ink">{selectedSymbol}</h2>
                <span className="pb-0.5 text-2xl font-bold text-ink">{selectedQuote ? formatCurrency(selectedQuote.price, selectedQuote.currency) : 'Unavailable'}</span>
                {selectedQuote && <span className={`mb-1 inline-flex items-center gap-1 text-xs font-bold ${(selectedQuote.changePercent ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                  {(selectedQuote.changePercent ?? 0) >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{Math.abs(selectedQuote.changePercent ?? 0).toFixed(2)}%
                </span>}
              </div>
              <p className="mt-1 text-[10px] text-secondary">{selectedQuote ? `${selectedQuote.providerName} · ${selectedQuote.freshness.replaceAll('_', ' ')} · ${selectedQuote.providerTimestamp || selectedQuote.retrievedAt}` : 'No real provider quote is available for this selection.'}</p>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-canvas p-1">
                {MARKET_SYMBOLS.map((symbol) => <button key={symbol} type="button" onClick={() => setSelectedSymbol(symbol)} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition ${selectedSymbol === symbol ? 'bg-interactive-soft text-interactive' : 'text-secondary hover:text-interactive'}`}>{symbol}</button>)}
              </div>
              <div className="flex justify-end gap-1">
                {MARKET_RANGES.map((range) => <button key={range} type="button" onClick={() => setSelectedRange(range)} className={`rounded-lg px-2.5 py-1 text-[9px] font-bold uppercase transition ${selectedRange === range ? 'bg-interactive-soft text-interactive' : 'text-secondary hover:text-interactive'}`}>{range}</button>)}
              </div>
            </div>
          </div>
          <div className="h-[340px] w-full pt-5 sm:h-[420px]">
            {historyLoading ? <div className="flex h-full items-center justify-center text-xs text-secondary"><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading provider price history…</div> : marketHistory.length > 0 ? (
              <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-secondary">Preparing interactive chart…</div>}>
                <MarketPerformanceChart data={marketHistory} />
              </Suspense>
            ) : <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-secondary"><LineChartIcon className="h-7 w-7 text-secondary" /> Historical data is unavailable for this selection.</div>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-4 sm:grid-cols-4">
            {[
              ['Range return', historyMetrics?.returnPercent == null ? '—' : `${historyMetrics.returnPercent >= 0 ? '+' : ''}${historyMetrics.returnPercent.toFixed(2)}%`],
              ['Period high', historyMetrics ? formatCurrency(historyMetrics.high) : '—'],
              ['Period low', historyMetrics ? formatCurrency(historyMetrics.low) : '—'],
              ['Observations', historyMetrics ? historyMetrics.pointCount.toString() : '—'],
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-surface px-3 py-2.5"><p className="text-[9px] uppercase tracking-wider text-secondary">{label}</p><p className="mt-1 text-xs font-bold text-ink">{value}</p></div>)}
          </div>
        </div>
        <div className="min-w-0 space-y-3 xl:col-span-5">
          <div className="overflow-hidden rounded-xl border border-line bg-[#101A2E] text-white shadow-sm" aria-label="Latest business headline">
            <div className="flex min-h-9 items-center gap-3 px-3">
              <span className="shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-200">{latestHeadline ? 'Latest headline' : 'News status'}</span>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-[10px] font-medium text-slate-200">{latestHeadline ? `${latestHeadline.sourceName}: ${latestHeadline.title}` : 'Current business headlines are unavailable.'}</p>
              </div>
            </div>
          </div>
          <DashboardAssistant snapshot={assistantSnapshot} ready={!loading && lastUpdated !== null} onNavigate={onNavigate} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="min-w-0 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6 xl:col-span-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-interactive"><BarChart3 className="h-3.5 w-3.5" /> Economic rate comparison</div><h2 className="mt-2 text-xl font-black text-ink">{selectedCountry === 'us' ? 'United States' : 'India'} economic pulse</h2><p className="mt-1 text-[11px] text-secondary">Latest official observations; dates differ by release schedule and are not tick-by-tick market values.</p></div>
            <div className="flex rounded-xl border border-line bg-canvas p-1">
              <button type="button" onClick={() => setSelectedCountry('us')} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold ${selectedCountry === 'us' ? 'bg-interactive-soft text-interactive' : 'text-secondary'}`}>United States</button>
              <button type="button" onClick={() => setSelectedCountry('india')} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold ${selectedCountry === 'india' ? 'bg-interactive-soft text-interactive' : 'text-secondary'}`}>India</button>
            </div>
          </div>
          <div className="mt-5 h-[330px] w-full">
            {economicChartData.length > 0 ? <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-secondary">Preparing comparison chart…</div>}><EconomicPulseChart data={economicChartData} country={selectedCountry} /></Suspense> : <div className="flex h-full items-center justify-center text-xs text-secondary">Economic comparison data is unavailable.</div>}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {selectedEconomicIndicators.slice(0, 5).map((item) => <button key={item.id} type="button" onClick={() => onNavigate('economy')} className="rounded-xl border border-line bg-surface p-3 text-left transition hover:border-interactive/30"><div className="flex items-start justify-between gap-2"><span className="text-[10px] text-secondary">{item.label}</span><ArrowRight className="h-3 w-3 text-secondary" /></div><p className="mt-1 text-sm font-black text-ink">{item.value == null ? '—' : item.value.toLocaleString()} <span className="text-[9px] font-medium text-secondary">{item.unit}</span></p><p className="mt-1 text-[9px] text-secondary">{formatDate(item.date)} · {item.sourceName}</p></button>)}
          </div>
        </div>

        <div className="min-w-0 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6 xl:col-span-5">
          <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-interactive"><BrainCircuit className="h-3.5 w-3.5" /> Reliability analytics</div><h2 className="mt-2 text-xl font-black text-ink">{latestReport ? 'Latest evaluation profile' : 'Scoring architecture'}</h2><p className="mt-1 text-[11px] text-secondary">{latestReport ? `${latestReport.verificationCode} · ${formatDate(latestReport.timestamp)}` : 'Run an evaluation to populate measured scores.'}</p></div>
            <button type="button" onClick={() => onNavigate(latestReport ? 'reports' : 'evaluation-lab')} className="rounded-xl border border-interactive/25 bg-interactive/10 px-3 py-2 text-[10px] font-bold text-interactive hover:bg-interactive/20">{latestReport ? 'Open report' : 'Run now'}</button>
          </div>
          <div className="mt-4 h-[345px] w-full">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-secondary">Preparing reliability chart…</div>}><ReliabilityAnalyticsChart measuredScores={reliabilityChartData} /></Suspense>
          </div>
          {latestReport && <div className="flex items-center justify-between rounded-xl border border-success-fill/20 bg-success-soft px-4 py-3"><div><p className="text-[9px] uppercase tracking-wider text-success">Overall reliability</p><p className="mt-1 text-xl font-black text-ink">{latestReport.metrics.overallReliabilityScore}%</p></div><div className="rounded-full border border-success-fill/20 bg-surface px-3 py-1.5 text-[9px] font-bold text-success">{latestReport.verdict.replaceAll('_', ' ')}</div></div>}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-success"><Activity className="h-3.5 w-3.5" /> Provider health</div><h2 className="mt-2 text-lg font-black text-ink">Connection matrix</h2></div><span className="text-2xl font-black text-ink">{connectedDiagnostics.length}<span className="text-sm text-secondary">/{diagnostics.length || '—'}</span></span></div>
          <div className="mt-5 space-y-2">{diagnostics.slice(0, 9).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"><div className="min-w-0"><p className="truncate text-[10px] font-semibold text-ink">{item.name}</p><p className="mt-0.5 truncate text-[9px] text-secondary">{item.role}</p></div><div className="flex shrink-0 items-center gap-1.5 text-[9px] font-bold text-secondary"><span className={`h-1.5 w-1.5 rounded-full ${statusColor(item.status)}`} />{item.status.replaceAll('_', ' ')}</div></div>)}</div>
          {!diagnostics.length && <div className="mt-5 rounded-xl border border-warning-fill/25 bg-warning-soft p-3 text-xs text-secondary">Provider diagnostics are unavailable. No connected state is being inferred.</div>}
          <button type="button" onClick={() => onNavigate('connections')} className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-bold text-interactive hover:text-interactive/80">Open connection diagnostics <ArrowRight className="h-3 w-3" /></button>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-interactive"><CircleGauge className="h-3.5 w-3.5" /> Market movers</div><h2 className="mt-2 text-lg font-black text-ink">Tracked assets</h2></div><button type="button" onClick={() => onNavigate('markets')} className="text-[10px] font-bold text-interactive hover:text-interactive/80">Full market lab</button></div>
          <div className="mt-5 overflow-hidden rounded-xl border border-line">{quotes.length ? quotes.map((quote) => { const change = quote.changePercent ?? 0; return <button key={quote.symbol} type="button" onClick={() => { setSelectedSymbol(quote.symbol); window.scrollTo({ top: 300, behavior: 'smooth' }); }} className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-line bg-surface px-3 py-3 text-left last:border-b-0 hover:bg-subtle"><div><p className="text-xs font-black text-ink">{quote.symbol}</p><p className="mt-0.5 max-w-28 truncate text-[9px] text-secondary">{quote.name}</p></div><p className="text-xs font-bold text-ink">{formatCurrency(quote.price, quote.currency)}</p><p className={`flex items-center justify-end gap-1 text-[10px] font-bold ${change >= 0 ? 'text-success' : 'text-danger'}`}>{change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{change >= 0 ? '+' : ''}{change.toFixed(2)}%</p></button>; }) : <div className="p-5 text-center text-xs text-secondary">Real market quotes are currently unavailable.</div>}</div>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-secondary"><Newspaper className="h-3.5 w-3.5" /> Business brief</div><h2 className="mt-2 text-lg font-black text-ink">Latest headlines</h2></div><button type="button" onClick={() => onNavigate('news')} className="text-[10px] font-bold text-interactive hover:text-interactive/80">View feed</button></div>
          <div className="mt-5 space-y-2.5">{news.length > 0 ? news.map((item) => <button key={item.id} type="button" onClick={() => onNavigate('news')} className="w-full rounded-xl border border-line bg-surface p-3 text-left transition hover:border-interactive/25"><div className="flex items-center justify-between gap-3 text-[9px]"><span className="font-bold text-interactive">{item.sourceName}</span><span className="text-secondary">{formatDate(item.publishedAt)}</span></div><p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-5 text-ink">{item.title}</p></button>) : <div className="rounded-xl border border-line bg-surface p-5 text-center text-xs text-secondary">Current business news is unavailable.</div>}</div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: 'Quick reliability check', text: 'Screen a financial prompt for safety and logic issues.', icon: Zap, destination: 'quick-check' as const, accent: 'var(--interactive)' },
          { title: 'Evaluation laboratory', text: 'Run the seven-dimension dual-model benchmark.', icon: FlaskConical, destination: 'evaluation-lab' as const, accent: 'var(--interactive)' },
          { title: 'Structured learning', text: 'Continue finance lessons and knowledge checks.', icon: BookOpen, destination: 'learning' as const, accent: 'var(--interactive)' },
          { title: 'Verified reports', text: 'Review evidence, scores, risk flags, and exports.', icon: FileCheck2, destination: 'reports' as const, accent: 'var(--success)' },
        ].map((action) => <button key={action.title} type="button" onClick={() => onNavigate(action.destination)} className="group rounded-2xl border border-line bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-interactive/25"><div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-subtle" style={{ color: action.accent }}><action.icon className="h-4 w-4" /></div><ArrowRight className="h-4 w-4 text-secondary transition group-hover:translate-x-1 group-hover:text-interactive" /></div><h3 className="mt-4 text-sm font-black text-ink">{action.title}</h3><p className="mt-1 text-[10px] leading-5 text-secondary">{action.text}</p></button>)}
      </section>

      <SafetyBanner />
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-[10px] text-secondary sm:flex-row sm:items-center sm:justify-between"><span className="inline-flex items-center gap-2"><Database className="h-3.5 w-3.5 text-interactive" /> Values retain provider freshness labels and observation dates; historical patterns are not forecasts.</span><span className="inline-flex items-center gap-2"><WalletCards className="h-3.5 w-3.5 text-success" /> Paper portfolio uses simulated funds only.</span></div>
    </div>
  );
};
