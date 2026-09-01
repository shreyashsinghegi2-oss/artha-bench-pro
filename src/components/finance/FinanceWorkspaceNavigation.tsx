import React, { MouseEvent, useEffect, useRef, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, FileBarChart2, Gauge, Landmark, ReceiptText, Sparkles, WalletCards } from 'lucide-react';
import { pathForDestination } from '../../appRoutes';
import { AppNavigationDestination } from '../../navigationTypes';

type Props = {
  currentDestination: AppNavigationDestination;
  onNavigate: (destination: AppNavigationDestination) => void;
};

const tabs: Array<{
  id: AppNavigationDestination;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', description: 'Your financial intelligence overview and current workspace signals.', icon: Gauge },
  { id: 'income', label: 'Income', description: 'Review income sources, recurring amounts and tax context.', icon: WalletCards },
  { id: 'expenses', label: 'Expenses', description: 'Review spending by category and transaction.', icon: ReceiptText },
  { id: 'budgeting', label: 'Budgeting', description: 'Compare planned category limits with recorded spending.', icon: Landmark },
  { id: 'finance-reports', label: 'Reports', description: 'Understand spending, savings, budgets and period changes.', icon: FileBarChart2 },
  { id: 'emi-manager', label: 'EMI Manager', description: 'Track existing loan instalments, balances and upcoming due dates.', icon: CalendarClock },
  { id: 'decision-replay', label: 'Decision Replay', description: 'Test temporary what-if assumptions against your recorded baseline without changing saved records.', icon: Sparkles },
];

function isModifiedNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export const FinanceWorkspaceNavigation: React.FC<Props> = ({ currentDestination, onNavigate }) => {
  const railRef = useRef<HTMLDivElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; left: number } | null>(null);
  const draggedRef = useRef(false);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const [tooltipId, setTooltipId] = useState<AppNavigationDestination | null>(null);

  const activeDestination = currentDestination === 'dashboard' ? 'overview' : currentDestination;
  const currentPath = typeof window !== 'undefined' ? (window.location.pathname.replace(/\/+$/, '') || '/') : pathForDestination(activeDestination);

  const updateOverflow = () => {
    const rail = railRef.current;
    if (!rail) return;
    setOverflow({
      left: rail.scrollLeft > 2,
      right: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2,
    });
  };

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    updateOverflow();
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateOverflow) : null;
    resizeObserver?.observe(rail);
    window.addEventListener('resize', updateOverflow);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateOverflow);
    };
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const active = rail.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
    window.setTimeout(updateOverflow, 40);
  }, [currentPath]);

  useEffect(() => () => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
  }, []);

  const queueTooltip = (id: AppNavigationDestination) => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => setTooltipId(id), 300);
  };

  const hideTooltip = () => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    setTooltipId(null);
  };

  const scrollBy = (delta: number) => railRef.current?.scrollBy({ left: delta, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  return (
    <div className="sticky top-[65px] z-40 border-b border-line bg-canvas/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-canvas/85 sm:px-6" aria-label="Finance Workspace Navigation">
      <div className="mx-auto flex max-w-[1700px] items-center gap-2">
        {overflow.left && <button type="button" onClick={() => scrollBy(-260)} className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-secondary hover:border-interactive/40 hover:text-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-interactive md:flex" aria-label="Scroll finance navigation left"><ChevronLeft className="h-4 w-4" /></button>}
        <div
          ref={railRef}
          className="scrollbar-thin flex min-w-0 flex-1 select-none gap-1.5 overflow-x-auto py-1"
          onScroll={updateOverflow}
          onWheel={(event) => {
            const rail = railRef.current;
            if (!rail || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
            event.preventDefault();
            rail.scrollLeft += event.deltaY;
          }}
          onPointerDown={(event) => {
            if (event.pointerType !== 'mouse') return;
            if ((event.target as HTMLElement).closest('a,button')) return;
            const rail = railRef.current;
            if (!rail) return;
            dragStartRef.current = { x: event.clientX, left: rail.scrollLeft };
            draggedRef.current = false;
            rail.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const rail = railRef.current;
            const start = dragStartRef.current;
            if (!rail || !start) return;
            const delta = event.clientX - start.x;
            if (Math.abs(delta) > 5) draggedRef.current = true;
            rail.scrollLeft = start.left - delta;
          }}
          onPointerUp={() => {
            dragStartRef.current = null;
            window.setTimeout(() => { draggedRef.current = false; }, 0);
          }}
          onPointerCancel={() => {
            dragStartRef.current = null;
            draggedRef.current = false;
          }}
        >
          {tabs.map(({ id, label, description, icon: Icon }) => {
            const href = pathForDestination(id);
            const active = currentPath === href || (id === 'overview' && activeDestination === 'overview');
            const tooltipVisible = tooltipId === id;
            return (
              <div key={id} className="relative shrink-0">
                <a
                  href={href}
                  data-finance-tab={id}
                  onMouseEnter={() => queueTooltip(id)}
                  onMouseLeave={hideTooltip}
                  onFocus={() => setTooltipId(id)}
                  onBlur={hideTooltip}
                  onClick={(event) => {
                    if (draggedRef.current) {
                      event.preventDefault();
                      return;
                    }
                    if (isModifiedNavigation(event)) return;
                    event.preventDefault();
                    onNavigate(id);
                  }}
                  aria-label={`Open ${label}`}
                  aria-current={active ? 'page' : undefined}
                  className={`group inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-xs font-semibold transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive ${active ? 'border-interactive/30 bg-interactive-soft text-interactive' : 'border-transparent bg-transparent text-secondary hover:border-line hover:bg-surface hover:text-ink'}`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </a>
                {tooltipVisible && <div role="tooltip" className="absolute left-1/2 top-[calc(100%+8px)] z-50 w-60 -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 shadow-xl"><div className="text-[10px] font-black text-ink">{label}</div><div className="mt-1 text-[9px] leading-4 text-secondary">{description}</div></div>}
              </div>
            );
          })}
        </div>
        {overflow.right && <button type="button" onClick={() => scrollBy(260)} className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-secondary hover:border-interactive/40 hover:text-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-interactive md:flex" aria-label="Scroll finance navigation right"><ChevronRight className="h-4 w-4" /></button>}
      </div>
    </div>
  );
};
