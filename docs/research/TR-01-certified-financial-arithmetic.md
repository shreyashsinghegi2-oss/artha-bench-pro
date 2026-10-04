# TR-01 · Certified Financial Arithmetic: Returning a Proof, or No Number at All

**Shreyash Singh** · ArthaBench Pro · Technical report, October 2026
Code: [`precision-engine/`](../../precision-engine) · Tests: [`precision-engine/tests/`](../../precision-engine/tests) · CI: `Precision engine` workflow

> Status: engineering technical report, not peer reviewed. Every claim below refers to code and tests in this repository.

---

## Abstract

Financial assistants usually compute with binary floating point and print the result with confidence. For
consumer finance the error is often small, but it is never stated, and for root-finding problems such as XIRR
the answer may not even be unique. This report describes a calculation engine that returns, for every
result, a **certificate**: a 30-significant-digit value, an interval that is *proven* to contain the true value
of the stated formula, and an error bound computed from what the caller actually receives. If a relative
error of at most 1×10⁻⁸ cannot be proven, the engine answers HTTP 422 and returns **no number**. The engine
covers EMI, SIP future value, CAGR, XIRR, bond yield to maturity and Indian income tax (FY 2025-26 and
FY 2026-27), and every result must also agree with an independent algorithm.

## 1. Problem

Three failure modes motivate the design:

1. **Silent rounding.** A JSON number such as `0.1` has already been rounded to binary before the server sees
   it. Any later "exact" computation is exact about the wrong input.
2. **Unstated error.** A float result carries no information about how far it may be from the true value.
3. **Ill-posed roots.** XIRR solves Σ cₖ(1+r)^(−tₖ) = 0. With more than one sign change in the cash flows, there
   can be several roots; most libraries return whichever one Newton's method happens to reach.

## 2. Design

**Exact inputs.** The API accepts decimal *strings* and rejects JSON numbers. Each input becomes an exact
rational (`fractions.Fraction`). No Python `float` appears on the computation path.

**Certificates.** Every response contains `value` (30 significant digits), an interval `[lo, hi]` and a
relative error bound. The bound is computed from the *printed* value and interval, not from internal
quantities. A separate `display` field (₹64,145.72) is rounded to paise for reading; the guarantee is stated
for `value`, never for `display`.

**Per-calculator proofs.**

| Calculator | Why the true value lies inside the interval |
|---|---|
| EMI, SIP | With a decimal rate and whole months the answer is rational; it is computed exactly and rounded outward. |
| Income tax | Slabs, the 87A rebate, surcharge with marginal relief and 4 % cess are percentages of rupee amounts, so the liability is a terminating decimal computed exactly (error bound 0). |
| CAGR | Interval arithmetic with outward rounding (`mpmath.iv`, 50 digits) encloses q = (end/begin)^(1/years); a monotonicity check proves begin·q_lo^n < end < begin·q_hi^n. |
| XIRR, bond YTM | **Existence:** interval evaluation proves a sign change of f across the interval (intermediate value theorem). **Uniqueness:** with x = 1/(1+r), f is a generalised polynomial; Descartes' rule of signs bounds the number of positive roots by the sign changes in the cash flows. With more than one sign change, interval branch-and-bound over −99.99 % … 10,000 % counts roots rigorously; if there are several, the engine **refuses** rather than choosing. |

**Independent cross-checks.** On top of the proof, each result must agree within 1×10⁻¹⁰ with a second,
independently written method:

| Calculator | Primary method | Cross-check |
|---|---|---|
| EMI | closed form, 30 digits | amortisation schedule closes to zero |
| SIP | closed form, 30 digits | month-by-month accumulation |
| CAGR | power formula, 30 digits | exact rational power, then integer root |
| XIRR, bond YTM | safeguarded Newton, 30 digits | bisection, 40 digits |
| Tax | exact slab computation | SymPy piecewise statute |

**Independent verification.** `POST /api/verify` re-checks a certificate without calling the calculators
(recomputing the rational value, or re-proving the bracket or sign change). Tampered certificates are rejected.

## 3. What 1×10⁻⁸ means in rupees

| Result | 1×10⁻⁸ of it | Typical certified bound |
|---|---|---|
| EMI ₹1,00,000 | ₹0.001 | about ₹10⁻²⁵ |
| Tax ₹42,380 | ₹0.0004238 | 0 (exact) |
| XIRR 14.2345 % | 0.000000142 percentage points | about 10⁻²⁷ percentage points |

## 4. Evaluation

Correctness is tested with property-based testing (Hypothesis) against independent oracles
([`oracles.py`](../../precision-engine/tests/oracles.py)). The CI profile runs **10,000 cases per closed-form
calculator and per tax regime, and 5,000 per root-finder**, on every push.

The tests are evidence, not proof; their job is to catch mistakes in the code that carries the proof. During
development they caught five real defects:

1. interval endpoints silently re-rounded to 15 digits;
2. cash-flow coefficients converted at 15 digits;
3. a yield scaled at 15 digits;
4. a CAGR within 10⁻⁵¹ of −100 %;
5. an exact 0 % XIRR (now detected in exact arithmetic, Σ cₖ = 0).

## 5. Trusted base and limitations

The proofs rest on Python's `fractions.Fraction`, on `mpmath` interval arithmetic rounding every operation
outward (including `exp` and `log`), and on the correctness of this code. The guarantee is about the
**stated formula**: it does not certify that the formula is the right model of a user's real loan or tax
situation, and the tax rules are only as current as the encoded statute.

## 6. Why it matters

In an AI system the language model never computes these numbers. It receives certified values and explains
them (see [TR-02](TR-02-grounded-financial-advisor.md)). A refusal (HTTP 422) is a feature: an assistant that
cannot prove a number should say so instead of printing one.
