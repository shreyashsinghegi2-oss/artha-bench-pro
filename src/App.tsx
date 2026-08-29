import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AppLocation, PublicPageId, pushDestination, pushLanding, pushPublicPage, pushSampleWorkspace, readAppLocation } from './appRoutes';
import { AppNavigationDestination, isFinanceDestination } from './navigationTypes';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { FinanceWorkspaceNavigation } from './components/finance/FinanceWorkspaceNavigation';
import { FinanceOverviewView } from './components/finance/FinanceOverviewView';
import { FinanceAssistantDrawer } from './components/finance/FinanceAssistantDrawer';
import { Footer } from './components/Footer';
import { DashboardView } from './components/dashboard/DashboardView';
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
import { FirstTimeOnboardingGate } from './components/onboarding/FirstTimeOnboardingGate';
import { PublicInfoPage } from './components/public/PublicInfoPage';
import { SampleWorkspace } from './components/sample/SampleWorkspace';
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

  const navigateWorkspace = useCallback((destination: AppNavigationDestination = 'overview') => {
    pushDestination(destination);
    setLocation({ kind: 'workspace', destination });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);
  const navigatePublic = useCallback((page: PublicPageId) => { pushPublicPage(page); setLocation({ kind: 'public', page }); window.scrollTo({ top: 0, behavior: 'auto' }); }, []);
  const goHome = useCallback(() => { pushLanding(); setLocation({ kind: 'landing' }); window.scrollTo({ top: 0, behavior: 'auto' }); }, []);
  const openSample = useCallback(() => { pushSampleWorkspace(); setLocation({ kind: 'sample' }); window.scrollTo({ top: 0, behavior: 'auto' }); }, []);

  const renderActiveView = () => {
    switch (currentDestination) {
      case 'overview': return <FinanceOverviewView onNavigate={navigateWorkspace} onTrySample={openSample} onSignIn={() => auth.openAuth('login')} />;
      case 'dashboard': return <DashboardView onNavigate={(destination) => navigateWorkspace(destination)} />;
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
      default: return <FinanceOverviewView onNavigate={navigateWorkspace} onTrySample={openSample} onSignIn={() => auth.openAuth('login')} />;
    }
  };

  if (auth.loading) return <div className="flex min-h-screen items-center justify-center bg-canvas text-ink"><div className="rounded-2xl border border-line bg-surface px-6 py-5 text-sm font-semibold text-secondary shadow-sm">Restoring your Artha Bench workspace…</div></div>;

  if (location.kind === 'landing') return <><ArthaMindLandingPage signedIn={Boolean(auth.user)} onEnter={(destination) => navigateWorkspace(destination ?? 'overview')} onSignIn={() => auth.openAuth('login')} /><AuthModal /><FirstTimeOnboardingGate onNavigate={navigateWorkspace} /></>;
  if (location.kind === 'public') return <><PublicInfoPage page={location.page} onHome={goHome} onWorkspace={() => navigateWorkspace('overview')} /><AuthModal /><FirstTimeOnboardingGate onNavigate={navigateWorkspace} /></>;
  if (location.kind === 'sample') return <><SampleWorkspace onExit={goHome} onUseOwnData={navigateWorkspace} /><AuthModal /><FirstTimeOnboardingGate onNavigate={navigateWorkspace} /></>;

  const financeWorkspace = isFinanceDestination(currentDestination);
  return <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink selection:bg-interactive selection:text-white"><Header currentDestination={currentDestination} onNavigate={navigateWorkspace} />{financeWorkspace ? <FinanceWorkspaceNavigation currentDestination={currentDestination} onNavigate={navigateWorkspace} /> : <Navigation currentDestination={currentDestination} onNavigate={navigateWorkspace} />}<main className="flex-1">{renderActiveView()}</main><Footer /><AuthModal /><SocialAuthDock />{financeWorkspace && <FinanceAssistantDrawer module={currentDestination} onManageContext={() => navigateWorkspace('account')} />}<FirstTimeOnboardingGate onNavigate={navigateWorkspace} /></div>;
}
