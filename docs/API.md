# ArthaBench public API (v1)

Base URL: `https://artha-bench-pro.vercel.app/api/v1` · Interactive docs: `/api/v1/docs` · Spec: `/api/v1/openapi.json`
· Playground: `/developers`

## Response format

Every JSON response is:

```json
{ "data": {}, "source": "…", "timestamp": "ISO-8601", "reliability_score": 0, "is_deterministic": true }
```

Errors are `{ "error": { "code", "message", "details?" }, "timestamp" }` with status 400 (bad input), 401 (key),
404, 422 (valid numbers but not calculable, e.g. price below variable cost), 429 (rate limit) or 503 (a data
source is down; no substitute data is ever returned).

### reliability_score

| Data | Score |
| --- | --- |
| Calculator with statutory or caller-supplied rates | 100 |
| Calculator using a default scheme rate (PPF, SSY, EPF, NPS) | 90 |
| Market data | source confidence (NSE 95, Binance 90, Yahoo Finance 85, other 70) minus freshness penalty: ≤1 min 0, ≤15 min 10, ≤1 day 25, ≤7 days 40, older/unknown 60 |
| AI answers | 15 if no model answered; else 50 + 5 per linked source (max 20) + 15 certified number (10 app-calculated) − 10 invalid citations removed − 10 fallback model; max 95 |

## Limits and caching

- No key: 100 requests/minute per IP. With `x-api-key`: 1,000/minute per key. Limits are counted per server
  instance. Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.
- GET calculator and market responses: `Cache-Control: s-maxage=60, stale-while-revalidate=60` (Vercel edge).
- CORS is open (`*`).

## Endpoints

| Method | Path | Key |
| --- | --- | --- |
| GET | `/calculators` (list) and `/calculators/{emi, compound-interest, break-even, sip, ppf, nps, epf, ssy, gst, hra, 80c, ltcg, stcg, tax-india, tax-us, tax-uk, tax-philippines, tax-nigeria, tax-kenya}` | no |
| GET | `/market/nifty`, `/market/btc`, `/market/fii-dii`, `/market/sector-rotation` | no |
| GET | `/health`, `/openapi.json`, `/docs` | no |
| POST | `/ai/cfo` `{ query, context? }` | yes |
| POST | `/ai/benchmark` `{ model?, tolerance_pct?, items: [{ question, expected }] }` (1-10 items) | yes |
| GET, POST | `/webhooks` (list, create `{ url, symbol: nifty\|btc, condition: above\|below, threshold }`) | yes |
| DELETE | `/webhooks/{id}` | yes |
| GET, POST | `/webhooks/run` (scheduler only, `Authorization: Bearer $CRON_SECRET`) | cron secret |

Parameters, ranges and defaults for each calculator are in the OpenAPI spec (generated from the same registry
that validates requests, `server/v1/calculators.ts`).

## Tax rules

India uses `src/config/taxRules/india` (FY2025-26 and FY2026-27, Income-tax Act 2025). Other countries use JSON
files in `src/tax-engines/config/` with their sources and what is not modelled (US: federal only, 2026
Rev. Proc. 2025-32; UK: 2026-27, rUK rates with allowance taper; Philippines: TRAIN graduated rates; Nigeria:
Nigeria Tax Act 2025; Kenya: PAYE with personal relief). Verify against the official source before relying on
a figure.

## Operating it

| Setting | Where | Purpose |
| --- | --- | --- |
| `API_V1_KEY_HASHES` | Vercel env | Comma-separated SHA-256 hashes of issued keys. Create one with `npx tsx scripts/create-api-key.ts`. |
| `CRON_SECRET` | Vercel env + GitHub secret | Protects `/webhooks/run`. Vercel Cron (daily on Hobby) and `.github/workflows/market-webhooks.yml` (every 15 minutes in Indian market hours) call it. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel env | Webhook storage. Apply `supabase/migrations/20260930100000_api_webhooks.sql` first. |

Webhook deliveries are `POST` JSON with `X-ArthaBench-Signature: sha256=<HMAC-SHA256(secret, raw body)>`.
Target URLs must be public `https`; private, loopback and internal addresses are refused at creation and again
before each delivery.
