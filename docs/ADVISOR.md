# ArthaMind Advisor: the A–H pipeline

The rule: **AI only explains, it never calculates.** Every number comes from deterministic code and can be
traced to the user's words, a live source (with timestamp), or a labelled assumption.

| Layer | Code | What it does |
|---|---|---|
| A. Parse | `src/advisor/query-parser.ts` | Intent, entities, amounts (Indian formats, Hindi units), horizon. An optional small Groq model helps with structure; numbers not in the question are refused. |
| B. Data | `src/advisor/data-gathering.ts`, `server/advisor/fetchers.ts` | Market quotes, NIFTY features, RBI, FII/DII, sectors, news (time-sensitive only), web (novel or stale only). Each source has a timeout and fails alone; data older than 1 h gets a "Data from …" warning. |
| C. Pattern | `src/advisor/pattern-matcher.ts`, `src/advisor/features.ts` | 15 most similar past NIFTY days (10 years, z-scored features, ≥10 trading days apart); 20/60-day forward returns vs the any-day baseline. Always labelled "Historical pattern, not a prediction". |
| D. Math | `src/advisor/math-engine.ts` | SIP, lump sum, EMI, FD, inflation, required SIP, India income tax: formula, sourced inputs and steps. Guardrails: short equity horizon, crypto share, concentration, EMI burden, emergency fund first. No projections for single stocks, crypto or gold. |
| E. Profile | `src/advisor/profile-matcher.ts` | Emergency fund, EMI share, savings rate, term/health cover, 80C/NPS room, equity mix against labelled guidelines; fits / caution / mismatch. |
| F. Explain | `src/advisor/explainer.ts`, `server/advisor/groq-explainer.ts` | Groq `llama-3.3-70b-versatile` explains a facts sheet. Every number in the reply is checked; one regeneration, then the raw computed data. |
| G. Audit | `server/advisor/audit.ts`, migration `20260930120000_advisor_audit.sql` | Signed-in answers are stored with the user's own session (owner-only RLS). Share links via `get_shared_advice()`, which drops profile data. |
| H. UI | `src/components/advisor/AdvisorChat.tsx` | `/advisor` with live layer progress and "Show my work"; `/advice/<id>` for shared answers. |

## API

- `POST /api/advisor/ask` `{ question, profile? }` → NDJSON: `{"type":"layer",...}` per layer, then `{"type":"answer", answer, audit, audit_note}`.
- `POST /api/advisor/share` `{ id }` (Bearer token) → `{ share_id }`.
- `GET /api/advisor/shared/:shareId` → shared answer.
- `POST /api/advisor/parse`, `POST /api/advisor/context` expose Layers A and B alone.

## Configuration

`GROQ_API_KEY` (parser and explainer; without it answers use the raw computed data), optional
`GROQ_PARSER_MODEL`, `GROQ_EXPLAINER_MODEL`.
