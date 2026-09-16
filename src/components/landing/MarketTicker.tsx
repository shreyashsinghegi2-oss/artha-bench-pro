import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BusinessBrief, TopMarketTicker } from './LandingLiveInformation';
import { CryptoMarketPreview } from './CryptoMarketPreview';

export const MarketTicker: React.FC = () => {
  const [tickerMount, setTickerMount] = useState<HTMLElement | null>(null);
  const [newsMount, setNewsMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const host = document.querySelector('[data-artha-market-context-host]');
    const section = host?.closest('section');
    const capabilities = document.getElementById('capabilities');
    if (!section || !capabilities || !section.parentElement) return;

    section.setAttribute('data-artha-market-context', 'true');
    const ticker = document.createElement('div');
    ticker.setAttribute('data-artha-unified-market-ticker', 'true');
    section.parentElement.insertBefore(ticker, section);

    const news = document.createElement('div');
    news.setAttribute('data-artha-business-brief', 'true');
    capabilities.parentElement?.insertBefore(news, capabilities);

    setTickerMount(ticker);
    setNewsMount(news);
    return () => {
      section.removeAttribute('data-artha-market-context');
      ticker.remove();
      news.remove();
    };
  }, []);

  return (
    <>
      {tickerMount && createPortal(<TopMarketTicker />, tickerMount)}
      {newsMount && createPortal(<BusinessBrief />, newsMount)}
      <CryptoMarketPreview />
    </>
  );
};
