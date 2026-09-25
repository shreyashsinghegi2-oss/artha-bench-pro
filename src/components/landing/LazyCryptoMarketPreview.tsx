import React, { Suspense, useEffect, useRef, useState } from 'react';

// Lightweight Charts only downloads when the crypto preview nears the viewport.
const CryptoMarketPreview = React.lazy(() => import('./CryptoMarketPreview').then((module) => ({ default: module.CryptoMarketPreview })));

export const LazyCryptoMarketPreview: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || !('IntersectionObserver' in window)) { setNear(true); return; }
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { setNear(true); observer.disconnect(); } }, { rootMargin: '600px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const shell = <div className="crypto-lazy-shell" role="status" aria-label="Loading crypto market preview"/>;
  return <div ref={ref}>{near ? <Suspense fallback={shell}><CryptoMarketPreview/></Suspense> : shell}</div>;
};
