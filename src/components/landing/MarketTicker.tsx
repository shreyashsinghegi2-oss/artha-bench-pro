import React, { lazy, Suspense } from 'react';

const LandingBitcoinChart = lazy(() =>
  import('./LandingBitcoinChart').then((module) => ({ default: module.LandingBitcoinChart })),
);

export const MarketTicker: React.FC = () => (
  <Suspense fallback={<div className="mt-6 rounded-[22px] border border-white/10 bg-[#0d0d0d] p-5 text-xs text-white/45">Loading Bitcoin market chart…</div>}>
    <LandingBitcoinChart />
  </Suspense>
);
