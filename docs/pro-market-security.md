# Pro Market Security Boundaries

- Provider API keys stay server-side; frontend workspaces call existing `/api/markets/*` routes.
- No broker login credentials, passwords, OTPs, UPI PINs, CVVs or trading PINs are collected.
- Watchlist and alert routes are sign-in gated as user preferences.
- Market AI receives only the page-visible snapshot assembled in the browser plus source/freshness labels; it is not given broker credentials or hidden portfolio instructions.
- Direct personalised trading-instruction patterns are rejected locally before the AI request.
- Browser notification permission is not treated as proof of a configured delivery service.
- Subscription secret placeholders are server-side env variables only; no client-side checkout secret is introduced.
