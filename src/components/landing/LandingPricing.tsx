import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import './landingPricing.css';
import { mailto } from '../common/ContactLinks';

type Billing = 'monthly' | 'yearly';
type Price = { amount: string; unit?: string; note?: string };
type Plan = {
  name: string;
  price: Record<Billing, Price>;
  blurb: string;
  yes: string[];
  no?: string[];
  featured?: boolean;
  cta: 'sample' | 'start' | 'sales';
};

const PLANS: Plan[] = [
  {
    name: 'Free',
    price: { monthly: { amount: '₹0', note: 'Free forever' }, yearly: { amount: '₹0', note: 'Free forever' } },
    blurb: 'See where you stand.',
    yes: ['Money health score', 'All 14 calculators', 'Money Check report', 'AI CFO, limited questions'],
    no: ['Tax regime optimiser', 'Portfolio import and XIRR', 'Goal plans'],
    cta: 'sample',
  },
  {
    name: 'Pro',
    price: {
      monthly: { amount: '₹359', unit: '/month', note: 'or ₹3,499 a year' },
      yearly: { amount: '₹3,499', unit: '/year', note: 'Save ₹809 vs monthly' },
    },
    blurb: 'Your full personal CFO for India.',
    yes: [
      'Old vs new tax regime, every deduction',
      'EMI prepayment plans',
      'Portfolio with CAS import and XIRR',
      'Monte Carlo goal plans',
      'Unlimited AI CFO in your language',
    ],
    no: ['Retirement and education abroad'],
    featured: true,
    cta: 'start',
  },
  {
    name: 'Global planner',
    price: {
      monthly: { amount: '$29', unit: '/month', note: 'or $290 a year' },
      yearly: { amount: '$290', unit: '/year', note: 'Save $58 vs monthly' },
    },
    blurb: 'For Indians living and earning abroad.',
    yes: ['Everything in Pro', 'Retirement in India or abroad', 'Child education in India or abroad'],
    cta: 'start',
  },
  {
    name: 'Business',
    price: { monthly: { amount: 'Custom', note: 'Volume pricing' }, yearly: { amount: 'Custom', note: 'Volume pricing' } },
    blurb: 'For NBFCs, HR platforms and API partners.',
    yes: ['EMI intelligence licensing', 'Employee financial wellness', 'Verified-calculation API'],
    cta: 'sales',
  },
];

// Pro at ₹359 a month is ₹4,308 a year. A ₹47,000 tax saving is 10.9 times that.
const ROI = { saving: '₹47,000', cost: '₹4,308', multiple: '10.9×' };

/** Pricing: monthly or yearly, four plans, Pro highlighted with a worked return-on-cost example. */
export const LandingPricing: React.FC<{ onStart: () => void; onSample: () => void }> = ({ onStart, onSample }) => {
  const [billing, setBilling] = useState<Billing>('monthly');
  return (
    <section id="pricing" className="cl-section lp-section cl-reveal-section" aria-labelledby="lp-title">
      <div className="cl-wrap">
        <div className="cl-eyebrow">Pricing</div>
        <h2 id="lp-title">Free to start. Pro when it saves you money.</h2>
        <p className="cl-sub">Pro pays for itself if it finds one missed deduction or one sensible loan prepayment a year.</p>
        <div className="lp-toggle" role="group" aria-label="Billing period">
          {(['monthly', 'yearly'] as const).map((b) => (
            <button key={b} type="button" aria-pressed={billing === b} className={billing === b ? 'on' : ''} onClick={() => setBilling(b)}>
              {b === 'monthly' ? 'Monthly' : 'Yearly'}
              {b === 'yearly' && <em>save up to 18%</em>}
            </button>
          ))}
        </div>
        <div className="lp-grid" data-stagger>
          {PLANS.map((p) => {
            const price = p.price[billing];
            return (
              <article key={p.name} className={`lp-card ${p.featured ? 'lp-featured' : ''}`}>
                {p.featured && <span className="lp-badge">Most popular</span>}
                <h3>{p.name}</h3>
                <p className="lp-price">
                  <b>{price.amount}</b>
                  {price.unit && <span>{price.unit}</span>}
                </p>
                <p className="lp-note">{price.note ?? ' '}</p>
                <p className="lp-blurb">{p.blurb}</p>
                {p.featured && (
                  <div className="lp-roi">
                    <span>Example return</span>
                    <p>
                      A <b>{ROI.saving}</b> tax saving covers a year of Pro ({ROI.cost}) <b>{ROI.multiple}</b> over.
                    </p>
                  </div>
                )}
                <ul>
                  {p.yes.map((it) => (
                    <li key={it}>
                      <Check size={15} aria-label="Included" />
                      {it}
                    </li>
                  ))}
                  {p.no?.map((it) => (
                    <li key={it} className="lp-no">
                      <X size={15} aria-label="Not included" />
                      {it}
                    </li>
                  ))}
                </ul>
                {p.cta === 'sample' && (
                  <button type="button" className="lp-btn" onClick={onSample}>
                    Try it free
                  </button>
                )}
                {p.cta === 'start' && (
                  <button type="button" className={`lp-btn ${p.featured ? 'lp-btn-primary' : ''}`} onClick={onStart}>
                    Get started
                  </button>
                )}
                {p.cta === 'sales' && (
                  <a className="lp-btn" href={mailto('ArthaMind Business plan')}>
                    Contact sales
                  </a>
                )}
              </article>
            );
          })}
        </div>
        <p className="lp-fine">
          Prices in Indian rupees and US dollars, taxes extra. The return is an illustration, not a promise: your saving depends on your income and
          deductions. Not investment advice. See our <a href="/terms.html">Terms &amp; conditions</a>.
        </p>
      </div>
    </section>
  );
};
