import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  AppLocation,
  destinationForPath,
  pathForDestination,
  PRIVATE_FINANCE_DESTINATIONS,
  pushAuth,
  pushDestination,
  pushLanding,
  readAppLocation,
} from './appRoutes';
import { AppNavigationDestination, isFinanceDestination } from './navigationTypes';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { FinanceWorkspaceNavigation } from './components/finance/FinanceWorkspaceNavigation';
import { FinanceAssistantDrawer } from './components/finance/FinanceAssistantDrawer';
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
import { AuthGateView } from './components/auth/AuthGateView';
import { SocialAuthDock } from './components/auth/SocialAuthDock';
import { ArthaMindLandingPage } from './components/landing/ArthaMindLandingPage';
import { FirstTimeOnboardingGate } from './components/onboarding/FirstTimeOnboardingGate';
import { PublicInfoPage } from './components/public/PublicInfoPage';
import { useAuth } from './auth/AuthContext';

const EconomicDashboardView = lazy(() => import('./components/economy/EconomicDashboardView').then((module) => ({ default: module.EconomicDashboardView })));
const MarketView = lazy(() => import('./components/market/MarketView').then((module) => ({ default: module.MarketView })));
const IncomeWorkspaceView = lazy(() => import('./components/income/IncomeWorkspaceView').then((module) => ({ default: module.IncomeWorkspaceView })));
const ExpensesView = lazy(() => import('./components/expenses/ExpensesView').then((module) => ({ default: module.ExpensesView })));
const BudgetingView = lazy(() => import('./components/budgeting/BudgetingView').then((module) => ({ default: module.BudgetingView })));
const FinanceReportsView = lazy(() => import('./components/finance/FinanceReportsView').then((module) => ({ default: module.FinanceReportsView })));
const EmiManagerView = lazy(() => import('./components/finance/EmiManagerView').then((module) => ({ default: module.EmiManagerView })));
const CryptoDashboardView = lazy(() => import('./components/crypto/CryptoDashboardView').then((module) => ({ default: module.CryptoDashboardView })));
const LoadingView = ({ label }: { label: string }) => <div className="mx-auto max-w-[1500px] px-4 py-20 text-center text-sm text-secondary">Loading {label}…</div>;
const PENDING_RETURN_KEY = 'arthabench_pending_private_return_v1';

export default function App() {
  const auth = useAuth();
  const [location, setLocation] = useState<AppLocation>(() => readAppLocation());
  const currentDestination = location.kind === 'workspace' ? location.destination : 'overview';

  const syncFromLocation = useCallback(() => setLocation(readAppLocation()), []);
  useEffect(() => {
    window.addEventListener('popstate', syncFromLocation);
    window.addEventListener('hashchange', syncFromLocation);
    if (window.location.hash === '#workspace') {
      pushDestination('overview', true);
      setLocation({ kind: 'workspace', destination: 'overview' });
    }
    return () => { window.removeEventListener('popstate', syncFromLocation); window.removeEventListener('hashchange', syncFromLocation); };
  }, [syncFromLocation]);

  const goToDestination = useCallback((destination: AppNavigationDestination, replace = false) => {
    pushDestination(destination, replace);
    setLocation({ kind: 'workspace', destination });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const requestPrivateDestination = useCallback((destination: AppNavigationDestination) => {
    const returnTo = pathForDestination(destination);
    window.sessionStorage.setItem(PENDING_RETURN_KEY, returnTo);
    pushAuth(returnTo);
    setLocation({ kind: 'auth', returnTo });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const navigateWorkspace = useCallback((destination: AppNavigationDestination = 'overview') => {
    if (!auth.user && PRIVATE_FINANCE_DESTINATIONS.has(destination)) return requestPrivateDestination(destination);
    goToDestination(destination);
  }, [auth.user, goToDestination, requestPrivateDestination]);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user && location.kind === 'workspace' && PRIVATE_FINANCE_DESTINATIONS.has(location.destination)) {
      const returnTo = pathForDestination(location.destination);
      window.sessionStorage.setItem(PENDING_RETURN_KEY, returnTo);
      pushAuth(returnTo, true);
      setLocation({ kind: 'auth', returnTo });
      return;
    }
    if (!auth.user) return;
    const pending = window.sessionStorage.getItem(PENDING_RETURN_KEY);
    const returnTo = location.kind === 'auth' ? location.returnTo : pending;
    if (!returnTo) return;
    const destination = destinationForPath(returnTo);
    window.sessionStorage.removeItem(PENDING_RETURN_KEY);
    if (destination) goToDestination(destination, true);
  }, [auth.loading, auth.user, goToDestination, location]);

  const goHome = useCallback(() => { pushLanding(); setLocation({ kind: 'landing' }); window.scrollTo({ top: 0, behavior: 'auto' }); }, []);
  const goOverview = useCallback(() => goToDestination('overview'), [goToDestination]);

  const dashboard = () => <>
    {auth.user && <div className="mx-auto max-w-[1700px] px-4 pt-7 sm:px-6"><PersonalFinancialIntelligence onNavigate={(destination) => navigateWorkspace(destination)} /></div>}
    <DashboardView onNavigate={(destination) => navigateWorkspace(destination)} />
  </>;

  const renderActiveView = () => {
    switch (currentDestination) {
      case 'overview':
      case 'dashboard': return dashboard();
      case 'learning': return <LearningView />;
      case 'income': return <Suspense fallback={<LoadingView label="Income Workspace" />}><IncomeWorkspaceView /></Suspense>;
      case 'expenses': return <Suspense fallback={<LoadingView label="Expenses Workspace" />}><ExpensesView /></Suspense>;
      case 'budgeting': return <Suspense fallback={<LoadingView label="Budgeting Workspace" />}><BudgetingView /></Suspense>;
      case 'finance-reports': return <Suspense fallback={<LoadingView label="Finance Reports" />}><FinanceReportsView onNavigate={navigateWorkspace} /></Suspense>;
      case 'emi-manager': return <Suspense fallback={<LoadingView label="EMI Manager" />}><EmiManagerView onNavigate={navigateWorkspace} /></Suspense>;
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

  if (auth.loading) return <div className="flex min-h-screen items-center justify-center bg-canvas text-ink"><div className="rounded-2xl border border-line bg-surface px-6 py-5 text-sm font-semibold text-secondary shadow-sm">Restoring your Artha Bench workspace…</div></div>;

  if (!auth.user && location.kind === 'workspace' && PRIVATE_FINANCE_DESTINATIONS.has(location.destination)) {
    const returnTo = pathForDestination(location.destination);
    return <><AuthGateView returnTo={returnTo} onCancel={goOverview} onEmail={() => auth.openAuth('login')} /><AuthModal /></>;
  }
  if (location.kind === 'landing') return <><ArthaMindLandingPage signedIn={Boolean(auth.user)} onEnter={(destination) => navigateWorkspace(destination ?? 'overview')} onSignIn={() => auth.openAuth('login')} /><AuthModal /><FirstTimeOnboardingGate onNavigate={navigateWorkspace} /></>;
  if (location.kind === 'public') return <><PublicInfoPage page={location.page} onHome={goHome} onWorkspace={goOverview} /><AuthModal /><FirstTimeOnboardingGate onNavigate={navigateWorkspace} /></>;
  if (location.kind === 'auth') return <><AuthGateView returnTo={location.returnTo} onCancel={goOverview} onEmail={() => auth.openAuth('login')} /><AuthModal /><FirstTimeOnboardingGate onNavigate={navigateWorkspace} /></>;

  const financeWorkspace = isFinanceDestination(currentDestination);
  return <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink selection:bg-interactive selection:text-white"><Header currentDestination={currentDestination} onNavigate={navigateWorkspace} />{financeWorkspace ? <FinanceWorkspaceNavigation currentDestination={currentDestination} onNavigate={navigateWorkspace} /> : <Navigation currentDestination={currentDestination} onNavigate={navigateWorkspace} />}<main className="flex-1">{renderActiveView()}</main><Footer /><AuthModal /><SocialAuthDock />{auth.user && financeWorkspace && <FinanceAssistantDrawer module={currentDestination} onManageContext={() => navigateWorkspace('account')} />}<FirstTimeOnboardingGate onNavigate={navigateWorkspace} /></div>;
}
