import React, { useMemo } from 'react';
import { loadMoneyProfile } from '../../services/moneyProfile';
import { JOB_SWITCH_DEFAULTS, planJobSwitch, type JobSwitchInputs } from '../../services/lifePlanners';
import { Bars, Card, Field, inr, Kpi, pct, PlanAI, PlannerHeader, useStoredState, type Tone } from './plannerKit';

function initial(): JobSwitchInputs {
  const p = loadMoneyProfile();
  return p ? { ...JOB_SWITCH_DEFAULTS, currentCtc: p.annualSalary, offeredCtc: Math.round(p.annualSalary * 1.3 / 10_000) * 10_000, currentMonthlyExpenses: p.monthlyExpenses, newCityMonthlyExpenses: p.monthlyExpenses } : JOB_SWITCH_DEFAULTS;
}

const VERDICT: Record<'strong' | 'fair' | 'weak' | 'loss', { tone: Tone; title: string; text: string }> = {
  strong: { tone: 'good', title: 'Strong offer', text: 'After tax and living costs you keep 20% or more extra each month.' },
  fair: { tone: 'info', title: 'Fair offer', text: 'A real gain of 8–20% a month after tax and living costs.' },
  weak: { tone: 'warn', title: 'Weak offer', text: 'The real gain is under 8% a month; negotiate or weigh the role and growth instead.' },
  loss: { tone: 'bad', title: 'You would be worse off', text: 'Higher living costs or lower take-home cancel the raise.' },
};

/** Job switch planner: CTC to take-home for both offers, living-cost change, switching costs and break-even. */
export const JobSwitchPlannerView: React.FC = () => {
  const [i, set, reset] = useStoredState<JobSwitchInputs>('arthamind-plan-jobswitch-v1', initial);
  const p = useMemo(() => planJobSwitch(i), [i]);
  const v = VERDICT[p.verdict];
  const summary = [
    `Current CTC ${inr(i.currentCtc)} (${pct(i.currentVariableShare)} variable); offer ${inr(i.offeredCtc)} (${pct(i.offeredVariableShare)} variable); basic ${pct(i.basicShare)} of CTC.`,
    `Take-home: now ${inr(p.current.monthlyTakeHome)} a month, offer ${inr(p.offered.monthlyTakeHome)} a month (tax ${inr(p.current.tax)} vs ${inr(p.offered.tax)} a year).`,
    `Living costs: ${inr(i.currentMonthlyExpenses)} now vs ${inr(i.newCityMonthlyExpenses)} after the move.`,
    `Joining bonus ${inr(i.joiningBonus)}, relocation ${inr(i.relocationCost)}, notice buyout ${inr(i.noticeBuyout)}, ${i.gapMonths} months without pay, ${i.yearsAtCurrentJob} years at current job (gratuity forgone ${inr(p.gratuityForgone)}).`,
    `Result: CTC hike ${pct(p.hikePct, 1)}; real monthly gain ${inr(p.netMonthlyGain)}; switching costs ${inr(p.switchingCosts)}; first-year net ${inr(p.firstYearNetGain)}; break-even ${p.breakEvenMonths == null ? 'never' : `${p.breakEvenMonths} months`}; verdict ${v.title}.`,
  ].join('\n');

  return <div className="pk">
    <PlannerHeader kicker="Job switch planner" title="Is the new offer really worth it?" text="A 30% hike on CTC is not 30% more in your pocket. This works out take-home after tax and PF for both jobs, adjusts for the new city's living costs and the cost of switching, and tells you how soon the move pays off." onReset={reset}/>
    <div className="pk-layout">
      <aside className="pk-inputs" aria-label="Your inputs">
        <h2>Salaries</h2>
        <Field label="Current CTC (yearly)" value={i.currentCtc} max={1_00_00_000} onChange={(x) => set({ currentCtc: x })}/>
        <Field label="Offered CTC (yearly)" value={i.offeredCtc} max={1_00_00_000} onChange={(x) => set({ offeredCtc: x })}/>
        <Field label="Basic pay share of CTC" kind="pct" value={i.basicShare} min={0.25} max={0.6} hint="drives PF and gratuity" onChange={(x) => set({ basicShare: x })}/>
        <Field label="Variable pay now" kind="pct" value={i.currentVariableShare} max={0.4} onChange={(x) => set({ currentVariableShare: x })}/>
        <Field label="Variable pay in offer" kind="pct" value={i.offeredVariableShare} max={0.4} onChange={(x) => set({ offeredVariableShare: x })}/>
        <h2>Living costs</h2>
        <Field label="Monthly expenses now" value={i.currentMonthlyExpenses} max={5_00_000} onChange={(x) => set({ currentMonthlyExpenses: x })}/>
        <Field label="Monthly expenses after the move" hint="rent, commute" value={i.newCityMonthlyExpenses} max={5_00_000} onChange={(x) => set({ newCityMonthlyExpenses: x })}/>
        <h2>Switching</h2>
        <Field label="Joining bonus" value={i.joiningBonus} max={20_00_000} onChange={(x) => set({ joiningBonus: x })}/>
        <Field label="Relocation cost" value={i.relocationCost} max={10_00_000} onChange={(x) => set({ relocationCost: x })}/>
        <Field label="Notice period buyout" value={i.noticeBuyout} max={10_00_000} onChange={(x) => set({ noticeBuyout: x })}/>
        <Field label="Months without pay" kind="num" value={i.gapMonths} max={12} onChange={(x) => set({ gapMonths: Math.round(x) })}/>
        <Field label="Years at current job" kind="num" value={i.yearsAtCurrentJob} max={30} hint="gratuity after 5" onChange={(x) => set({ yearsAtCurrentJob: x })}/>
      </aside>

      <main className="pk-main">
        <div className={`pk-verdict ${v.tone}`}><div><b>{v.title}</b><p>{v.text}</p></div></div>
        <section className="pk-kpis">
          <Kpi label="CTC hike" value={pct(p.hikePct, 1)} note={`${inr(i.offeredCtc - i.currentCtc)} a year`} tone={p.hikePct > 0 ? 'info' : 'bad'} big/>
          <Kpi label="Real monthly gain" value={inr(p.netMonthlyGain)} note="after tax, PF and living costs" tone={p.netMonthlyGain > 0 ? 'good' : 'bad'} big/>
          <Kpi label="First-year net gain" value={inr(p.firstYearNetGain)} note={`after ${inr(p.switchingCosts)} switching costs`} tone={p.firstYearNetGain > 0 ? 'good' : 'bad'} big/>
          <Kpi label="Pays for itself in" value={p.breakEvenMonths == null ? 'Never' : p.breakEvenMonths === 0 ? 'Day one' : `${p.breakEvenMonths} months`} tone={p.breakEvenMonths == null ? 'bad' : p.breakEvenMonths <= 6 ? 'good' : 'warn'} big/>
        </section>

        <div className="pk-grid2">
          <Card title="Take-home, side by side" tone="info" sub="Monthly, after income tax (lower of the two regimes), PF and professional tax">
            <Bars rows={[{ label: 'Take-home now', value: p.current.monthlyTakeHome, color: '#94a3b8' }, { label: 'Take-home in offer', value: p.offered.monthlyTakeHome, color: '#059669' }, { label: 'Living-cost change', value: p.costOfLivingChangeMonthly, color: p.costOfLivingChangeMonthly > 0 ? '#dc2626' : '#059669', note: p.costOfLivingChangeMonthly > 0 ? 'more' : p.costOfLivingChangeMonthly < 0 ? 'less' : 'no change' }]}/>
          </Card>
          <Card title="Where the CTC goes (yearly)" tone="info">
            <ul className="pk-kv">
              <li><span></span><b>Now · Offer</b></li>
              <li><span>Income tax</span><b className="neg">{inr(p.current.tax)} · {inr(p.offered.tax)}</b></li>
              <li><span>PF (you + employer)</span><b>{inr(p.current.employeePf + p.current.employerPf)} · {inr(p.offered.employeePf + p.offered.employerPf)}</b></li>
              <li><span>Take-home</span><b className="pos">{inr(p.current.annualTakeHome)} · {inr(p.offered.annualTakeHome)}</b></li>
              <li><span>Fixed monthly (excl. variable)</span><b>{inr(p.current.monthlyFixedTakeHome)} · {inr(p.offered.monthlyFixedTakeHome)}</b></li>
            </ul>
          </Card>
        </div>

        <Card title="Before you accept" tone={v.tone} status={v.title}>
          <ul className="pk-tips">
            {p.gratuityForgone > 0 && <li className="bad">You are close to 5 years: leaving now forfeits about <b>{inr(p.gratuityForgone)}</b> of gratuity. Consider timing the move after 5 years.</li>}
            {i.offeredVariableShare > i.currentVariableShare && <li className="warn">More of the offer is variable ({pct(i.offeredVariableShare)}). Ask how much was actually paid out last year.</li>}
            {p.costOfLivingChangeMonthly > 0 && <li className="warn">The move costs {inr(p.costOfLivingChangeMonthly)} more a month to live. Negotiate a relocation allowance or a higher fixed pay.</li>}
            <li className="info">Keep 3–6 months of expenses ({inr(i.newCityMonthlyExpenses * 3)}–{inr(i.newCityMonthlyExpenses * 6)}) as a buffer during the switch.</li>
            <li className="good">Transfer your EPF to the new employer instead of withdrawing it, so it keeps compounding tax-free.</li>
          </ul>
        </Card>

        <PlanAI title="job switch decision" summary={summary} questions={['Should I take this offer?', 'What salary should I negotiate?', 'Typical pay for my role and city?', 'How do I handle PF and gratuity?']}/>
        <p className="pk-note">Take-home uses the FY 2025-26 tax rules (lower of old and new regime, no extra deductions), 12% PF on basic from both sides and ₹2,400 professional tax. Actual salary structures vary; check your offer letter. Educational estimate, not tax advice.</p>
      </main>
    </div>
  </div>;
};
