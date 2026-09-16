import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BusinessBrief, TopMarketTicker } from './LandingLiveInformation';

const LandingBitcoinChart = lazy(() =>
  import('./LandingBitcoinChart').then((module) => ({ default: module.LandingBitcoinChart })),
);

export const MarketTicker: React.FC = () => {
  const [topMount, setTopMount] = useState<HTMLElement | null>(null);
  const [newsMount, setNewsMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const landingShell = document.querySelector('.landing-shell');
    const capabilities = document.getElementById('capabilities');
    if (!landingShell || !capabilities) return;

    const top = document.createElement('div');
    top.setAttribute('data-artha-top-market-ticker', 'true');
    landingShell.insertBefore(top, landingShell.firstChild);

    const news = document.createElement('div');
    news.setAttribute('data-artha-business-brief', 'true');
    capabilities.parentElement?.insertBefore(news, capabilities);

    setTopMount(top);
    setNewsMount(news);

    return () => {
      top.remove();
      news.remove();
    };
  }, []);

  return (
    <>
      {topMount && createPortal(<TopMarketTicker />, topMount)}
      {newsMount && createPortal(<BusinessBrief />, newsMount)}
      <Suspense fallback={<div className="mt-6 rounded-[22px] border border-white/10 bg-[#0d0d0d] p-5 text-xs text-white/45">Loading Bitcoin market chart…</div>}>
        <LandingBitcoinChart />
      </Suspense>
    </>
  );
};
