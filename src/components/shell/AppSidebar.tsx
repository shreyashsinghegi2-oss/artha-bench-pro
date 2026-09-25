import React, { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, Bell, BookOpen, Bot, Briefcase, CalendarClock, ChevronDown, ChevronsLeft, ChevronsRight, Coins, Crown, DollarSign, FileBarChart2,
  FlaskConical, Gauge, GraduationCap, HeartPulse, Home, Landmark, LayoutDashboard, LineChart, Lock, Menu, Newspaper, PieChart, Plug, ReceiptText,
  Settings, Sparkles, Star, Timer, TrendingUp, User, WalletCards, Waves, X, Sunset, BriefcaseBusiness } from 'lucide-react';
import type { AppNavigationDestination } from '../../navigationTypes';
import { pathForDestination, PRIVATE_FINANCE_DESTINATIONS } from '../../appRoutes';
import './appSidebar.css';

type Icon = React.ComponentType<{ size?: number }>;
interface Item { id: AppNavigationDestination; label: string; icon: Icon }
interface Group { title: string; items: Item[]; collapsed?: boolean }

/** One navigation for the whole app, grouped the way people think about money. */
export const NAV_GROUPS: Group[] = [
  { title: 'Home', items: [
    { id: 'my-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'overview', label: 'Money report', icon: Gauge },
  ] },
  { title: 'Money', items: [
    { id: 'portfolio', label: 'Portfolio & net worth', icon: PieChart },
    { id: 'financial-health', label: 'Health score', icon: HeartPulse },
    { id: 'decision-replay', label: 'What-if', icon: Sparkles },
    { id: 'financial-twin', label: 'Ripple Twin', icon: Waves },
  ] },
  { title: 'Plan', items: [
    { id: 'retirement-planner', label: 'Retirement planner', icon: Sunset },
    { id: 'education-planner', label: 'Child education', icon: GraduationCap },
    { id: 'job-switch-planner', label: 'Job switch', icon: BriefcaseBusiness },
    { id: 'money-planner', label: 'Invest a lump sum', icon: Coins },
  ] },
  { title: 'Track', items: [
    { id: 'income', label: 'Income & tax', icon: WalletCards },
    { id: 'expenses', label: 'Expenses', icon: ReceiptText },
    { id: 'budgeting', label: 'Budget', icon: Landmark },
    { id: 'emi-manager', label: 'EMI & loans', icon: CalendarClock },
    { id: 'finance-reports', label: 'Reports', icon: FileBarChart2 },
  ] },
  { title: 'Markets', items: [
    { id: 'markets', label: 'Market overview', icon: LineChart },
    { id: 'india-markets', label: 'Indian stocks', icon: TrendingUp },
    { id: 'us-markets', label: 'US stocks', icon: Activity },
    { id: 'forex-markets', label: 'Forex', icon: DollarSign },
    { id: 'crypto', label: 'Crypto', icon: Coins },
    { id: 'intraday-markets', label: 'Intraday lab', icon: Timer },
    { id: 'market-watchlist', label: 'Watchlist', icon: Star },
    { id: 'market-alerts', label: 'Alerts', icon: Bell },
    { id: 'news', label: 'Business news', icon: Newspaper },
    { id: 'economy', label: 'Economy', icon: Briefcase },
  ] },
  { title: 'Learn & AI', items: [
    { id: 'tutor', label: 'AI tutor', icon: Bot },
    { id: 'learning', label: 'Courses', icon: GraduationCap },
    { id: 'markets-learn', label: 'Market lessons', icon: BookOpen },
    { id: 'dashboard', label: 'Research desk', icon: LayoutDashboard },
    { id: 'scenarios', label: 'Scenario lab', icon: FlaskConical },
  ] },
  { title: 'AI reliability lab', collapsed: true, items: [
    { id: 'evaluation-lab', label: 'Evaluation lab', icon: FlaskConical },
    { id: 'quick-check', label: 'Quick check', icon: AlertTriangle },
    { id: 'comparison', label: 'Compare answers', icon: Activity },
    { id: 'batch', label: 'Batch benchmark', icon: FileBarChart2 },
    { id: 'reports', label: 'Evaluation reports', icon: FileBarChart2 },
    { id: 'methodology', label: 'Methodology', icon: BookOpen },
  ] },
  { title: 'Account', collapsed: true, items: [
    { id: 'account', label: 'Profile', icon: User },
    { id: 'connections', label: 'Connections', icon: Plug },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'go-pro', label: 'Go Pro', icon: Crown },
  ] },
];

const COLLAPSE_KEY = 'arthamind-sidebar-collapsed';
const GROUP_KEY = 'arthamind-sidebar-groups';

function readJson<T>(key: string, fallback: T): T { try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function writeJson(key: string, value: unknown) { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ } }
const isPlainClick = (e: React.MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

const NavList: React.FC<{ current: AppNavigationDestination; onNavigate: (d: AppNavigationDestination) => void; signedIn: boolean; narrow?: boolean }> = ({ current, onNavigate, signedIn, narrow }) => {
  const [open, setOpen] = useState<Record<string, boolean>>(() => readJson(GROUP_KEY, {}));
  useEffect(() => writeJson(GROUP_KEY, open), [open]);
  return <nav className="sb-nav" aria-label="Workspace">
    {NAV_GROUPS.map((g) => {
      const hasCurrent = g.items.some((i) => i.id === current);
      const expanded = narrow || hasCurrent || (open[g.title] ?? !g.collapsed);
      return <div key={g.title} className="sb-group">
        {!narrow && <button type="button" className="sb-group-title" aria-expanded={expanded} onClick={() => setOpen((o) => ({ ...o, [g.title]: !expanded }))}>
          {g.title}<ChevronDown size={13} className={expanded ? 'open' : ''}/>
        </button>}
        {expanded && <ul>{g.items.map((it) => {
          const Icon = it.icon;
          const locked = !signedIn && PRIVATE_FINANCE_DESTINATIONS.has(it.id);
          return <li key={it.id}>
            <a href={pathForDestination(it.id)} className={`sb-item ${current === it.id ? 'on' : ''}`} aria-current={current === it.id ? 'page' : undefined} title={narrow ? it.label : undefined}
              onClick={(e) => { if (!isPlainClick(e)) return; e.preventDefault(); onNavigate(it.id); }}>
              <Icon size={17}/>{!narrow && <span>{it.label}</span>}{!narrow && locked && <Lock size={12} className="sb-lock" aria-label="Sign in to use"/>}
            </a>
          </li>;
        })}</ul>}
      </div>;
    })}
  </nav>;
};

/** Desktop: a collapsible left sidebar. */
export const AppSidebar: React.FC<{ current: AppNavigationDestination; onNavigate: (d: AppNavigationDestination) => void; signedIn: boolean }> = (props) => {
  const [narrow, setNarrow] = useState<boolean>(() => readJson(COLLAPSE_KEY, false));
  useEffect(() => writeJson(COLLAPSE_KEY, narrow), [narrow]);
  return <aside className={`sb ${narrow ? 'narrow' : ''}`}>
    <NavList {...props} narrow={narrow}/>
    <button type="button" className="sb-collapse" onClick={() => setNarrow((n) => !n)} aria-label={narrow ? 'Expand sidebar' : 'Collapse sidebar'}>
      {narrow ? <ChevronsRight size={16}/> : <><ChevronsLeft size={16}/><span>Collapse</span></>}
    </button>
  </aside>;
};

const TABS: Array<{ id: AppNavigationDestination; label: string; icon: Icon }> = [
  { id: 'my-dashboard', label: 'Home', icon: Home },
  { id: 'portfolio', label: 'Portfolio', icon: PieChart },
  { id: 'markets', label: 'Markets', icon: LineChart },
  { id: 'tutor', label: 'Learn', icon: GraduationCap },
];

/** Phone: a bottom tab bar with the four most used places, plus "More" for everything. */
export const MobileTabBar: React.FC<{ current: AppNavigationDestination; onNavigate: (d: AppNavigationDestination) => void; signedIn: boolean }> = ({ current, onNavigate, signedIn }) => {
  const [more, setMore] = useState(false);
  useEffect(() => { setMore(false); }, [current]);
  useEffect(() => { document.body.classList.add('has-tabbar'); return () => document.body.classList.remove('has-tabbar'); }, []);
  return <>
    <nav className="tb" aria-label="Main">
      {TABS.map((t) => { const I = t.icon; return <a key={t.id} href={pathForDestination(t.id)} className={current === t.id ? 'on' : ''} onClick={(e) => { if (!isPlainClick(e)) return; e.preventDefault(); onNavigate(t.id); }}><I size={20}/><span>{t.label}</span></a>; })}
      <button type="button" className={more ? 'on' : ''} onClick={() => setMore(true)}><Menu size={20}/><span>More</span></button>
    </nav>
    {more && <div className="tb-sheet" role="dialog" aria-label="All features" onClick={(e) => { if (e.target === e.currentTarget) setMore(false); }}>
      <div className="tb-panel">
        <header><b>All features</b><button type="button" onClick={() => setMore(false)} aria-label="Close"><X size={18}/></button></header>
        <NavList current={current} onNavigate={onNavigate} signedIn={signedIn}/>
      </div>
    </div>}
  </>;
};
