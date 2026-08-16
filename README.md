# ArthaBench Pro

ArthaBench Pro is a financial AI reliability, learning, business-news, and market-intelligence platform. It combines dual Groq evaluation, deterministic financial calculations, educational safety controls, NewsData.io headlines, and Twelve Data market quotes.

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
```

Never prefix provider secrets with `VITE_`, commit `.env` files, or expose values in browser responses. When a provider is unavailable, the relevant feature returns explicitly labelled demo data instead of claiming a live connection.

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

The project is configured for Vercel. Add all seven environment variables for Production and Preview, deploy the `main` branch, and verify provider health from **AI Connections**.

ArthaBench Pro is an educational and research system. It does not provide personalized investment, tax, legal, or accounting advice.
