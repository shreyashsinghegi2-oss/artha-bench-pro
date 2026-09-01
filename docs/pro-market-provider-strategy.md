# Pro Market Provider and Caching Strategy

The Pro market workspaces reuse the existing server-side market-data adapter and provider-health system.

- Yahoo Finance remains an experimental/reference adapter with provider-derived freshness labels.
- Twelve Data remains an optional configured fallback when its server-side key exists.
- No provider is relabelled as official NSE/BSE or real-time unless its actual response/entitlement supports that statement.
- Current visible-page quote sets are requested in parallel, not serially across the entire India registry.
- `MarketQuoteProvider.getBatchQuotes` is the canonical future hook for providers with licensed bulk endpoints.
- Public provider responses may be cached server-side by the existing/provider-specific layer; future TTL/stale thresholds are represented by environment variables.
- Provider failures degrade to unavailable/stale states, not fixture prices.
