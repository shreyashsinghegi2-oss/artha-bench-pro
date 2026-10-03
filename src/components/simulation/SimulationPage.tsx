import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Dices, Link2, Loader2, RotateCcw } from 'lucide-react';
import { findContribution, loadDefaults, runSimulation, type SimulationDefaults } from '../../simulation/client';
import { DEFAULT_PATHS, DEFAULT_SEED, SIMULATION_DISCLAIMER, type SimulationInput, type SimulationResult } from '../../simulation/monte-carlo';
import { FanChart, inrShort } from './FanChart';

const FD_RATE = 0.07;

export interface SimForm {
  initial: number;
  monthly: number;
  years: number;
  ret: number; // percent
  vol: number; // percent
  target: number;
  seed: number;
}

export function readForm(search: string): Partial<SimForm> {
  const q = new URLSearchParams(search);
  const num = (k: string) => {
    const v = q.get(k);
    const n = v === null ? Number.NaN : Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const out: Partial<SimForm> = {};
  for (const k of ['initial', 'monthly', 'years', 'ret', 'vol', 'target', 'seed'] as const) {
    const v = num(k);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export function formToQuery(f: SimForm): string {
  return new URLSearchParams(Object.entries(f).map(([k, v]) => [k, String(v)])).toString();
}

function toInput(f: SimForm, paths = DEFAULT_PATHS): SimulationInput {
  return {
    initial_amount: f.initial,
    monthly_contribution: f.monthly,
    years: f.years,
    expected_return: f.ret / 100,
    volatility: f.vol / 100,
    seed: f.seed,
    paths,
    targets: [f.target],
  };
}

function fdValue(f: SimForm): number {
  const g = (1 + FD_RATE / 4) ** (1 / 3); // quarterly compounding, monthly steps
  let v = f.initial;
  for (let m = 0; m < Math.round(f.years * 12); m += 1) v = (v + f.monthly) * g;
  return v;
}

const Field: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  prefix?: string;
  id: string;
}> = ({ label, value, onChange, min, max, step, suffix, prefix, id }) => (
  <div className="grid gap-1">
    <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      <span className="text-secondary">
        {prefix}
        {prefix === '₹' ? value.toLocaleString('en-IN') : value}
        {suffix}
      </span>
    </label>
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-brand"
    />
  </div>
);

export default function SimulationPage({ onHome }: { onHome: () => void }) {
  const [form, setForm] = useState<SimForm | null>(null);
  const [defaults, setDefaults] = useState<SimulationDefaults | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [needed, setNeeded] = useState<number | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    void loadDefaults().then((d) => {
      setDefaults(d);
      const fromUrl = readForm(window.location.search);
      setForm({
        initial: 100_000,
        monthly: 10_000,
        years: 15,
        ret: Math.round(d.expected_return * 1000) / 10,
        vol: Math.round(d.volatility * 1000) / 10,
        target: 10_000_000,
        seed: DEFAULT_SEED,
        ...fromUrl,
      });
    });
  }, []);

  const run = useCallback(async (f: SimForm) => {
    const id = ++runId.current;
    setBusy(true);
    setError(null);
    setNeeded(undefined);
    try {
      const r = await runSimulation(toInput(f));
      if (id !== runId.current) return;
      setResult(r);
      window.history.replaceState(null, '', `/simulation?${formToQuery(f)}`);
      const p = r.probability_above[String(f.target)] ?? 0;
      if (p < 0.9 && f.vol > 0) {
        const n = await findContribution(toInput(f, 4000), f.target, 0.9);
        if (id === runId.current) setNeeded(n);
      } else setNeeded(null);
    } catch (e) {
      if (id === runId.current) setError(e instanceof Error ? e.message : 'Simulation failed');
    } finally {
      if (id === runId.current) setBusy(false);
    }
  }, []);

  // Re-run shortly after the last slider change.
  useEffect(() => {
    if (!form) return;
    const t = window.setTimeout(() => void run(form), 250);
    return () => window.clearTimeout(t);
  }, [form, run]);

  const set = (k: keyof SimForm) => (v: number) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const prob = result && form ? (result.probability_above[String(form.target)] ?? 0) : null;
  const fd = form ? fdValue(form) : 0;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onHome}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Home
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-ink">Monte Carlo simulator</h1>
            <p className="truncate text-xs text-secondary">10,000 possible market paths for your investment</p>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[320px_1fr]">
        <section className="grid content-start gap-4 rounded-2xl border border-line bg-surface p-4" aria-label="Assumptions">
          {!form ? (
            <p className="text-sm text-secondary">Loading historical data…</p>
          ) : (
            <>
              <Field id="sim-initial" label="Invest now" prefix="₹" value={form.initial} onChange={set('initial')} min={0} max={10_000_000} step={10_000} />
              <Field id="sim-monthly" label="Every month (SIP)" prefix="₹" value={form.monthly} onChange={set('monthly')} min={0} max={500_000} step={500} />
              <Field id="sim-years" label="Years" value={form.years} onChange={set('years')} min={1} max={40} step={1} suffix=" yrs" />
              <Field id="sim-target" label="Goal" prefix="₹" value={form.target} onChange={set('target')} min={100_000} max={100_000_000} step={100_000} />
              <details className="rounded-xl bg-subtle p-3" open>
                <summary className="cursor-pointer text-sm font-semibold text-ink">Market assumptions</summary>
                <div className="mt-3 grid gap-3">
                  <Field id="sim-ret" label="Expected return (a year)" value={form.ret} onChange={set('ret')} min={0} max={25} step={0.1} suffix="%" />
                  <Field id="sim-vol" label="Volatility (a year)" value={form.vol} onChange={set('vol')} min={0} max={60} step={0.5} suffix="%" />
                  <p className="text-xs text-secondary">
                    Defaults: {defaults?.source ?? '…'}
                    {defaults?.is_historical && defaults.cagr !== null ? ` (growth ${(defaults.cagr * 100).toFixed(1)}% a year).` : '.'} Set volatility to 0%
                    for a fixed-return product such as an FD.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        defaults &&
                        setForm((f) =>
                          f ? { ...f, ret: Math.round(defaults.expected_return * 1000) / 10, vol: Math.round(defaults.volatility * 1000) / 10 } : f,
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-hover"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Historical defaults
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((f) => (f ? { ...f, seed: Math.floor(Math.random() * 1_000_000) } : f))}
                      className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-hover"
                    >
                      <Dices className="h-3.5 w-3.5" aria-hidden /> New random seed
                    </button>
                  </div>
                  <p className="text-xs text-secondary">Seed {form.seed}: the same seed always gives the same result.</p>
                </div>
              </details>
            </>
          )}
        </section>

        <section className="grid min-w-0 content-start gap-4" aria-live="polite" aria-busy={busy}>
          {error && (
            <p className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-sm" role="alert">
              {error}
            </p>
          )}
          {result && form && prob !== null ? (
            <>
              <div className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-lg font-bold text-ink">
                  {result.model === 'deterministic' ? (
                    <>
                      With a fixed return, you reach {inrShort(result.percentiles.p50)} in {form.years} years
                      {result.percentiles.p50 >= form.target ? `, above your ${inrShort(form.target)} goal.` : `, below your ${inrShort(form.target)} goal.`}
                    </>
                  ) : (
                    <>
                      {Math.round(prob * 100)}% chance of reaching {inrShort(form.target)} in {form.years} years.
                    </>
                  )}
                </p>
                <ul className="mt-2 grid gap-1 text-sm text-ink">
                  <li>
                    Median outcome: <b>{inrShort(result.percentiles.p50)}</b> on {inrShort(result.total_invested)} invested.
                  </li>
                  {result.model !== 'deterministic' && (
                    <li>
                      Worst realistic case (5%): <b>{inrShort(result.percentiles.p5)}</b>.{' '}
                      {result.percentiles.p5 >= fd
                        ? `Still more than an FD at ${Math.round(FD_RATE * 100)}% (${inrShort(fd)}).`
                        : `Less than an FD at ${Math.round(FD_RATE * 100)}% (${inrShort(fd)}).`}
                    </li>
                  )}
                  {result.model !== 'deterministic' && <li>Chance of ending below what you put in: {(result.probability_loss * 100).toFixed(1)}%.</li>}
                  {needed !== undefined && prob < 0.9 && (
                    <li>
                      {needed === null
                        ? 'Even a very large SIP would not reach a 90% chance; try more years or a smaller goal.'
                        : `To raise the chance to 90%, invest ${inrShort(needed)} a month (${needed > form.monthly ? `${inrShort(needed - form.monthly)} more` : 'about the same'}).`}
                    </li>
                  )}
                </ul>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-4">
                <FanChart bands={result.bands} title={`Simulated value of your investment over ${form.years} years`} />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-secondary">
                <span className="rounded-lg bg-warning-soft px-2 py-1 font-semibold text-warning">{SIMULATION_DISCLAIMER}</span>
                <span>
                  {result.paths_sampled.toLocaleString('en-IN')} paths · seed {result.seed} · {result.runtime_ms} ms ·{' '}
                  {result.model === 'deterministic' ? 'fixed return' : 'geometric Brownian motion, monthly steps'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true));
                  }}
                  className="inline-flex items-center gap-1 font-semibold text-interactive underline"
                >
                  <Link2 className="h-3.5 w-3.5" aria-hidden /> {copied ? 'Link copied' : 'Copy link to these results'}
                </button>
              </div>
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Running 10,000 simulations…
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
