import React from 'react';
import {
  BarChart3, BookOpen, BrainCircuit, BriefcaseBusiness, Calculator,
  FlaskConical, GraduationCap, Home, Landmark, LineChart, Newspaper, Settings,
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

const MONEY_ITEMS: NavigationItem[] = [
  { id: 'overview', label: 'Home', icon: Home },
  { id: 'income', label: 'Income & tax', icon: WalletCards },
  { id: 'expenses', label: 'Expenses', icon: Calculator },
  { id: 'budgeting', label: 'Budgeting', icon: BriefcaseBusiness },
];

const MARKET_ITEMS: NavigationItem[] = [
  { id: 'markets', label: 'Market data', icon: LineChart },
  { id: 'crypto', label: 'Crypto', icon: Sparkles },
  { id: 'news', label: 'Business news', icon: Newspaper },
  { id: 'economy', label: 'Economic data', icon: Landmark },
  { id: 'dashboard', label: 'Research dashboard', icon: BarChart3 },
];

const LEARN_ITEMS: NavigationItem[] = [
  { id: 'tutor', label: 'Financial tutor', icon: GraduationCap },
  { id: 'learning', label: 'Learning', icon: BookOpen },
  { id: 'quick-check', label: 'Quick check', icon: Zap },
  { id: 'scenarios', label: 'Calculators', icon: Calculator },
];

/** Tools for testing AI answers. Folded away unless one of them is open. */
const LAB_ITEMS: NavigationItem[] = [
  { id: 'evaluation-lab', label: 'Evaluation lab', icon: FlaskConical },
  { id: 'comparison', label: 'Model comparison', icon: BarChart3 },
  { id: 'batch', label: 'Batch benchmark', icon: BrainCircuit },
  { id: 'reports', label: 'Reports & history', icon: BookOpen },
  { id: 'connections', label: 'AI connections', icon: ShieldCheck },
  { id: 'methodology', label: 'Methodology', icon: ShieldCheck },
];

const SYSTEM_ITEMS: NavigationItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const NAVIGATION_ITEMS = [...MONEY_ITEMS, ...MARKET_ITEMS, ...LEARN_ITEMS, ...LAB_ITEMS, ...SYSTEM_ITEMS];

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
          const active = currentDestination === id;
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
        <strong>ArthaMind</strong>
        <span>Your money, markets and learning</span>
      </div>

      <div className="dashboard-sidebar-groups">
        <NavigationGroup title="My money" items={MONEY_ITEMS} currentDestination={currentDestination} onNavigate={onNavigate} />
        <NavigationGroup title="Markets" items={MARKET_ITEMS} currentDestination={currentDestination} onNavigate={onNavigate} />
        <NavigationGroup title="Learn & ask" items={LEARN_ITEMS} currentDestination={currentDestination} onNavigate={onNavigate} />
        <details className="dashboard-nav-lab" open={LAB_ITEMS.some((item) => item.id === currentDestination) || undefined}>
          <summary>AI reliability lab</summary>
          <NavigationGroup title="Lab tools" items={LAB_ITEMS} currentDestination={currentDestination} onNavigate={onNavigate} />
        </details>
        <NavigationGroup title="Account" items={SYSTEM_ITEMS} currentDestination={currentDestination} onNavigate={onNavigate} />
      </div>

      <div className="dashboard-sidebar-note">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Your money profile stays on this device. Data sources are labelled on every page.</span>
      </div>
    </div>

    <div className="dashboard-mobile-nav">
      <div className="max-w-[1700px] mx-auto flex items-center gap-1 min-w-max">
        {NAVIGATION_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = currentDestination === id;
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
