# TR-02 · AI Explains, It Never Calculates: A Grounded Pipeline for Financial Advice

**Shreyash Singh** · ArthaBench Pro · Technical report, October 2026
Code: [`src/advisor/`](../../src/advisor), [`server/advisor/`](../../server/advisor), [`rag/`](../../rag) · Docs: [`ADVISOR.md`](../ADVISOR.md)

> Status: engineering technical report, not peer reviewed. ArthaBench Pro is educational software and does not give personalised investment, tax or legal advice.

---

## Abstract

Large language models write fluent financial answers, but they also produce numbers that come from nowhere.
This report describes an eight-layer pipeline (A–H) in which **every number shown to the user is produced
by deterministic code and traced to one of three origins**: the user's own words, a live source with a
timestamp, or a labelled assumption. The language model is used only to *explain* a facts sheet. Its reply is
checked number by number; one regeneration is allowed, after which the system falls back to the raw
computed data. Answers are audited and can be shared as read-only links.

## 1. Problem

A typical chat assistant mixes four jobs in one model call: understanding the question, fetching data,
calculating and explaining. Errors in any of them are invisible to the reader. In finance the most damaging
failure is a **plausible but invented number**: a wrong EMI, an outdated tax slab, a made-up return.

## 2. Design principle

Separate the jobs, and let the model do only the one it is good at:

| Layer | Job | Who does it |
|---|---|---|
| A. Parse | intent, entities, amounts (Indian formats such as "1.5 lakh", "2 cr"), horizon | rules; an optional small model may help with structure, but numbers not present in the question are refused |
| B. Data | quotes, NIFTY features, RBI, FII/DII, sectors, news, web | per-source fetchers, each with its own timeout; one failing source never blocks the others; data older than 1 h is flagged |
| C. Pattern | the 15 most similar past NIFTY days over 10 years (z-scored features, at least 10 trading days apart), with 20- and 60-day forward returns vs. the any-day baseline | deterministic k-nearest-neighbour search; always labelled "Historical pattern, not a prediction" |
| D. Math | SIP, lump sum, EMI, FD, inflation, required SIP, income tax: formula, sourced inputs and steps | deterministic code (see [TR-01](TR-01-certified-financial-arithmetic.md)) |
| E. Profile | emergency fund, EMI share, savings rate, insurance cover, 80C/NPS room, equity mix | rule checks against labelled guidelines → fits / caution / mismatch |
| F. Explain | plain-language answer | language model (Groq Llama 3.3 70B), constrained to the facts sheet |
| G. Audit | store the answer with its inputs; shareable link that drops profile data | Supabase with owner-only row-level security |
| H. UI | live progress per layer, "Show my work" | React, streamed NDJSON |

## 3. Guardrails in the math layer

Deterministic rules run before any explanation is written:

- short horizon with equity → warning;
- high crypto share or single-asset concentration → warning;
- EMI burden above a labelled threshold → warning;
- no emergency fund → "emergency fund first";
- **no projections** for single stocks, crypto or gold.

## 4. The number check (Layer F)

The explainer receives a facts sheet, not raw data. After it replies, every number in the text is extracted
and matched against the numbers the pipeline actually produced (allowing for normal formatting such as
Indian digit grouping and lakh/crore units). If any number does not match, the model is asked once to
regenerate. If the second attempt also fails, the user sees the **raw computed data** instead of an
unverified explanation. The system prefers a less fluent answer to an unsupported one.

## 5. Retrieval for regulatory text

Questions about rules (tax sections, SEBI or RBI circulars) use a hybrid retriever ([`rag/retriever.py`](../../rag/retriever.py)):
vector search and BM25 keyword search, each top-20, fused with Reciprocal Rank Fusion (k = 60), then
re-ranked by a cross-encoder (or a lexical fallback offline) to the top 5 passages, which are given to the
model as numbered citations.

## 6. Evaluation

- The pipeline is covered by automated tests across the parser, data layer, pattern matcher, math engine,
  profile matcher, explainer and audit routes (`tests/advisor*.test.ts`), running in CI with the rest of the
  suite (1,171 tests passing at the time of writing).
- A separate **Grounding evaluation** workflow checks that answers stay tied to their sources.
- Real parser defects found and fixed during development include: "SIP of ₹X" being read as a lump sum, and
  "loan of X" triggering investment guardrails.

## 7. Limitations

- The pattern matcher shows what happened after similar days in the past; it is not a forecast and is
  labelled as such.
- Guideline thresholds (e.g. emergency-fund months) are conventions, not laws, and are shown as labelled
  assumptions.
- Live data depends on third-party providers; stale or missing data is surfaced, not hidden.

## 8. Takeaway

Reliability in financial AI does not have to come from a better model. It can come from **architecture**:
let deterministic code own the numbers, let the model own the words, and check the words against the numbers.
