# ArthaMind Pro Market Intelligence — Acceptance Checklist

## Preservation
- Existing Finance Overview remains the same route and retains India ticker, US Market Performance, provider health, FRED/World Bank, news, AI dashboard and learning/reliability sections.
- Existing personal-finance routes, Decision Replay, EMI Manager, Financial Health and Ripple Twin remain routed independently.
- Existing market data and Yahoo/Twelve provider adapters are reused rather than replaced.

## Market intelligence
- India Market Explorer remains available at `/finance/markets/india`.
- Intraday Lab enables an intraday interval only when returned provider history is timestamped intraday data.
- Forex values are requested from the active provider; unsupported pairs remain unavailable.
- US Explorer preserves SPY/AAPL/NVDA/MSFT and adds more public-market identities without hardcoded quotes.
- Watchlist uses the existing watchlist persistence architecture.
- Alerts are user-defined informational conditions and are evaluated against provider data.
- Paper scenarios are simulation-only and do not send broker orders.

## Data integrity
- Controlled source/freshness labels are centralized in `marketPro.ts`.
- Provider, source timestamp, retrieval timestamp and state are visible in shared source panels.
- Bid/ask/spread remain unavailable when the current normalized provider response does not contain those fields.
- No artificial candles or streaming badges are generated.

## AI safety
- Unsafe buy/sell/entry/exit/target/stop-loss/profit-guarantee requests are redirected before the AI call.
- Market Explainer prompt is constrained to page-visible provider-backed data and explicit source labels.
- Educational disclaimer remains visible.

## Pro/billing
- Header desktop and mobile Go Pro actions navigate to `/go-pro`.
- Pro page shows Free vs Pro capability states.
- Payments are explicitly unavailable in this build.
- Request Pro Access shows a local-demo/non-submission message because no access backend is configured.

## Build verification
- Run TypeScript/Vite build through connected preview deploys before merge.
- Merge only if preview deployment checks pass.
- Verify production deployment status on the merged main SHA.
