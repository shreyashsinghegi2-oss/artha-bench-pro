# ArthaPilot

ArthaPilot is the reusable orchestration layer for ArthaBench Pro. It is a command centre, not a generic chatbot: natural-language requests are classified and handed to existing workspaces.

## Intent-routing schema

| Intent | Detection examples | Destination | Data rule |
|---|---|---|---|
| finance | budget, income, expense, saving, goal | Budgeting / finance workspace | Existing account data only when explicitly enabled |
| calculation | EMI, loan, formula, calculate | EMI Manager | Deterministic calculator; existing EMI records require permission |
| learning | learn, explain, quiz, revision, flashcards | Financial Tutor | Learning progress requires explicit learning permission |
| market | NIFTY, stocks, prices, forex | Market Data | Source-backed data with provider timestamps |
| market/news | business news, headlines | Business News | Source-backed data |
| market/economy | inflation, GDP, economic data | Economic Data | Source-backed data |
| market/crypto | crypto, BTC, ETH | Crypto | Source-backed data |
| verify | verify, fact check, reliability, proof | Evaluation Lab / verification workflow | Never represented as verified without an evaluation run |
| future | what-if, future, projection, replay | Ripple Twin / Decision Replay | Personal goals require explicit goal permission |
| navigation | find, open, continue, workspace, feature | Global workspace/navigation entry | No account data needed |
| ambiguous | no supported intent | Clarification | One concise clarification |

## Handoff contract

`createArthaPilotHandoff()` stores the original request, detected intent, destination, workspace label, selected context and timestamp in session storage. A compact recent-action history is kept locally for navigation continuity.

## Workspace integrations

- Financial Health, Income, Expenses, Budgeting and Reports remain existing finance workspaces.
- EMI Manager receives calculation/loan requests.
- Financial Tutor and Learning receive education requests.
- Market Data, Crypto, Business News and Economic Data receive current-data requests.
- Evaluation Lab receives verification requests.
- Ripple Twin and Decision Replay receive future/what-if requests.
- Existing Comparison, Scenarios, Batch Benchmark and Reports & History remain directly available.

## Privacy behavior

ArthaPilot reads the existing AI-data-context permission model. Defaults are off. It never creates or invents account records. Personal context is only used for categories explicitly enabled by the user. When a required personal context is missing, the UI gives an actionable setup message rather than fabricating data.

## UX behavior

- Compact `✦ ArthaPilot` entry is placed in the top navigation beside language/AI status.
- Full-height responsive command-centre drawer.
- Keyboard Escape closes the drawer; command input receives focus when opened.
- Initial choices stay simple and advanced privacy/context information is revealed on demand.
- Dark mode uses the existing application theme tokens.
- Navigation handoffs show `Opening [workspace]` and preserve the original request.
- No raw provider errors, JSON, Markdown, internal prompts or technical logs are surfaced.

## Test plan

1. **Plan my money** → Budgeting; no expense records are invented when expense context is disabled.
2. **Learn with me** → Financial Tutor; learning context is optional unless explicitly requested.
3. **Verify this** → Evaluation Lab; request is preserved for the verification workflow.
4. **See my future** → Ripple Twin; goal context is required before using existing personal goals.
5. **Explore markets** → Market Data; crypto/news/economy keywords are routed to their existing specialized workspaces.
6. **Continue where I left off** → Overview/navigation entry; recent ArthaPilot actions remain available locally.
7. **EMI** → EMI Manager and deterministic calculation path.
8. **Ambiguous input** → one concise clarification and no invented answer.
9. **Mobile/keyboard** → drawer fills viewport, scrolls independently, Escape closes, input and cards are keyboard reachable.
10. **Theme/language** → existing application theme and global language mechanisms remain in control.

## Preservation

ArthaPilot adds an orchestration layer and command-centre UI. It does not delete or replace existing routes, data providers, finance engines, learning engines, evaluation tools, market providers or account controls.
