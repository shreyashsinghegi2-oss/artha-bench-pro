import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { MONEY_CHECK_ASSUMPTIONS, type MoneyCheckInputs, type MoneyCheckReport } from '../../services/moneyCheck';
import '../landing/moneyCheck.css';

export const pct = (rate: number) => `${Math.round(rate * 1000) / 10}%`;
export const inr = (v: number) => `${v < 0 ? '−' : ''}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`;
export const shortInr = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(1)} L`;
  return inr(v);
};
/** Accepts 85000, 85,000, 85k, 1.2 lakh, 1 cr. Empty → 0; unreadable → NaN. */
export const parseMoney = (value: string) => {
  const clean = value.replace(/[₹,\s]/g, '').toLowerCase();
  if (!clean) return 0;
  const match = clean.match(/^(\d+(?:\.\d+)?)(k|l|lakh|lakhs|lac|cr|crore|crores)?$/);
  if (!match) return Number.NaN;
  const unit = match[2];
  return Number(match[1]) * (unit === 'k' ? 1e3 : unit?.startsWith('l') ? 1e5 : unit?.startsWith('c') ? 1e7 : 1);
};

export function moneyAskPrompt(inputs: MoneyCheckInputs, report: MoneyCheckReport): string {
  return [
    'Review my money report and tell me what to do first, in plain language.',
    `Age ${inputs.age}, salary ${inr(inputs.annualSalary)}/yr, take-home ${inr(report.tax.monthlyTakeHome)}/mo, spending ${inr(inputs.monthlyExpenses)}/mo, EMIs ${inr(inputs.monthlyEmi)}/mo, ${inputs.dependants} dependant(s).`,
    `Verified results: health score ${report.health.score}/100; ${report.tax.better} tax regime saves ${inr(report.tax.saving)}; emergency gap ${inr(report.emergency.gap)}; freedom number ${inr(report.freedom.corpusNeeded)} needing ${inr(report.freedom.monthlySipNeeded)}/mo SIP; term cover gap ${inr(report.protection.termGap)}; health cover gap ${inr(report.protection.healthGap)}.`,
  ].join(' ');
}

const Tile: React.FC<{ label: string; value: string; sub?: string; tone?: 'neg' | 'pos'; how: string; i: number }> = ({ label, value, sub, tone, how, i }) => {
  const [open, setOpen] = useState(false);
  return <motion.div className={`mc-tile ${tone ?? ''}`} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.35 }}>
    <small>{label}</small>
    <motion.b key={value} initial={{ opacity: 0.2, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>{value}</motion.b>
    {sub && <span className="mc-sub">{sub}</span>}
    <button type="button" className="mc-how" aria-expanded={open} onClick={() => setOpen((v) => !v)}>How it’s calculated <ChevronDown size={12}/></button>
    {open && <p className="mc-how-text">{how}</p>}
  </motion.div>;
};

/** The full money report: score, eight result tiles, prioritised actions and an AI hand-off. */
export const MoneyReportView: React.FC<{ report: MoneyCheckReport; onAsk?: () => void; askLabel?: string }> = ({ report, onAsk, askLabel = 'Ask the AI CFO about this report' }) => <>
  <div className="mc-score" aria-live="polite">
    <div className="mc-ring" style={{ '--deg': `${report.health.score * 3.6}deg` } as React.CSSProperties}><b>{report.health.score}</b><span>/100</span></div>
    <div><small>Money health</small><b>{report.health.status}</b><p>{report.health.summary}</p></div>
  </div>
  <div className="mc-tiles">
    <Tile i={0} label="Better tax regime" value={report.tax.better === 'same' ? 'Same either way' : `${report.tax.better === 'new' ? 'New' : 'Old'} · saves ${shortInr(report.tax.saving)}`} sub={`Old ${shortInr(report.tax.oldRegimeTax)} · New ${shortInr(report.tax.newRegimeTax)}`} how="Both regimes use FY 2025-26 slabs, the standard deduction, the section 87A rebate and 4% cess. Your 80C, 80D and NPS amounts count only under the old regime, within their caps. Surcharge applies above ₹50 lakh; HRA and home-loan interest are not included."/>
    <Tile i={1} label="Monthly take-home" value={inr(report.tax.monthlyTakeHome)} sub={`Surplus ${inr(report.cashflow.surplus)}/mo`} tone={report.cashflow.surplus < 0 ? 'neg' : undefined} how="Annual salary minus the lower of the two tax figures, divided by 12. Employee PF and professional tax are not deducted, so your payslip may be slightly lower."/>
    <Tile i={2} label="Freedom number" value={shortInr(report.freedom.corpusNeeded)} sub={`SIP ${inr(report.freedom.monthlySipNeeded)}/mo${report.freedom.freedomAge ? ` · free by ${report.freedom.freedomAge}` : ''}`} how={`Today's spending grown at ${pct(MONEY_CHECK_ASSUMPTIONS.inflation)} inflation to retirement, then funded to age ${MONEY_CHECK_ASSUMPTIONS.lifeExpectancy} with a ${pct(MONEY_CHECK_ASSUMPTIONS.postRetirementReturn)} return while it keeps rising with inflation. Investments grow at ${pct(MONEY_CHECK_ASSUMPTIONS.preRetirementReturn)} before retirement. 'Free by' assumes you invest your whole monthly surplus.`}/>
    <Tile i={3} label="Emergency fund" value={report.emergency.gap > 0 ? `Gap ${shortInr(report.emergency.gap)}` : 'Covered'} sub={`Target ${shortInr(report.emergency.target)} · ${Number.isFinite(report.emergency.months) ? report.emergency.months.toFixed(1) : '∞'} months now`} tone={report.emergency.gap > 0 ? 'neg' : 'pos'} how="Six months of spending plus EMIs, kept in cash, sweep FDs or liquid funds. 'Months now' is your cash and FDs divided by monthly spending plus EMIs."/>
    <Tile i={4} label="Term insurance" value={report.protection.termGap > 0 ? `Gap ${shortInr(report.protection.termGap)}` : report.protection.termCoverNeeded > 0 ? 'Covered' : 'Not essential now'} sub={`Need ${shortInr(report.protection.termCoverNeeded)}`} tone={report.protection.termGap > 0 ? 'neg' : 'pos'} how={`Present value of your household's spending until retirement (rising ${pct(MONEY_CHECK_ASSUMPTIONS.inflation)} a year, discounted at ${pct(MONEY_CHECK_ASSUMPTIONS.protectionDiscountRate)}), plus loans outstanding, minus the cash and investments your family could use. Zero when nobody depends on your income.`}/>
    <Tile i={5} label="Health insurance" value={report.protection.healthGap > 0 ? `Gap ${shortInr(report.protection.healthGap)}` : 'Covered'} sub={`Suggested ${shortInr(report.protection.healthCoverSuggested)}`} tone={report.protection.healthGap > 0 ? 'neg' : 'pos'} how="A rule of thumb for city hospital costs: ₹10 lakh for up to two people, ₹15 lakh for three or four, ₹20 lakh for five or more. A super top-up is the cheapest way to add cover."/>
    <Tile i={6} label="Net worth" value={shortInr(report.netWorth)} tone={report.netWorth < 0 ? 'neg' : undefined} how="Cash and FDs plus investments, minus loans outstanding. Property and gold are not included."/>
    {report.goal && <Tile i={7} label="Your goal" value={`${shortInr(report.goal.futureCost)} then`} sub={`SIP ${inr(report.goal.monthlySip)}/mo`} how={`Today's cost grown at ${pct(MONEY_CHECK_ASSUMPTIONS.inflation)} a year, and the monthly SIP that reaches it at a ${pct(MONEY_CHECK_ASSUMPTIONS.preRetirementReturn)} return.`}/>}
  </div>
  {report.actions.length > 0 && <div className="mc-actions">
    <b>Do these first</b>
    <ol>{report.actions.map((a) => <li key={a.title}><strong>{a.title}</strong><span>{a.detail}</span></li>)}</ol>
  </div>}
  <div className="mc-foot">
    {onAsk && <button type="button" className="mc-ask" onClick={onAsk}><Sparkles size={15}/> {askLabel}</button>}
    <small>Estimates for planning, not tax filing or investment advice. Returns and inflation are assumptions, not guarantees.</small>
  </div>
</>;
