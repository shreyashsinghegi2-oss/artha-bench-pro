import React from 'react';
import {
  BarChart3,
  Building2,
  CalendarCheck2,
  ExternalLink,
  KeyRound,
  RefreshCw,
  Users,
} from 'lucide-react';
import { CompanyIntelligence } from '../../types';

interface CompanyIntelligencePanelProps {
  data: CompanyIntelligence | null;
  loading: boolean;
}

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
  const latestRecommendation = data.recommendations[0];
  const companyUrl = profile?.webUrl?.startsWith('https://') ? profile.webUrl : null;
  const logoUrl = profile?.logoUrl?.startsWith('https://') ? profile.logoUrl : null;

  const metricCards = [
    ['P/E ratio', formatNumber(metrics?.peRatio ?? null)],
    ['Price / book', formatNumber(metrics?.priceToBook ?? null)],
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

      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-200">Fundamental Metrics</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metricCards.map(([label, value]) => (
            <div key={label} className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className="text-sm font-bold text-slate-100 mt-1">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-3">
          52-week range: {formatNumber(metrics?.week52Low ?? null)} – {formatNumber(metrics?.week52High ?? null)}
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarCheck2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-200">Recent Earnings</h3>
          </div>
          {data.earnings.length > 0 ? (
            <div className="space-y-2">
              {data.earnings.map((earning, index) => (
                <div key={`${earning.period}-${index}`} className="grid grid-cols-3 gap-2 text-[10px] border-b border-slate-900 pb-2">
                  <span className="text-slate-400">{earning.period || 'Period'}</span>
                  <span className="text-right text-slate-300">EPS {formatNumber(earning.actual)}</span>
                  <span className={`text-right font-semibold ${(earning.surprise ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {earning.surprise === null ? '—' : `${earning.surprise >= 0 ? '+' : ''}${formatNumber(earning.surprise)}`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-slate-500">No earnings observations available on the current Finnhub plan.</p>
          )}
        </section>

        <section className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-violet-400" />
            <h3 className="text-xs font-bold text-slate-200">Analyst Recommendation Trend</h3>
          </div>
          {latestRecommendation ? (
            <>
              <p className="text-[10px] text-slate-500 mb-3">Latest period: {latestRecommendation.period || 'Current'}</p>
              <div className="grid grid-cols-5 gap-1 text-center">
                {[
                  ['Strong buy', latestRecommendation.strongBuy, 'text-emerald-300'],
                  ['Buy', latestRecommendation.buy, 'text-emerald-400'],
                  ['Hold', latestRecommendation.hold, 'text-amber-300'],
                  ['Sell', latestRecommendation.sell, 'text-rose-400'],
                  ['Strong sell', latestRecommendation.strongSell, 'text-rose-300'],
                ].map(([label, value, color]) => (
                  <div key={String(label)} className="bg-slate-900 rounded-lg px-1 py-2">
                    <p className={`text-sm font-bold ${color}`}>{String(value)}</p>
                    <p className="text-[8px] text-slate-500 mt-1 leading-tight">{String(label)}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[10px] text-slate-500">No recommendation trend is available on the current Finnhub plan.</p>
          )}
        </section>
      </div>

      <div className="flex items-center justify-between gap-4 text-[10px] text-slate-500">
        <span>{data.message}</span>
        <span>Source: Finnhub · Educational use only</span>
      </div>
    </div>
  );
};
