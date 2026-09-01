# Artha Bench Pro V2.0 — Functionality Audit (2026-09-01)

## Scope

Fix-first audit against the existing React/Vite + Express architecture. Existing finance, market, learning, reliability, authentication, theme and Pro routes are preserved.

## Confirmed working before this branch

- Finance Overview, personal finance routes and authenticated gates.
- Existing India identity registry and India ticker/reference labels.
- US Market Performance selectors/range controls.
- Market Pro route set: India, Intraday, Forex, US, Watchlist, Alerts, Learn, Go Pro.
- Watchlist local persistence and user-defined in-app alert evaluation.
- Yahoo Finance experimental/reference adapter with explicit provider-derived freshness labels.
- Provider diagnostics, FRED, World Bank, NewsData/Finnhub paths where configured.
- Paper portfolio and the original Learning workspace.
- Dark/light theme and responsive shells.

## Root-cause findings

### India quote unavailability

1. The Explorer loaded visible companies with individual client quote calls instead of one bounded server batch request.
2. The generic Twelve Data adapter inferred provider symbols from Yahoo `.NS`/`.BO` identifiers. Provider-specific mapping was not actually verified.
3. Generic Twelve Data normalization could substitute missing change values with zero.
4. Explicit `MARKET_DATA_PROVIDER=twelvedata` could fall back to Yahoo, masking missing/invalid Twelve Data configuration.
5. The 65-company identity registry mixed identity tracking with a single `providerSymbol` field and did not maintain a verified Twelve Data mapping state.

### Market AI / evidence

1. Market pages used the general tutor endpoint.
2. The Market Explainer rendered a plain text answer rather than a structured evidence panel.
3. Source labels were shown after the text, but response evidence did not have a typed source/timestamp/freshness contract.
4. Safety redirect existed client-side; a dedicated server-side market safety boundary did not.

### Forex

1. The converter multiplied by any returned normalized quote, including stale references.
2. Bid/ask/spread were correctly unavailable when absent, but stale-rate policy did not demote the primary rate or disable conversion.

### Intraday

1. Timestamp shape could enable an interval without a separately verified licensed-provider entitlement.
2. The previous view could show a price-history line when OHLC entitlement was not established.

### Markets Learning Lab

1. Concept cards were informative but not routes.
2. No nested lesson route, knowledge check, previous/next flow, deterministic simulator suite, or explicit progress persistence contract existed.

### Go Pro

1. Most feature destinations worked.
2. Exportable research reports was a disabled-looking capability rather than an actionable Coming Soon explanation.
3. Request Pro Access was a one-click local-demo state instead of a validated access-interest form.

## Fixes implemented on this branch

- Dedicated server-only Twelve Data adapter with timeout and sanitized failure categories.
- Provider-specific India mapping registry; five starter mappings deliberately remain `unknown` until actual provider search + quote verification succeeds.
- Server-only starter symbol discovery utility.
- Server cache, stale window, request dedupe, bounded retry and concurrency limit.
- `GET /api/markets/india/quotes?assetIds=...` bounded to 20 IDs.
- India search, history and status endpoints.
- Overview 8-asset preview changed to one batch request.
- India Explorer visible 12-asset page changed to one batch request with source/retrieval/freshness states.
- Structured server-side Market Explainer endpoint and evidence UI.
- Forex stale-rate demotion and converter gating.
- Intraday configured/licensed/provider-match/OHLC gates.
- Nine-track, 18-lesson Markets Learning curriculum with lesson routes, quizzes, simulators and local-only progress disclosure.
- Go Pro validated local-demo access-interest form and actionable Coming Soon scope.
- India Market Quotes provider-health panel.

## Configuration-dependent

- Groq-backed AI response generation requires server-side `GROQ_API_KEY` and an active configured model.
- Strict Twelve Data India quote mode requires `TWELVE_DATA_API_KEY`, `MARKET_DATA_PROVIDER=twelve_data`, and verified provider-specific symbol mappings.
- Existing news, company-intelligence, FRED and related adapters continue to require their existing configured credentials where applicable.

## Provider-entitlement-dependent

- India intraday controls require a configured provider, explicit `INDIA_INTRADAY_LICENSED=true`, and actual matching timestamped OHLC data.
- Full NSE/BSE or Forex live/streaming capability is not claimed by this branch.
- External/background alert delivery remains unavailable without notification infrastructure.

## Unavailable by design

- Fake live quotes, synthetic candles, invented bid/ask/spread, trade signals, targets, stop-losses, guaranteed returns, fake citations, fake Pro activation, fake payment success, and unverified provider mappings.
