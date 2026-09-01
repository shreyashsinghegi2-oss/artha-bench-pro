# What is live now vs what needs a verified market-data, regulated, or subscription integration

## Live now in the product code

- Existing India Market Explorer identity registry and provider-backed visible quote requests.
- US Market Explorer using the existing market-data adapter.
- Forex Intelligence using supported symbols through the existing server market-data adapter, with unavailable states when a provider cannot return a pair.
- Intraday Lab that verifies returned timestamp/history characteristics before enabling intraday observations.
- Existing watchlist persistence plus a dedicated signed-in watchlist page.
- User-defined in-app market alert records and on-demand provider-backed evaluation.
- Browser notification-permission flow without a false background-delivery claim.
- Markets Learning Lab and timestamped paper-learning scenarios.
- ArthaMind Market Explainer guardrails and page-visible evidence grounding.
- `/go-pro` Free/Pro capability page with no-payment/no-fake-submission behavior.

## Requires a verified/authorised market-data integration

- Official or licensed real-time NSE/BSE streaming or intraday entitlement.
- Provider-supported 1m/15m/30m/1h India intervals beyond what the active response proves.
- Dedicated FX bid/ask/spread or streaming WebSocket coverage.
- Guaranteed bulk coverage for all registry symbols from one licensed provider.
- Licensed image-logo provider if brand images are preferred over safe ticker/initial fallbacks.

## Requires additional product infrastructure

- Background/external push, email or SMS alert delivery.
- Server-synced watchlists/alerts across devices beyond the existing storage architecture.
- Subscription billing, checkout, entitlement and webhook handling.
- Pro access-request/waitlist submission backend.

## Outside current product scope

- Brokerage/order execution.
- Broker credential collection.
- Personalised buy/sell/hold calls, targets, stop-loss recommendations, leverage instructions or guaranteed-profit features.
