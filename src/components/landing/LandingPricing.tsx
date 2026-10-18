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
    blurb: 'Everything you need to see where you stand.',
    yes: [
      'Money health score',
      'Money Check report: tax, freedom number, cover, emergency fund, net worth',
      'All 14 calculators: EMI, SIP, tax, retirement and more',
      'Budget and expense tracker',
      'Live markets: NIFTY, SENSEX, US stocks and crypto',
      'Learning hub and step-by-step lessons',
      '3 AI CFO questions a month',
      'App in 20 languages',
    ],
    no: ['Tax regime optimiser', 'Portfolio import and XIRR', 'Goal plans across 1,000 market paths'],
    cta: 'sample',
  },
  {
    name: 'Pro',
    price: {
      monthly: { amount: '₹249', unit: '/month', note: 'or ₹1,999 a year (save 33%)' },
      yearly: { amount: '₹1,999', unit: '/year', note: 'About ₹167 a month, billed yearly' },
    },
    blurb: 'Your full personal CFO. A ₹47,000 tax saving pays for it in about 16 days.',
    yes: [
      'Everything in Free',
      'Unlimited tax engine: old vs new regime, 80C, 80D, NPS, HRA and every deduction',
      'Advance tax and TDS check',
      'EMI prepayment plans for every loan',
      'Portfolio sync: mutual fund statement (CAS) import, holdings and XIRR',
      'Goal plans tested across 1,000 market paths: retirement, education, home',
      'Term and health insurance gap',
      'Unlimited AI CFO in 13 Indian languages, by voice or text',
      'Monthly money reports you can download',
      'Answer checker: formulas and sources shown',
    ],
    no: ['Cross-border planning for NRIs'],
    featured: true,
    cta: 'start',
  },
  {
    name: 'Global planner',
    price: {
      monthly: { amount: '$199', unit: '/year', note: 'Billed yearly · ₹16,999 a year in India' },
      yearly: { amount: '$199', unit: '/year', note: '₹16,999 a year in India' },
    },
    blurb: 'For Indians living and earning abroad.',
    yes: [
      'Everything in Pro',
      'Retirement in India or abroad, side by side',
      'Child education in India or abroad',
      'Cross-border tax: US, UK and UAE tax treaties (DTAA)',
      'NRE and NRO account planning',
      'Forex tracking: USD, GBP, EUR and AED against INR',
      'Plans in two currencies',
    ],
    cta: 'start',
  },
  {
    name: 'Business',
    price: { monthly: { amount: 'Custom', note: 'Volume pricing' }, yearly: { amount: 'Custom', note: 'Volume pricing' } },
    blurb: 'For NBFCs, HR platforms and API partners.',
    yes: [
      'EMI intelligence licensing',
      'Verified-calculation API',
      'Employee financial wellness',
      'Volume pricing for teams',
      'Onboarding and priority support',
    ],
    cta: 'sales',
  },
];

/**
 * Worked examples for the maths block (checked):
 * - Tax: a ₹47,000 saving ÷ ₹1,999 = 23.5×; ₹1,999 ÷ ₹47,000 × 365 = 15.5 days.
 * - EMI: ₹50 lakh at 8% for 20 years has an EMI of ₹41,822; paying ₹5,000 extra each month cuts
 *   interest by ₹12,67,626 and ends the loan 52 months early; ₹12,67,626 ÷ ₹1,999 ≈ 634×.
 * - Monthly ₹249 × 12 = ₹2,988, so ₹1,999 a year is 33% less.
 */
const MATH = {
  tax: { saving: '₹47,000', multiple: '23.5×', days: '15.5 days' },
  emi: { loan: '₹50 lakh', rate: '8%', years: 20, emi: '₹41,822', extra: '₹5,000', saved: '₹12.7 lakh', months: 52, multiple: '634×' },
};

/** Pricing: monthly or yearly, four plans, Pro highlighted with a worked return-on-cost example. */
export const LandingPricing: React.FC<{ onStart: () => void; onSample: () => void }> = ({ onStart, onSample }) => {
  const [billing, setBilling] = useState<Billing>('yearly');
  return (
    <section id="pricing" className="cl-section lp-section cl-reveal-section" aria-labelledby="lp-title">
      <div className="cl-wrap">
        <div className="cl-eyebrow">Pricing</div>
        <h2 id="lp-title">Free to start. Pro when it saves you money.</h2>
        <p className="cl-sub">Pro is ₹1,999 a year. It pays for itself if it finds one missed deduction or one sensible loan prepayment.</p>
        <div className="lp-toggle" role="group" aria-label="Billing period">
          {(['monthly', 'yearly'] as const).map((b) => (
            <button key={b} type="button" aria-pressed={billing === b} className={billing === b ? 'on' : ''} onClick={() => setBilling(b)}>
              {b === 'monthly' ? 'Monthly' : 'Yearly'}
              {b === 'yearly' && <em>save 33%</em>}
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
                      If Pro finds a <b>{MATH.tax.saving}</b> tax saving, that is <b>{MATH.tax.multiple}</b> its yearly price.
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
        <div className="lp-math" aria-labelledby="lp-math-title">
          <h3 id="lp-math-title">The maths</h3>
          <div className="lp-math-grid">
            <div>
              <small>Tax example</small>
              <p>Tax saving found: <b>{MATH.tax.saving}</b> a year</p>
              <p>Cost of Pro: <b>₹1,999</b> a year</p>
              <p className="lp-math-res">Return <b>{MATH.tax.multiple}</b> · pays for itself in <b>{MATH.tax.days}</b></p>
            </div>
            <div>
              <small>Home-loan example</small>
              <p>{MATH.emi.loan} at {MATH.emi.rate} for {MATH.emi.years} years · EMI {MATH.emi.emi}</p>
              <p>Pay <b>{MATH.emi.extra}</b> extra a month: <b>{MATH.emi.saved}</b> less interest, loan ends <b>{MATH.emi.months} months</b> early</p>
              <p className="lp-math-res">That saving is <b>{MATH.emi.multiple}</b> the price of a year of Pro</p>
            </div>
          </div>
        </div>
        <p className="lp-fine">
          Prices in Indian rupees and US dollars, taxes extra. These are worked examples, not promises or averages: your saving depends on your income, loans and
          deductions. Not investment advice. See our <a href="/terms.html">Terms &amp; conditions</a>.
        </p>
      </div>
    </section>
  );
};
