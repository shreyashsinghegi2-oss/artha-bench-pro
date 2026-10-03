import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';

const loadAuthModal = () => import('./AuthModal').then((m) => ({ default: m.AuthModal }));
const AuthModalImpl = lazy(loadAuthModal);

/**
 * The sign-in window is only downloaded when it is first opened (or once the page is idle), keeping it out of
 * the first page load.
 */
export const LazyAuthModal: React.FC = () => {
  const auth = useAuth();
  const [wanted, setWanted] = useState(auth.authOpen);
  useEffect(() => {
    if (auth.authOpen) setWanted(true);
  }, [auth.authOpen]);
  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(() => void loadAuthModal(), { timeout: 6000 });
    else window.setTimeout(() => void loadAuthModal(), 4000);
  }, []);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <AuthModalImpl />
    </Suspense>
  );
};
