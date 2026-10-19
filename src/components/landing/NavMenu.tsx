import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { AppNavigationDestination } from '../../navigationTypes';
import './navMenu.css';

export interface MenuItem { label: string; desc: string; to: AppNavigationDestination }
export interface MenuGroup { id: string; label: string; art: string; title: string; blurb: string; lead: AppNavigationDestination; items: MenuItem[] }

/** Header menus: each opens a panel with an illustration from ArthaMind City and the tools inside it. */
export const MENU: MenuGroup[] = [
  {
    id: 'money', label: 'Money', art: '/hero/menu/money.webp', title: 'Check your money health', lead: 'financial-health',
    blurb: 'A score for your finances, with what to fix first: savings, debt, cover and cash flow.',
    items: [
      { label: 'Money health score', desc: 'Your score in 2 minutes, with next steps', to: 'financial-health' },
      { label: 'Budget & expenses', desc: 'See where every rupee goes each month', to: 'budgeting' },
      { label: 'Income tracker', desc: 'Salary, rent, side income in one place', to: 'income' },
      { label: 'EMI & loans', desc: 'Prepay or invest? Plan every loan', to: 'emi-manager' },
      { label: 'Money reports', desc: 'Monthly reports you can download', to: 'finance-reports' },
      { label: 'My dashboard', desc: 'Everything about your money on one page', to: 'my-dashboard' },
    ],
  },
  {
    id: 'plan', label: 'Plan', art: '/hero/menu/plan.webp', title: 'Plan every goal', lead: 'money-planner',
    blurb: "Retirement, your child's education, a home, a job change. Plans built from your real numbers.",
    items: [
      { label: 'Retirement planner', desc: 'How much you need, and the SIP to get there', to: 'retirement-planner' },
      { label: 'Child education', desc: 'Bachelors or masters, India or abroad', to: 'education-planner' },
      { label: 'Money planner', desc: 'Where to put a lump sum', to: 'money-planner' },
      { label: 'Job switch planner', desc: 'Compare offers after tax and costs', to: 'job-switch-planner' },
      { label: 'Financial twin', desc: 'See your next 10 years before they happen', to: 'financial-twin' },
      { label: 'What-if scenarios', desc: 'Test big decisions safely', to: 'scenarios' },
    ],
  },
  {
    id: 'invest', label: 'Invest', art: '/hero/menu/invest.webp', title: 'Track and grow investments', lead: 'portfolio',
    blurb: 'Import your mutual funds, see true returns, and follow Indian and global markets live.',
    items: [
      { label: 'Portfolio', desc: 'Mutual fund statement import and true returns (XIRR)', to: 'portfolio' },
      { label: 'India markets', desc: 'NIFTY, SENSEX and stocks, live', to: 'india-markets' },
      { label: 'US markets', desc: 'S&P 500, NASDAQ and US stocks', to: 'us-markets' },
      { label: 'Watchlist', desc: 'Follow the stocks you care about', to: 'market-watchlist' },
      { label: 'Crypto', desc: 'Prices, charts and the tax rules', to: 'crypto' },
      { label: 'Market news', desc: 'What moved the market today', to: 'news' },
    ],
  },
  {
    id: 'learn', label: 'Learn', art: '/hero/menu/learn.webp', title: 'Your ArthaMind CFO, with experts', lead: 'tutor',
    blurb: 'Ask anything about money by voice in 13 Indian languages, and learn at your own pace.',
    items: [
      { label: 'ArthaMind CFO', desc: 'Ask any money question, get checked numbers', to: 'tutor' },
      { label: 'Learning hub', desc: 'Courses from basics to advanced', to: 'learning' },
      { label: 'Market lessons', desc: 'How stocks, funds and F&O work', to: 'markets-learn' },
      { label: 'Platform guide', desc: 'Everything ArthaMind can do', to: 'platform-guide' },
    ],
  },
];

/** Desktop header menus. Opens on hover or click; Escape and outside clicks close it. */
export const NavMenu: React.FC<{ onPick: (to: AppNavigationDestination) => void }> = ({ onPick }) => {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(null); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  const enter = (id: string) => { window.clearTimeout(timer.current); setOpen(id); };
  const leave = () => { timer.current = window.setTimeout(() => setOpen(null), 160); };
  const group = MENU.find((g) => g.id === open);
  const pick = (to: AppNavigationDestination) => { setOpen(null); onPick(to); };

  return (
    <div className="nm" ref={ref} onMouseLeave={leave} onMouseEnter={() => window.clearTimeout(timer.current)}>
      <nav className="nm-bar" aria-label="Products">
        {MENU.map((g) => (
          <button key={g.id} type="button" className={'nm-top' + (open === g.id ? ' on' : '')} aria-expanded={open === g.id} aria-controls={`nm-${g.id}`}
            onMouseEnter={() => enter(g.id)} onClick={() => setOpen(open === g.id ? null : g.id)}>
            {g.label}<ChevronDown size={14} aria-hidden="true" />
          </button>
        ))}
      </nav>
      {group && (
        <div className="nm-panel" id={`nm-${group.id}`} role="region" aria-label={group.label}>
          <div className="nm-feature">
            <img src={group.art} alt="" loading="lazy" />
            <button type="button" className="nm-lead" onClick={() => pick(group.lead)}>{group.title} <ArrowRight size={16} aria-hidden="true" /></button>
            <p>{group.blurb}</p>
          </div>
          <ul className="nm-list">
            {group.items.map((it) => (
              <li key={it.label}>
                <button type="button" onClick={() => pick(it.to)}><b>{it.label}</b><span>{it.desc}</span></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
