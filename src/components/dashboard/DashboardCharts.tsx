import React from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMarketAxis, marketMovementColor } from '../../lib/charts/marketChartTheme';

const CHART_COLORS = [
  'var(--chart-primary)',
  'var(--chart-comparison)',
  'var(--chart-reference)',
  'var(--success)',
  'var(--warning)',
  'var(--danger)',
  'var(--text-secondary)',
];
const INDIA_COLORS = [
  'var(--chart-primary)',
  'var(--chart-comparison)',
  'var(--chart-reference)',
  'var(--text-secondary)',
];
const RELIABILITY_ARCHITECTURE = [
  { name: 'Numerical accuracy', value: 25 },
  { name: 'Safety & risk', value: 20 },
  { name: 'Reasoning', value: 15 },
  { name: 'Localization', value: 10 },
  { name: 'Evidence', value: 10 },
  { name: 'Consensus', value: 10 },
  { name: 'Injection defense', value: 10 },
];

function formatCurrency(value: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency', currency, maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function MarketPerformanceChart({
  data,
  currency = 'USD',
  rangeReturn = null,
}: {
  data: Array<{ date: string; price: number; volume?: number }>;
  currency?: string;
  rangeReturn?: number | null;
}) {
  const movementColor = marketMovementColor(rangeReturn);
  const gradientId = `dashboardPriceGradient-${movementColor.replace('#', '')}`;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 5, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={movementColor} stopOpacity={0.16} />
            <stop offset="95%" stopColor={movementColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value) => String(value).slice(5, 10)}
          tick={{ fill: 'var(--text-secondary)', fontSize: 9 }}
          stroke="var(--border-subtle)"
          minTickGap={34}
        />
        <YAxis
          yAxisId="price"
          domain={['auto', 'auto']}
          tick={{ fill: 'var(--text-secondary)', fontSize: 9 }}
          stroke="var(--border-subtle)"
          width={62}
          tickFormatter={(value) => formatMarketAxis(Number(value), currency)}
        />
        <YAxis yAxisId="volume" orientation="right" hide domain={[0, 'dataMax']} />
        <Tooltip
          labelFormatter={(label) => formatDate(String(label))}
          formatter={(value, name) =>
            name === 'Volume'
              ? [formatCompact(Number(value)), 'Volume']
              : [formatCurrency(Number(value), currency), 'Price']
          }
          contentStyle={{
            background: 'var(--chart-tooltip)',
            border: '1px solid var(--border-strong)',
            color: 'var(--chart-tooltip-foreground)',
            borderRadius: 12,
            fontSize: 11,
          }}
        />
        <Bar
          yAxisId="volume"
          dataKey="volume"
          name="Volume"
          fill="var(--chart-comparison)"
          opacity={0.14}
          radius={[3, 3, 0, 0]}
        />
        <Area
          yAxisId="price"
          type="monotone"
          dataKey="price"
          name="Price"
          stroke={movementColor}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 5, fill: movementColor, stroke: 'var(--bg-surface)', strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function EconomicPulseChart({
  data,
  country,
}: {
  data: Array<{ label: string; value: number | null; unit: string; date: string | null }>;
  country: 'us' | 'india';
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 30 }}>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          angle={-16}
          textAnchor="end"
          interval={0}
          tick={{ fill: 'var(--text-secondary)', fontSize: 9 }}
          stroke="var(--border-subtle)"
        />
        <YAxis
          tick={{ fill: 'var(--text-secondary)', fontSize: 9 }}
          stroke="var(--border-subtle)"
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          formatter={(value, _name, item) => [
            `${Number(value).toFixed(2)}${item.payload.unit}`,
            'Latest value',
          ]}
          labelFormatter={(label, payload) =>
            `${label} · ${payload?.[0]?.payload?.date || 'Date unavailable'}`
          }
          contentStyle={{
            background: 'var(--chart-tooltip)',
            border: '1px solid var(--border-strong)',
            color: 'var(--chart-tooltip-foreground)',
            borderRadius: 12,
            fontSize: 11,
          }}
        />
        <Bar dataKey="value" name="Latest value" radius={[7, 7, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`${entry.label}-${index}`}
              fill={
                country === 'us'
                  ? CHART_COLORS[index % CHART_COLORS.length]
                  : INDIA_COLORS[index % INDIA_COLORS.length]
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReliabilityAnalyticsChart({
  measuredScores,
}: {
  measuredScores: Array<{ dimension: string; score: number }>;
}) {
  if (measuredScores.length > 0) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={measuredScores} outerRadius="72%">
          <PolarGrid stroke="var(--chart-grid)" />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
          <Radar
            name="Score"
            dataKey="score"
            stroke="var(--chart-primary)"
            fill="var(--chart-primary)"
            fillOpacity={0.28}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(0)}%`, 'Score']}
            contentStyle={{
              background: 'var(--chart-tooltip)',
              border: '1px solid var(--border-strong)',
              color: 'var(--chart-tooltip-foreground)',
              borderRadius: 12,
              fontSize: 11,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={RELIABILITY_ARCHITECTURE}
          dataKey="value"
          nameKey="name"
          innerRadius={70}
          outerRadius={112}
          paddingAngle={2}
        >
          {RELIABILITY_ARCHITECTURE.map((entry, index) => (
            <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [`${value}%`, 'Scoring weight']}
          contentStyle={{
            background: 'var(--chart-tooltip)',
            border: '1px solid var(--border-strong)',
            color: 'var(--chart-tooltip-foreground)',
            borderRadius: 12,
            fontSize: 11,
          }}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 9, color: 'var(--text-secondary)' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
