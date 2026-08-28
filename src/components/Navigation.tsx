import React from 'react';
import { AppNavigationDestination } from '../navigationTypes';

interface NavigationProps { currentDestination: AppNavigationDestination; onNavigate: (dest: AppNavigationDestination) => void; }

export const NAVIGATION_ITEMS: { id: AppNavigationDestination; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'income', label: 'Income' }, { id: 'expenses', label: 'Expenses' }, { id: 'budgeting', label: 'Budgeting' },
  { id: 'markets', label: 'Market Data' }, { id: 'crypto', label: 'Crypto' }, { id: 'quick-check', label: 'Quick Check' }, { id: 'tutor', label: 'Financial Tutor' },
  { id: 'evaluation-lab', label: 'Evaluation Lab' }, { id: 'comparison', label: 'Comparison' }, { id: 'scenarios', label: 'Scenarios' }, { id: 'batch', label: 'Batch Benchmark' },
  { id: 'connections', label: 'AI Connections' }, { id: 'reports', label: 'Reports & History' }, { id: 'learning', label: 'Learning' }, { id: 'news', label: 'Business News' },
  { id: 'economy', label: 'Economic Data' }, { id: 'methodology', label: 'Methodology' }, { id: 'settings', label: 'Settings' },
];

export const Navigation: React.FC<NavigationProps> = ({ currentDestination, onNavigate }) => <div className="bg-canvas border-b border-line px-4 py-2 overflow-x-auto scrollbar-thin lg:hidden"><div className="max-w-[1700px] mx-auto flex items-center gap-1 min-w-max">{NAVIGATION_ITEMS.map((item) => { const active = currentDestination === item.id || (item.id === 'overview' && currentDestination === 'dashboard'); return <button key={item.id} onClick={() => onNavigate(item.id)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${active ? 'bg-interactive-soft text-interactive shadow-sm' : 'text-secondary hover:text-ink hover:bg-surface'}`}>{item.label}</button>; })}</div></div>;
