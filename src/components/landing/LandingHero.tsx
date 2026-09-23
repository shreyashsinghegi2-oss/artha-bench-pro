import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { ArrowRight, Calculator, FileText, ShieldAlert } from 'lucide-react';
import { compareTaxRegimes } from '../../services/indiaTaxEngine';
import { createDefaultTaxProfile } from '../../services/taxWorkspaceStorage';
import './landingHero.css';

const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

/** Worked example shown in the preview. Figures come from the app's FY 2025-26 tax engine. */
const EXAMPLE = { income: 1_200_000, c80: 150_000, d80: 25_000 };

function useExampleTax() {
  return useMemo(() => {
    const now = new Date().toISOString();
    const result = compareTaxRegimes(
      [{ id: 'hero-salary', type: 'Salary', amount: EXAMPLE.income / 12, currency: 'INR', frequency: 'Monthly', description: 'Salary', taxStatus: 'Pre-tax', startDate: now.slice(0, 10), tags: [], createdAt: now, updatedAt: now }],
      { ...createDefaultTaxProfile(), taxRegime: 'compare' },
      [
        { id: 'hero-80c', type: '80c', amount: EXAMPLE.c80, description: '80C', status: 'added', createdAt: now },
        { id: 'hero-80d', type: 'health-insurance', amount: EXAMPLE.d80, description: '80D', status: 'added', createdAt: now },
      ],
      [],
    );
    const pick = (r: typeof result.old) => ({
      taxable: Number(r.taxableIncome),
      beforeRebate: Number(r.slabTax) + Number(r.rebate),
      rebate: Number(r.rebate),
      cess: Number(r.cess),
      total: Number(r.totalTaxLiability),
    });
    return { old: pick(result.old), new: pick(result.new) };
  }, []);
}

type Stage = 0 | 1 | 2 | 3 | 4;
/** Reveal timings (ms): caret, then Answer → Assumptions → Evidence → Verify. Ends before 1.2s. */
const STEPS: Array<[Stage, number]> = [[1, 380], [2, 560], [3, 740], [4, 920]];

const Reveal: React.FC<{ show: boolean; reduced: boolean; children: React.ReactNode; className?: string }> = ({ show, reduced, children, className }) => (
  <motion.div className={className} initial={false} animate={show || reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }} transition={{ duration: reduced ? 0 : 0.26, ease: [0.2, 0.7, 0.2, 1] }}>
    {children}
  </motion.div>
);

const ProductPreview: React.FC = () => {
  const tax = useExampleTax();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduced = Boolean(useReducedMotion());
  const [stage, setStage] = useState<Stage>(0);
  const [tab, setTab] = useState<'calc' | 'sources'>('calc');

  useEffect(() => {
    if (!inView) return;
    if (reduced) { setStage(4); return; }
    const timers = STEPS.map(([s, ms]) => window.setTimeout(() => setStage(s), ms));
    return () => timers.forEach(window.clearTimeout);
  }, [inView, reduced]);

  const max = Math.max(tax.old.total, tax.new.total, 1);
  const width = (v: number) => `${Math.max(1.5, (v / max) * 100)}%`;
  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next = e.key === 'Home' ? 'calc' : e.key === 'End' ? 'sources' : tab === 'calc' ? 'sources' : 'calc';
    setTab(next);
    // Roving focus: the selected tab is the one that holds keyboard focus.
    document.getElementById(next === 'calc' ? 'hx-tab-calc' : 'hx-tab-sources')?.focus();
  };

  return <figure ref={ref} className="hx-window" aria-label="Product preview: a sample answer to a tax-regime question">
    <div className="hx-bar">
      <span className="hx-dots" aria-hidden="true"><i/><i/><i/></span>
      <span className="hx-bar-title">ArthaMind · Tax question</span>
      <span className="hx-sample">Sample</span>
    </div>

    <div className="hx-body">
      <div className="hx-question">
        <small>Question</small>
        <p>Should I choose the old or new tax regime?{inView && stage === 0 && !reduced && <span className="hx-caret" aria-hidden="true"/>}</p>
      </div>

      <Reveal show={stage >= 1} reduced={reduced} className="hx-block">
        <div className="hx-status"><span className="hx-status-dot" aria-hidden="true"/>Needs your numbers</div>
        <p className="hx-answer">It depends on your deductions. In this example the new regime costs less. Large HRA or home-loan interest can make the old regime cheaper.</p>
        <div className="hx-compare" role="img" aria-label={`Example tax: old regime ${inr(tax.old.total)}, new regime ${inr(tax.new.total)}`}>
          <div><span>Old regime</span><i><b style={{ width: width(tax.old.total) }}/></i><em>{inr(tax.old.total)}</em></div>
          <div className="hx-win"><span>New regime</span><i><b style={{ width: width(tax.new.total) }}/></i><em>{inr(tax.new.total)}</em></div>
        </div>
      </Reveal>

      <Reveal show={stage >= 2} reduced={reduced} className="hx-block">
        <h3 className="hx-label">Assumptions</h3>
        <dl className="hx-assume">
          <div><dt>Annual income</dt><dd>{inr(EXAMPLE.income)} <small>example</small></dd></div>
          <div><dt>Deductions</dt><dd>{inr(EXAMPLE.c80 + EXAMPLE.d80)} <small>80C + 80D</small></dd></div>
          <div><dt>Financial year</dt><dd>FY 2025-26</dd></div>
        </dl>
      </Reveal>

      <Reveal show={stage >= 3} reduced={reduced} className="hx-block">
        <div className="hx-tabs" role="tablist" aria-label="Evidence">
          <button type="button" role="tab" id="hx-tab-calc" aria-selected={tab === 'calc'} aria-controls="hx-panel" tabIndex={tab === 'calc' ? 0 : -1} onKeyDown={onTabKey} onClick={() => setTab('calc')}><Calculator size={13} aria-hidden="true"/>Calculation</button>
          <button type="button" role="tab" id="hx-tab-sources" aria-selected={tab === 'sources'} aria-controls="hx-panel" tabIndex={tab === 'sources' ? 0 : -1} onKeyDown={onTabKey} onClick={() => setTab('sources')}><FileText size={13} aria-hidden="true"/>Sources</button>
        </div>
        <div id="hx-panel" role="tabpanel" aria-labelledby={tab === 'calc' ? 'hx-tab-calc' : 'hx-tab-sources'} className="hx-panel">
          {tab === 'calc'
            ? <ul className="hx-calc">
                <li><span>Old</span>{inr(tax.old.taxable)} taxable → {inr(tax.old.beforeRebate)} + {inr(tax.old.cess)} cess</li>
                <li><span>New</span>{inr(tax.new.taxable)} taxable → {inr(tax.new.beforeRebate)} − {inr(tax.new.rebate)} rebate (87A)</li>
              </ul>
            : <div className="hx-chips">
                <span>Income-tax slabs, FY 2025-26</span><span>Section 87A rebate</span><span>Standard deduction</span><span>Sections 80C and 80D</span>
              </div>}
        </div>
      </Reveal>

      <Reveal show={stage >= 4} reduced={reduced} className="hx-verify">
        <ShieldAlert size={15} aria-hidden="true"/>
        <p><b>Verify before acting.</b> HRA and home-loan interest are not included. Check against your Form 16 or with a CA.</p>
      </Reveal>
    </div>
  </figure>;
};

/**
 * Landing hero: a short, plain-language pitch on the left and a calm product preview on the right that
 * shows the core loop: ask → inspect → verify.
 */
export const LandingHero: React.FC<{ onSample: () => void; onExplore: () => void }> = ({ onSample, onExplore }) => {
  const reduced = useReducedMotion();
  const item = (i: number) => (reduced ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.08 + i * 0.1, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number] } });

  return <section className="hx" aria-labelledby="hx-title">
    <div className="hx-wrap">
      <div className="hx-copy">
        <motion.p className="hx-eyebrow" {...item(0)}>Financial intelligence you can inspect</motion.p>
        <motion.h1 id="hx-title" {...item(1)}>Make financial decisions with the evidence visible.</motion.h1>
        <motion.p className="hx-lead" {...item(2)}>Ask about taxes, EMIs, goals, or markets. ArthaMind shows its assumptions, calculations, sources, and what still needs verification.</motion.p>
        <motion.div className="hx-ctas" {...item(3)}>
          <button type="button" className="hx-btn hx-btn-primary" onClick={onSample}>Try a sample analysis <ArrowRight size={16} aria-hidden="true"/></button>
          <button type="button" className="hx-btn hx-btn-secondary" onClick={onExplore}>Explore the workspace</button>
        </motion.div>
        <motion.p className="hx-trust" {...item(4)}>Sources visible <span aria-hidden="true">·</span> Assumptions stated <span aria-hidden="true">·</span> Educational use</motion.p>
      </div>
      <motion.div className="hx-visual" {...item(2)}>
        <ProductPreview/>
      </motion.div>
    </div>
  </section>;
};
