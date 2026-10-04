import React, { lazy, Suspense, useEffect, useState } from 'react';

const VoiceAssistant = lazy(() => import('./VoiceAssistant').then((m) => ({ default: m.VoiceAssistant })));

/** The floating voice button loads after the page is interactive, so it never delays the first paint. */
export const LazyVoiceAssistant: React.FC = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(() => setReady(true), { timeout: 2500 });
    else window.setTimeout(() => setReady(true), 1500);
  }, []);
  return ready ? (
    <Suspense fallback={null}>
      <VoiceAssistant />
    </Suspense>
  ) : null;
};
