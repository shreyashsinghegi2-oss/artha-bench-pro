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
- Hero (`LandingHero.tsx`): live index ticker (`HeroTicker.tsx`, real quotes only), headline, then the owner-approved "ArthaMind City" illustration (`public/hero/city.webp`) with `HeroPhone` standing on the central pedestal (no floating logo) and the brand on the billboard. Positions are percentages of the 1621 × 919 image (`heroCity.css`). The old coin background video was removed at the owner's request.
- Investment advice or stock tips appear only as education, or through SEBI-registered partners.
- Keep secrets in environment variables only; `VITE_*` values are public.

## Known gaps (fix when working nearby)
- Workspace data is stored as JSON blobs, not typed tables; sync is last-write-wins.
- No PII masking before LLM calls; no CSP header; the API rate limiter is per instance.
- The deployed RAG index uses the hashing embedder (50 documents, 104 chunks).

## Git
- Working branch: `claude/artha-bench-pro-changes-b5n7t7`.
- This repository is public: never commit business plans, financial models, contact details or other private documents.
