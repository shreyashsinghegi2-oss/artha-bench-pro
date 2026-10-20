import React, { useEffect, useMemo, useState } from 'react';
import { fetchInvestmentPlan, planInputFrom, type InvestmentPlan } from '../../services/investmentPlanApi';
import type { CompleteDashboard } from '../../services/completeDashboard';
import type { MoneyProfile } from '../../services/moneyProfile';
import { loadOnboardingRecord } from '../../services/onboarding';
import './investmentPlan.css';

const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

/**
 * "Where to invest, by your profile": the split of the monthly surplus, the matching funds with live NAVs
 * from AMFI, and sector starting points. Rebuilt whenever the answers or the numbers change.
 */
export const InvestmentPlanCard: React.FC<{ profile: MoneyProfile; d: CompleteDashboard }> = ({ profile, d }) => {
  const record = loadOnboardingRecord();
  const input = useMemo(() => planInputFrom(profile, d, record), [profile, d, record]);
  const key = JSON.stringify(input);
  const [plan, setPlan] = useState<InvestmentPlan | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetchInvestmentPlan(JSON.parse(key), controller.signal)
      .then((p) => setPlan(p))
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Fund data is unavailable right now.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [key]);

  return <article className="ip" aria-label="Where to invest, by your profile">
    <header className="ip-head">
      <div>
        <h3>Where to invest, by your profile</h3>
        <p>{plan ? plan.headline : 'Splitting your monthly surplus by how soon you need it and how much risk you accept.'}</p>
      </div>
      {plan && <span className="ip-chip">{plan.band === 'short' ? 'Short term' : plan.band === 'medium' ? 'Medium term' : 'Long term'}</span>}
    </header>

    {loading && !plan && <p className="ip-note" role="status">Checking live fund data…</p>}
    {error && <p className="ip-note is-error" role="alert">{error} The split below still uses your numbers.</p>}

    {plan && <>
      {plan.fixFirst && <p className="ip-callout">{plan.fixFirst}</p>}
      <p className="ip-sub">Monthly to invest: <b>{inr(plan.monthlyToInvest)}</b></p>

      <ul className="ip-split">
        {plan.allocation.map((row) => <li key={row.key}>
          <div className="ip-split-top"><b>{row.label}</b><span>{row.percent}% · {inr(row.monthly)}/mo</span></div>
          <div className="ip-bar" aria-hidden="true"><i style={{ width: `${row.percent}%` }}/></div>
          <small>{row.reason}</small>
        </li>)}
      </ul>

      {plan.funds.length > 0 && <>
        <h4 className="ip-h4">Funds that match this split</h4>
        <div className="ip-funds">
          {plan.funds.map((f) => <div key={f.code} className="ip-fund">
            <b>{f.name}</b>
            <small>{f.house} · {f.category}</small>
            <dl>
              <div><dt>NAV</dt><dd>₹{f.nav.toFixed(2)} <em>({f.navDate})</em></dd></div>
              <div><dt>1-year return</dt><dd>{pct(f.oneYear)}</dd></div>
              <div><dt>3-year return (yearly)</dt><dd>{pct(f.threeYear)}</dd></div>
            </dl>
          </div>)}
        </div>
      </>}

      {plan.sectors.length > 0 && <>
        <h4 className="ip-h4">Sectors to research first</h4>
        <ul className="ip-sectors">
          {plan.sectors.map((s) => <li key={s.name}><b>{s.name}</b><span>{s.why}</span>{s.check.length > 0 && <small>Check: {s.check.join(' · ')}</small>}</li>)}
        </ul>
        <p className="ip-note">These are starting points for your own research, not stock picks. Ask a SEBI-registered adviser before buying any single company.</p>
      </>}

      <ul className="ip-notes">{plan.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      <p className="ip-src">Sources: {plan.sources.join(' · ')}. Generated {new Date(plan.generatedAt).toLocaleDateString('en-IN')}.</p>
    </>}
  </article>;
};
