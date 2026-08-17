# ArthaBench Pro

ArthaBench Pro is a financial AI reliability, learning, business-news, and market-intelligence platform. It combines dual Groq evaluation, deterministic financial calculations, educational safety controls, NewsData.io headlines, and server-side market-provider adapters.

## Server-side providers

The application reads provider credentials only in server code. Configure these variables locally in `.env` or in Vercel Project Settings:

```text
GROQ_API_KEY=
BUSINESS_NEWS_PROVIDER=newsdata
BUSINESS_NEWS_API_KEY=
BUSINESS_NEWS_BASE_URL=https://newsdata.io/api/1/latest
MARKET_DATA_PROVIDER=twelvedata
MARKET_DATA_API_KEY=
MARKET_DATA_BASE_URL=https://api.twelvedata.com/quote
# Optional experimental, no-key alternative:
# MARKET_DATA_PROVIDER=yahoo
# YAHOO_FINANCE_BASE_URL=https://query1.finance.yahoo.com/v8/finance/chart
```

Never prefix provider secrets with `VITE_`, commit `.env` files, or expose values in browser responses. When a provider is unavailable, the relevant feature returns explicitly labelled demo data instead of claiming a live connection.

For the experimental Yahoo adapter, see [Yahoo Finance setup](docs/yahoo-finance-setup.md). Yahoo quote freshness is derived conservatively from the returned market timestamp, trading session, and delay metadata.

For the recommended sequential Yahoo → Twelve Data configuration, see [Hybrid market-data setup](docs/hybrid-market-data-setup.md). The fallback provider is called only when the primary quote is unusable, which preserves Twelve Data credits and reduces unnecessary provider traffic.

## Local verification

```bash
npm install
npm run lint
npm test
npm run build
PORT=3001 NODE_ENV=production npm start
```

Production health endpoints:

- `GET /api/health`
- `GET /api/diagnostics`

## Deployment

The project is configured for Vercel. Add the required environment variables for Production and Preview, deploy the `main` branch, and verify provider health from **AI Connections**.

ArthaBench Pro is an educational and research system. It does not provide personalized investment, tax, legal, or accounting advice.
