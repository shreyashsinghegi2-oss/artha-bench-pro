# Hybrid market-data setup

ArthaBench can use Yahoo Finance as the primary market-data source and Twelve Data as a sequential fallback. It does not call both providers for every successful request.

## Routing policy

1. Request Yahoo Finance first.
2. Accept the Yahoo quote only when its response is connected, numeric, and not labelled `DEMO` or `STALE`.
3. If Yahoo is rate-limited, unreachable, stale, or invalid, request Twelve Data.
4. Return the usable fallback quote while preserving `providerName`, `providerTimestamp`, and `freshness` from Twelve Data.
5. If neither provider is usable, return the explicitly labelled fallback response rather than claiming a live connection.

## Vercel variables

Open [ArthaBench environment variables](https://vercel.com/e25b002702-3723s-projects/artha-bench-pro/settings/environment-variables) and configure these values for **Production**, **Preview**, and **Development**:

```text
MARKET_DATA_PROVIDER=hybrid
MARKET_DATA_PRIMARY_PROVIDER=yahoo
MARKET_DATA_FALLBACK_PROVIDER=twelvedata
```

Keep the existing Twelve Data configuration:

```text
MARKET_DATA_API_KEY=<existing Twelve Data key>
MARKET_DATA_BASE_URL=https://api.twelvedata.com/quote
```

Yahoo requires no key. `YAHOO_FINANCE_BASE_URL` is optional because the application already has the correct default.

## Deployment

1. Save all three hybrid variables.
2. Open [ArthaBench deployments](https://vercel.com/e25b002702-3723s-projects/artha-bench-pro/deployments).
3. Redeploy the latest `main` deployment.
4. Wait for the deployment status to become **Ready**.
5. Open [ArthaBench Pro](https://artha-bench-pro.vercel.app), hard-refresh, and select **Market Data**.
6. Open **AI Connections**. The market provider should be named `Hybrid Market Data`.

## Verification

Open the server response below only for technical verification:

```text
https://artha-bench-pro.vercel.app/api/markets/quote?symbol=SBIN%3ANSE
```

- If Yahoo succeeds, `providerName` is `Yahoo Finance (Experimental)`.
- If Yahoo fails and Twelve Data succeeds, `providerName` is `Twelve Data`, and the response message states that hybrid failover was used.
- If both fail, the response status and message identify both failures and any fixture quote remains explicitly labelled `DEMO`.

## Change provider priority

To make Twelve Data primary later, swap only these values and redeploy:

```text
MARKET_DATA_PRIMARY_PROVIDER=twelvedata
MARKET_DATA_FALLBACK_PROVIDER=yahoo
```
