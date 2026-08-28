import React, { lazy, Suspense, useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Database,
  FlaskConical,
  GraduationCap,
  Landmark,
  LineChart,
  LockKeyhole,
  Network,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { NavigationDestination } from './types';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import { DashboardView } from './components/dashboard/DashboardView';
import { PersonalFinancialIntelligence } from './components/dashboard/PersonalFinancialIntelligence';
import { LearningView } from './components/learning/LearningView';
import { NewsView } from './components/news/NewsView';
import { QuickCheckView } from './components/quickcheck/QuickCheckView';
import { TutorView } from './components/tutor/TutorView';
import { EvaluationLabView } from './components/evaluation/EvaluationLabView';
import { ComparisonView } from './components/comparison/ComparisonView';
import { ScenariosView } from './components/scenarios/ScenariosView';
import { BatchBenchmarkView } from './components/evaluation/BatchBenchmarkView';
import { ReportsView } from './components/evaluation/ReportsView';
import { MethodologyView } from './components/evaluation/MethodologyView';
import { ConnectionsView } from './components/evaluation/ConnectionsView';
import { SettingsView } from './components/evaluation/SettingsView';
import { AccountView } from './components/account/AccountView';
import { AuthModal } from './components/auth/AuthModal';
import { SocialAuthDock } from './components/auth/SocialAuthDock';
import { useAuth } from './auth/AuthContext';

const EconomicDashboardView = lazy(() => import('./components/economy/EconomicDashboardView').then((module) => ({ default: module.EconomicDashboardView })));
const MarketView = lazy(() => import('./components/market/MarketView').then((module) => ({ default: module.MarketView })));
const IncomeWorkspaceView = lazy(() => import('./components/income/IncomeWorkspaceView').then((module) => ({ default: module.IncomeWorkspaceView })));
const ExpensesView = lazy(() => import('./components/expenses/ExpensesView').then((module) => ({ default: module.ExpensesView })));
const BudgetingView = lazy(() => import('./components/budgeting/BudgetingView').then((module) => ({ default: module.BudgetingView })));
const CryptoDashboardView = lazy(() => import('./components/crypto/CryptoDashboardView').then((module) => ({ default: module.CryptoDashboardView })));

const LoadingView = ({ label }: { label: string }) => (
  <div className="max-w-[1500px] mx-auto px-4 py-20 text-center text-sm text-secondary">Loading {label}…</div>
);

type LandingProps = {
  signedIn: boolean;
  onEnter: (destination?: NavigationDestination) => void;
  onSignIn: () => void;
};

const ArthaMindLandingPage: React.FC<LandingProps> = ({ signedIn, onEnter, onSignIn }) => {
  const capabilities = [
    {
      icon: FlaskConical,
      title: 'AI Reliability Lab',
      description: 'Evaluate financial AI answers, compare models, test scenarios and inspect reliability instead of trusting a single response blindly.',
    },
    {
      icon: GraduationCap,
      title: 'Financial Learning',
      description: 'Learn finance through structured lessons, an AI tutor, notes, quizzes and learning progress inside one workspace.',
    },
    {
      icon: LineChart,
      title: 'Markets & Crypto',
      description: 'Explore market, company, economic and cryptocurrency intelligence with visible data-source and freshness context.',
    },
    {
      icon: WalletCards,
      title: 'Personal Finance',
      description: 'Organize income, expenses, budgets, goals and paper portfolios while keeping personal AI context explicitly user-controlled.',
    },
    {
      icon: BrainCircuit,
      title: 'ArthaMind Assistant',
      description: 'Ask financial questions in the same environment where public intelligence and your specifically authorized context can be separated.',
    },
    {
      icon: BookOpen,
      title: 'Reports & Methodology',
      description: 'Save evaluation work, review methodology and keep an auditable research trail for financial AI reliability analysis.',
    },
  ];

  const workflow = [
    ['Explore', 'Use the public financial research, market, learning and evaluation tools without creating an account.'],
    ['Personalize', 'Create an account when you want a user-scoped workspace, preferences and cross-session persistence.'],
    ['Authorize', 'Choose which personal data categories ArthaMind may use. Disabled personal sources stay outside personalized AI context.'],
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050B14] text-white selection:bg-emerald-400 selection:text-slate-950">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050B14]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="ArthaMind AI home">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 shadow-[0_0_35px_rgba(45,212,191,0.14)]">
              <BrainCircuit className="h-5 w-5 text-emerald-300" />
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-blue-400 ring-2 ring-[#050B14]" />
            </div>
            <div>
              <div className="text-sm font-black tracking-[0.16em] text-white">ARTHAMIND AI</div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Financial Intelligence</div>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-xs font-semibold text-slate-400 md:flex">
            <a href="#ecosystem" className="transition hover:text-white">Ecosystem</a>
            <a href="#platform" className="transition hover:text-white">Artha Bench Pro</a>
            <a href="#trust" className="transition hover:text-white">Trust & Privacy</a>
          </nav>

          <div className="flex items-center gap-2">
            {!signedIn && (
              <button type="button" onClick={onSignIn} className="hidden rounded-xl px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/5 hover:text-white sm:block">
                Sign in
              </button>
            )}
            <button type="button" onClick={() => onEnter('overview')} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300 px-3.5 py-2.5 text-xs font-black text-[#05251E] shadow-[0_10px_35px_rgba(45,212,191,0.14)] transition hover:bg-emerald-200">
              {signedIn ? 'Open my workspace' : 'Open Artha Bench Pro'} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative isolate overflow-hidden border-b border-white/10">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-[6%] top-10 h-72 w-72 rounded-full bg-emerald-400/10 blur-[100px]" />
            <div className="absolute right-[2%] top-16 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />
            <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.18)_1px,transparent_1px)] [background-size:48px_48px]" />
          </div>

          <div className="mx-auto grid min-h-[760px] max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.06fr_.94fr] lg:px-8 lg:py-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
                <Sparkles className="h-3.5 w-3.5" /> Financial intelligence that can be inspected
              </div>

              <h1 className="max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
                Understand finance.
                <span className="mt-2 block bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent">Test the intelligence.</span>
                Trust with evidence.
              </h1>

              <p className="mt-7 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
                <strong className="font-bold text-slate-100">ArthaMind AI</strong> is the financial-intelligence layer. <strong className="font-bold text-slate-100">Artha Bench Pro</strong> is the workspace underneath it where users evaluate financial AI, learn finance, explore markets, organize personal finance and inspect how conclusions are produced.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => onEnter('overview')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-slate-100">
                  Explore Artha Bench Pro <ArrowRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => onEnter('evaluation-lab')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/[0.08]">
                  <FlaskConical className="h-4 w-4 text-blue-300" /> Open Evaluation Lab
                </button>
              </div>

              <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Public tools remain accessible</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> User-controlled personal AI context</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Educational & research use</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-10 -z-10 rounded-full bg-blue-500/[0.08] blur-3xl" />
              <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#0A1422]/90 p-4 shadow-[0_35px_100px_rgba(0,0,0,.45)] sm:p-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10"><Network className="h-5 w-5 text-emerald-300" /></div>
                    <div><div className="text-xs font-black uppercase tracking-[0.13em]">ArthaMind Intelligence Layer</div><div className="mt-0.5 text-[10px] text-slate-500">Context • reasoning • explanation</div></div>
                  </div>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-2.5 py-1 text-[9px] font-bold text-emerald-300">ECOSYSTEM</span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <SystemNode icon={LineChart} title="Market Intelligence" detail="Markets • crypto • economy" />
                  <SystemNode icon={PiggyBank} title="Personal Finance" detail="Income • expenses • budgets" />
                  <SystemNode icon={GraduationCap} title="Learning" detail="Tutor • lessons • progress" />
                  <SystemNode icon={ShieldCheck} title="AI Reliability" detail="Evaluate • compare • verify" />
                </div>

                <div className="relative my-4 flex justify-center">
                  <div className="h-8 w-px bg-gradient-to-b from-blue-400/60 to-emerald-300/60" />
                  <div className="absolute top-3 h-2 w-2 rounded-full bg-blue-300 shadow-[0_0_18px_rgba(125,211,252,.8)]" />
                </div>

                <div className="rounded-2xl border border-blue-300/20 bg-gradient-to-br from-blue-400/[0.10] to-emerald-300/[0.07] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">Workspace layer</div>
                      <div className="mt-1 text-xl font-black">Artha Bench Pro</div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-400">The interactive environment where ArthaMind intelligence becomes testable, learnable and user-controlled.</p>
                    </div>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-950"><BarChart3 className="h-5 w-5" /></div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[9px] font-bold text-slate-300">
                    <div className="rounded-lg border border-white/10 bg-black/15 px-2 py-2">EVALUATE</div>
                    <div className="rounded-lg border border-white/10 bg-black/15 px-2 py-2">LEARN</div>
                    <div className="rounded-lg border border-white/10 bg-black/15 px-2 py-2">MANAGE</div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-[10px] text-slate-500">
                  <LockKeyhole className="h-3.5 w-3.5 text-emerald-300" /> Personal context is used only from categories the signed-in user explicitly enables.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="ecosystem" className="border-b border-white/10 bg-[#07101C] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">One ecosystem, two clear roles</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">What ArthaMind AI is — and where Artha Bench Pro fits.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">The landing experience makes the relationship clear before a user reaches the dashboard.</p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              <article className="rounded-[28px] border border-emerald-300/15 bg-emerald-300/[0.045] p-6 sm:p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10"><BrainCircuit className="h-6 w-6 text-emerald-300" /></div>
                <div className="mt-6 text-[10px] font-black uppercase tracking-[0.17em] text-emerald-300">The intelligence layer</div>
                <h3 className="mt-2 text-2xl font-black">ArthaMind AI</h3>
                <p className="mt-4 text-sm leading-7 text-slate-400">ArthaMind is the financial-intelligence concept that brings together market context, economic information, business information and user-authorized personal context so financial questions can be reasoned about and explained more clearly.</p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  <MiniPoint text="Financial context & reasoning" />
                  <MiniPoint text="Explainable analysis" />
                  <MiniPoint text="Public + authorized context separation" />
                  <MiniPoint text="Safety-aware educational guidance" />
                </div>
              </article>

              <article id="platform" className="rounded-[28px] border border-blue-300/15 bg-blue-300/[0.045] p-6 sm:p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-300/10"><Landmark className="h-6 w-6 text-blue-300" /></div>
                <div className="mt-6 text-[10px] font-black uppercase tracking-[0.17em] text-blue-300">The product workspace</div>
                <h3 className="mt-2 text-2xl font-black">Artha Bench Pro</h3>
                <p className="mt-4 text-sm leading-7 text-slate-400">Artha Bench Pro is where users interact with the ecosystem: evaluating financial AI, comparing responses, learning finance, exploring markets and economic data, organizing a personal finance workspace and saving research outputs.</p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  <MiniPoint text="Reliability evaluation & comparison" />
                  <MiniPoint text="Finance learning & tutor" />
                  <MiniPoint text="Markets, crypto & economy" />
                  <MiniPoint text="Personal finance workspace" />
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="bg-[#050B14] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div className="max-w-3xl">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Inside Artha Bench Pro</div>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">One workspace for financial AI reliability and learning.</h2>
              </div>
              <button type="button" onClick={() => onEnter('overview')} className="inline-flex w-fit items-center gap-2 text-sm font-black text-emerald-300">Open the complete workspace <ArrowRight className="h-4 w-4" /></button>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {capabilities.map(({ icon: Icon, title, description }) => (
                <article key={title} className="group rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.045]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition group-hover:text-emerald-300"><Icon className="h-5 w-5" /></div>
                  <h3 className="mt-5 text-base font-black">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-slate-500">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="trust" className="border-y border-white/10 bg-[#07101C] py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10"><ShieldCheck className="h-6 w-6 text-emerald-300" /></div>
              <div className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Trust by design</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Personalization without hiding the boundary.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">Artha Bench Pro separates public financial intelligence from optional personal context and gives the signed-in user controls over which personal data categories may be used for personalized ArthaMind analysis.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <TrustCard icon={UserRound} title="User-scoped workspace" text="Signed-in cloud data is stored against the authenticated user and protected with database row-level access policies." />
              <TrustCard icon={Database} title="Public vs personal context" text="Public market/economic context and optional personal context are treated as separate data categories." />
              <TrustCard icon={LockKeyhole} title="Explicit AI controls" text="Personal finance, budgets, portfolio and learning context can be enabled or disabled independently for personalized AI." />
              <TrustCard icon={ShieldCheck} title="Educational scope" text="The platform keeps educational and research disclosures visible instead of presenting AI output as guaranteed financial advice." />
            </div>
          </div>
        </section>

        <section className="bg-[#050B14] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">From discovery to personalized workspace</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">How a user enters the ecosystem.</h2>
            </div>
            <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
              {workflow.map(([title, text], index) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-300/20 bg-blue-300/10 text-[10px] font-black text-blue-300">0{index + 1}</div>
                  <h3 className="mt-5 text-sm font-black">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-gradient-to-b from-[#08111D] to-[#050B14] py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10"><BrainCircuit className="h-7 w-7 text-emerald-300" /></div>
            <h2 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">Enter ArthaMind through Artha Bench Pro.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">Evaluate, learn, explore and personalize financial intelligence in one workspace — while keeping the distinction between evidence, AI interpretation and user-authorized context visible.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={() => onEnter('overview')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-6 py-3.5 text-sm font-black text-[#05251E]">{signedIn ? 'Open my workspace' : 'Open Artha Bench Pro'} <ArrowRight className="h-4 w-4" /></button>
              {!signedIn && <button type="button" onClick={onSignIn} className="rounded-2xl border border-white/15 bg-white/[0.03] px-6 py-3.5 text-sm font-bold text-white">Sign in / Create account</button>}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#040912] px-4 py-8 text-xs text-slate-600 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-black tracking-[0.12em] text-slate-300">ARTHAMIND AI <span className="font-medium text-slate-600">× ARTHA BENCH PRO</span></div>
            <p className="mt-1 text-[10px]">Financial intelligence, reliability evaluation and learning.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-[10px] font-semibold">
            <a href="/privacy.html" className="transition hover:text-slate-300">Privacy</a>
            <a href="/terms.html" className="transition hover:text-slate-300">Terms</a>
            <span>Educational/research use — not financial, investment, tax or legal advice.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const SystemNode: React.FC<{ icon: React.ElementType; title: string; detail: string }> = ({ icon: Icon, title, detail }) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3.5">
    <Icon className="h-4 w-4 text-blue-300" />
    <div className="mt-3 text-[11px] font-black text-slate-100">{title}</div>
    <div className="mt-1 text-[9px] leading-4 text-slate-500">{detail}</div>
  </div>
);

const MiniPoint: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-[10px] font-semibold text-slate-400">
    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> {text}
  </div>
);

const TrustCard: React.FC<{ icon: React.ElementType; title: string; text: string }> = ({ icon: Icon, title, text }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
    <Icon className="h-5 w-5 text-blue-300" />
    <h3 className="mt-4 text-sm font-black">{title}</h3>
    <p className="mt-2 text-xs leading-6 text-slate-500">{text}</p>
  </div>
);

export default function App() {
  const auth = useAuth();
  const [currentDestination, setCurrentDestination] = useState<NavigationDestination>('overview');
  const [showLanding, setShowLanding] = useState(() => typeof window === 'undefined' || window.location.hash !== '#workspace');

  useEffect(() => {
    const syncFromLocation = () => setShowLanding(window.location.hash !== '#workspace');
    window.addEventListener('hashchange', syncFromLocation);
    window.addEventListener('popstate', syncFromLocation);
    return () => {
      window.removeEventListener('hashchange', syncFromLocation);
      window.removeEventListener('popstate', syncFromLocation);
    };
  }, []);

  const enterWorkspace = (destination: NavigationDestination = 'overview') => {
    setCurrentDestination(destination);
    setShowLanding(false);
    if (window.location.hash !== '#workspace') {
      window.history.pushState({ view: 'workspace' }, '', `${window.location.pathname}${window.location.search}#workspace`);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const dashboard = () => (
    <>
      {auth.user && <div className="mx-auto max-w-[1700px] px-4 pt-7 sm:px-6"><PersonalFinancialIntelligence onNavigate={setCurrentDestination} /></div>}
      <DashboardView onNavigate={setCurrentDestination} />
    </>
  );

  const renderActiveView = () => {
    switch (currentDestination) {
      case 'dashboard':
      case 'overview': return dashboard();
      case 'learning': return <LearningView />;
      case 'income': return <Suspense fallback={<LoadingView label="Income Workspace" />}><IncomeWorkspaceView /></Suspense>;
      case 'expenses': return <Suspense fallback={<LoadingView label="Expenses Workspace" />}><ExpensesView /></Suspense>;
      case 'budgeting': return <Suspense fallback={<LoadingView label="Budgeting Workspace" />}><BudgetingView /></Suspense>;
      case 'crypto': return <Suspense fallback={<LoadingView label="Crypto Dashboard" />}><CryptoDashboardView /></Suspense>;
      case 'markets': return <Suspense fallback={<LoadingView label="Company Intelligence Dashboard" />}><MarketView /></Suspense>;
      case 'economy': return <Suspense fallback={<LoadingView label="Economic Dashboard" />}><EconomicDashboardView /></Suspense>;
      case 'news': return <NewsView />;
      case 'quick-check': return <QuickCheckView />;
      case 'tutor': return <TutorView />;
      case 'evaluation-lab': return <EvaluationLabView />;
      case 'comparison': return <ComparisonView />;
      case 'scenarios': return <ScenariosView />;
      case 'batch': return <BatchBenchmarkView />;
      case 'reports': return <ReportsView />;
      case 'methodology': return <MethodologyView />;
      case 'connections': return <ConnectionsView />;
      case 'settings': return <SettingsView />;
      case 'account': return <AccountView />;
      default: return dashboard();
    }
  };

  if (auth.loading) {
    return <div className="min-h-screen bg-canvas text-ink flex items-center justify-center"><div className="rounded-2xl border border-line bg-surface px-6 py-5 text-sm font-semibold text-secondary shadow-sm">Restoring your Artha Bench workspace…</div></div>;
  }

  if (showLanding) {
    return (
      <>
        <ArthaMindLandingPage signedIn={Boolean(auth.user)} onEnter={enterWorkspace} onSignIn={() => auth.openAuth('login')} />
        <AuthModal />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans selection:bg-interactive selection:text-white">
      <Header currentDestination={currentDestination} onNavigate={setCurrentDestination} />
      <Navigation currentDestination={currentDestination} onNavigate={setCurrentDestination} />
      <main className="flex-1">{renderActiveView()}</main>
      <Footer />
      <AuthModal />
      <SocialAuthDock />
    </div>
  );
}
