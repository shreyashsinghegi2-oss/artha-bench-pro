import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, CheckCheck, Info, Newspaper, Trash2, X } from 'lucide-react';
import type { AppNavigationDestination } from '../../navigationTypes';
import { checkMarkets, checkMoney, checkNews, clearNotices, loadNotices, markAllRead, markRead, NOTICES_EVENT, type Notice, type NoticeKind } from '../../services/notifications';
import './notifications.css';

const ICON: Record<NoticeKind, React.ComponentType<{ size?: number }>> = { up: ArrowUpRight, down: ArrowDownRight, alert: AlertTriangle, news: Newspaper, info: Info };
const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/**
 * Bell in the workspace header. Checks your money alerts, big market moves (1% or more) and new
 * business headlines, keeps them in this browser, and slides in a short toast when something new
 * arrives. Colours: green growth, red loss, amber needs attention, blue information.
 */
export const NotificationBell: React.FC<{ onNavigate: (d: AppNavigationDestination) => void }> = ({ onNavigate }) => {
  const [list, setList] = useState<Notice[]>(() => loadNotices());
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Notice | null>(null);
  const first = useRef(true);
  const root = useRef<HTMLDivElement>(null);

  const run = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    const fresh = [...checkMoney(), ...(await checkMarkets().catch(() => [])), ...(await checkNews().catch(() => []))];
    // The first check fills the list quietly; later checks announce what is new.
    if (!first.current && fresh.length) setToast(fresh[0]);
    first.current = false;
  }, []);

  useEffect(() => {
    const sync = () => setList(loadNotices());
    window.addEventListener(NOTICES_EVENT, sync);
    window.addEventListener('storage', sync);
    const start = window.setTimeout(() => void run(), 2500);
    const every = window.setInterval(() => void run(), 3 * 60_000);
    return () => { window.removeEventListener(NOTICES_EVENT, sync); window.removeEventListener('storage', sync); window.clearTimeout(start); window.clearInterval(every); };
  }, [run]);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 6000); return () => window.clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('keydown', esc); };
  }, [open]);

  const unread = list.filter((n) => !n.read).length;
  const openNotice = (n: Notice) => {
    markRead(n.id); setOpen(false); setToast(null);
    if (n.url) window.open(n.url, '_blank', 'noopener,noreferrer'); else if (n.to) onNavigate(n.to);
  };
  const Row: React.FC<{ n: Notice }> = ({ n }) => { const Icon = ICON[n.kind]; return <button type="button" className={`nb-item k-${n.kind} ${n.read ? '' : 'unread'}`} onClick={() => openNotice(n)}>
    <span className="nb-ico"><Icon size={15}/></span><span className="nb-txt"><b>{n.title}</b><small>{n.body}</small><em>{ago(n.at)}</em></span>
  </button>; };

  return <div className="nb-root" ref={root}>
    <button type="button" className="nb-bell" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
      <Bell size={16}/>{unread > 0 && <span className="nb-count">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="nb-panel" role="dialog" aria-label="Notifications">
      <header><b>Notifications</b><span>
        <button type="button" onClick={markAllRead} disabled={!unread} title="Mark all as read"><CheckCheck size={15}/></button>
        <button type="button" onClick={clearNotices} disabled={!list.length} title="Clear all"><Trash2 size={15}/></button>
      </span></header>
      <div className="nb-legend"><span className="k-up">Growth</span><span className="k-down">Loss / risk</span><span className="k-alert">Needs attention</span><span className="k-news">News & info</span></div>
      <div className="nb-list">{list.length ? list.map((n) => <Row key={n.id} n={n}/>) : <p className="nb-empty">You are all caught up. Money alerts, big market moves and new headlines will appear here.</p>}</div>
    </div>}
    {toast && !open && <div className="nb-toast" role="status"><Row n={toast}/><button type="button" className="nb-toast-x" onClick={() => setToast(null)} aria-label="Dismiss"><X size={14}/></button></div>}
  </div>;
};
