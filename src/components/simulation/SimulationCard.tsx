import React, { useEffect, useState } from 'react';
import { Dices, Loader2 } from 'lucide-react';
import { loadDefaults, runSimulation } from '../../simulation/client';
import { DEFAULT_SEED, type SimulationResult } from '../../simulation/monte-carlo';
import { FanChart, inrShort } from './FanChart';
import { formToQuery } from './SimulationPage';

/**
 * Range of outcomes for an advisory calculation: the same inputs run through 10,000 simulated market paths
 * (in a Web Worker). Return = the calculation's middle scenario; volatility = NIFTY's historical volatility.
 */
export const SimulationCard: React.FC<{ initial: number; monthly: number; years: number; expectedReturnPct: number }> = ({
  initial,
  monthly,
  years,
  expectedReturnPct,
}) => {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [vol, setVol] = useState<{ value: number; source: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const d = await loadDefaults();
        if (!alive) return;
        setVol({ value: d.volatility, source: d.source });
        const r = await runSimulation({
          initial_amount: initial,
          monthly_contribution: monthly,
          years,
          expected_return: expectedReturnPct / 100,
          volatility: d.volatility,
          seed: DEFAULT_SEED,
        });
        if (alive) setResult(r);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Simulation failed');
      }
    })();
    return () => {
      alive = false;
    };
  }, [initial, monthly, years, expectedReturnPct]);

  if (error) return null;
  const link = vol
    ? `/simulation?${formToQuery({ initial, monthly, years, ret: expectedReturnPct, vol: Math.round(vol.value * 1000) / 10, target: Math.round((result?.percentiles.p50 ?? initial + monthly * years * 12) / 100_000) * 100_000 || 100_000, seed: DEFAULT_SEED })}`
    : '/simulation';
  return (
    <article className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary">
        <Dices className="h-3.5 w-3.5" aria-hidden /> Range of outcomes (10,000 simulated markets)
      </p>
      {!result ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Simulating…
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink">
            Median <b>{inrShort(result.percentiles.p50)}</b>; worst 5% <b>{inrShort(result.percentiles.p5)}</b>; best 5%{' '}
            <b>{inrShort(result.percentiles.p95)}</b>. Chance of ending below the {inrShort(result.total_invested)} invested:{' '}
            {(result.probability_loss * 100).toFixed(1)}%.
          </p>
          <div className="mt-3">
            <FanChart bands={result.bands} height={220} compact title={`Simulated value over ${years} years`} />
          </div>
          <p className="mt-2 text-xs text-secondary">
            {expectedReturnPct}% expected return (the middle scenario above) with{' '}
            {vol ? `${(vol.value * 100).toFixed(1)}% volatility from ${vol.source}` : 'historical volatility'}. The median sits below a fixed{' '}
            {expectedReturnPct}% because ups and downs reduce compound growth (volatility drag). {result.disclaimer}{' '}
            <a href={link} className="font-semibold text-interactive underline">
              Re-run with different assumptions
            </a>
          </p>
        </>
      )}
    </article>
  );
};
