/**
 * Annualised GBM parameters from daily closes: σ = stdev(daily log returns)·√252,
 * μ = mean(daily log return)·252 + σ²/2 (so the model's median growth matches the historical CAGR).
 */
export interface HistoricalParams {
  expected_return: number;
  volatility: number;
  cagr: number;
  from: string;
  to: string;
  days: number;
}

export function paramsFromCloses(series: Array<{ date: string; close: number }>): HistoricalParams {
  const s = series.filter((p) => Number.isFinite(p.close) && p.close > 0);
  if (s.length < 250) throw new Error('need at least a year of daily closes');
  const logs: number[] = [];
  for (let i = 1; i < s.length; i += 1) logs.push(Math.log((s[i]?.close ?? 1) / (s[i - 1]?.close ?? 1)));
  const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
  const variance = logs.reduce((a, b) => a + (b - mean) ** 2, 0) / (logs.length - 1);
  const volatility = Math.sqrt(variance * 252);
  const first = s[0] as { date: string; close: number };
  const last = s[s.length - 1] as { date: string; close: number };
  const years = (Date.parse(last.date) - Date.parse(first.date)) / (365.25 * 86_400_000);
  const cagr = years > 0 ? (last.close / first.close) ** (1 / years) - 1 : Number.NaN;
  return { expected_return: mean * 252 + (volatility * volatility) / 2, volatility, cagr, from: first.date, to: last.date, days: s.length };
}
