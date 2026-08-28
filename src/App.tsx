import React, { lazy, Suspense, useEffect, useState } from 'react';
import { NavigationDestination } from './types';
import { AppNavigationDestination, isFinanceDestination } from './navigationTypes';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { FinanceWorkspaceNavigation } from './components/finance/FinanceWorkspaceNavigation';
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
import { ArthaMindLandingPage } from './components/landing/ArthaMindLandingPage';
import { useAuth } from './auth/AuthContext';

const EconomicDashboardView = lazy(() => import('./components/economy/EconomicDashboardView').then((module) => ({ default: module.EconomicDashboardView })));
const MarketView = lazy(() => import('./components/market/MarketView').then((module) => ({ default: module.MarketView })));
const IncomeWorkspaceView = lazy(() => import('./components/income/IncomeWorkspaceView').then((module) => ({ default: module.IncomeWorkspaceView })));
const ExpensesView = lazy(() => import('./components/expenses/ExpensesView').then((module) => ({ default: module.ExpensesView })));
const BudgetingView = lazy(() => import('./components/budgeting/BudgetingView').then((module) => ({ default: module.BudgetingView })));
const FinanceReportsView = lazy(() => import('./components/finance/FinanceReportsView').then((module) => ({ default: module.FinanceReportsView })));
const EmiManagerView = lazy(() => import('./components/finance/EmiManagerView').then((module) => ({ default: module.EmiManagerView })));
const CryptoDashboardView = lazy(() => import('./components/crypto/CryptoDashboardView').then((module) => ({ default: module.CryptoDashboardView })));

const LoadingView = ({ label }: { label: string }) => (
  <div className="max-w-[1500px] mx-auto px-4 py-20 text-center text-sm text-secondary">Loading {label}…</div>
);

export default function App() {
  const auth = useAuth();
  const [currentDestination, setCurrentDestination] = useState<AppNavigationDestination>('overview');
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
      {auth.user && <div className="mx-auto max-w-[1700px] px-4 pt-7 sm:px-6"><PersonalFinancialIntelligence onNavigate={(destination) => setCurrentDestination(destination)} /></div>}
      <DashboardView onNavigate={(destination) => setCurrentDestination(destination)} />
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
      case 'finance-reports': return <Suspense fallback={<LoadingView label="Finance Reports" />}><FinanceReportsView onNavigate={setCurrentDestination} /></Suspense>;
      case 'emi-manager': return <Suspense fallback={<LoadingView label="EMI Manager" />}><EmiManagerView /></Suspense>;
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

  const financeWorkspace = isFinanceDestination(currentDestination);

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans selection:bg-interactive selection:text-white">
      <Header currentDestination={currentDestination} onNavigate={setCurrentDestination} />
      {financeWorkspace ? <FinanceWorkspaceNavigation currentDestination={currentDestination} onNavigate={setCurrentDestination} /> : <Navigation currentDestination={currentDestination} onNavigate={setCurrentDestination} />}
      <main className="flex-1">{renderActiveView()}</main>
      <Footer />
      <AuthModal />
      <SocialAuthDock />
    </div>
  );
}
