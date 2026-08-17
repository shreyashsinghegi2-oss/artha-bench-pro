import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Menu, X, Sparkles, User } from 'lucide-react';
import { NavigationDestination } from '../types';

interface HeaderProps {
  currentDestination: NavigationDestination;
  onNavigate: (dest: NavigationDestination) => void;
}

interface NavItem {
  id: NavigationDestination;
  label: string;
}

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'markets', label: 'Market Data' },
  { id: 'quick-check', label: 'Quick Check' },
  { id: 'tutor', label: 'Financial Tutor' },
  { id: 'evaluation-lab', label: 'Evaluation Lab' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'batch', label: 'Batch Benchmark' },
  { id: 'connections', label: 'AI Connections' },
  { id: 'reports', label: 'Reports & History' },
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
  { id: 'learning', label: 'Learning Workspace' },
  { id: 'news', label: 'Business News' },
  { id: 'economy', label: 'Economic Data' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'settings', label: 'Settings' },
];

const ALL_NAV_ITEMS: NavItem[] = [...PRIMARY_NAV_ITEMS, ...SECONDARY_NAV_ITEMS];

export const Header: React.FC<HeaderProps> = ({
  currentDestination,
  onNavigate,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isGroqHealthy, setIsGroqHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    // Check Groq server health
    fetch('/api/diagnostics')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.diagnostics)) {
          const primaryGroq = data.diagnostics.find((diagnostic: any) => diagnostic.id === 'groq-primary');
          setIsGroqHealthy(primaryGroq?.status === 'connected');
        } else {
          setIsGroqHealthy(false);
        }
      })
      .catch(() => setIsGroqHealthy(false));
  }, []);

  const handleNavClick = (id: NavigationDestination) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="border-b border-line bg-surface sticky top-0 z-50 px-4 py-3">
      <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
        {/* Branding & Product Name */}
        <div
          onClick={() => handleNavClick('overview')}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="w-10 h-10 rounded-2xl bg-interactive p-0.5 shadow-sm transition-all flex items-center justify-center">
            <div className="w-full h-full bg-surface rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-interactive" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-extrabold text-ink tracking-tight">Artha</span>
                <span className="text-sm font-extrabold text-ink tracking-tight -mt-1">Bench</span>
              </div>
              <span className="text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-premium-soft text-premium border border-premium-fill/30">
                PRO V2.0
              </span>
            </div>
            <p className="text-[10px] text-secondary hidden xl:block mt-0.5">
              AI Financial Reliability Evaluation Framework
            </p>
          </div>
        </div>

        {/* Large Rounded Primary Navigation Container (Desktop) */}
        <nav className="hidden lg:flex items-center bg-surface border border-line rounded-2xl p-1.5 gap-1 overflow-x-auto scrollbar-thin max-w-full">
          {ALL_NAV_ITEMS.map((item) => {
            const isActive = currentDestination === item.id || (item.id === 'overview' && currentDestination === 'dashboard');
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-interactive-soft text-interactive shadow-sm'
                    : 'text-secondary hover:text-ink hover:bg-subtle/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Controls Right */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Consolidated Single Environment / AI Connection Control */}
          <button
            onClick={() => handleNavClick('connections')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isGroqHealthy
                ? 'bg-success-fill/10 text-success border-success-fill/30 hover:bg-success-fill/20'
                : 'bg-warning-fill/10 text-warning border-warning-fill/30 hover:bg-warning-fill/20'
            }`}
            title="Open live provider diagnostics"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isGroqHealthy ? 'bg-success-fill animate-pulse' : 'bg-warning-fill'
              }`}
            />
            <span>
              {isGroqHealthy === null ? '● Checking…' : isGroqHealthy ? '● AI Live' : '● Demo Mode'}
            </span>
          </button>

          {/* Settings Control Button */}
          <button
            onClick={() => handleNavClick('settings')}
            className={`p-2 rounded-xl bg-surface text-secondary hover:text-ink border transition-all ${
              currentDestination === 'settings' ? 'border-interactive text-ink' : 'border-line hover:border-interactive/50'
            }`}
            title="Settings & Controls"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Account & Research Workspace Button */}
          <button
            onClick={() => handleNavClick('account')}
            className={`p-2 rounded-xl bg-surface text-secondary hover:text-ink border transition-all ${
              currentDestination === 'account' ? 'border-interactive text-ink' : 'border-line hover:border-interactive/50'
            }`}
            title="User Profile & Account Workspace"
          >
            <User className="w-4 h-4" />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-surface text-secondary hover:text-ink border border-line lg:hidden"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-3 pt-3 border-t border-line bg-surface rounded-2xl p-4 space-y-2">
          <div className="text-[10px] uppercase font-bold text-secondary px-2 mb-1">Navigation (15 Destinations)</div>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_NAV_ITEMS.map((item) => {
              const isActive = currentDestination === item.id || (item.id === 'overview' && currentDestination === 'dashboard');
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition-all ${
                    isActive
                      ? 'bg-interactive-soft text-interactive font-bold'
                      : 'text-secondary hover:text-ink hover:bg-subtle/60'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
