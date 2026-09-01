export const MARKET_CHART_COLORS = {
  positive: '#16A34A',
  negative: '#DC2626',
  neutral: '#64748B',
  comparison: '#7C3AED',
} as const;

export function marketMovementColor(rangeReturn: number | null | undefined): string {
  if (rangeReturn == null || !Number.isFinite(rangeReturn) || Math.abs(rangeReturn) < 0.0001) return MARKET_CHART_COLORS.neutral;
  return rangeReturn > 0 ? MARKET_CHART_COLORS.positive : MARKET_CHART_COLORS.negative;
}

export function formatMarketAxis(value: number, currency: string): string {
  const sign = currency.toUpperCase() === 'INR' ? '₹' : currency.toUpperCase() === 'USD' ? '$' : `${currency.toUpperCase()} `;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(value / 1_000).toFixed(1)}K`;
  return `${sign}${value.toFixed(abs >= 100 ? 0 : 2)}`;
}
