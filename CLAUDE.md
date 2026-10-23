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
- `npx vitest run`: unit tests (about 1,214)
- `npm run build`, then `npx vite preview --port 4371`: production preview (use this for Playwright screenshots; the sandbox cannot reach vercel.app)
- Playwright: launch Chromium with `executablePath: '/opt/pw-browsers/chromium'`; never run `playwright install`.

## Data model
- The browser keeps workspace data in localStorage and syncs it every 7 s (when it changes) to `user_workspace_state` (`user_id`, `storage_key`, JSON `payload`). The sync keys are in `src/services/cloudWorkspace.ts`.
- Connected workspace (`src/services/workspaceSync.ts`): the money profile (`moneyProfile.ts`, from setup, document scan or a landing Money Check saved before sign-up) fills Income, Expenses, Budget, EMIs and Tax with records tagged `from-profile`. They follow profile changes and step aside once the user adds their own records. The sync runs on every profile save and on workspace navigation. The portfolio feeds investments, cash and loans back into the profile; portfolio prices refresh automatically (stale after 6 h, then every 30 min). The profile, portfolio and planners are in the cloud sync keys.
- The typed tables (`incomes`, `expenses`, `emi_records`, `health_score_snapshots`, `consent_records`, `finance_data_audit_log`) exist but are not wired up yet.
- Uploaded documents are parsed on the device (`src/services/documentScan.ts`); they are never uploaded.

## Product rules
- Be honest in all copy: no fake reviews or names, no invented traction. Reviews carry an "Illustrative quotes" note.
- Header: four menus (`NavMenu.tsx`, Groww-style panels with building art from the town) and one action, Sign up. Visitors who pick any destination sign up first (pending return path), then land on it.
- Landing order: hero, products, stats, purpose, phone showcase, Money Check (one screen on desktop), AI CFO, pricing, reviews (`ReviewsStory.tsx`: Groww-style field of cards that zooms out from the centre, then the dark logo finale), languages, footer. The Bitcoin chart, the bottom market ticker, the news strip and the scroll progress line were removed. Reviews headline: the waitlist count, counting up.
- Pricing (`LandingPricing.tsx`): Free; Pro ₹1,999/year (₹249 monthly); Global planner $199/year (₹16,999); Business custom. The maths block shows worked examples (checked in a code comment), never averages.
- Hero (`LandingHero.tsx`): live ticker (`HeroTicker.tsx`, real quotes only), a big two-line heading "Financial intelligence / for the global Indian." that fades on scroll, then the owner-approved town `public/hero/city2/town.webp` (1376 × 768). Overlays in `heroCity.css` are % of that picture: `HeroPhone` on the round platform on top of the market building (covers the drawn logo), the gold ArthaMind coin (`GoldCoin.tsx`, shared with the phone intro) spinning in 3D above a glowing platform and light beam in the plaza (the beam covers the drawn phone at every angle), NIFTY 50 on the dark screen, a ticker band clipped to the market building's fascia (two faces), a price screen, billboard messages, and parked car sprites (`city2/*.png`, no motion).
- Required sign-up questions (`RequiredOnboarding.tsx`, logic in `src/services/onboarding.ts`): every signed-in user answers them full screen before any workspace page shows. Each question says why we ask; core questions are required, extra sections (tax, will, habits, scenarios) can be skipped. Plain arithmetic checks (`checkAnswers`, no AI) block impossible answers and ask to confirm unusual ones. Answers go to table `user_onboarding` (RLS, own row), the account profile (level, country, currency) and the money profile; the review screen shows a step-by-step plan (`buildPath`). Afterwards a short arrow tour and a "Getting started" checklist with points (`GuidedTour.tsx`).
- After the questions, the answers drive everything: `ensureProfileFrom` keeps the money profile in step with them, every "Set up" / "Edit answers" button opens the same saved answers (`openAnswersEditor`, `src/services/answersEditor.ts`), the dashboard advisor runs its full analysis by itself (cached 6 h, `DASH_ANALYSIS_KEY`), and `answersSummary` adds job, goals, habits and mindset to every assistant. The first question is the language; it switches the whole site (`setSiteLanguage` in `LanguageSelector.tsx`) and every answer (`language` in `x-artha-prefs`).
- Calculations accept every real situation the questions allow (`hardInputError` in `moneyCheck.ts`): ages 14–110, no income (students, homemakers), and people past their retirement age. `validateMoneyCheck` stays stricter only for the landing form.
- Dashboard and Money report show `FinancialPicture.tsx`: donuts (monthly money, what you own, what you owe), % covered bars for protection, the road to retirement, strengths / needs attention and "About you", all from `analyseFinances` (`src/services/financialAnalysis.ts`), which the PDF shares. The advisor card ("Get my complete advisory") runs by itself; its Listen bar starts in the user's chosen language (English by default).
- First visit to any feature shows a short card with an arrow (`FeatureIntro` in `GuidedTour.tsx`, seen list `arthamind.featureIntro.v1`).
- Downloadable report: `src/services/financialReport.ts` (jsPDF, lazy-loaded) builds a 6–9 page PDF with the ArthaMind logo: cover with score gauge and key figures, executive summary (strengths, needs attention), about you, cash flow and net worth donuts, loans, tax, insurance (% covered), road-to-retirement chart, the advisor analysis (grounded on live markets, news and web, with its sources), a 30/60/90-day plan, markets, method/assumptions/limitations, sources and a glossary. Charts are drawn on a canvas and embedded. Helvetica has no ₹, so the PDF writes "Rs".
- Brand: never show the word "AI" to users; the product is "ArthaMind" (CFO, Tutor, assistant). Legal pages say answers come from "computer language models".
- Reader level and currency (`src/services/userPrefs.ts`) go with every AI request in the `x-artha-prefs` header: beginners get 10-year-old-simple wording; answers use the currency the question names, else the home currency (lakh/crore for INR, million/billion otherwise). Voice reads amounts as words (`src/lib/spokenNumbers.ts`: ₹12,00,000 → "12 lakh rupees"); normal voice speed is 1.25×.
- Every page ends with the short line "Investments are subject to market risks." The workspace uses one accent colour (brand teal); green and red only for gains and losses.
- Voice input: signed-in users only. The browser records and `POST /api/voice/stt` sends it to Sarvam AI (`server/sarvamService.ts`, key `SARVAM_API_KEY` in Vercel only); the daily limit (`VOICE_STT_DAILY_LIMIT`, default 15, India time) is counted by the Supabase function `use_voice_credit` (table `voice_usage`). When the limit is used up, Chrome/Edge fall back to the browser's free recognition. Spoken answers are capped at two short sentences (`shortSpoken`).
- Voice: the floating voice assistant panel was removed. Voice-to-text (`MicButton.tsx`, `listenOnce` in `src/services/voice.ts`) keeps listening through pauses until tapped to stop and shows a "Listening" label.
- Verified answers (`src/services/verifiedAnswers.ts`, `verifiedFreedom.ts`): `askAiCfo` answers dashboard questions (money health, surplus, runway, net worth, freedom age) and plain EMI, SIP and compound maths on the device, from the same figures the dashboard shows, before any model call. Every other CFO or advisor prompt carries the verified freedom figures, and a conflicting age or return gets a correction. Decisions and open questions still go to the model.
- Reviews stay illustrative (role and city, no names or photos) until real, consented reviews exist.
- Investment advice or stock tips appear only as education, or through SEBI-registered partners.
- Keep secrets in environment variables only; `VITE_*` values are public.

## Known gaps (fix when working nearby)
- Workspace data is stored as JSON blobs, not typed tables; sync is last-write-wins.
- No PII masking before LLM calls; no CSP header; the API rate limiter is per instance.
- The deployed RAG index uses the hashing embedder (50 documents, 104 chunks).

## Git
- Working branch: `claude/artha-bench-pro-changes-b5n7t7`.
- This repository is public: never commit business plans, financial models, contact details or other private documents.
