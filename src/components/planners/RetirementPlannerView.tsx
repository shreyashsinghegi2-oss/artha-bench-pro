import React, { useMemo } from 'react';
import { loadMoneyProfile } from '../../services/moneyProfile';
import { planRetirement, RETIREMENT_DEFAULTS, type RetirementInputs } from '../../services/lifePlanners';
import { AreaChart, Bars, Card, Field, inr, Kpi, pct, PlanAI, PlannerHeader, useStoredState, type Tone } from './plannerKit';

function initial(): RetirementInputs {
  const p = loadMoneyProfile();
  return p ? { ...RETIREMENT_DEFAULTS, age: p.age, retireAge: p.retireAge ?? 60, monthlyExpensesToday: p.monthlyExpenses, currentSavings: p.investments } : RETIREMENT_DEFAULTS;
}

/** Retirement planner: corpus needed, where the current plan lands, the SIP to close the gap and how long the money lasts. */
export const RetirementPlannerView: React.FC = () => {
  const [i, set, reset] = useStoredState<RetirementInputs>('arthamind-plan-retirement-v1', initial);
  const safe = { ...i, retireAge: Math.max(i.age + 1, i.retireAge), lifeExpectancy: Math.max(Math.max(i.age + 1, i.retireAge) + 1, i.lifeExpectancy) };
  const p = useMemo(() => planRetirement(safe), [JSON.stringify(safe)]); // eslint-disable-line react-hooks/exhaustive-deps
  const tone: Tone = p.onTrackPct >= 1 ? 'good' : p.onTrackPct >= 0.6 ? 'warn' : 'bad';
  const lastsTone: Tone = p.moneyLastsToAge === null ? 'good' : p.moneyLastsToAge >= safe.lifeExpectancy - 5 ? 'warn' : 'bad';
  const summary = [
    `Age ${safe.age}, retiring at ${safe.retireAge}, planning to age ${safe.lifeExpectancy}.`,
    `Monthly expenses today ${inr(safe.monthlyExpensesToday)}; other income at retirement ${inr(safe.otherIncomeToday)} a month (today's value).`,
    `Assumptions: inflation ${pct(safe.inflation, 1)}, return before retirement ${pct(safe.preReturn, 1)}, after ${pct(safe.postReturn, 1)}, SIP step-up ${pct(safe.stepUp)} a year.`,
    `Savings now ${inr(safe.currentSavings)}; SIP ${inr(safe.monthlySip)} a month.`,
    `Result: expenses at retirement ${inr(p.monthlyExpenseAtRetirement)} a month; corpus needed ${inr(p.corpusNeeded)}; projected ${inr(p.projectedCorpus)} (${pct(p.onTrackPct)} of target); gap ${inr(p.gap)}.`,
    `To close the gap: extra SIP ${inr(p.extraSipNeeded)} a month (total ${inr(p.totalSipNeeded)}), or ${inr(p.lumpSumTodayForGap)} invested today.`,
    `On the current plan the money ${p.moneyLastsToAge === null ? `lasts beyond age ${safe.lifeExpectancy}` : `runs out at age ${p.moneyLastsToAge}`}.`,
  ].join('\n');

  return <div className="pk">
    <PlannerHeader kicker="Retirement planner" title="How much do you need to retire, and are you on track?" text="Your corpus is worked out year by year: savings grow until you retire, then inflation-rising expenses are paid from it. Change any number and everything updates instantly." onReset={reset}/>
    <div className="pk-layout">
      <aside className="pk-inputs" aria-label="Your inputs">
        <h2>You</h2>
        <Field label="Current age" kind="num" value={safe.age} min={18} max={70} onChange={(v) => set({ age: Math.round(v) })}/>
        <Field label="Retire at" kind="num" value={safe.retireAge} min={35} max={75} onChange={(v) => set({ retireAge: Math.round(v) })}/>
        <Field label="Plan until age" kind="num" value={safe.lifeExpectancy} min={70} max={100} hint="life expectancy" onChange={(v) => set({ lifeExpectancy: Math.round(v) })}/>
        <h2>Money</h2>
        <Field label="Monthly expenses today" value={safe.monthlyExpensesToday} max={5_00_000} onChange={(v) => set({ monthlyExpensesToday: v })}/>
        <Field label="Retirement savings now" hint="EPF, PPF, NPS, funds" value={safe.currentSavings} max={5_00_00_000} onChange={(v) => set({ currentSavings: v })}/>
        <Field label="Monthly SIP / contribution" value={safe.monthlySip} max={3_00_000} onChange={(v) => set({ monthlySip: v })}/>
        <Field label="Yearly SIP step-up" kind="pct" value={safe.stepUp} max={0.25} onChange={(v) => set({ stepUp: v })}/>
        <Field label="Pension / rent at retirement" hint="per month, today's ₹" value={safe.otherIncomeToday} max={3_00_000} onChange={(v) => set({ otherIncomeToday: v })}/>
        <h2>Assumptions</h2>
        <Field label="Inflation" kind="pct" value={safe.inflation} min={0.02} max={0.12} onChange={(v) => set({ inflation: v })}/>
        <Field label="Return until retirement" kind="pct" value={safe.preReturn} min={0.04} max={0.16} hint="equity-heavy mix" onChange={(v) => set({ preReturn: v })}/>
        <Field label="Return after retirement" kind="pct" value={safe.postReturn} min={0.03} max={0.12} hint="safer mix" onChange={(v) => set({ postReturn: v })}/>
      </aside>

      <main className="pk-main">
        <section className="pk-kpis">
          <Kpi label="Corpus needed at retirement" value={inr(p.corpusNeeded)} note={`${p.yearsInRetirement} years of expenses`} tone="info" big/>
          <Kpi label="You are on track for" value={inr(p.projectedCorpus)} note={`${pct(p.onTrackPct)} of the target`} tone={tone} big/>
          <Kpi label={p.gap > 0 ? 'Extra SIP needed' : 'Surplus'} value={p.gap > 0 ? `${inr(p.extraSipNeeded)}/mo` : inr(p.projectedCorpus - p.corpusNeeded)} note={p.gap > 0 ? `total ${inr(p.totalSipNeeded)}/mo` : 'you are ahead'} tone={p.gap > 0 ? 'warn' : 'good'} big/>
          <Kpi label="Money lasts until" value={p.moneyLastsToAge === null ? `${safe.lifeExpectancy}+` : `age ${p.moneyLastsToAge}`} note={p.moneyLastsToAge === null ? 'the whole plan' : `${safe.lifeExpectancy - p.moneyLastsToAge} years short`} tone={lastsTone} big/>
        </section>

        <Card title="Your retirement money, year by year" tone={tone} status={p.gap > 0 ? `${pct(1 - p.onTrackPct)} short` : 'On track'} sub="Green while you save, blue while you spend in retirement. Hover to see any age.">
          <AreaChart points={p.series.map((s) => ({ x: s.age, y: s.balance, phase: s.phase }))} colors={{ save: '#059669', spend: '#2563eb' }} xLabel={(x) => `Age ${x}`} yLabel={inr} marker={p.moneyLastsToAge ? { x: p.moneyLastsToAge, label: `Runs out at ${p.moneyLastsToAge}` } : undefined}/>
          <div className="pk-legend"><span><i style={{ background: '#059669' }}/>Saving phase</span><span><i style={{ background: '#2563eb' }}/>Retirement phase</span>{p.moneyLastsToAge && <span><i style={{ background: '#dc2626' }}/>Money runs out</span>}</div>
        </Card>

        <div className="pk-grid2">
          <Card title="Target vs where you are heading" tone={tone}>
            <Bars rows={[{ label: 'Corpus needed', value: p.corpusNeeded, color: '#2563eb' }, { label: 'Projected corpus', value: p.projectedCorpus, color: p.gap > 0 ? '#d97706' : '#059669' }, ...(p.gap > 0 ? [{ label: 'Gap', value: p.gap, color: '#dc2626' }] : [])]}/>
            <ul className="pk-kv">
              <li><span>Expenses at retirement</span><b>{inr(p.monthlyExpenseAtRetirement)}/mo</b></li>
              <li><span>Years to retirement</span><b>{p.yearsToRetire}</b></li>
              <li><span>Lump sum today to close the gap</span><b className={p.gap > 0 ? 'neg' : 'pos'}>{p.gap > 0 ? inr(p.lumpSumTodayForGap) : 'Not needed'}</b></li>
            </ul>
          </Card>
          <Card title="What to do" tone={p.gap > 0 ? 'warn' : 'good'} status={p.gap > 0 ? 'Action needed' : 'Keep going'}>
            <ul className="pk-tips">
              {p.gap > 0 && <li className="warn">Raise your monthly investment by <b>{inr(p.extraSipNeeded)}</b> (to {inr(p.totalSipNeeded)}) and keep the {pct(safe.stepUp)} yearly step-up.</li>}
              {p.gap > 0 && safe.retireAge < 65 && <li className="info">Or retire {Math.min(5, 65 - safe.retireAge)} years later: move the "Retire at" slider to see the effect instantly.</li>}
              <li className="info">Use EPF, PPF and NPS for the safe part, and diversified equity index funds for growth until about 5 years before retirement.</li>
              <li className="good">From 5 years before retirement, shift gradually to debt so a market fall does not hit the money you need first.</li>
              <li className="warn">Keep health insurance separate: medical costs in retirement usually rise faster than general inflation.</li>
            </ul>
          </Card>
        </div>

        <PlanAI title="retirement plan" summary={summary} questions={['Review my retirement plan', 'Can I retire 5 years earlier?', 'Which funds and schemes suit this plan?', 'How should my asset mix change with age?']}/>
        <p className="pk-note">Formulas: corpus = present value of inflation-rising yearly expenses (paid at the start of each year) at the post-retirement return; SIPs compound monthly with a yearly step-up. Returns are assumptions, not guarantees. Educational planning, not investment advice.</p>
      </main>
    </div>
  </div>;
};
