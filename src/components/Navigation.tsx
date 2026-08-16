import React from 'react';
import { NavigationDestination } from '../types';

interface NavigationProps {
  currentDestination: NavigationDestination;
  onNavigate: (dest: NavigationDestination) => void;
}

export const NAVIGATION_ITEMS: { id: NavigationDestination; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'quick-check', label: 'Quick Check' },
  { id: 'tutor', label: 'Financial Tutor' },
  { id: 'evaluation-lab', label: 'Evaluation Lab' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'batch', label: 'Batch Benchmark' },
  { id: 'connections', label: 'AI Connections' },
  { id: 'reports', label: 'Reports & History' },
  { id: 'learning', label: 'Learning' },
  { id: 'news', label: 'Business News' },
  { id: 'markets', label: 'Market Data' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'settings', label: 'Settings' },
];

export const Navigation: React.FC<NavigationProps> = ({ currentDestination, onNavigate }) => {
  return (
    <div className="bg-[#030303] border-b border-[#1A1A23] px-4 py-2 overflow-x-auto scrollbar-thin lg:hidden">
      <div className="max-w-[1700px] mx-auto flex items-center gap-1 min-w-max">
        {NAVIGATION_ITEMS.map((item) => {
          const isActive = currentDestination === item.id || (item.id === 'overview' && currentDestination === 'dashboard');
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#4F32FF] text-[#F7F7FB] shadow-md shadow-[#4F32FF]/30'
                  : 'text-[#9A9AAA] hover:text-[#F7F7FB] hover:bg-[#08080E]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
