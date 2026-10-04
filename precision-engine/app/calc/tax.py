"""
Indian income tax for an individual, FY 2025-26 and FY 2026-27 (the FY 2026-27 rules repeat FY 2025-26).

Everything is exact rational arithmetic: slab rates, the 87A rebate, surcharge and 4% cess are all
decimal percentages of rupee amounts, so the exact liability is a terminating decimal and the error
bound is 0. The cross-check is an independent symbolic formulation of the same statute (SymPy
Piecewise with exact Rationals) that must agree exactly.

Order of computation: total income (rounded to ₹10 under s.288A) → slab tax → s.87A rebate (new regime:
with marginal relief above ₹12,00,000) → surcharge with marginal relief at each threshold → 4% cess.
The amount payable is also shown rounded to ₹10 under s.288B.

Scope (stated in every certificate): normal-rate income only. Special-rate income (capital gains under
111A/112/112A, VDA, lottery) and AMT are not covered.
"""
from __future__ import annotations

from fractions import Fraction
from functools import lru_cache

import sympy as sp

from ..core import certificate
from ..core.precision import InputError, VerificationError, dec_str, display_inr, parse_decimal

L = 100_000  # one lakh

SLABS_NEW = [(4 * L, 0), (8 * L, 5), (12 * L, 10), (16 * L, 15), (20 * L, 20), (24 * L, 25), (None, 30)]
SLABS_OLD = {
    "below-60": [(Fraction(5, 2) * L, 0), (5 * L, 5), (10 * L, 20), (None, 30)],
    "60-79": [(3 * L, 0), (5 * L, 5), (10 * L, 20), (None, 30)],
    "80-plus": [(5 * L, 0), (10 * L, 20), (None, 30)],
}
STANDARD_DEDUCTION = {"new": 75_000, "old": 50_000}
REBATE = {"new": (12 * L, 60_000), "old": (5 * L, 12_500)}  # (income limit, maximum rebate)
SURCHARGE = [(50 * L, 10), (100 * L, 15), (200 * L, 25), (500 * L, 37)]  # income above threshold → rate %
NEW_REGIME_SURCHARGE_CAP = 25
CESS_PCT = 4
YEARS = ("FY2025-26", "FY2026-27")

# section → (cap in ₹ or None, allowed in new regime)
DEDUCTIONS = {
    "80C": (150_000, False),
    "80CCD(1B)": (50_000, False),
    "80CCD(2)": (None, True),  # employer NPS contribution: allowed in both regimes (limit depends on salary; not enforced here)
    "80D": (100_000, False),
    "24(b)": (200_000, False),  # self-occupied home-loan interest
    "80E": (None, False),
    "80G": (None, False),
    "80TTA": (10_000, False),
    "80TTB": (50_000, False),
}


def round_288(amount: Fraction) -> Fraction:
    """Sections 288A/288B: drop paise, then round to the nearest ₹10 (a last digit of 5 rounds up)."""
    rupees = amount.numerator // amount.denominator if amount >= 0 else -((-amount).numerator // (-amount).denominator)
    tens, last = divmod(rupees, 10)
    return Fraction((tens + (1 if last >= 5 else 0)) * 10)


def slab_tax(income: Fraction, slabs) -> Fraction:
    tax, lower = Fraction(0), Fraction(0)
    for upper, pct in slabs:
        top = income if upper is None else min(income, Fraction(upper))
        if top > lower:
            tax += (top - lower) * pct / 100
        if upper is None or income <= upper:
            break
        lower = Fraction(upper)
    return tax


def _surcharge_rate(income: Fraction, regime: str) -> int:
    rate = 0
    for threshold, pct in SURCHARGE:
        if income > threshold:
            rate = pct
    return min(rate, NEW_REGIME_SURCHARGE_CAP) if regime == "new" else rate


def tax_before_cess(income: Fraction, regime: str, slabs, resident: bool) -> dict[str, Fraction]:
    base = slab_tax(income, slabs)
    rebate = Fraction(0)
    limit, maximum = REBATE[regime]
    if resident and income <= limit:
        rebate = min(base, Fraction(maximum))
    elif resident and regime == "new" and income > limit:
        rebate = max(Fraction(0), base - (income - limit))  # marginal relief: tax may not exceed income above ₹12L
    after_rebate = base - rebate
    rate = _surcharge_rate(income, regime)
    surcharge = after_rebate * rate / 100
    relief = Fraction(0)
    if rate:
        threshold = max(t for t, _ in SURCHARGE if income > t)
        at_threshold = slab_tax(Fraction(threshold), slabs)
        at_threshold_total = at_threshold * (1 + Fraction(_surcharge_rate(Fraction(threshold), regime), 100))
        cap = at_threshold_total + (income - threshold)
        if after_rebate + surcharge > cap:
            relief = after_rebate + surcharge - cap
    return {"slab_tax": base, "rebate": rebate, "surcharge": surcharge - relief, "surcharge_marginal_relief": relief, "surcharge_rate_pct": Fraction(rate)}


@lru_cache(maxsize=8)
def _symbolic(regime: str, age: str, resident: bool):
    """Independent SymPy formulation of the same statute, as a function of total income x."""
    x = sp.Symbol("x", nonnegative=True)
    slabs = SLABS_NEW if regime == "new" else SLABS_OLD[age]

    def slab_expr(v):
        terms, lower = [], sp.Integer(0)
        for upper, pct in slabs:
            hi = v if upper is None else sp.Min(v, sp.Rational(upper))
            terms.append(sp.Piecewise((sp.Rational(pct, 100) * (hi - lower), v > lower), (0, True)))
            if upper is not None:
                lower = sp.Rational(upper)
        return sp.Add(*terms)

    base = slab_expr(x)
    limit, maximum = REBATE[regime]
    if not resident:
        after = base
    elif regime == "new":
        after = sp.Piecewise((base - sp.Min(base, maximum), x <= limit), (base - sp.Max(0, base - (x - limit)), True))
    else:
        after = sp.Piecewise((base - sp.Min(base, maximum), x <= limit), (base, True))

    rates = [(t, min(p, NEW_REGIME_SURCHARGE_CAP) if regime == "new" else p) for t, p in SURCHARGE]
    pieces = []
    for i in range(len(rates) - 1, -1, -1):
        t, p = rates[i]
        below = rates[i - 1][1] if i > 0 else 0
        cap = slab_expr(sp.Rational(t)) * (1 + sp.Rational(below, 100)) + (x - t)
        pieces.append((sp.Min(after * (1 + sp.Rational(p, 100)), cap), x > t))
    pieces.append((after, True))
    with_surcharge = sp.Piecewise(*pieces)
    total = with_surcharge * (1 + sp.Rational(CESS_PCT, 100))
    return x, total


def _evaluate(node, x, value: Fraction) -> Fraction:
    """
    Exact evaluation of the SymPy statute at x = value by walking the expression tree with Fractions.
    (Same result as expr.subs(x, value) with Rationals, about 100x faster; any other node type is refused.)
    """
    if node == x:
        return value
    if node.is_Rational:
        return Fraction(int(node.p), int(node.q))
    args = node.args
    if isinstance(node, sp.Add):
        return sum((_evaluate(a, x, value) for a in args), Fraction(0))
    if isinstance(node, sp.Mul):
        out = Fraction(1)
        for a in args:
            out *= _evaluate(a, x, value)
        return out
    if isinstance(node, sp.Min):
        return min(_evaluate(a, x, value) for a in args)
    if isinstance(node, sp.Max):
        return max(_evaluate(a, x, value) for a in args)
    if isinstance(node, sp.Piecewise):
        for expr, cond in args:
            if _truth(cond, x, value):
                return _evaluate(expr, x, value)
        raise VerificationError("tax: no branch of the symbolic statute applies")
    raise VerificationError(f"tax: unsupported symbolic node {type(node).__name__}")


def _truth(cond, x, value: Fraction) -> bool:
    if cond is sp.true or cond == True:  # noqa: E712 (SymPy's true)
        return True
    if cond is sp.false or cond == False:  # noqa: E712
        return False
    lhs, rhs = _evaluate(cond.lhs, x, value), _evaluate(cond.rhs, x, value)
    if isinstance(cond, sp.StrictGreaterThan):
        return lhs > rhs
    if isinstance(cond, sp.GreaterThan):
        return lhs >= rhs
    if isinstance(cond, sp.StrictLessThan):
        return lhs < rhs
    if isinstance(cond, sp.LessThan):
        return lhs <= rhs
    raise VerificationError(f"tax: unsupported condition {cond}")


def income_tax(
    gross_income: object,
    regime: str = "new",
    financial_year: str = "FY2026-27",
    age_category: str = "below-60",
    salaried: bool = True,
    resident: bool = True,
    deductions: dict | None = None,
) -> dict:
    if financial_year not in YEARS:
        raise InputError(f"financial_year must be one of {', '.join(YEARS)}")
    if regime not in ("new", "old"):
        raise InputError("regime must be 'new' or 'old'")
    if age_category not in SLABS_OLD:
        raise InputError("age_category must be below-60, 60-79 or 80-plus")
    gross = parse_decimal(gross_income, "gross_income")
    if gross < 0:
        raise InputError("gross_income cannot be negative")

    warnings: list[str] = []
    allowed: dict[str, Fraction] = {}
    for section, raw in (deductions or {}).items():
        if section not in DEDUCTIONS:
            raise InputError(f"unknown deduction section {section!r}; supported: {', '.join(DEDUCTIONS)}")
        amount = parse_decimal(raw, f"deductions[{section}]")
        if amount < 0:
            raise InputError(f"deductions[{section}] cannot be negative")
        cap, in_new = DEDUCTIONS[section]
        if regime == "new" and not in_new:
            warnings.append(f"{section} is not allowed under the new regime and was ignored.")
            continue
        if cap is not None and amount > cap:
            warnings.append(f"{section} capped at ₹{cap:,}.")
            amount = Fraction(cap)
        allowed[section] = amount

    std = min(gross, Fraction(STANDARD_DEDUCTION[regime])) if salaried else Fraction(0)
    taxable = max(Fraction(0), gross - std - sum(allowed.values(), Fraction(0)))
    total_income = round_288(taxable)
    slabs = SLABS_NEW if regime == "new" else SLABS_OLD[age_category]

    parts = tax_before_cess(total_income, regime, slabs, resident)
    before_cess = parts["slab_tax"] - parts["rebate"] + parts["surcharge"]
    cess = before_cess * CESS_PCT / 100
    liability = before_cess + cess

    x, expr = _symbolic(regime, age_category, resident)
    symbolic_q = _evaluate(expr, x, total_income)
    if symbolic_q != liability:
        raise VerificationError(f"tax: symbolic cross-check gives {dec_str(symbolic_q)}, primary gives {dec_str(liability)}")

    breakdown = []
    lower = Fraction(0)
    for upper, pct in slabs:
        top = total_income if upper is None else min(total_income, Fraction(upper))
        if top > lower:
            breakdown.append({"from": dec_str(lower), "to": dec_str(top), "rate_pct": pct, "tax": dec_str((top - lower) * pct / 100)})
        if upper is None or total_income <= upper:
            break
        lower = Fraction(upper)

    return certificate.build(
        "Income tax",
        {"gross_income": str(gross_income), "regime": regime, "financial_year": financial_year, "age_category": age_category,
         "salaried": salaried, "resident": resident, "deductions": {k: str(v) for k, v in (deductions or {}).items()}},
        liability, liability, liability, display_inr(liability),
        methods=[("exact rational slab computation", liability), ("SymPy piecewise statute (exact Rationals)", symbolic_q)],
        method_3="exact arithmetic: the liability is a terminating decimal, so the error bound is 0",
        extra_output={
            "standard_deduction": dec_str(std),
            "deductions_allowed": {k: dec_str(v) for k, v in allowed.items()},
            "total_income_288A": dec_str(total_income),
            "slab_tax": dec_str(parts["slab_tax"]),
            "rebate_87A": dec_str(parts["rebate"]),
            "surcharge": dec_str(parts["surcharge"]),
            "surcharge_marginal_relief": dec_str(parts["surcharge_marginal_relief"]),
            "cess": dec_str(cess),
            "payable_288B": dec_str(round_288(liability)),
            "effective_rate_pct": certificate.sig_str(liability / gross * 100) if gross and liability else "0",
            "slab_breakdown": breakdown,
            "warnings": warnings,
        },
        notes=[
            "Normal-rate income only: special-rate capital gains (111A/112/112A), VDA income and AMT are not included.",
            "Total income is rounded to ₹10 (s.288A) before tax; 'value' is the liability before the s.288B rounding shown in payable_288B.",
            "Rules: FY 2025-26 slabs, which FY 2026-27 continues. Check the current Finance Act before filing.",
        ],
    )
