# Free web search with SearXNG

ArthaMind uses a self-hosted [SearXNG](https://docs.searxng.org) instance as its default web-search
provider. No paid search API is needed. The browser never calls SearXNG; every request goes through the
backend route `POST /api/ai/web-search` and the grounding layer.

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `SEARXNG_BASE_URL` | yes, for web search | — | Base URL of your SearXNG (no trailing path). Server-only. |
| `WEB_SEARCH_TIMEOUT_MS` | no | 9000 | Time limit per SearXNG call. |
| `WEB_SEARCH_MAX_RESULTS` | no | 5 | Sources per search (capped at 5). |
| `WEB_SEARCH_CACHE_TTL_SECONDS` | no | 900 | Fresh cache window for identical queries. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | no | — | Shared cache across serverless instances. |

Set `SEARXNG_BASE_URL` in Vercel project settings (Production and Preview). Never put it in a `VITE_` variable.

## Self-hosting SearXNG (short guide)

1. Run the official container on a small VM or any host you control:
   ```bash
   docker run -d --name searxng -p 8080:8080 -v ./searxng:/etc/searxng searxng/searxng
   ```
2. In `settings.yml`, enable the JSON format the app uses:
   ```yaml
   search:
     formats:
       - html
       - json
   ```
3. Put it behind HTTPS (for example Caddy or Nginx with a certificate) and restrict who can reach the
   instance. The app only calls `GET /search?q=…&format=json`.
4. Check it: `curl "https://your-host/search?q=RBI+repo+rate&format=json"` should return a JSON `results` list.
5. Set `SEARXNG_BASE_URL=https://your-host` and redeploy.

## What leaves the server

Only a neutral public query. Amounts, first-person words, income, EMI, savings, goals and chat history are
removed before any call (`publicQuery` in `server/services/searxngSearch.ts`, covered by tests). Only
financial and economic questions are searched.

## Limits and fallbacks

- 10 searches per user per minute and 50 per hour (keyed by signed-in user, otherwise by IP).
- If SearXNG is down or slow, a cached answer up to six hours old is used; otherwise the answer is built
  from the saved profile and verified calculations, with a calm notice.
- Dead links are not probed (that would add latency); the ranking removes blocked and low-quality domains.
