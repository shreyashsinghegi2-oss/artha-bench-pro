import React, { useEffect, useState } from 'react';
import { Clock, LogOut, MonitorSmartphone, X } from 'lucide-react';
import './sessionNotices.css';

export const LOGOUT_REASON_KEY = 'arthamind-logout-reason';
export type LogoutReason = 'idle' | 'other-device';

const TEXT: Record<LogoutReason, { title: string; body: string; icon: React.ComponentType<{ size?: number }> }> = {
  idle: { title: 'Signed out after 30 minutes of inactivity', body: 'For your security, ArthaMind signs you out when the app is left idle. Sign in again to continue.', icon: Clock },
  'other-device': { title: 'Signed out: your account was used on another device', body: 'ArthaMind keeps one active device per account. If this was not you, change your password from Account.', icon: MonitorSmartphone },
};

export function rememberLogoutReason(reason: LogoutReason) {
  try { sessionStorage.setItem(LOGOUT_REASON_KEY, reason); } catch { /* storage blocked */ }
}

/** Shows why the user was signed out (after the reload that follows a forced sign-out). */
export const LogoutNotice: React.FC = () => {
  const [reason, setReason] = useState<LogoutReason | null>(() => {
    try { const r = sessionStorage.getItem(LOGOUT_REASON_KEY) as LogoutReason | null; sessionStorage.removeItem(LOGOUT_REASON_KEY); return r && r in TEXT ? r : null; } catch { return null; }
  });
  useEffect(() => { if (!reason) return; const t = window.setTimeout(() => setReason(null), 12000); return () => window.clearTimeout(t); }, [reason]);
  if (!reason) return null;
  const T = TEXT[reason]; const Icon = T.icon;
  return <div className="sn-toast" role="status"><span className="sn-ico"><Icon size={18}/></span><div><b>{T.title}</b><p>{T.body}</p></div><button type="button" onClick={() => setReason(null)} aria-label="Dismiss"><X size={15}/></button></div>;
};

/** Countdown shown one minute before an idle sign-out. */
export const IdleWarning: React.FC<{ deadline: number; onStay: () => void; onSignOut: () => void }> = ({ deadline, onStay, onSignOut }) => {
  const [left, setLeft] = useState(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
  useEffect(() => { const t = window.setInterval(() => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 500); return () => window.clearInterval(t); }, [deadline]);
  return <div className="sn-overlay" role="alertdialog" aria-labelledby="sn-title">
    <div className="sn-card">
      <span className="sn-ring" style={{ '--p': left / 60 } as React.CSSProperties}><b>{left}</b></span>
      <h2 id="sn-title">Still there?</h2>
      <p>You will be signed out in {left} seconds to keep your financial data safe.</p>
      <div className="sn-actions"><button type="button" className="primary" onClick={onStay}>Stay signed in</button><button type="button" onClick={onSignOut}><LogOut size={15}/> Sign out now</button></div>
    </div>
  </div>;
};
