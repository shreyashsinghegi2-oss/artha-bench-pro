import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { COURSE_PRESETS, planEducationGoal, type EducationGoal } from '../../services/lifePlanners';
import { Bars, Card, Field, inr, Kpi, pct, PlanAI, PlannerHeader, useStoredState, type Tone } from './plannerKit';

interface EduState { childName: string; childAge: number; annualReturn: number; stepUp: number; goals: Array<EducationGoal & { presetId: string }> }
const goalFrom = (presetId: string): EducationGoal & { presetId: string } => {
  const c = COURSE_PRESETS.find((x) => x.id === presetId) ?? COURSE_PRESETS[0];
  return { id: `${c.id}-${Math.random().toString(36).slice(2, 7)}`, presetId: c.id, label: c.label, costToday: c.costToday, startAge: c.startAge, inflation: c.inflation, savedSoFar: 0 };
};
const initial = (): EduState => ({ childName: '', childAge: 5, annualReturn: 0.11, stepUp: 0.05, goals: [goalFrom('btech-india'), goalFrom('ms-us')] });
const COLORS = ['#059669', '#2563eb', '#7c3aed', '#d97706', '#0891b2'];

/** Child education planner: bachelors, masters and professional courses in India or abroad, each a goal with its own SIP. */
export const EducationPlannerView: React.FC = () => {
  const [s, set, reset] = useStoredState<EduState>('arthamind-plan-education-v1', initial);
  const plans = useMemo(() => s.goals.map((g) => planEducationGoal(g, s.childAge, s.annualReturn, s.stepUp)), [s]);
  const totalFuture = plans.reduce((a, p) => a + p.futureCost, 0);
  const totalSip = plans.reduce((a, p) => a + p.monthlySip, 0);
  const totalLump = plans.reduce((a, p) => a + p.lumpSumToday, 0);
  const funded = totalFuture > 0 ? plans.reduce((a, p) => a + Math.min(p.futureCost, p.savingsGrowTo), 0) / totalFuture : 1;
  const nearest = plans.filter((p) => p.years > 0).sort((a, b) => a.years - b.years)[0];
  const who = s.childName.trim() || 'your child';
  const updateGoal = (id: string, patch: Partial<EducationGoal & { presetId: string }>) => set({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  const summary = [
    `Child: ${who}, age ${s.childAge}. Expected return ${pct(s.annualReturn, 1)}, SIP step-up ${pct(s.stepUp)} a year.`,
    ...plans.map((p) => `${p.label}: costs ${inr(p.costToday)} today, starts at age ${p.startAge} (in ${p.years} years), education inflation ${pct(p.inflation, 1)} → ${inr(p.futureCost)} then; saved ${inr(p.savedSoFar)} grows to ${inr(p.savingsGrowTo)}; SIP needed ${inr(p.monthlySip)} a month or ${inr(p.lumpSumToday)} today${p.sipIfDelayed3y ? `; if started 3 years later SIP ${inr(p.sipIfDelayed3y)}` : ''}.`),
    `Total future cost ${inr(totalFuture)}; total SIP ${inr(totalSip)} a month.`,
  ].join('\n');

  return <div className="pk">
    <PlannerHeader kicker="Child education planner" title={`Plan ${who === 'your child' ? "your child's" : `${who}'s`} education, from bachelors to masters`} text="Pick the courses (India or abroad), and see what they will cost when your child gets there, and the monthly SIP that pays for each one. Costs are indicative; replace them with your target college's fees." onReset={reset}/>
    <div className="pk-layout">
      <aside className="pk-inputs" aria-label="Your inputs">
        <h2>Child</h2>
        <label className="pk-field"><span className="pk-label">Child's name <small>optional</small></span><span className="pk-input"><input value={s.childName} onChange={(e) => set({ childName: e.target.value.slice(0, 30) })} placeholder="e.g. Aarav"/></span></label>
        <Field label="Child's age now" kind="num" value={s.childAge} min={0} max={21} onChange={(v) => set({ childAge: Math.round(v) })}/>
        <h2>Courses</h2>
        <div className="pk-goals">{s.goals.map((g, idx) => <div key={g.id} className="pk-goal">
          <div className="pk-goal-top">
            <select className="pk-select" value={g.presetId} aria-label="Course" onChange={(e) => { const c = COURSE_PRESETS.find((x) => x.id === e.target.value)!; updateGoal(g.id, { presetId: c.id, label: c.label, costToday: c.costToday, startAge: c.startAge, inflation: c.inflation }); }}>
              {(['Bachelors', 'Professional', 'Masters'] as const).map((lvl) => <optgroup key={lvl} label={lvl}>{COURSE_PRESETS.filter((c) => c.level === lvl).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>)}
            </select>
            {s.goals.length > 1 && <button type="button" onClick={() => set({ goals: s.goals.filter((x) => x.id !== g.id) })} aria-label="Remove course"><Trash2 size={14}/></button>}
          </div>
          <small className="pk-note" style={{ color: COLORS[idx % COLORS.length] }}>{COURSE_PRESETS.find((c) => c.id === g.presetId)?.note}</small>
          <Field label="Total cost today" value={g.costToday} max={3_00_00_000} onChange={(v) => updateGoal(g.id, { costToday: v })}/>
          <Field label="Starts at child's age" kind="num" value={g.startAge} min={s.childAge} max={30} onChange={(v) => updateGoal(g.id, { startAge: Math.round(v) })}/>
          <Field label="Education inflation" kind="pct" value={g.inflation} min={0.03} max={0.15} onChange={(v) => updateGoal(g.id, { inflation: v })}/>
          <Field label="Already saved for this" value={g.savedSoFar} max={1_00_00_000} onChange={(v) => updateGoal(g.id, { savedSoFar: v })}/>
        </div>)}</div>
        {s.goals.length < 5 && <button type="button" className="pk-add" onClick={() => set({ goals: [...s.goals, goalFrom('mba-india')] })}><Plus size={14}/> Add a course</button>}
        <h2>Investing</h2>
        <Field label="Expected return" kind="pct" value={s.annualReturn} min={0.05} max={0.15} hint="equity mix, lower near the date" onChange={(v) => set({ annualReturn: v })}/>
        <Field label="Yearly SIP step-up" kind="pct" value={s.stepUp} max={0.2} onChange={(v) => set({ stepUp: v })}/>
      </aside>

      <main className="pk-main">
        <section className="pk-kpis">
          <Kpi label="Total cost when needed" value={inr(totalFuture)} note={`${plans.length} course${plans.length > 1 ? 's' : ''}`} tone="info" big/>
          <Kpi label="Monthly SIP for all goals" value={`${inr(totalSip)}/mo`} note={`steps up ${pct(s.stepUp)} a year`} tone={totalSip > 0 ? 'warn' : 'good'} big/>
          <Kpi label="Or invest today" value={inr(totalLump)} note="one-time lump sum" tone="info" big/>
          <Kpi label="Already funded" value={pct(funded)} note={nearest ? `first goal in ${nearest.years} years` : 'all goals due'} tone={funded >= 0.8 ? 'good' : funded >= 0.3 ? 'warn' : 'bad'} big/>
        </section>

        <Card title="Cost today vs cost when your child starts" tone="info" sub="Education costs rise faster than general prices, so start early.">
          <Bars rows={plans.flatMap((p, i) => [{ label: `${p.label} · today`, value: p.costToday, color: '#94a3b8' }, { label: `${p.label} · in ${p.years} yrs`, value: p.futureCost, color: COLORS[i % COLORS.length] }])}/>
        </Card>

        <div className="pk-grid2">{plans.map((p, i) => { const tone: Tone = p.gap <= 0 ? 'good' : p.years <= 3 ? 'bad' : 'warn'; return <Card key={p.id} title={p.label} tone={tone} status={p.gap <= 0 ? 'Fully funded' : p.years <= 3 ? 'Urgent' : 'On plan'} sub={`Starts at age ${p.startAge}, in ${p.years} years`}>
          <ul className="pk-kv">
            <li><span>Cost then</span><b style={{ color: COLORS[i % COLORS.length] }}>{inr(p.futureCost)}</b></li>
            <li><span>Your savings grow to</span><b className="pos">{inr(p.savingsGrowTo)}</b></li>
            <li><span>Monthly SIP needed</span><b className={p.gap > 0 ? 'neg' : 'pos'}>{p.gap > 0 ? `${inr(p.monthlySip)}/mo` : 'Nothing more'}</b></li>
            <li><span>Or lump sum today</span><b>{inr(p.lumpSumToday)}</b></li>
            {p.sipIfDelayed3y && <li><span>If you wait 3 years</span><b className="neg">{inr(p.sipIfDelayed3y)}/mo</b></li>}
          </ul>
        </Card>; })}</div>

        <Card title="Good practice" tone="good" status="Tips">
          <ul className="pk-tips">
            <li className="good">Use equity index or flexi-cap funds while the goal is more than 5 years away; move to debt funds or FDs over the last 3 years.</li>
            <li className="info">For a daughter under 10, Sukanya Samriddhi Yojana gives a government-backed, tax-free return for part of the goal.</li>
            <li className="warn">For study abroad, the rupee usually weakens against the dollar and pound, so plan with a higher inflation rate.</li>
            <li className="info">An education loan can cover part of a masters; the maths above shows how much you avoid borrowing.</li>
          </ul>
        </Card>

        <PlanAI title="child education plan" summary={summary} questions={['Review my education plan', 'Current fees for these courses?', 'Which funds or schemes to use?', 'Loan vs saving for the masters?']}/>
        <p className="pk-note">Future cost = cost today × (1 + education inflation)^years. SIPs compound monthly with a yearly step-up. Course costs are indicative planning figures; ask the AI for current fees. Educational planning, not investment advice.</p>
      </main>
    </div>
  </div>;
};
