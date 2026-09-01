import React from 'react';
import { MarketAssetIdentity, MARKET_MARK_DISCLOSURE } from '../market/MarketAssetIdentity';

export const USMarketIdentityStrip: React.FC = () => (
  <section className="mx-auto max-w-[1700px] px-4 pt-4 sm:px-6" aria-label="US market asset identities">
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {['SPY','AAPL','NVDA','MSFT'].map((symbol) => <div key={symbol} className="rounded-xl border border-line bg-canvas px-3 py-2"><MarketAssetIdentity symbol={symbol} compact /></div>)}
        </div>
        <p className="max-w-2xl text-[8px] leading-4 text-secondary">{MARKET_MARK_DISCLOSURE} Neutral identity marks are used where a separately licensed logo asset is not bundled.</p>
      </div>
    </div>
  </section>
);
