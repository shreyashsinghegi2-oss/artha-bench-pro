# ArthaBench precision engine

Certified financial calculations: EMI, SIP future value, CAGR, XIRR, bond yield to maturity and Indian
income tax (FY 2025-26 / FY 2026-27). Every result carries a certificate: a value, an interval that is
**proven** to contain the true value of the stated formula, and an error bound. If the engine cannot
prove a relative error of at most 1×10⁻⁸ (0.000001 %), it returns HTTP 422 and **no number**.

```
uvicorn app.main:app --port 8000                  # from precision-engine/
docker build -t arthabench-precision . && docker run -p 8000:8000 arthabench-precision
pytest tests -q                                   # quick (200 cases per property)
HYPOTHESIS_PROFILE=ci pytest tests -q             # full: 10,000 cases per closed form and tax regime, 5,000 per root-finder
```

## What 1×10⁻⁸ relative error means in rupees

| Result | 1×10⁻⁸ of it | Typical certified bound here |
|---|---|---|
| EMI ₹1,00,000 | ₹0.001 | about ₹10⁻²⁵ |
| Tax ₹42,380 | ₹0.0004238 | 0 (tax is computed exactly) |
| XIRR 14.2345 % | 0.000000142 percentage points | about 10⁻²⁷ percentage points |

The bound applies to `output.value`, the 30-significant-digit result. `output.display` (₹64,145.72) is
rounded to paise for reading, and paise rounding alone can exceed 1×10⁻⁸ of a small amount. So the
guarantee is stated for `value`, never for `display`.

## What is proved, calculator by calculator

Inputs are decimal strings. The API rejects JSON numbers, because they arrive as binary floats that have
already been rounded. Each input becomes an exact rational number. Nothing on the computation path uses
Python `float`.

| Calculator | Why the true value is inside the certified interval |
|---|---|
| **EMI**, **SIP** | With a decimal rate and whole months, the answer is a rational number. It is computed exactly with `fractions.Fraction`, and the interval is that exact value rounded outward. A 50-digit interval evaluation must also contain it, and a 60-digit amortisation schedule or month-by-month sum must close. |
| **Income tax** | Slab rates, the 87A rebate, surcharge with marginal relief and 4 % cess are all percentages of rupee amounts, so the liability is a terminating decimal computed exactly (error bound 0). It must equal, exactly, an independently written SymPy piecewise version of the same rules. |
| **CAGR** | Interval arithmetic with outward rounding (`mpmath.iv`, 50 digits) encloses the growth factor q = (end/begin)^(1/years). The engine then checks, again with interval arithmetic, that begin·q_low^years < end < begin·q_high^years. Because this is strictly increasing in q, the true q lies in [q_low, q_high], and CAGR = q − 1 exactly. |
| **XIRR**, **bond YTM** | f(r) = Σ c_k (1+r)^(−t_k). **Existence:** f is continuous for r > −1. Interval arithmetic proves f(lower) and f(upper) have opposite signs, so a root lies between them (intermediate value theorem). **Uniqueness:** with x = 1/(1+r), f is a generalised polynomial in x. Descartes' rule of signs for real exponents allows at most as many positive roots as there are sign changes in the cash flows. One sign change means exactly one IRR. With more sign changes, an interval branch-and-bound over −99.99 % … 10,000 % counts the roots rigorously. If there is more than one, the engine refuses rather than picking one. An exact 0 % rate is detected in exact arithmetic (Σ c_k = 0). |

On top of the proof, every result must agree with at least one independent algorithm to within 1×10⁻¹⁰:

| Calculator | Primary method | Independent cross-check |
|---|---|---|
| EMI | closed form at 30 digits | amortisation schedule closure |
| SIP | closed form at 30 digits | month-by-month accumulation |
| CAGR | power formula at 30 digits | exact rational power followed by an integer root |
| XIRR, bond YTM | safeguarded Newton at 30 digits | bisection at 40 digits |
| Tax | exact slab computation | SymPy statute |

If any check fails, the answer is 422, never a number.

The error bound is computed from the printed value and the printed interval, which is what a caller
receives, not from internal quantities.

### What the proof rests on (the trusted base)

- Python's `fractions.Fraction`: exact rational arithmetic.
- `mpmath` interval arithmetic (`mpmath.iv`) rounding every operation outward, including `exp` and `log`.
- The correctness of this code.

The tests are evidence, not proof. They exist to catch mistakes in the code above. They already caught
five during development:
- interval endpoints silently re-rounded to 15 digits;
- cash-flow coefficients converted at 15 digits;
- scaling a yield at 15 digits;
- a CAGR within 10⁻⁵¹ of −100 %;
- an exact 0 % XIRR.

## Independent checking

`POST /api/verify` with `{"certificate": …}` re-checks a certificate without calling the calculators:

| Calculator | What the checker does |
|---|---|
| EMI, SIP | recomputes the exact rational value and tests it against the interval |
| CAGR | re-proves the monotonicity bracket |
| XIRR, bond | re-proves the sign change at the interval ends |
| Tax | reports that the value is exact arithmetic; it does not re-derive it |

The tests also show that tampered certificates are rejected.

## What it does not certify

- **The financial model.** The certificate proves the number matches the stated formula and conventions:
  - EMI uses a nominal annual rate compounded monthly;
  - SIP uses start-of-month payments;
  - XIRR uses actual/365 days;
  - bond yield assumes pricing on a coupon date.

  Lenders round instalments, use other day counts, or charge fees. Those differences are real and are
  not rounding errors.
- **Tax scope.** Normal-rate income only. Special-rate capital gains (111A/112/112A), VDA income and AMT are
  out of scope. Rules are the FY 2025-26 rules, which FY 2026-27 continues; check the Finance Act before filing.
- **Rates extremely close to 0.** For a rate within about 10⁻²⁵ of 0 %, relative error stops being meaningful.
  The engine reports an absolute bound, or refuses if 1×10⁻⁸ cannot be shown.

## Speed (measured on the development container, warm)

| Calculation | Median | Max |
|---|---|---|
| EMI ₹50,00,000 @ 8.25 % × 120 | 1.2 ms | 2.6 ms |
| EMI ₹1 Cr @ 10.75 % × 360 | 2.0 ms | 3.2 ms |
| SIP ₹10,000 × 240 @ 12 % | 1.4 ms | 1.6 ms |
| CAGR | 1.0 ms | 1.4 ms |
| XIRR, 3 cash flows | 7.1 ms | 9.3 ms |
| XIRR, 61 monthly SIP flows | 100 ms | 105 ms |
| Bond YTM, 20 half-years | 20 ms | 33 ms |
| Income tax | 0.4 ms | 0.6 ms |

The first tax call per regime takes about 0.2–0.6 s while SymPy builds the statute, which is then cached.

## API

`POST /api/{emi|sip|cagr|xirr|bond|tax|verify}`; `GET /health`. Request schemas are in `app/schemas/requests.py`.
The Express app proxies them at `/api/precision/*` when `PRECISION_ENGINE_URL` is set (`server/precisionRoutes.ts`),
and `src/lib/precision-client.ts` is the browser client.

```json
POST /api/emi  {"principal": "5000000", "annual_rate_pct": "8.25", "months": 120}
→ output.value "61326.3125442320798315018378094", display "₹61,326.31",
  certification.certified_interval [..., ...], certified_relative_error "7.18e-31", verification.all_agree true
```
