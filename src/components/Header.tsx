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
  { id: 'markets', label: 'Market Data' },
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
    <header className="border-b border-[#1A1A23] bg-[#030303]/95 backdrop-blur-md sticky top-0 z-50 px-4 py-3">
      <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
        {/* Branding & Product Name */}
        <div
          onClick={() => handleNavClick('overview')}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#4F32FF] to-[#7137F2] p-0.5 shadow-lg shadow-[#4F32FF]/20 group-hover:shadow-[#4F32FF]/40 transition-all flex items-center justify-center">
            <div className="w-full h-full bg-[#08080E] rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#665CFF]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-extrabold text-[#F7F7FB] tracking-tight">Artha</span>
                <span className="text-sm font-extrabold text-[#F7F7FB] tracking-tight -mt-1">Bench</span>
              </div>
              <span className="text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#4F32FF]/20 text-[#665CFF] border border-[#4F32FF]/40">
                PRO V2.0
              </span>
            </div>
            <p className="text-[10px] text-[#9A9AAA] hidden xl:block mt-0.5">
              AI Financial Reliability Evaluation Framework
            </p>
          </div>
        </div>

        {/* Large Rounded Primary Navigation Container (Desktop) */}
        <nav className="hidden lg:flex items-center bg-[#08080E] border border-[#1A1A23] rounded-2xl p-1.5 gap-1 overflow-x-auto scrollbar-thin max-w-full">
          {ALL_NAV_ITEMS.map((item) => {
            const isActive = currentDestination === item.id || (item.id === 'overview' && currentDestination === 'dashboard');
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#4F32FF] text-[#F7F7FB] shadow-md shadow-[#4F32FF]/30'
                    : 'text-[#9A9AAA] hover:text-[#F7F7FB] hover:bg-[#1A1A23]/60'
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
                ? 'bg-[#00D68F]/10 text-[#00D68F] border-[#00D68F]/30 hover:bg-[#00D68F]/20'
                : 'bg-[#F5B800]/10 text-[#F5B800] border-[#F5B800]/30 hover:bg-[#F5B800]/20'
            }`}
            title="Open live provider diagnostics"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isGroqHealthy ? 'bg-[#00D68F] animate-pulse' : 'bg-[#F5B800]'
              }`}
            />
            <span>
              {isGroqHealthy === null ? '● Checking…' : isGroqHealthy ? '● AI Live' : '● Demo Mode'}
            </span>
          </button>

          {/* Settings Control Button */}
          <button
            onClick={() => handleNavClick('settings')}
            className={`p-2 rounded-xl bg-[#08080E] text-[#9A9AAA] hover:text-[#F7F7FB] border transition-all ${
              currentDestination === 'settings' ? 'border-[#4F32FF] text-[#F7F7FB]' : 'border-[#1A1A23] hover:border-[#4F32FF]/50'
            }`}
            title="Settings & Controls"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Account & Research Workspace Button */}
          <button
            onClick={() => handleNavClick('account')}
            className={`p-2 rounded-xl bg-[#08080E] text-[#9A9AAA] hover:text-[#F7F7FB] border transition-all ${
              currentDestination === 'account' ? 'border-[#4F32FF] text-[#F7F7FB]' : 'border-[#1A1A23] hover:border-[#4F32FF]/50'
            }`}
            title="User Profile & Account Workspace"
          >
            <User className="w-4 h-4" />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-[#08080E] text-[#9A9AAA] hover:text-[#F7F7FB] border border-[#1A1A23] lg:hidden"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-3 pt-3 border-t border-[#1A1A23] bg-[#08080E] rounded-2xl p-4 space-y-2">
          <div className="text-[10px] uppercase font-bold text-[#9A9AAA] px-2 mb-1">Navigation (14 Destinations)</div>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_NAV_ITEMS.map((item) => {
              const isActive = currentDestination === item.id || (item.id === 'overview' && currentDestination === 'dashboard');
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition-all ${
                    isActive
                      ? 'bg-[#4F32FF] text-[#F7F7FB] font-bold'
                      : 'text-[#9A9AAA] hover:text-[#F7F7FB] hover:bg-[#1A1A23]/60'
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
