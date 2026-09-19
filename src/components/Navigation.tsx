import React from 'react';
import {
  BarChart3, BookOpen, BrainCircuit, BriefcaseBusiness, Calculator,
  FlaskConical, GraduationCap, Landmark, LineChart, Newspaper, Settings,
  ShieldCheck, Sparkles, WalletCards, Zap,
} from 'lucide-react';
import { AppNavigationDestination } from '../navigationTypes';

interface NavigationProps {
  currentDestination: AppNavigationDestination;
  onNavigate: (dest: AppNavigationDestination) => void;
}

type NavigationItem = {
  id: AppNavigationDestination;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const WORKSPACE_ITEMS: NavigationItem[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'income', label: 'Income', icon: WalletCards },
  { id: 'expenses', label: 'Expenses', icon: Calculator },
  { id: 'budgeting', label: 'Budgeting', icon: BriefcaseBusiness },
  { id: 'markets', label: 'Market Data', icon: LineChart },
  { id: 'crypto', label: 'Crypto', icon: Sparkles },
];

const RESEARCH_ITEMS: NavigationItem[] = [
  { id: 'quick-check', label: 'Quick Check', icon: Zap },
  { id: 'tutor', label: 'Financial Tutor', icon: GraduationCap },
  { id: 'evaluation-lab', label: 'Evaluation Lab', icon: FlaskConical },
  { id: 'comparison', label: 'Comparison', icon: BarChart3 },
  { id: 'scenarios', label: 'Scenarios', icon: Landmark },
  { id: 'batch', label: 'Batch Benchmark', icon: BrainCircuit },
  { id: 'connections', label: 'AI Connections', icon: ShieldCheck },
  { id: 'reports', label: 'Reports & History', icon: BookOpen },
  { id: 'learning', label: 'Learning', icon: GraduationCap },
  { id: 'news', label: 'Business News', icon: Newspaper },
  { id: 'economy', label: 'Economic Data', icon: Landmark },
];

const SYSTEM_ITEMS: NavigationItem[] = [
  { id: 'methodology', label: 'Methodology', icon: ShieldCheck },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const NAVIGATION_ITEMS = [...WORKSPACE_ITEMS, ...RESEARCH_ITEMS, ...SYSTEM_ITEMS];

function NavigationGroup({
  title,
  items,
  currentDestination,
  onNavigate,
}: {
  title: string;
  items: NavigationItem[];
  currentDestination: AppNavigationDestination;
  onNavigate: (dest: AppNavigationDestination) => void;
}) {
  return (
    <section className="dashboard-nav-group" aria-labelledby={`dashboard-nav-${title.toLowerCase().replace(/\\s+/g, '-')}`}>
      <p id={`dashboard-nav-${title.toLowerCase().replace(/\\s+/g, '-')}`} className="dashboard-nav-label">
        {title}
      </p>
      <div className="space-y-1">
        {items.map(({ id, label, icon: Icon }) => {
          const active = currentDestination === id || (id === 'overview' && currentDestination === 'dashboard');
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={active ? 'page' : undefined}
              className={`dashboard-nav-item ${active ? 'dashboard-nav-item-active' : ''}`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export const Navigation: React.FC<NavigationProps> = ({ currentDestination, onNavigate }) => (
  <aside className="dashboard-sidebar" aria-label="Artha Bench workspace navigation">
    <div className="dashboard-sidebar-inner">
      <div className="dashboard-sidebar-intro">
        <span className="dashboard-sidebar-kicker">Workspace</span>
        <strong>Artha Bench Pro</strong>
        <span>Financial intelligence tools</span>
      </div>

      <div className="dashboard-sidebar-groups">
        <NavigationGroup title="Workspace" items={WORKSPACE_ITEMS} currentDestination={currentDestination} onNavigate={onNavigate} />
        <NavigationGroup title="Research & tools" items={RESEARCH_ITEMS} currentDestination={currentDestination} onNavigate={onNavigate} />
        <NavigationGroup title="System" items={SYSTEM_ITEMS} currentDestination={currentDestination} onNavigate={onNavigate} />
      </div>

      <div className="dashboard-sidebar-note">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Provider status and reliability labels stay visible throughout the workspace.</span>
      </div>
    </div>

    <div className="dashboard-mobile-nav">
      <div className="max-w-[1700px] mx-auto flex items-center gap-1 min-w-max">
        {NAVIGATION_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = currentDestination === id || (id === 'overview' && currentDestination === 'dashboard');
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={active ? 'page' : undefined}
              className={`dashboard-mobile-nav-item ${active ? 'dashboard-mobile-nav-item-active' : ''}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  </aside>
);
