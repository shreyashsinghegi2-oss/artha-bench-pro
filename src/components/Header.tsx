import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Menu, X, User, Moon, Sun } from 'lucide-react';
import { AppNavigationDestination } from '../navigationTypes';
import { ArthaBenchLogo } from './branding/ArthaBenchLogo';
import { AllFeaturesMenu } from './AllFeaturesMenu';
import { useAuth } from '../auth/AuthContext';

interface HeaderProps {
  currentDestination: AppNavigationDestination;
  onNavigate: (dest: AppNavigationDestination) => void;
}

interface NavItem { id: AppNavigationDestination; label: string; }

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview' }, { id: 'income', label: 'Income' }, { id: 'expenses', label: 'Expenses' }, { id: 'budgeting', label: 'Budgeting' },
  { id: 'markets', label: 'Market Data' }, { id: 'crypto', label: 'Crypto' }, { id: 'quick-check', label: 'Quick Check' }, { id: 'tutor', label: 'Financial Tutor' },
  { id: 'evaluation-lab', label: 'Evaluation Lab' }, { id: 'comparison', label: 'Comparison' }, { id: 'scenarios', label: 'Scenarios' }, { id: 'batch', label: 'Batch Benchmark' },
  { id: 'connections', label: 'AI Connections' }, { id: 'reports', label: 'Reports & History' },
];
const SECONDARY_NAV_ITEMS: NavItem[] = [
  { id: 'learning', label: 'Learning Workspace' }, { id: 'news', label: 'Business News' }, { id: 'economy', label: 'Economic Data' }, { id: 'methodology', label: 'Methodology' }, { id: 'settings', label: 'Settings' },
];
const ALL_NAV_ITEMS = [...PRIMARY_NAV_ITEMS, ...SECONDARY_NAV_ITEMS];
const THEME_STORAGE_KEY = 'artha-bench-theme';
type ThemeMode = 'light' | 'dark';

export const Header: React.FC<HeaderProps> = ({ currentDestination, onNavigate }) => {
  const auth = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isGroqHealthy, setIsGroqHealthy] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark';
    root.classList.toggle('dark', isDark);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    fetch('/api/diagnostics').then((res) => res.json()).then((data) => {
      if (Array.isArray(data.diagnostics)) {
        const primaryGroq = data.diagnostics.find((diagnostic: any) => diagnostic.id === 'groq-primary');
        setIsGroqHealthy(primaryGroq?.status === 'connected');
      } else setIsGroqHealthy(false);
    }).catch(() => setIsGroqHealthy(false));
  }, []);

  const handleNavClick = (id: AppNavigationDestination) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };
  const isDarkMode = theme === 'dark';
  const openAccount = () => {
    if (auth.user) handleNavClick('account');
    else auth.openAuth('login');
  };

  return <header className="border-b border-line bg-surface sticky top-0 z-50 px-4 py-3"><div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
    <button type="button" onClick={() => handleNavClick('overview')} className="group shrink-0 rounded-2xl text-left focus:outline-none focus:ring-2 focus:ring-interactive focus:ring-offset-2 focus:ring-offset-canvas" aria-label="Open Artha Bench overview"><ArthaBenchLogo /></button>
    <nav className="hidden lg:flex items-center bg-surface border border-line rounded-2xl p-1.5 gap-1 overflow-x-auto scrollbar-thin max-w-full">
      {ALL_NAV_ITEMS.map((item) => { const active = currentDestination === item.id || (item.id === 'overview' && currentDestination === 'dashboard'); return <button key={item.id} onClick={() => handleNavClick(item.id)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${active ? 'bg-interactive-soft text-interactive shadow-sm' : 'text-secondary hover:text-ink hover:bg-subtle/60'}`}>{item.label}</button>; })}
    </nav>
    <div className="flex items-center gap-2 shrink-0">
      <button onClick={() => handleNavClick('connections')} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${isGroqHealthy ? 'bg-success-fill/10 text-success border-success-fill/30 hover:bg-success-fill/20' : 'bg-warning-fill/10 text-warning border-warning-fill/30 hover:bg-warning-fill/20'}`} title="Open provider diagnostics"><span className={`w-2 h-2 rounded-full ${isGroqHealthy ? 'bg-success-fill animate-pulse' : 'bg-warning-fill'}`} /><span>{isGroqHealthy === null ? '● Checking…' : isGroqHealthy ? '● AI Live' : '● AI Unavailable'}</span></button>
      <button type="button" onClick={() => setTheme(isDarkMode ? 'light' : 'dark')} className="flex items-center gap-2 p-2 xl:px-3 rounded-xl bg-surface text-secondary hover:text-ink border border-line hover:border-interactive/50 transition-all" title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'} aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={isDarkMode}>{isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}<span className="hidden xl:inline text-xs font-semibold">{isDarkMode ? 'Light' : 'Night'}</span></button>
      <AllFeaturesMenu currentDestination={currentDestination} onNavigate={handleNavClick} isDarkMode={isDarkMode} onToggleTheme={() => setTheme(isDarkMode ? 'light' : 'dark')} />
      <button onClick={() => handleNavClick('settings')} className={`p-2 rounded-xl bg-surface text-secondary hover:text-ink border transition-all ${currentDestination === 'settings' ? 'border-interactive text-ink' : 'border-line hover:border-interactive/50'}`} title="Settings & Controls"><SlidersHorizontal className="w-4 h-4" /></button>
      <button onClick={openAccount} className={`relative p-2 rounded-xl bg-surface text-secondary hover:text-ink border transition-all ${currentDestination === 'account' && auth.user ? 'border-interactive text-ink' : 'border-line hover:border-interactive/50'}`} title={auth.user ? `Account: ${auth.user.email ?? 'signed in'}` : 'Sign in to your private workspace'} aria-label={auth.user ? 'Open account workspace' : 'Sign in to Artha Bench Pro'}><User className="w-4 h-4" />{auth.user && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success-fill" aria-label="Signed in" />}</button>
      <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-xl bg-surface text-secondary hover:text-ink border border-line lg:hidden" aria-label="Toggle navigation menu">{mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
    </div>
  </div>{mobileMenuOpen && <div className="lg:hidden mt-3 pt-3 border-t border-line bg-surface rounded-2xl p-4 space-y-2"><div className="text-[10px] uppercase font-bold text-secondary px-2 mb-1">Navigation</div><div className="grid grid-cols-2 gap-1.5">{ALL_NAV_ITEMS.map((item) => { const active = currentDestination === item.id || (item.id === 'overview' && currentDestination === 'dashboard'); return <button key={item.id} onClick={() => handleNavClick(item.id)} className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition-all ${active ? 'bg-interactive-soft text-interactive font-bold' : 'text-secondary hover:text-ink hover:bg-subtle/60'}`}>{item.label}</button>; })}</div></div>}</header>;
};
