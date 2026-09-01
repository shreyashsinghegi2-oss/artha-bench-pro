# Pro Market Workspaces

The components in this folder are additive to the existing market dashboard and India Market Explorer.

- `MarketProShell.tsx` contains shared Pro market navigation, source/freshness disclosure and the evidence-grounded ArthaMind Market Explainer.
- `MarketProViews.tsx` contains the dedicated Intraday, Forex, US, Watchlist, Alerts and Markets Learning workspaces.
- Existing `IndiaMarketExplorerView.tsx`, `MarketView.tsx`, provider health, learning and dashboard components are preserved.

No component in this folder may promote delayed/end-of-day data to a live claim, invent unsupported quotes/candles, execute orders, or present ArthaMind output as personalised trading advice.
