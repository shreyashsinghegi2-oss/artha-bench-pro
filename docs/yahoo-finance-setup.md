# Yahoo Finance provider setup

ArthaBench includes an experimental, server-side Yahoo Finance chart adapter. It does not require an API key.

For production, the recommended configuration is the [hybrid Yahoo → Twelve Data provider chain](hybrid-market-data-setup.md), rather than Yahoo alone.

## Enable it on Vercel

1. Open the [ArthaBench environment-variable settings](https://vercel.com/e25b002702-3723s-projects/artha-bench-pro/settings/environment-variables).
2. Find `MARKET_DATA_PROVIDER`. If it already exists, edit it instead of creating a duplicate.
3. Set its value to `yahoo`.
4. Select **Production**, **Preview**, and **Development**.
5. Save the variable.
6. Do not delete `MARKET_DATA_API_KEY`; Yahoo ignores it, and keeping it allows a quick rollback to Twelve Data.
7. Optional: add `YAHOO_FINANCE_BASE_URL` with the value below. The application already uses this default, so this variable can be omitted.

```text
https://query1.finance.yahoo.com/v8/finance/chart
```

8. Open [ArthaBench deployments](https://vercel.com/e25b002702-3723s-projects/artha-bench-pro/deployments), select the latest deployment, choose **Redeploy**, and keep the existing build cache setting.
9. After the deployment succeeds, open [ArthaBench Pro](https://artha-bench-pro.vercel.app), hard-refresh, and select **Market Data**.
10. Open **AI Connections** to confirm that the market provider is named `Yahoo Finance (Experimental)`.

## Supported symbol conversions

| ArthaBench input | Yahoo symbol |
|---|---|
| `RELIANCE:NSE` | `RELIANCE.NS` |
| `SBIN:NSE` | `SBIN.NS` |
| `500325:BSE` | `500325.BO` |
| `NIFTY:NSE` | `^NSEI` |
| `BANKNIFTY:NSE` | `^NSEBANK` |
| `SENSEX:BSE` | `^BSESN` |
| `USD/INR` | `INR=X` |
| `GOLD` or `GC=F` | `GC=F` |

## Feed labels

- `LIVE`: returned delay is zero, the exchange is in its regular session, and the quote timestamp is no more than three minutes old.
- `DELAYED`: the exchange is open, but Yahoo reports a delay or does not provide zero-delay confirmation.
- `MARKET CLOSED`: the current time is outside the returned regular trading session.
- `RECONNECTING`: the exchange should be open, but the timestamp is older than the expected delay window.
- `DEMO`: Yahoo failed, rate-limited the request, or returned an unusable response, so only clearly labelled fixture data is displayed.

## Verify the server response

The following endpoint is intended for technical verification and displays JSON rather than the visual interface:

```text
https://artha-bench-pro.vercel.app/api/markets/quote?symbol=SBIN%3ANSE
```

Check these fields:

- `providerName` should be `Yahoo Finance (Experimental)` when Yahoo returns data.
- `freshness` should reflect the returned timestamp and delay metadata.
- `providerTimestamp` should contain Yahoo's market timestamp.
- `status` should be `connected`. A `rate_limited` result means Yahoo rejected the request and the quote is not live.

## Roll back to Twelve Data

1. Change `MARKET_DATA_PROVIDER` back to `twelvedata`.
2. Confirm that `MARKET_DATA_API_KEY` is still present.
3. Redeploy the latest Vercel deployment.

## Important limitation

Yahoo Finance shows real-time quotes for some exchanges and delayed quotes for others. Yahoo does not list a supported public Finance market-data API in its developer API catalogue. Treat this adapter as experimental and do not assume that its data is licensed for commercial redistribution or trading. See [Yahoo Finance data-status guidance](https://in.help.yahoo.com/kb/SLN2321.html), [exchange and provider information](https://help.yahoo.com/kb/SLN2310.html), and the [Yahoo developer API catalogue](https://developer.yahoo.com/api/).
