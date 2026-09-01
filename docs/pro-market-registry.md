# Market registries

India uses the existing `src/data/indiaMarketUniverse.ts` 50+ identity registry. No changing quote data is stored there.

US Pro explorer uses a small stable identity registry for SPY, AAPL, NVDA, MSFT, GOOGL, AMZN, META, TSLA, JPM, XOM, QQQ and DIA. Quotes are provider-fetched.

Forex registry includes USD/INR, EUR/INR, GBP/INR, JPY/INR, EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD and USD/CHF. Provider symbols are identity/routing metadata only; no rate is hardcoded.
