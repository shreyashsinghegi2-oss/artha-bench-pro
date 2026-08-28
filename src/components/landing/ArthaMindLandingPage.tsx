import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Database,
  FlaskConical,
  GraduationCap,
  Landmark,
  LineChart,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { NavigationDestination } from '../../types';
import { ArthaMindLogo } from './ArthaMindLogo';
import { ArthaMindHeroVisual } from './ArthaMindHeroVisual';
import { IntelligenceFlow } from './IntelligenceFlow';
import { MarketTicker } from './MarketTicker';
import './landingAnimations.css';

type LandingProps = {
  signedIn: boolean;
  onEnter: (destination?: NavigationDestination) => void;
  onSignIn: () => void;
};

export const ArthaMindLandingPage: React.FC<LandingProps> = ({ signedIn, onEnter, onSignIn }) => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const capabilities = [
    { icon: FlaskConical, title: 'AI Reliability Lab', description: 'Put two financial AI answers side by side, run the same scenario through different models, and inspect where the answers agree, differ or need verification.', visual: 'reliability' },
    { icon: GraduationCap, title: 'Financial Learning', description: 'Learn a topic, ask follow-up questions, take a quiz and keep your notes in the same place. The goal is understanding the concept, not collecting AI summaries.' },
    { icon: LineChart, title: 'Markets & Crypto', description: 'Open market, company, economic or crypto views and keep the data source and freshness label visible while you interpret what you are seeing.', visual: 'market' },
    { icon: WalletCards, title: 'Personal Finance', description: 'Track income, expenses, budgets, goals and paper portfolios. Those records only become AI context when you explicitly allow that category.', visual: 'finance' },
    { icon: BrainCircuit, title: 'ArthaMind Assistant', description: 'Ask about the public data in front of you, or opt in to selected personal context for a more relevant explanation. The two sources stay separated.' },
    { icon: BookOpen, title: 'Reports & Methodology', description: 'Save an evaluation with its scores, notes and methodology so you can come back later and see how a conclusion was reached.', visual: 'report' },
  ];

  const workflow = [
    ['Explore', 'Start with the public tools. You can inspect markets, learning material and AI evaluations without creating an account.'],
    ['Personalize', 'Create an account only when you want saved preferences, a private workspace and data that persists across sessions.'],
    ['Authorize', 'Turn personal context categories on or off yourself. If a category is off, ArthaMind does not use it for personalized analysis.'],
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050B14] text-white selection:bg-emerald-400 selection:text-slate-950">
      <header className={`sticky top-0 z-50 border-b transition-all duration-200 ${scrolled ? 'border-white/10 bg-[#050B14]/82 shadow-[0_12px_35px_rgba(0,0,0,.18)] backdrop-blur-xl' : 'border-transparent bg-[#050B14]/50 backdrop-blur-sm'}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="ArthaMind AI home">
            <ArthaMindLogo className="h-9 w-9" compact />
            <div><div className="text-sm font-black tracking-[0.16em] text-white">ARTHAMIND AI</div><div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Financial Intelligence</div></div>
          </a>
          <nav className="hidden items-center gap-7 text-xs font-semibold text-slate-400 md:flex">
            <a href="#ecosystem" className="transition hover:text-white">Ecosystem</a><a href="#platform" className="transition hover:text-white">Artha Bench Pro</a><a href="#trust" className="transition hover:text-white">Trust & Privacy</a>
          </nav>
          <div className="flex items-center gap-2">
            {!signedIn && <button type="button" onClick={onSignIn} className="artha-button hidden rounded-xl px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white sm:block">Sign in</button>}
            <button type="button" onClick={() => onEnter('overview')} className="artha-button inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300 px-3.5 py-2.5 text-xs font-black text-[#05251E] shadow-[0_10px_35px_rgba(45,212,191,0.14)] hover:bg-emerald-200">{signedIn ? 'Open my workspace' : 'Open Artha Bench Pro'} <ArrowRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative isolate overflow-hidden border-b border-white/10">
          <div className="pointer-events-none absolute inset-0 -z-10"><div className="absolute left-[6%] top-10 h-72 w-72 rounded-full bg-emerald-400/10 blur-[100px]" /><div className="absolute right-[2%] top-16 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" /><div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.18)_1px,transparent_1px)] [background-size:48px_48px]" /></div>
          <div className="mx-auto grid min-h-[760px] max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.03fr_.97fr] lg:px-8 lg:py-24">
            <div className="artha-hero-stagger">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">Financial AI you can inspect, not just chat with</div>
              <h1 className="max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">Understand the finance.<span className="mt-2 block bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent">Test the AI answer.</span>See what it used.</h1>
              <p className="mt-7 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">I’m building <strong className="font-bold text-slate-100">ArthaMind AI</strong> as the intelligence layer: the part that gathers context, reasons about a financial question and explains the result. <strong className="font-bold text-slate-100">Artha Bench Pro</strong> is the workspace where you can actually test that intelligence — compare answers, learn a concept, inspect market data, or bring in your own finance context when you choose.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => onEnter('overview')} className="artha-button inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-slate-950 hover:bg-slate-100">Explore Artha Bench Pro <ArrowRight className="h-4 w-4" /></button><button type="button" onClick={() => onEnter('evaluation-lab')} className="artha-button inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-3.5 text-sm font-bold text-white hover:bg-white/[0.08]"><FlaskConical className="h-4 w-4 text-blue-300" /> Open AI Reliability Lab</button></div>
              <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-slate-500"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Try public tools before signing in</span><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Personal context stays opt-in</span><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Educational & research use — not advice</span></div>
              <MarketTicker />
            </div>
            <div className="pt-4 lg:pt-0"><ArthaMindHeroVisual /></div>
          </div>
        </section>

        <IntelligenceFlow />

        <section id="ecosystem" className="border-b border-white/10 bg-[#07101C] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">One ecosystem, two jobs</div><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">I keep the intelligence layer and the workspace separate on purpose.</h2><p className="mt-4 text-sm leading-7 text-slate-400">ArthaMind does the reasoning. Artha Bench Pro gives you a place to test, inspect, learn from and save that work. Keeping the two roles clear also makes it easier to show which context an answer came from.</p></div>
            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              <article className="rounded-[28px] border border-emerald-300/15 bg-emerald-300/[0.045] p-6 sm:p-8"><ArthaMindLogo className="h-12 w-12" compact /><div className="mt-6 text-[10px] font-black uppercase tracking-[0.17em] text-emerald-300">The intelligence layer</div><h3 className="mt-2 text-2xl font-black">ArthaMind AI</h3><p className="mt-4 text-sm leading-7 text-slate-400">ArthaMind is the reasoning layer I’m building around financial questions. It can combine public market, economic and business context with personal data only when you turn those categories on. The aim is not to make the AI sound more confident; it is to make the context and reasoning easier to inspect.</p><div className="mt-6 grid gap-2 sm:grid-cols-2"><MiniPoint text="Context-aware financial reasoning" /><MiniPoint text="Explanations you can inspect" /><MiniPoint text="Public vs personal context boundary" /><MiniPoint text="Educational safety guardrails" /></div></article>
              <article id="platform" className="rounded-[28px] border border-blue-300/15 bg-blue-300/[0.045] p-6 sm:p-8"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-300/10"><Landmark className="h-6 w-6 text-blue-300" /></div><div className="mt-6 text-[10px] font-black uppercase tracking-[0.17em] text-blue-300">The product workspace</div><h3 className="mt-2 text-2xl font-black">Artha Bench Pro</h3><p className="mt-4 text-sm leading-7 text-slate-400">Artha Bench Pro is where that idea becomes usable. You can compare two model answers, run reliability checks, inspect market or economic data, learn a finance topic, track a budget and save the work you want to revisit later.</p><div className="mt-6 grid gap-2 sm:grid-cols-2"><MiniPoint text="Reliability tests & model comparison" /><MiniPoint text="Finance learning & AI tutor" /><MiniPoint text="Markets, crypto & economy" /><MiniPoint text="Personal finance workspace" /></div></article>
            </div>
          </div>
        </section>

        <section className="bg-[#050B14] py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div className="max-w-3xl"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Inside Artha Bench Pro</div><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">The tools I wanted in one place while learning and testing financial AI.</h2></div><button type="button" onClick={() => onEnter('overview')} className="artha-button inline-flex w-fit items-center gap-2 text-sm font-black text-emerald-300">Open the complete workspace <ArrowRight className="h-4 w-4" /></button></div><div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{capabilities.map((cap) => <FeatureCard key={cap.title} {...cap} />)}</div></div></section>

        <section id="trust" className="border-y border-white/10 bg-[#07101C] py-20"><div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:px-8"><div><div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10"><ShieldCheck className="h-6 w-6 text-emerald-300" /></div><div className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Trust & privacy</div><h2 className="mt-3 text-3xl font-black tracking-tight">Personalization should be a switch, not a surprise.</h2><p className="mt-4 text-sm leading-7 text-slate-400">Public market and economic context is one thing; your income, budget, portfolio or learning history is another. Artha Bench Pro keeps that boundary visible and lets you decide which personal categories ArthaMind may use.</p></div><div className="grid gap-3 sm:grid-cols-2"><TrustCard icon={UserRound} title="Your workspace stays yours" text="Signed-in cloud records are tied to the authenticated user and protected by database row-level access policies." /><TrustCard icon={Database} title="Public and personal are not mixed by default" text="Market and economic context can be public. Personal finance context stays a separate category that requires your authorization." /><TrustCard icon={LockKeyhole} title="Choose the context, category by category" text="Income, budgets, portfolio and learning context can be enabled independently. Turning one on does not silently turn the others on." /><TrustCard icon={ShieldCheck} title="Research tool, not an adviser" text="AI output is presented for educational and research use. The product does not present generated text as guaranteed financial, investment, tax or legal advice." /></div></div></section>

        <section className="bg-[#050B14] py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="text-center"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Public first, personal when you choose</div><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">You do not need to hand over personal data just to try the product.</h2></div><div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">{workflow.map(([title, text], index) => <div key={title} className="artha-feature-card rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-300/20 bg-blue-300/10 text-[10px] font-black text-blue-300">0{index + 1}</div><h3 className="mt-5 text-sm font-black">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{text}</p></div>)}</div></div></section>

        <section className="border-t border-white/10 bg-gradient-to-b from-[#08111D] to-[#050B14] py-20"><div className="mx-auto max-w-4xl px-4 text-center sm:px-6"><ArthaMindLogo className="mx-auto h-14 w-14" compact /><h2 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">Start with a question. Then inspect the answer.</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">Use Artha Bench Pro to evaluate an AI response, study a finance concept, explore public market data or build a private workspace. Add personal context only when it genuinely helps — and keep the difference between evidence, AI interpretation and your own data visible.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={() => onEnter('overview')} className="artha-button inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-6 py-3.5 text-sm font-black text-[#05251E]">{signedIn ? 'Open my workspace' : 'Open Artha Bench Pro'} <ArrowRight className="h-4 w-4" /></button>{!signedIn && <button type="button" onClick={onSignIn} className="artha-button rounded-2xl border border-white/15 bg-white/[0.03] px-6 py-3.5 text-sm font-bold text-white">Sign in / Create account</button>}</div></div></section>
      </main>

      <footer className="border-t border-white/10 bg-[#040912] px-4 py-8 text-xs text-slate-600 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-black tracking-[0.12em] text-slate-300">ARTHAMIND AI <span className="font-medium text-slate-600">× ARTHA BENCH PRO</span></div><p className="mt-1 text-[10px]">Built in public around financial AI reliability, learning, market context and personal finance.</p></div><div className="flex flex-wrap gap-4 text-[10px] font-semibold"><a href="/privacy.html" className="transition hover:text-slate-300">Privacy</a><a href="/terms.html" className="transition hover:text-slate-300">Terms</a><span>Educational/research use — not financial, investment, tax or legal advice.</span></div></div></footer>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: React.ElementType; title: string; description: string; visual?: string }> = ({ icon: Icon, title, description, visual }) => (
  <article className="artha-feature-card group rounded-2xl border border-white/10 bg-white/[0.025] p-5 hover:border-white/20 hover:bg-white/[0.045]">
    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 group-hover:text-emerald-300"><Icon className="h-5 w-5" /></div>
    <h3 className="mt-5 text-base font-black">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{description}</p>
    {visual === 'reliability' && <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[8px] text-slate-600"><div className="rounded-lg border border-white/10 p-2">Answer A</div><div className="artha-reliability-divider h-7 w-px bg-emerald-300/50" /><div className="rounded-lg border border-white/10 p-2">Answer B</div></div>}
    {visual === 'market' && <svg viewBox="0 0 150 28" className="mt-4 h-7 w-full text-sky-300" aria-hidden="true"><path className="artha-flow-spark" d="M2 22 C22 14, 34 24, 49 13 S75 18, 92 9 S120 13, 148 4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>}
    {visual === 'finance' && <div className="mt-4 flex h-8 items-end gap-2"><div className="artha-mini-bar-a h-6 w-5 rounded-t bg-emerald-300/50" /><div className="artha-mini-bar-b h-4 w-5 rounded-t bg-sky-300/45" /><span className="ml-1 text-[8px] text-slate-600">Income vs expense</span></div>}
    {visual === 'report' && <div className="artha-report-check mt-4 flex items-center gap-2 text-[9px] text-slate-500"><span className="flex h-4 w-4 items-center justify-center rounded border border-emerald-300/30 text-emerald-300">✓</span> Methodology saved</div>}
  </article>
);

const MiniPoint: React.FC<{ text: string }> = ({ text }) => <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-[10px] font-semibold text-slate-400"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> {text}</div>;
const TrustCard: React.FC<{ icon: React.ElementType; title: string; text: string }> = ({ icon: Icon, title, text }) => <div className="artha-feature-card rounded-2xl border border-white/10 bg-white/[0.025] p-5"><Icon className="h-5 w-5 text-blue-300" /><h3 className="mt-4 text-sm font-black">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{text}</p></div>;
