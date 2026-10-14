import React from 'react';
import { ArrowRight, BarChart3, BookOpen, Calculator, FlaskConical, Landmark, LineChart, MessageSquareText, Sparkles, Target, Wallet } from 'lucide-react';
import { ArthaMindMark } from './ArthaMindMark';
import './landingProducts.css';

const MIND_STEPS = [
  { icon: MessageSquareText, title: 'You ask', text: '“Old or new tax regime?” “Prepay my home loan or invest?” In 13 Indian languages, including Hinglish.' },
  { icon: Calculator, title: 'It does the maths', text: 'Your income, loans and goals go through tested formulas: tax slabs, EMI, SIP, XIRR, runway.' },
  { icon: Target, title: 'You get a plan', text: 'A clear next step with the working shown, what it assumed, and what to verify.' },
];

const BENCH_TILES = [
  { icon: Wallet, title: 'Money home', text: 'Income, spending, loans and net worth in one view' },
  { icon: LineChart, title: 'Portfolio', text: 'CAS import, holdings and XIRR' },
  { icon: Landmark, title: 'Planners', text: 'Retirement, education, insurance, job switch' },
  { icon: BarChart3, title: 'Markets', text: 'India, US, forex and crypto with live charts' },
  { icon: BookOpen, title: 'Tutor', text: 'Learn tax, SIPs and loans step by step' },
  { icon: FlaskConical, title: 'AI Reliability Lab', text: 'Test financial AI answers against formulas and sources' },
];

/** Two products, two different shapes: ArthaMind is a guided flow, Artha Bench Pro is a workspace of tools. */
export const LandingProducts: React.FC<{ onTryMind: () => void; onOpenBench: () => void }> = ({ onTryMind, onOpenBench }) => (
  <section id="products" className="cl-section lpd-section" aria-labelledby="lpd-title">
    <div className="cl-wrap">
      <div className="cl-eyebrow">Two products, one goal</div>
      <h2 id="lpd-title">ArthaMind thinks. Artha Bench Pro is where you work.</h2>
      <div className="lpd-grid">
        <article className="lpd-mind" aria-labelledby="lpd-mind-title">
          <header>
            <span className="lpd-logo"><ArthaMindMark size={30} tone="light" /></span>
            <div>
              <small>For you</small>
              <h3 id="lpd-mind-title">ArthaMind AI</h3>
            </div>
          </header>
          <p className="lpd-lead">Your personal AI CFO. Ask a money question and get an answer you can check.</p>
          <ol className="lpd-steps">
            {MIND_STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <span className="lpd-step-icon"><Icon size={18} aria-hidden="true" /></span>
                <div>
                  <b><em>{i + 1}</em>{title}</b>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="lpd-btn lpd-btn-light" onClick={onTryMind}>
            <Sparkles size={16} aria-hidden="true" /> Try ArthaMind free
          </button>
        </article>

        <article className="lpd-bench" aria-labelledby="lpd-bench-title">
          <header>
            <span className="lpd-logo lpd-logo-bench"><img src="/brand/artha-bench-mark.webp" alt="" width={34} height={34} /></span>
            <div>
              <small>Your workspace</small>
              <h3 id="lpd-bench-title">Artha Bench Pro</h3>
            </div>
          </header>
          <p className="lpd-lead">The full toolkit behind the answers: track, plan, learn and verify in one private workspace.</p>
          <ul className="lpd-tiles">
            {BENCH_TILES.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Icon size={18} aria-hidden="true" />
                <b>{title}</b>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="lpd-btn lpd-btn-light" onClick={onOpenBench}>
            Open Artha Bench Pro <ArrowRight size={16} aria-hidden="true" />
          </button>
        </article>
      </div>
    </div>
  </section>
);
