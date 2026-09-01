# Pro Market Test Plan

Automated tests cover route mappings, controlled freshness labels, required Forex-pair registry, core US assets, market-history statistics and direct-trading-advice refusal.

Manual verification on preview should include:

1. `/finance/overview` still shows existing India ticker/cards and US Market Performance.
2. `/finance/markets/india` search/detail/watchlist remain functional.
3. `/finance/markets/intraday` never enables unsupported intraday intervals or renders artificial candles.
4. `/finance/markets/forex` shows only provider-returned values and source timestamps; bid/ask/spread are unavailable unless present.
5. `/finance/markets/us` range controls show professional green/red/slate chart behavior from selected-range return.
6. `/finance/markets/watchlist` is sign-in gated and preserves preferences when a quote is unavailable.
7. `/finance/markets/alerts` is sign-in gated; browser permission is separate from external delivery; conditions are not trading signals.
8. `/finance/markets/learn` stores simulation-only hypotheses and does not execute orders.
9. `/go-pro` is reachable from desktop header, mobile header and feature menus; no fake checkout or fake request success is shown.
10. ArthaMind Market Explainer redirects buy/sell/target/stop-loss/profit-guarantee prompts and displays source/freshness limitations.
11. Keyboard focus, mobile layouts, light mode and dark mode remain usable.
12. Provider failures render unavailable/delayed/stale states rather than invented values.
