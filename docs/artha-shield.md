# ArthaShield — Financial Safety Centre

## Data and permission model

ArthaShield uses the central `arthabench_ai_context_v1` consent state. Existing categories are income, expenses, budgets, EMIs, goals, paper portfolio and learning progress, plus conversation retention. Defaults are disabled. ArthaShield does not infer missing records.

## Review rules and score

Each review component is derived from an actual check:

- Privacy context: enabled/disabled consent state and retention setting.
- Financial readiness: presence of actual expenses, recurring commitments, EMI/debt records, budget categories, emergency target and goal coverage.
- AI trust: actual provider health and completed evaluation evidence.
- Data quality: actual source freshness records.

Current score formula: `ready_checks / total_completed_checks × 100`, rounded to the nearest whole number. A score is not a claim of security, financial health, fraud protection, or investment safety. If a component cannot be established, the UI reports `Data needed`/`unknown` rather than manufacturing a score input.

## Secret detection/redaction

The local preflight detector checks for common patterns including OTP/one-time-password codes, API/access tokens, PEM private keys, 13–19 digit card-like numbers, password assignments and bank-login credential labels. Matching content is replaced locally with `[REDACTED SENSITIVE DATA]`. Findings are reported by category only; secret values are never written to the provider-sharing log.

This is a best-effort preflight, not a guarantee that every secret can be detected.

## Financial readiness calculations

Emergency-fund readiness is calculated only when positive essential monthly expenses and a target cash buffer are both present:

`months_of_buffer = target_cash_buffer / essential_monthly_expenses`

No ratio is produced for missing/invalid inputs. Emergency Money Plan fields are user-editable and include essential expenses, target buffer, savings goal, commitments and next actions. Monetary computation should remain deterministic and should be migrated to Decimal.js/equivalent when additional monetary calculations are introduced.

## AI verification workflow

ArthaShield provides the trust-control surface and routes users to the existing Evaluation Lab for actual verification. Tutor calculation verification can be enabled with `Always verify calculations in tutor responses`. A response is not represented as verified merely because a user asks for verification; applicable deterministic calculations, available source claims, assumptions, uncertainty, risk flags and injection indicators must be evaluated by the underlying verification workflow.

## Data freshness workflow

ArthaShield accepts explicit freshness records only: Live, Delayed, End-of-day, Cached, Unavailable or Illustrative. Source, timestamp and market status should come from the existing market/provider services. Unknown freshness is never upgraded to Live. Delayed/cached/unavailable states are surfaced as limitations.

## Test cases

- Privacy: toggle each AI context category and confirm central consent state changes.
- Sensitive input: OTP/password/API key/private key/card-like/bank credential patterns are detected and redacted without logging values.
- Missing data: readiness shows `Data needed`; no financial ratio is fabricated.
- Market delay: delayed/cached records are not displayed as live.
- Provider failure: unavailable/degraded provider state remains a warning and never becomes healthy by default.
- Calculation verification: tutor verification setting is persisted; unverified answers are not labelled verified by ArthaShield.
- India/INR: user-editable plan uses INR formatting in India-first UI; country/currency selections must be respected by connected modules.
- Accessibility: keyboard reachable tabs/buttons, focus-visible states, semantic dialog, readable contrast, mobile scrolling and non-color-only status indicators.
- Recovery: review can be retried; errors preserve user-entered plan/secret-review input.

## Scope boundary

ArthaShield is a privacy, readiness, AI-trust and data-quality review centre. It does not control bank accounts, lenders, payments, investments, insurance claims, fraud systems, emergency-money providers, debt-relief programs or external financial accounts.
