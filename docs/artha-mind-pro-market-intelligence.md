# ArthaMind Pro Market Intelligence

This additive upgrade preserves the existing Artha Bench Pro market, finance, AI reliability, learning and provider-health workspaces.

## Routes

- `/finance/markets/india` — existing India Market Explorer
- `/finance/markets/intraday` — Intraday Market Lab
- `/finance/markets/forex` — Forex Intelligence
- `/finance/markets/us` — US Market Explorer
- `/finance/markets/watchlist` — signed-in private watchlist
- `/finance/markets/alerts` — signed-in user-defined informational alerts
- `/finance/markets/learn` — Markets Learning Lab
- `/go-pro` — honest Free vs Pro capability map

## Data policy

Market UI uses only provider-backed values returned through the existing server market adapters. Missing values remain unavailable. Delayed or end-of-day data is never upgraded to a live/intraday claim. The new intraday lab checks the actual returned history/timestamps before enabling an intraday interval.

Canonical user-facing data labels are:

- Live verified feed
- Recently refreshed
- Delayed quote
- End-of-day reference
- Cached reference
- Stale data
- Unavailable
- Demo data (development/demo only)

## Current provider path

The existing server-side market adapter remains the source of truth. Yahoo Finance remains experimental/reference-oriented and its provider-derived freshness is preserved. Twelve Data is used only when its server-side key/configuration is present. The UI does not claim official NSE/BSE or licensed intraday entitlement unless an authorised production adapter confirms it.

The current providers do not expose one canonical bulk API through Artha Bench. Visible-page and small-registry quote requests are issued in parallel through the existing server endpoints; the app does not serially load the full India universe. A future provider can implement `MarketQuoteProvider.getBatchQuotes` without changing page contracts.

## AI safety

`ArthaMind Market Explainer` receives only the page-visible market snapshot and source labels. It explains observations, timestamps, terminology, limitations and research questions. Direct personalised trading instructions, buy/sell calls, targets, stop-losses, leverage guidance, profit guarantees and portfolio allocation requests are rejected before the AI call.

## Alerts

Alerts are user-defined informational conditions. Current delivery is in-app/on-demand evaluation. Browser notification permission can be requested, but permission is not presented as proof that background/external delivery infrastructure exists.

## Billing / Pro

`/go-pro` is an information and capability page. Payments are not enabled in this build. The Request Pro Access action explicitly reports that its local demo state was not sent or stored because no real access backend is configured.

## What requires future verified integration

- licensed/authorised India intraday streaming or low-latency feed
- dedicated FX bid/ask/streaming entitlement
- external/background notification delivery
- licensed logo provider if image marks are desired instead of safe identity fallbacks
- subscription/payment/access backend
- any brokerage/order-execution integration (not part of this product scope)
