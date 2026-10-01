# ArthaBench Research

Technical reports on the methods behind ArthaBench Pro. Each report describes code that exists in this
repository and the tests that check it. They are engineering reports, not peer-reviewed papers.

| ID | Title | Question it answers | Code |
|---|---|---|---|
| [TR-01](TR-01-certified-financial-arithmetic.md) | Certified Financial Arithmetic | Can a finance calculator *prove* its answer, and refuse when it cannot? | [`precision-engine/`](../../precision-engine) |
| [TR-02](TR-02-grounded-financial-advisor.md) | AI Explains, It Never Calculates | How do we stop a language model from inventing financial numbers? | [`src/advisor/`](../../src/advisor), [`rag/`](../../rag) |
| [TR-03](TR-03-reproducible-monte-carlo.md) | Reproducible Monte Carlo for Household Planning | How likely is a SIP to reach a goal, and can the answer be reproduced exactly? | [`src/simulation/`](../../src/simulation) |

## The common idea

> **Financial intelligence should be explainable, traceable, and explicit about uncertainty.**

- Numbers come from deterministic, tested code (TR-01, TR-03).
- Language models explain those numbers and are checked against them (TR-02).
- Uncertainty is shown, not hidden: proven error bounds (TR-01), labelled assumptions and stale-data warnings (TR-02), probability bands (TR-03).

## Citing

If you use this work, please cite it using [`CITATION.cff`](../../CITATION.cff) (GitHub shows a "Cite this repository" button).
