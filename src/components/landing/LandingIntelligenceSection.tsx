import React, { Suspense, useEffect, useRef, useState } from 'react';

// The flow (and the motion library) loads only when this section nears the viewport.
const MarketIntelligenceFlow = React.lazy(() => import('./MarketIntelligenceFlow'));

export const LandingIntelligenceSection: React.FC = () => {
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || !('IntersectionObserver' in window)) { setNear(true); return; }
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { setNear(true); observer.disconnect(); } }, { rootMargin: '500px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const shell = <div className="mif-shell" aria-hidden="true"/>;
  return <section id="intelligence-flow" ref={ref} className="cl-section mif-section cl-reveal-section" aria-labelledby="intelligence-flow-title">
    <div className="cl-wrap">
      <div className="cl-eyebrow">Market intelligence flow</div>
      <h2 id="intelligence-flow-title">From raw signals to an answer you can inspect.</h2>
      <p className="cl-sub">Public market data and your permitted finance records enter. ArthaMind verifies, compares and reasons over them. ArthaBench shows the answer with its confidence and sources.</p>
      {near ? <Suspense fallback={shell}><MarketIntelligenceFlow/></Suspense> : shell}
    </div>
  </section>;
};
