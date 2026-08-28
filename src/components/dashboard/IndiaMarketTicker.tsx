import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type {
  IndiaMarketTickerItem,
  IndiaMarketTickerResponse,
} from '../../types';
import { fetchIndiaMarketTicker } from '../../services/learningApi';

const REFRESH_INTERVAL_MS = 60_000;
const DEFAULT_SOURCE_LABEL = 'Yahoo Finance · delayed / availability varies';

function formatPrice(value: number, currency: string | null) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}

function signedNumber(value: number, suffix = '') {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${suffix}`;
}

function TickerItem({ item }: { item: IndiaMarketTickerItem }) {
  if (item.status === 'unavailable' || item.price === null) {
    return (
      <li className="flex h-10 shrink-0 items-center gap-2 border-r border-slate-700/80 px-5 text-xs">
        <span className="font-semibold text-slate-100">{item.label}</span>
        <span className="text-slate-400">Unavailable</span>
      </li>
    );
  }

  const change = item.change ?? 0;
  const changePercent = item.changePercent ?? 0;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  const valueColor = direction === 'up'
    ? 'text-emerald-300'
    : direction === 'down'
      ? 'text-red-300'
      : 'text-slate-300';
  const DirectionIcon = direction === 'up'
    ? ArrowUpRight
    : direction === 'down'
      ? ArrowDownRight
      : Minus;
  const sentiment = direction === 'up' ? 'Bullish' : direction === 'down' ? 'Bearish' : 'Neutral';
  const sentimentDot = direction === 'up' ? 'bg-emerald-400' : direction === 'down' ? 'bg-red-400' : 'bg-amber-300';
  const sentimentClass = direction === 'up'
    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
    : direction === 'down'
      ? 'border-red-400/25 bg-red-400/10 text-red-200'
      : 'border-amber-300/25 bg-amber-300/10 text-amber-100';

  return (
    <li className="flex h-10 shrink-0 items-center gap-2.5 border-r border-slate-700/80 px-5 text-xs tabular-nums">
      <span className="font-semibold text-slate-100">{item.label}</span>
      <span className="min-w-[5.5rem] text-right font-medium text-white">
        {formatPrice(item.price, item.currency)}
      </span>
      <span className={`inline-flex min-w-[8.75rem] items-center gap-1 font-semibold ${valueColor}`}>
        <DirectionIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{signedNumber(change)}</span>
        <span>({signedNumber(changePercent, '%')})</span>
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${sentimentClass}`}
        aria-label={`AI sentiment ${sentiment}`}
        title="ArthaMind AI sentiment derived from the displayed price-change direction"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${sentimentDot}`} aria-hidden="true" />
        {sentiment}
      </span>
    </li>
  );
}

function TickerGroup({
  items,
  duplicate = false,
}: {
  items: IndiaMarketTickerItem[];
  duplicate?: boolean;
}) {
  return (
    <ul
      className={`india-market-ticker-group flex shrink-0 items-center ${duplicate ? 'india-market-ticker-duplicate' : ''}`}
      aria-hidden={duplicate || undefined}
    >
      {items.map((item) => (
        <React.Fragment key={item.id}>
          <TickerItem item={item} />
        </React.Fragment>
      ))}
    </ul>
  );
}

export const IndiaMarketTicker: React.FC = () => {
  const [data, setData] = useState<IndiaMarketTickerResponse | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const loadTicker = async () => {
      try {
        const nextData = await fetchIndiaMarketTicker();
        if (!active) return;
        setData(nextData);
        setRequestFailed(false);
      } catch {
        if (!active) return;
        setRequestFailed(true);
      }
    };

    void loadTicker();
    const intervalId = window.setInterval(() => void loadTicker(), REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const sourceLabel = data?.sourceLabel || DEFAULT_SOURCE_LABEL;
  const isUnavailable = requestFailed || data?.status === 'unavailable';
  const hasAvailabilityWarning = isUnavailable || data?.status === 'partial';
  const retrievedTime = data?.retrievedAt
    ? new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      }).format(new Date(data.retrievedAt))
    : null;
  const accessibleLabel = useMemo(() => {
    const timestampLabel = retrievedTime ? ` Retrieved ${retrievedTime} India time.` : '';
    if (isUnavailable) {
      return `India markets ticker. ${sourceLabel}.${timestampLabel} Market data temporarily unavailable.`;
    }
    if (data?.status === 'partial') {
      return `India markets ticker. ${sourceLabel}.${timestampLabel} Some instruments are temporarily unavailable.`;
    }
    return `India markets ticker. ${sourceLabel}.${timestampLabel}`;
  }, [data?.status, isUnavailable, retrievedTime, sourceLabel]);

  return (
    <section
      className="india-market-ticker-shell flex min-h-10 overflow-hidden rounded-xl bg-[#101A2E] shadow-sm ring-1 ring-slate-900/10"
      aria-label={accessibleLabel}
    >
      <div className="relative z-10 flex shrink-0 items-center gap-2 border-r border-slate-700 bg-[#101A2E] px-3 sm:px-4">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${hasAvailabilityWarning ? 'bg-amber-400' : data ? 'bg-emerald-400' : 'bg-slate-400'}`}
          aria-hidden="true"
        />
        <div className="leading-tight">
          <p className="text-[10px] font-bold tracking-[0.13em] text-white">INDIA MARKETS</p>
          <p className="hidden text-[9px] text-slate-300 sm:block">
            {sourceLabel}
            {retrievedTime && <span className="hidden 2xl:inline"> · {retrievedTime} IST</span>}
          </p>
        </div>
      </div>

      <div className="india-market-ticker-viewport min-w-0 flex-1 overflow-hidden" tabIndex={0}>
        {data?.items.length ? (
          <div className="india-market-ticker-track flex w-max items-center">
            <TickerGroup items={data.items} />
            <TickerGroup items={data.items} duplicate />
          </div>
        ) : requestFailed ? (
          <div className="flex h-10 items-center px-5 text-xs text-slate-300">
            Market data temporarily unavailable
          </div>
        ) : (
          <div className="flex h-10 items-center gap-5 px-5" aria-label="Loading India market data">
            {[0, 1, 2, 3].map((item) => (
              <span
                key={item}
                className="h-2.5 w-32 animate-pulse rounded-full bg-slate-700 motion-reduce:animate-none"
                aria-hidden="true"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
