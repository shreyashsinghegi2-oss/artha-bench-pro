import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Database,
  ExternalLink,
  Info,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchEconomicOverview,
  fetchEconomicSeries,
  fetchIndiaEconomicOverview,
  fetchIndiaEconomicSeries,
} from '../../services/learningApi';
import {
  EconomicIndicator,
  EconomicObservation,
} from '../../types';
import { SafetyBanner } from '../SafetyBanner';

interface IndicatorMetadata {
  seriesId: string;
  label: string;
  shortLabel: string;
  unit: string;
  description: string;
  frequency: string;
  whyItMatters: string;
  transform?: 'inflation_yoy' | 'gdp_trillions' | 'usd_to_trillions';
}

const INDICATOR_METADATA: Record<string, IndicatorMetadata> = {
  CPIAUCSL: {
    seriesId: 'CPIAUCSL',
    label: 'US Inflation Rate',
    shortLabel: 'Inflation',
    unit: '% YoY',
    description:
      'Measures the year-over-year change in the Consumer Price Index for all urban consumers.',
    frequency: 'Monthly',
    whyItMatters:
      'Inflation affects purchasing power, household budgets, interest-rate policy, and the real value of savings.',
    transform: 'inflation_yoy',
  },
  GDPC1: {
    seriesId: 'GDPC1',
    label: 'US Real Gross Domestic Product',
    shortLabel: 'Real GDP',
    unit: '$T',
    description:
      'Inflation-adjusted value of goods and services produced by the United States economy.',
    frequency: 'Quarterly',
    whyItMatters:
      'Real GDP helps identify economic expansion, contraction, and longer-term changes in productive activity.',
    transform: 'gdp_trillions',
  },
  UNRATE: {
    seriesId: 'UNRATE',
    label: 'US Unemployment Rate',
    shortLabel: 'Unemployment',
    unit: '%',
    description:
      'Share of the civilian labor force that is unemployed and actively seeking employment.',
    frequency: 'Monthly',
    whyItMatters:
      'It is a central measure of labor-market strength, household income pressure, and economic slack.',
  },
  FEDFUNDS: {
    seriesId: 'FEDFUNDS',
    label: 'Effective Federal Funds Rate',
    shortLabel: 'Fed Funds Rate',
    unit: '%',
    description:
      'The interest rate at which depository institutions trade federal funds with one another overnight.',
    frequency: 'Monthly average',
    whyItMatters:
      'It influences borrowing costs, deposit rates, business financing, and financial conditions throughout the economy.',
  },
  DGS10: {
    seriesId: 'DGS10',
    label: 'US 10-Year Treasury Yield',
    shortLabel: '10-Year Treasury',
    unit: '%',
    description:
      'Market yield on US Treasury securities with a constant maturity of ten years.',
    frequency: 'Business daily',
    whyItMatters:
      'It is widely used as a long-term benchmark for mortgages, valuation discount rates, and market expectations.',
  },
  'NY.GDP.MKTP.CD': {
    seriesId: 'NY.GDP.MKTP.CD',
    label: 'India Gross Domestic Product',
    shortLabel: 'India GDP',
    unit: 'US$T',
    description:
      'The total market value of goods and services produced in India, expressed in current US dollars.',
    frequency: 'Annual',
    whyItMatters:
      'GDP provides a broad measure of the size of India’s economy and its long-term economic development.',
    transform: 'usd_to_trillions',
  },
  'NY.GDP.MKTP.KD.ZG': {
    seriesId: 'NY.GDP.MKTP.KD.ZG',
    label: 'India Real GDP Growth',
    shortLabel: 'GDP Growth',
    unit: '%',
    description:
      'Annual percentage growth rate of India’s GDP at constant prices, adjusted for inflation.',
    frequency: 'Annual',
    whyItMatters:
      'Real GDP growth shows whether inflation-adjusted economic production is expanding or contracting.',
  },
  'FP.CPI.TOTL.ZG': {
    seriesId: 'FP.CPI.TOTL.ZG',
    label: 'India Consumer Inflation',
    shortLabel: 'India Inflation',
    unit: '% annual',
    description:
      'Annual percentage change in the consumer price index for India.',
    frequency: 'Annual',
    whyItMatters:
      'Consumer inflation affects household purchasing power, savings, wages, and monetary-policy decisions.',
  },
  'SL.UEM.TOTL.ZS': {
    seriesId: 'SL.UEM.TOTL.ZS',
    label: 'India Unemployment Rate',
    shortLabel: 'India Unemployment',
    unit: '%',
    description:
      'Share of India’s total labor force that is without work but available for and seeking employment.',
    frequency: 'Annual modeled estimate',
    whyItMatters:
      'Unemployment is an important measure of labor-market conditions and household income pressure.',
  },
  'FR.INR.LEND': {
    seriesId: 'FR.INR.LEND',
    label: 'India Lending Interest Rate',
    shortLabel: 'Lending Rate',
    unit: '%',
    description:
      'Bank lending rate that usually meets the short- and medium-term financing needs of India’s private sector.',
    frequency: 'Annual',
    whyItMatters:
      'Lending rates influence the cost of household borrowing, business credit, and investment activity.',
  },
};

const OBSERVATION_OPTIONS = [
  { value: 24, label: '24 observations' },
  { value: 120, label: '120 observations' },
  { value: 240, label: '240 observations' },
];

const INDIA_OBSERVATION_OPTIONS = [
  { value: 10, label: '10 annual observations' },
  { value: 24, label: '24 annual observations' },
  { value: 60, label: '60 annual observations' },
];

function transformObservations(
  observations: EconomicObservation[],
  metadata: IndicatorMetadata,
) {
  if (metadata.transform === 'gdp_trillions') {
    return observations.map((observation) => ({
      date: observation.date,
      value: Math.round((observation.value / 1_000) * 100) / 100,
    }));
  }

  if (metadata.transform === 'usd_to_trillions') {
    return observations.map((observation) => ({
      date: observation.date,
      value: Math.round((observation.value / 1_000_000_000_000) * 100) / 100,
    }));
  }

  if (metadata.transform === 'inflation_yoy') {
    const byDate = new Map(
      observations.map((observation) => [observation.date, observation.value]),
    );
    return observations.flatMap((observation) => {
      const priorDate = new Date(`${observation.date}T00:00:00Z`);
      priorDate.setUTCFullYear(priorDate.getUTCFullYear() - 1);
      const priorValue = byDate.get(priorDate.toISOString().slice(0, 10));
      if (priorValue === undefined || priorValue === 0) return [];
      return [
        {
          date: observation.date,
          value:
            Math.round((((observation.value / priorValue) - 1) * 100) * 100) /
            100,
        },
      ];
    });
  }

  return observations;
}

function formatChartDate(date: string) {
  if (/^\d{4}$/.test(date)) return date;
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

function formatFullDate(date: string) {
  if (/^\d{4}$/.test(date)) return date;
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export const EconomicDashboardView: React.FC = () => {
  const [country, setCountry] = useState<'us' | 'india'>('us');
  const [indicators, setIndicators] = useState<EconomicIndicator[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState('CPIAUCSL');
  const [observations, setObservations] = useState<EconomicObservation[]>([]);
  const [observationLimit, setObservationLimit] = useState(120);
  const [customSeriesId, setCustomSeriesId] = useState('');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedMetadata =
    INDICATOR_METADATA[selectedSeriesId] || {
      seriesId: selectedSeriesId,
      label: `${country === 'us' ? 'FRED Series' : 'World Bank Indicator'} ${selectedSeriesId}`,
      shortLabel: selectedSeriesId,
      unit: 'Value',
      description: `A custom economic time series loaded directly from ${country === 'us' ? 'FRED' : 'the World Bank Indicators API'}.`,
      frequency: 'Defined by source series',
      whyItMatters:
        `Use the official ${country === 'us' ? 'FRED series' : 'World Bank indicator'} page to review its definition, units, frequency, and methodology.`,
    };

  const providerName = country === 'us' ? 'Federal Reserve Economic Data' : 'World Bank India Data';
  const providerShortName = country === 'us' ? 'FRED' : 'World Bank';
  const officialSeriesUrl =
    country === 'us'
      ? `https://fred.stlouisfed.org/series/${selectedSeriesId}`
      : `https://data.worldbank.org/indicator/${selectedSeriesId}?locations=IN`;

  const loadOverview = async () => {
    setLoadingOverview(true);
    try {
      setIndicators(
        country === 'us'
          ? await fetchEconomicOverview()
          : await fetchIndiaEconomicOverview(),
      );
    } catch {
      setError(`The ${providerShortName} economic overview is temporarily unavailable.`);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    setIndicators([]);
    loadOverview();
  }, [country]);

  useEffect(() => {
    // Loading the India overview already makes five World Bank requests. Wait
    // for those to finish before requesting chart history so the public API is
    // not hit by six concurrent requests from one country switch.
    if (loadingOverview) {
      setLoadingSeries(true);
      return;
    }

    let active = true;
    setLoadingSeries(true);
    setError(null);
    const request =
      country === 'us'
        ? fetchEconomicSeries(selectedSeriesId, observationLimit)
        : fetchIndiaEconomicSeries(selectedSeriesId, observationLimit);
    request
      .then((response) => {
        if (!active) return;
        setObservations(response.observations || []);
        if (response.status !== 'connected') {
          setError(response.message || `${providerShortName} series data is unavailable.`);
        }
      })
      .catch((requestError: Error) => {
        if (active) setError(requestError.message || `Unable to load ${providerShortName} data.`);
      })
      .finally(() => {
        if (active) setLoadingSeries(false);
      });
    return () => {
      active = false;
    };
  }, [country, selectedSeriesId, observationLimit, loadingOverview]);

  const chartData = useMemo(
    () => transformObservations(observations, selectedMetadata),
    [observations, selectedMetadata],
  );
  const latestChartPoint = chartData.at(-1);
  const previousChartPoint = chartData.at(-2);
  const change =
    latestChartPoint && previousChartPoint
      ? latestChartPoint.value - previousChartPoint.value
      : null;

  const handleCustomSeries = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = customSeriesId.trim().toUpperCase();
    if (!/^[A-Z0-9._-]{1,64}$/.test(normalized)) {
      setError(
        country === 'us'
          ? 'Enter a valid FRED series ID, such as PCE, M2SL, or DEXINUS.'
          : 'Enter a valid World Bank indicator ID, such as SP.POP.TOTL or GC.DOD.TOTL.GD.ZS.',
      );
      return;
    }
    setSelectedSeriesId(normalized);
  };

  const handleCountryChange = (nextCountry: 'us' | 'india') => {
    setLoadingOverview(true);
    setCountry(nextCountry);
    setSelectedSeriesId(nextCountry === 'us' ? 'CPIAUCSL' : 'NY.GDP.MKTP.CD');
    setObservationLimit(nextCountry === 'us' ? 120 : 24);
    setCustomSeriesId('');
    setObservations([]);
    setError(null);
  };

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-8 space-y-8">
      <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-sm overflow-hidden relative">
        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-transparent pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-fill/10 border border-success-fill/30 text-success text-[11px] font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Live {providerName}
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
                Economic Dashboard
              </h1>
              <p className="text-sm text-secondary leading-relaxed max-w-3xl mt-2">
                Compare official United States and India macroeconomic indicators, historical trends, observation dates, and educational explanations.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 self-start lg:self-auto">
            <div className="flex items-center p-1 bg-canvas border border-line rounded-xl">
              <button
                onClick={() => handleCountryChange('us')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${country === 'us' ? 'bg-interactive-soft text-interactive' : 'text-secondary hover:text-interactive'}`}
              >
                🇺🇸 United States
              </button>
              <button
                onClick={() => handleCountryChange('india')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${country === 'india' ? 'bg-interactive-soft text-interactive' : 'text-secondary hover:text-interactive'}`}
              >
                🇮🇳 India
              </button>
            </div>
            <button
              onClick={loadOverview}
              disabled={loadingOverview}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-success-fill/10 border border-success-fill/30 text-success hover:bg-success-fill/20 text-xs font-bold transition-all disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loadingOverview ? 'animate-spin' : ''}`} />
              Refresh {providerShortName}
            </button>
          </div>
        </div>
      </section>

      <SafetyBanner />

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {indicators.map((indicator) => {
          const active = selectedSeriesId === indicator.seriesId;
          return (
            <button
              key={indicator.id}
              onClick={() => setSelectedSeriesId(indicator.seriesId)}
              className={`text-left rounded-2xl p-5 border transition-all min-h-40 ${
                active
                  ? 'bg-interactive-soft border-interactive/40 shadow-sm'
                  : 'bg-surface border-line hover:border-interactive/35'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Activity className={`w-4 h-4 ${active ? 'text-success' : 'text-interactive'}`} />
                <span className="text-[9px] font-mono text-secondary">{indicator.seriesId}</span>
              </div>
              <p className="text-[11px] text-secondary mt-4">{indicator.label}</p>
              <div className="text-2xl font-extrabold text-ink mt-1">
                {indicator.value === null ? '—' : indicator.value.toLocaleString()}
                <span className="text-xs font-semibold text-secondary ml-1">{indicator.unit}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-secondary mt-3">
                <CalendarDays className="w-3 h-3" />
                {indicator.date || 'Date unavailable'}
              </div>
            </button>
          );
        })}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-surface border border-line rounded-3xl p-5 sm:p-7 shadow-sm min-w-0">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-success">
                <TrendingUp className="w-3.5 h-3.5" />
                Historical Trend
              </div>
              <h2 className="text-xl font-bold text-ink mt-1">{selectedMetadata.label}</h2>
              <p className="text-xs text-secondary mt-1">
                {selectedMetadata.frequency} · {selectedMetadata.seriesId}
              </p>
            </div>
            <select
              value={observationLimit}
              onChange={(event) => setObservationLimit(Number(event.target.value))}
              className="bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-interactive focus:ring-2 focus:ring-interactive"
            >
              {(country === 'india' ? INDIA_OBSERVATION_OPTIONS : OBSERVATION_OPTIONS).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="h-[360px] sm:h-[420px] w-full">
            {loadingSeries ? (
              <div className="h-full flex items-center justify-center text-xs text-secondary">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading historical observations…
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatChartDate}
                    stroke="var(--border-subtle)"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                    minTickGap={34}
                  />
                  <YAxis
                    stroke="var(--border-subtle)"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                    width={54}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    labelFormatter={(date) => formatFullDate(String(date))}
                    formatter={(value) => [`${Number(value).toLocaleString()} ${selectedMetadata.unit}`, selectedMetadata.shortLabel]}
                    contentStyle={{
                      background: 'var(--chart-tooltip)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 12,
                      color: 'var(--chart-tooltip-foreground)',
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--chart-primary)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: 'var(--chart-primary)', stroke: 'var(--bg-surface)', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-secondary">
                No usable observations were returned for this series.
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-danger/10 border border-danger/25 text-xs text-danger">
              {error}
            </div>
          )}
        </div>

        <aside className="xl:col-span-4 space-y-6">
          <div className="bg-surface border border-line rounded-3xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-interactive" />
              <h2 className="text-sm font-bold text-ink">Indicator Guide</h2>
            </div>
            <p className="text-xs text-secondary leading-relaxed">{selectedMetadata.description}</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-canvas rounded-xl border border-line">
                <span className="text-[10px] text-secondary">Latest value</span>
                <span className="text-sm font-bold text-success">
                  {latestChartPoint ? latestChartPoint.value.toLocaleString() : '—'} {selectedMetadata.unit}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-canvas rounded-xl border border-line">
                <span className="text-[10px] text-secondary">Previous change</span>
                <span className={`text-xs font-bold ${change !== null && change >= 0 ? 'text-success' : 'text-danger'}`}>
                  {change === null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)} ${selectedMetadata.unit}`}
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink">Why it matters</h3>
              <p className="text-xs text-secondary leading-relaxed mt-2">{selectedMetadata.whyItMatters}</p>
            </div>
            <a
              href={officialSeriesUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-semibold text-interactive hover:text-interactive"
            >
              Open official {providerShortName} series <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="bg-surface border border-line rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-interactive" />
              <h2 className="text-sm font-bold text-ink">{providerShortName} Series Explorer</h2>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              Enter any public {providerShortName} {country === 'us' ? 'series' : 'indicator'} ID to load its historical values.
            </p>
            <form onSubmit={handleCustomSeries} className="flex gap-2">
              <input
                value={customSeriesId}
                onChange={(event) => setCustomSeriesId(event.target.value)}
                placeholder={country === 'us' ? 'Example: PCE or M2SL' : 'Example: SP.POP.TOTL'}
                className="min-w-0 flex-1 bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink placeholder:text-secondary focus:outline-none focus:border-interactive focus:ring-2 focus:ring-interactive uppercase"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-interactive/15 border border-interactive/30 text-interactive text-xs font-bold hover:bg-interactive/25"
              >
                Load
              </button>
            </form>
          </div>
        </aside>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-line rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Database className="w-4 h-4 text-interactive" />
            <h2 className="text-sm font-bold text-ink">Recent Observations</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-secondary text-left">
                  <th className="py-2 font-semibold">Observation date</th>
                  <th className="py-2 font-semibold text-right">Value</th>
                  <th className="py-2 font-semibold text-right">Unit</th>
                </tr>
              </thead>
              <tbody>
                {chartData.slice(-10).reverse().map((observation) => (
                  <tr key={observation.date} className="border-b border-line">
                    <td className="py-3 text-secondary">{observation.date}</td>
                    <td className="py-3 text-right font-mono font-semibold text-ink">
                      {observation.value.toLocaleString()}
                    </td>
                    <td className="py-3 text-right text-secondary">{selectedMetadata.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-success" />
            <h2 className="text-sm font-bold text-ink">How to Read This Dashboard</h2>
          </div>
          <div className="space-y-4">
            {[
              ['Values', `Each number is a historical observation retrieved from ${providerShortName}, not a forecast.`],
              ['Dates', country === 'us' ? 'Release frequencies differ: GDP is quarterly, CPI and unemployment are monthly, and Treasury yields are daily.' : 'World Bank India indicators are generally annual and may have different latest available years.'],
              ['Inflation', country === 'us' ? 'ArthaBench calculates the displayed year-over-year percentage from the official CPI index observations.' : 'India inflation is the annual percentage change in consumer prices reported through World Development Indicators.'],
              ['Use', 'Compare trends and economic context for education and AI verification—not personalized investment decisions.'],
            ].map(([title, text], index) => (
              <div key={title} className="flex gap-3">
                <div className="w-6 h-6 rounded-lg bg-interactive/15 border border-interactive/25 flex items-center justify-center text-[10px] font-bold text-interactive shrink-0">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-ink">{title}</h3>
                  <p className="text-xs text-secondary leading-relaxed mt-1">{text}</p>
                </div>
              </div>
            ))}
          </div>
          <a
            href={country === 'us' ? 'https://fred.stlouisfed.org/' : 'https://data.worldbank.org/country/india'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-interactive/10 border border-interactive/25 text-interactive text-xs font-semibold hover:bg-interactive/20"
          >
            {providerName} <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>
    </div>
  );
};
