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

const CHART_COLORS = ['#665CFF', '#16C7E8', '#00D68F', '#F5B800', '#FF3B65', '#A78BFA', '#38BDF8'];
const INDIA_COLORS = ['#FF8A00', '#F5B800', '#00D68F', '#16C7E8'];
const RELIABILITY_ARCHITECTURE = [
  { name: 'Numerical accuracy', value: 25 },
  { name: 'Safety & risk', value: 20 },
  { name: 'Reasoning', value: 15 },
  { name: 'Localization', value: 10 },
  { name: 'Evidence', value: 10 },
  { name: 'Consensus', value: 10 },
  { name: 'Injection defense', value: 10 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
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
}: {
  data: Array<{ date: string; price: number; volume?: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 5, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="dashboardPriceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#665CFF" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#665CFF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1A1A23" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value) => String(value).slice(5, 10)}
          tick={{ fill: '#666678', fontSize: 9 }}
          stroke="#22222E"
          minTickGap={34}
        />
        <YAxis
          yAxisId="price"
          domain={['auto', 'auto']}
          tick={{ fill: '#666678', fontSize: 9 }}
          stroke="#22222E"
          width={54}
          tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
        />
        <YAxis yAxisId="volume" orientation="right" hide domain={[0, 'dataMax']} />
        <Tooltip
          labelFormatter={(label) => formatDate(String(label))}
          formatter={(value, name) =>
            name === 'Volume'
              ? [formatCompact(Number(value)), 'Volume']
              : [formatCurrency(Number(value)), 'Price']
          }
          contentStyle={{
            background: '#08080E',
            border: '1px solid #2A2A3A',
            borderRadius: 12,
            fontSize: 11,
          }}
        />
        <Bar
          yAxisId="volume"
          dataKey="volume"
          name="Volume"
          fill="#16C7E8"
          opacity={0.16}
          radius={[3, 3, 0, 0]}
        />
        <Area
          yAxisId="price"
          type="monotone"
          dataKey="price"
          name="Price"
          stroke="#7B6CFF"
          strokeWidth={2.5}
          fill="url(#dashboardPriceGradient)"
          dot={false}
          activeDot={{ r: 5, fill: '#16C7E8', stroke: '#08080E', strokeWidth: 2 }}
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
        <CartesianGrid stroke="#1A1A23" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          angle={-16}
          textAnchor="end"
          interval={0}
          tick={{ fill: '#777789', fontSize: 9 }}
          stroke="#22222E"
        />
        <YAxis
          tick={{ fill: '#777789', fontSize: 9 }}
          stroke="#22222E"
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
            background: '#08080E',
            border: '1px solid #2A2A3A',
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
          <PolarGrid stroke="#242432" />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: '#8E8EA1', fontSize: 10 }} />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#8B7CFF"
            fill="#665CFF"
            fillOpacity={0.28}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(0)}%`, 'Score']}
            contentStyle={{
              background: '#08080E',
              border: '1px solid #2A2A3A',
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
            background: '#08080E',
            border: '1px solid #2A2A3A',
            borderRadius: 12,
            fontSize: 11,
          }}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 9, color: '#8E8EA1' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
