import React from 'react';
import { Check } from 'lucide-react';
import './landingPricing.css';

type Plan = { name: string; price: string; unit?: string; note?: string; blurb: string; items: string[]; featured?: boolean; cta?: 'start' | 'sample' };

const PLANS: Plan[] = [
  {
    name: 'Free',
    price: '₹0',
    blurb: 'Everything you need to see where you stand.',
    items: ['Money health score', 'All 14 calculators', 'Money Check report', 'AI CFO, limited questions'],
    cta: 'sample',
  },
  {
    name: 'Pro',
    price: '₹199',
    unit: '/month',
    note: 'or ₹1,999 a year',
    blurb: 'Your full personal CFO for India.',
    items: ['Old vs new tax regime, every deduction', 'EMI prepayment plans', 'Portfolio with CAS import and XIRR', 'Monte Carlo goal plans', 'Unlimited AI CFO in your language'],
    featured: true,
    cta: 'start',
  },
  {
    name: 'Global planner',
    price: '$29',
    unit: '/month',
    blurb: 'For Indians living and earning abroad.',
    items: ['Retirement in India or abroad', 'Child education in India or abroad', 'Everything in Pro'],
    cta: 'start',
  },
  {
    name: 'Business',
    price: 'Custom',
    blurb: 'For NBFCs, HR platforms and API partners.',
    items: ['EMI intelligence licensing', 'Employee financial wellness', 'Verified-calculation API'],
  },
];

/** Launch pricing: four plans, the Pro plan highlighted. Prices are shown as launch pricing, not a checkout. */
export const LandingPricing: React.FC<{ onStart: () => void; onSample: () => void }> = ({ onStart, onSample }) => (
  <section id="pricing" className="cl-section lp-section cl-reveal-section" aria-labelledby="lp-title">
    <div className="cl-wrap">
      <div className="cl-eyebrow">Pricing</div>
      <h2 id="lp-title">Free to start. Pro when it saves you money.</h2>
      <p className="cl-sub">Pro pays for itself if it finds one missed deduction or one sensible loan prepayment a year.</p>
      <div className="lp-grid" data-stagger>
        {PLANS.map((p) => (
          <article key={p.name} className={`lp-card ${p.featured ? 'lp-featured' : ''}`}>
            {p.featured && <span className="lp-badge">Most popular</span>}
            <h3>{p.name}</h3>
            <p className="lp-price">
              <b>{p.price}</b>
              {p.unit && <span>{p.unit}</span>}
            </p>
            <p className="lp-note">{p.note ?? ' '}</p>
            <p className="lp-blurb">{p.blurb}</p>
            <ul>
              {p.items.map((it) => (
                <li key={it}>
                  <Check size={15} aria-hidden="true" />
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
            {!p.cta && <p className="lp-contact">Volume pricing on request.</p>}
          </article>
        ))}
      </div>
      <p className="lp-fine">Launch pricing. Education and analysis only, not investment advice.</p>
    </div>
  </section>
);
