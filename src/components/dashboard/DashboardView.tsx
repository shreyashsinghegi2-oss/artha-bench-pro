import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, BookOpen,
  BrainCircuit, CircleGauge, Clock3, Database, FileCheck2, FlaskConical,
  Globe2, GraduationCap, LineChart as LineChartIcon, Newspaper, RefreshCw,
  ServerCog, ShieldCheck, TrendingDown, TrendingUp, WalletCards, Zap,
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
  if (status === 'connected') return 'bg-[#00D68F]';
  if (status === 'rate_limited' || status === 'stale_data') return 'bg-[#F5B800]';
  return 'bg-[#FF3B65]';
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
      setLoadError('Live dashboard data is temporarily unavailable. Please refresh shortly.');
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

  return (
    <div className="mx-auto max-w-[1700px] space-y-7 px-4 py-7 sm:px-6 sm:py-9">
      <section className="relative overflow-hidden rounded-[30px] border border-[#665CFF]/25 bg-[radial-gradient(circle_at_76%_0%,rgba(102,92,255,0.22),transparent_34%),linear-gradient(135deg,#0D0B1E_0%,#08080E_54%,#06110F_100%)] p-6 shadow-2xl sm:p-8">
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#00D68F]/25 bg-[#00D68F]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#00D68F]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00D68F]" /> Intelligence command centre
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] text-[#9898AA]">
                <Clock3 className="h-3 w-3" />
                {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Loading live sources'}
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">ArthaBench Pro Analytics</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#AAAABE] sm:text-base">
              One evidence-linked view of market movement, US and India economic signals, AI reliability, provider health, and learning progress—with an assistant that can explain the exact data on screen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={() => void loadDashboard()} disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh intelligence
            </button>
            <button type="button" onClick={() => onNavigate('evaluation-lab')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#665CFF] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#4F32FF]/20 transition hover:bg-[#7769FF]">
              <FlaskConical className="h-4 w-4" /> Run evaluation
            </button>
          </div>
        </div>
      </section>

      {loadError && <div className="rounded-2xl border border-[#FF3B65]/25 bg-[#FF3B65]/10 px-4 py-3 text-xs text-[#FF8BA1]">{loadError}</div>}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Market breadth', value: quotes.length ? `${gainers}/${quotes.length}` : '—', detail: quotes.length ? 'tracked assets advancing' : 'Waiting for quotes', icon: TrendingUp, color: '#00D68F' },
          { label: 'Economic coverage', value: economicIndicatorTotal ? `${connectedEconomicCount}/${economicIndicatorTotal}` : '—', detail: 'US + India live indicators', icon: Globe2, color: '#16C7E8' },
          { label: 'Provider health', value: diagnostics.length ? `${connectedDiagnostics.length}/${diagnostics.length}` : '—', detail: unavailableDiagnostics.length ? `${unavailableDiagnostics.length} need attention` : 'all checks connected', icon: ServerCog, color: unavailableDiagnostics.length ? '#F5B800' : '#00D68F' },
          { label: 'Latest reliability', value: latestReport ? `${latestReport.metrics.overallReliabilityScore}%` : 'No run', detail: latestReport ? latestReport.verdict.replaceAll('_', ' ') : 'Run an evaluation to populate', icon: ShieldCheck, color: '#665CFF' },
          { label: 'Learning workspace', value: `${progress}%`, detail: `${formatCurrency(portfolio.cashBalance)} paper cash`, icon: GraduationCap, color: '#A78BFA' },
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-[#1A1A23] bg-[#08080E] p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#777789]">{metric.label}</p><p className="mt-2 text-2xl font-black text-white">{metric.value}</p><p className="mt-1 text-[10px] text-[#8E8EA1]">{metric.detail}</p></div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035]" style={{ color: metric.color }}><metric.icon className="h-4 w-4" /></div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="min-w-0 rounded-3xl border border-[#1A1A23] bg-[#08080E] p-5 shadow-2xl sm:p-7 xl:col-span-8">
          <div className="flex flex-col gap-5 border-b border-[#171720] pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#16C7E8]"><LineChartIcon className="h-3.5 w-3.5" /> Market performance</div>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <h2 className="text-2xl font-black text-white">{selectedSymbol}</h2>
                <span className="pb-0.5 text-2xl font-bold text-[#E7E7EF]">{selectedQuote ? formatCurrency(selectedQuote.price, selectedQuote.currency) : '—'}</span>
                {selectedQuote && <span className={`mb-1 inline-flex items-center gap-1 text-xs font-bold ${(selectedQuote.changePercent ?? 0) >= 0 ? 'text-[#00D68F]' : 'text-[#FF3B65]'}`}>
                  {(selectedQuote.changePercent ?? 0) >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{Math.abs(selectedQuote.changePercent ?? 0).toFixed(2)}%
                </span>}
              </div>
              <p className="mt-1 text-[10px] text-[#777789]">{selectedQuote?.providerName || 'Configured market provider'} · {selectedQuote?.freshness?.replaceAll('_', ' ') || 'loading'} data</p>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1 rounded-xl border border-[#1A1A23] bg-[#030303] p-1">
                {MARKET_SYMBOLS.map((symbol) => <button key={symbol} type="button" onClick={() => setSelectedSymbol(symbol)} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition ${selectedSymbol === symbol ? 'bg-[#665CFF] text-white' : 'text-[#8E8EA1] hover:text-white'}`}>{symbol}</button>)}
              </div>
              <div className="flex justify-end gap-1">
                {MARKET_RANGES.map((range) => <button key={range} type="button" onClick={() => setSelectedRange(range)} className={`rounded-lg px-2.5 py-1 text-[9px] font-bold uppercase transition ${selectedRange === range ? 'bg-[#16C7E8]/15 text-[#16C7E8]' : 'text-[#666678] hover:text-white'}`}>{range}</button>)}
              </div>
            </div>
          </div>
          <div className="h-[340px] w-full pt-5 sm:h-[420px]">
            {historyLoading ? <div className="flex h-full items-center justify-center text-xs text-[#777789]"><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading price history…</div> : marketHistory.length > 0 ? (
              <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-[#777789]">Preparing interactive chart…</div>}>
                <MarketPerformanceChart data={marketHistory} />
              </Suspense>
            ) : <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-[#777789]"><LineChartIcon className="h-7 w-7 text-[#353544]" /> Historical data is temporarily unavailable for this selection.</div>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#171720] pt-4 sm:grid-cols-4">
            {[
              ['Range return', historyMetrics?.returnPercent == null ? '—' : `${historyMetrics.returnPercent >= 0 ? '+' : ''}${historyMetrics.returnPercent.toFixed(2)}%`],
              ['Period high', historyMetrics ? formatCurrency(historyMetrics.high) : '—'],
              ['Period low', historyMetrics ? formatCurrency(historyMetrics.low) : '—'],
              ['Observations', historyMetrics ? historyMetrics.pointCount.toString() : '—'],
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-[#05050A] px-3 py-2.5"><p className="text-[9px] uppercase tracking-wider text-[#666678]">{label}</p><p className="mt-1 text-xs font-bold text-[#D9D9E4]">{value}</p></div>)}
          </div>
        </div>
        <div className="xl:col-span-4"><DashboardAssistant snapshot={assistantSnapshot} ready={!loading && lastUpdated !== null} onNavigate={onNavigate} /></div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="min-w-0 rounded-3xl border border-[#1A1A23] bg-[#08080E] p-5 shadow-xl sm:p-6 xl:col-span-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#00D68F]"><BarChart3 className="h-3.5 w-3.5" /> Economic rate comparison</div><h2 className="mt-2 text-xl font-black text-white">{selectedCountry === 'us' ? 'United States' : 'India'} economic pulse</h2><p className="mt-1 text-[11px] text-[#777789]">Latest percentage-based indicators; dates differ by release schedule.</p></div>
            <div className="flex rounded-xl border border-[#1A1A23] bg-[#030303] p-1">
              <button type="button" onClick={() => setSelectedCountry('us')} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold ${selectedCountry === 'us' ? 'bg-[#4F32FF] text-white' : 'text-[#88889A]'}`}>United States</button>
              <button type="button" onClick={() => setSelectedCountry('india')} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold ${selectedCountry === 'india' ? 'bg-[#FF8A00] text-[#160B00]' : 'text-[#88889A]'}`}>India</button>
            </div>
          </div>
          <div className="mt-5 h-[330px] w-full">
            {economicChartData.length > 0 ? <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-[#777789]">Preparing comparison chart…</div>}><EconomicPulseChart data={economicChartData} country={selectedCountry} /></Suspense> : <div className="flex h-full items-center justify-center text-xs text-[#777789]">Economic comparison data is unavailable.</div>}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {selectedEconomicIndicators.slice(0, 5).map((item) => <button key={item.id} type="button" onClick={() => onNavigate('economy')} className="rounded-xl border border-[#171720] bg-[#05050A] p-3 text-left transition hover:border-[#00D68F]/30"><div className="flex items-start justify-between gap-2"><span className="text-[10px] text-[#8A8A9E]">{item.label}</span><ArrowRight className="h-3 w-3 text-[#555568]" /></div><p className="mt-1 text-sm font-black text-white">{item.value == null ? '—' : item.value.toLocaleString()} <span className="text-[9px] font-medium text-[#777789]">{item.unit}</span></p><p className="mt-1 text-[9px] text-[#5F5F72]">{formatDate(item.date)} · {item.sourceName}</p></button>)}
          </div>
        </div>

        <div className="min-w-0 rounded-3xl border border-[#1A1A23] bg-[#08080E] p-5 shadow-xl sm:p-6 xl:col-span-5">
          <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#A78BFA]"><BrainCircuit className="h-3.5 w-3.5" /> Reliability analytics</div><h2 className="mt-2 text-xl font-black text-white">{latestReport ? 'Latest evaluation profile' : 'Scoring architecture'}</h2><p className="mt-1 text-[11px] text-[#777789]">{latestReport ? `${latestReport.verificationCode} · ${formatDate(latestReport.timestamp)}` : 'Run an evaluation to replace weights with measured scores.'}</p></div>
            <button type="button" onClick={() => onNavigate(latestReport ? 'reports' : 'evaluation-lab')} className="rounded-xl border border-[#665CFF]/25 bg-[#665CFF]/10 px-3 py-2 text-[10px] font-bold text-[#8B7CFF] hover:bg-[#665CFF]/20">{latestReport ? 'Open report' : 'Run now'}</button>
          </div>
          <div className="mt-4 h-[345px] w-full">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-[#777789]">Preparing reliability chart…</div>}><ReliabilityAnalyticsChart measuredScores={reliabilityChartData} /></Suspense>
          </div>
          {latestReport && <div className="flex items-center justify-between rounded-xl border border-[#665CFF]/20 bg-[#665CFF]/10 px-4 py-3"><div><p className="text-[9px] uppercase tracking-wider text-[#8B7CFF]">Overall reliability</p><p className="mt-1 text-xl font-black text-white">{latestReport.metrics.overallReliabilityScore}%</p></div><div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[9px] font-bold text-[#C7C3E9]">{latestReport.verdict.replaceAll('_', ' ')}</div></div>}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-[#1A1A23] bg-[#08080E] p-5 shadow-xl sm:p-6">
          <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#00D68F]"><Activity className="h-3.5 w-3.5" /> Provider health</div><h2 className="mt-2 text-lg font-black text-white">Live connection matrix</h2></div><span className="text-2xl font-black text-white">{connectedDiagnostics.length}<span className="text-sm text-[#666678]">/{diagnostics.length || '—'}</span></span></div>
          <div className="mt-5 space-y-2">{diagnostics.slice(0, 9).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#15151D] bg-[#05050A] px-3 py-2.5"><div className="min-w-0"><p className="truncate text-[10px] font-semibold text-[#C7C7D3]">{item.name}</p><p className="mt-0.5 truncate text-[9px] text-[#5F5F72]">{item.role}</p></div><div className="flex shrink-0 items-center gap-1.5 text-[9px] font-bold text-[#8E8EA1]"><span className={`h-1.5 w-1.5 rounded-full ${statusColor(item.status)}`} />{item.status.replaceAll('_', ' ')}</div></div>)}</div>
          <button type="button" onClick={() => onNavigate('connections')} className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-bold text-[#00D68F] hover:text-white">Open connection diagnostics <ArrowRight className="h-3 w-3" /></button>
        </div>

        <div className="rounded-3xl border border-[#1A1A23] bg-[#08080E] p-5 shadow-xl sm:p-6">
          <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#16C7E8]"><CircleGauge className="h-3.5 w-3.5" /> Market movers</div><h2 className="mt-2 text-lg font-black text-white">Tracked assets</h2></div><button type="button" onClick={() => onNavigate('markets')} className="text-[10px] font-bold text-[#16C7E8] hover:text-white">Full market lab</button></div>
          <div className="mt-5 overflow-hidden rounded-xl border border-[#15151D]">{quotes.map((quote) => { const change = quote.changePercent ?? 0; return <button key={quote.symbol} type="button" onClick={() => { setSelectedSymbol(quote.symbol); window.scrollTo({ top: 300, behavior: 'smooth' }); }} className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-[#15151D] bg-[#05050A] px-3 py-3 text-left last:border-b-0 hover:bg-white/[0.03]"><div><p className="text-xs font-black text-white">{quote.symbol}</p><p className="mt-0.5 max-w-28 truncate text-[9px] text-[#5F5F72]">{quote.name}</p></div><p className="text-xs font-bold text-[#C7C7D3]">{formatCurrency(quote.price, quote.currency)}</p><p className={`flex items-center justify-end gap-1 text-[10px] font-bold ${change >= 0 ? 'text-[#00D68F]' : 'text-[#FF3B65]'}`}>{change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{change >= 0 ? '+' : ''}{change.toFixed(2)}%</p></button>; })}</div>
        </div>

        <div className="rounded-3xl border border-[#1A1A23] bg-[#08080E] p-5 shadow-xl sm:p-6">
          <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#F5B800]"><Newspaper className="h-3.5 w-3.5" /> Business brief</div><h2 className="mt-2 text-lg font-black text-white">Latest headlines</h2></div><button type="button" onClick={() => onNavigate('news')} className="text-[10px] font-bold text-[#F5B800] hover:text-white">View feed</button></div>
          <div className="mt-5 space-y-2.5">{news.length > 0 ? news.map((item) => <button key={item.id} type="button" onClick={() => onNavigate('news')} className="w-full rounded-xl border border-[#15151D] bg-[#05050A] p-3 text-left transition hover:border-[#F5B800]/25"><div className="flex items-center justify-between gap-3 text-[9px]"><span className="font-bold text-[#F5B800]">{item.sourceName}</span><span className="text-[#555568]">{formatDate(item.publishedAt)}</span></div><p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-5 text-[#C7C7D3]">{item.title}</p></button>) : <div className="rounded-xl border border-[#15151D] bg-[#05050A] p-5 text-center text-xs text-[#666678]">Business news is loading.</div>}</div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: 'Quick reliability check', text: 'Screen a financial prompt for safety and logic issues.', icon: Zap, destination: 'quick-check' as const, accent: '#F5B800' },
          { title: 'Evaluation laboratory', text: 'Run the seven-dimension dual-model benchmark.', icon: FlaskConical, destination: 'evaluation-lab' as const, accent: '#665CFF' },
          { title: 'Structured learning', text: 'Continue finance lessons and knowledge checks.', icon: BookOpen, destination: 'learning' as const, accent: '#16C7E8' },
          { title: 'Verified reports', text: 'Review evidence, scores, risk flags, and exports.', icon: FileCheck2, destination: 'reports' as const, accent: '#00D68F' },
        ].map((action) => <button key={action.title} type="button" onClick={() => onNavigate(action.destination)} className="group rounded-2xl border border-[#1A1A23] bg-[#08080E] p-4 text-left transition hover:-translate-y-0.5 hover:border-white/15"><div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035]" style={{ color: action.accent }}><action.icon className="h-4 w-4" /></div><ArrowRight className="h-4 w-4 text-[#4A4A5D] transition group-hover:translate-x-1 group-hover:text-white" /></div><h3 className="mt-4 text-sm font-black text-white">{action.title}</h3><p className="mt-1 text-[10px] leading-5 text-[#777789]">{action.text}</p></button>)}
      </section>

      <SafetyBanner />
      <div className="flex flex-col gap-3 rounded-2xl border border-[#1A1A23] bg-[#05050A] px-4 py-3 text-[10px] text-[#666678] sm:flex-row sm:items-center sm:justify-between"><span className="inline-flex items-center gap-2"><Database className="h-3.5 w-3.5 text-[#665CFF]" /> Values retain provider freshness labels and observation dates; historical patterns are not forecasts.</span><span className="inline-flex items-center gap-2"><WalletCards className="h-3.5 w-3.5 text-[#00D68F]" /> Paper portfolio uses simulated funds only.</span></div>
    </div>
  );
};
