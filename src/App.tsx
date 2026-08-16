import React, { useState } from 'react';
import { NavigationDestination } from './types';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import { DashboardView } from './components/dashboard/DashboardView';
import { LearningView } from './components/learning/LearningView';
import { MarketView } from './components/market/MarketView';
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

export default function App() {
  const [currentDestination, setCurrentDestination] = useState<NavigationDestination>('overview');

  const renderActiveView = () => {
    switch (currentDestination) {
      case 'dashboard':
      case 'overview':
        return <DashboardView onNavigate={setCurrentDestination} />;
      case 'learning':
        return <LearningView />;
      case 'markets':
        return <MarketView />;
      case 'news':
        return <NewsView />;
      case 'quick-check':
        return <QuickCheckView />;
      case 'tutor':
        return <TutorView />;
      case 'evaluation-lab':
        return <EvaluationLabView />;
      case 'comparison':
        return <ComparisonView />;
      case 'scenarios':
        return <ScenariosView />;
      case 'batch':
        return <BatchBenchmarkView />;
      case 'reports':
        return <ReportsView />;
      case 'methodology':
        return <MethodologyView />;
      case 'connections':
        return <ConnectionsView />;
      case 'settings':
        return <SettingsView />;
      case 'account':
        return <AccountView />;
      default:
        return <DashboardView onNavigate={setCurrentDestination} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-[#F7F7FB] flex flex-col font-sans selection:bg-[#4F32FF] selection:text-[#F7F7FB]">
      {/* Global Header */}
      <Header
        currentDestination={currentDestination}
        onNavigate={setCurrentDestination}
      />

      {/* Secondary Mobile Navigation */}
      <Navigation currentDestination={currentDestination} onNavigate={setCurrentDestination} />

      {/* Active Main View Content */}
      <main className="flex-1">{renderActiveView()}</main>

      {/* Global Footer */}
      <Footer />
    </div>
  );
}
