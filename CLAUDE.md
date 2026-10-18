# ArthaMind (Artha Bench Pro): notes for Claude

Personal-finance web app for Indian families: money health check, tax (old vs new regime), planners, portfolio, and an AI assistant in 13 Indian languages. Live at https://artha-bench-pro.vercel.app.

## Stack
- Front end: Vite + React + TypeScript SPA in `src/` (not Next.js).
- API: one Express app (`server.ts` locally; `server/vercelHandler.ts` bundled to `api/index.js` for Vercel).
- Data: Supabase (Auth with email OTP, Postgres with Row Level Security, pgvector). Schema in `supabase/migrations/`.
- AI: `server/aiGateway.ts`, Groq first, NVIDIA NIM fallback, then an offline template. Answers are grounded by `server/fetch/` (Fetch → Refine → Verify) and the RAG in `rag/`.
- Numbers never come from the AI: `src/services/calculators.ts`, `indiaTaxEngine.ts`, `portfolio.ts` (XIRR), `src/simulation/` (Monte Carlo), and the optional certified `precision-engine/` (FastAPI).
- Architecture details: `docs/SYSTEM_DESIGN.md`.

## Commands
- `npm run dev`: local dev server
- `npx vitest run`: unit tests (about 1,178)
- `npm run build`, then `npx vite preview --port 4371`: production preview (use this for Playwright screenshots; the sandbox cannot reach vercel.app)
- Playwright: launch Chromium with `executablePath: '/opt/pw-browsers/chromium'`; never run `playwright install`.

## Data model
- The browser keeps workspace data in localStorage and syncs it every 7 s (when it changes) to `user_workspace_state` (`user_id`, `storage_key`, JSON `payload`). The sync keys are in `src/services/cloudWorkspace.ts`.
- The typed tables (`incomes`, `expenses`, `emi_records`, `health_score_snapshots`, `consent_records`, `finance_data_audit_log`) exist but are not wired up yet.
- Uploaded documents are parsed on the device (`src/services/documentScan.ts`); they are never uploaded.

## Product rules
- Be honest in all copy: no fake reviews or names, no invented traction. Reviews carry an "Illustrative quotes" note.
- Header: four menus (`NavMenu.tsx`, Groww-style panels with building art from the town) and one action, Sign up. Visitors who pick any destination sign up first (pending return path), then land on it.
- Landing order: hero, products, stats, purpose, phone showcase, Money Check (one screen on desktop), AI CFO, pricing, reviews (`ReviewsStory.tsx`: Groww-style field of cards that zooms out from the centre, then the dark logo finale), languages, footer. The Bitcoin chart, the bottom market ticker, the news strip and the scroll progress line were removed. Reviews headline: the waitlist count, counting up.
- Pricing (`LandingPricing.tsx`): Free; Pro ₹1,999/year (₹249 monthly); Global planner $199/year (₹16,999); Business custom. The maths block shows worked examples (checked in a code comment), never averages.
- Hero (`LandingHero.tsx`): live ticker (`HeroTicker.tsx`, real quotes only), a big two-line heading "Financial intelligence / for the global Indian." that fades on scroll, then the owner-approved town `public/hero/city2/town.webp` (1376 × 768). Overlays in `heroCity.css` are % of that picture: `HeroPhone` standing front-facing on the plaza (covers the drawn phone), NIFTY 50 on the dark screen, a ticker band clipped to the market building's fascia (two faces), a price screen, billboard messages, and parked car sprites (`city2/*.png`, no motion).
- Investment advice or stock tips appear only as education, or through SEBI-registered partners.
- Keep secrets in environment variables only; `VITE_*` values are public.

## Known gaps (fix when working nearby)
- Workspace data is stored as JSON blobs, not typed tables; sync is last-write-wins.
- No PII masking before LLM calls; no CSP header; the API rate limiter is per instance.
- The deployed RAG index uses the hashing embedder (50 documents, 104 chunks).

## Git
- Working branch: `claude/artha-bench-pro-changes-b5n7t7`.
- This repository is public: never commit business plans, financial models, contact details or other private documents.
