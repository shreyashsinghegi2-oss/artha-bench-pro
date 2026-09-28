"""
Reference implementations used ONLY by the tests. They deliberately avoid mpmath and the engine's modules:
exact rationals (fractions) and Python's decimal module at 80 digits, written from the definitions.
"""
from __future__ import annotations

from decimal import Decimal, localcontext
from fractions import Fraction

D80 = 80


def emi_by_definition(P: Fraction, rate_pct: Fraction, n: int) -> Fraction:
    """The payment that makes the loan balance exactly zero after n months (solved as a linear equation)."""
    r = rate_pct / 1200
    # balance_n = P(1+r)^n − E·Σ_{k<n}(1+r)^k = 0  →  E = P(1+r)^n / Σ(1+r)^k
    growth = Fraction(1)
    total = Fraction(0)
    for _ in range(n):
        total += growth
        growth *= 1 + r
    return P * growth / total


def sip_by_definition(M: Fraction, rate_pct: Fraction, n: int, timing: str) -> Fraction:
    i = rate_pct / 1200
    acc = Fraction(0)
    for _ in range(n):
        acc = (acc + M) * (1 + i) if timing == "begin" else acc * (1 + i) + M
    return acc


def cagr_decimal(B: Fraction, E: Fraction, Y: Fraction) -> Decimal:
    with localcontext() as ctx:
        ctx.prec = D80
        ratio = Decimal(E.numerator) / Decimal(E.denominator) / (Decimal(B.numerator) / Decimal(B.denominator))
        years = Decimal(Y.numerator) / Decimal(Y.denominator)
        return (ratio.ln() / years).exp() - 1


def npv_decimal(amounts: list[Fraction], times: list[Fraction], r: Fraction) -> Decimal:
    with localcontext() as ctx:
        ctx.prec = D80
        base = 1 + Decimal(r.numerator) / Decimal(r.denominator)
        total = Decimal(0)
        for c, t in zip(amounts, times):
            texp = Decimal(t.numerator) / Decimal(t.denominator)
            total += (Decimal(c.numerator) / Decimal(c.denominator)) * (base ** (-texp) if t.denominator != 1 else base ** (-int(t)))
        return total


def to_fraction(d: Decimal) -> Fraction:
    return Fraction(d)


# --- income tax from the statute table (separate copy from the engine's) ---------------------------------
NEW = [(0, 400000, 0), (400000, 800000, 5), (800000, 1200000, 10), (1200000, 1600000, 15),
       (1600000, 2000000, 20), (2000000, 2400000, 25), (2400000, None, 30)]
OLD = {"below-60": [(0, 250000, 0), (250000, 500000, 5), (500000, 1000000, 20), (1000000, None, 30)],
       "60-79": [(0, 300000, 0), (300000, 500000, 5), (500000, 1000000, 20), (1000000, None, 30)],
       "80-plus": [(0, 500000, 0), (500000, 1000000, 20), (1000000, None, 30)]}


def slab(x: Fraction, table) -> Fraction:
    return sum((Fraction(p, 100) * (min(x, hi) - lo if hi is not None else x - lo) for lo, hi, p in table if x > lo), Fraction(0))


def sur_rate(x: Fraction, regime: str) -> Fraction:
    r = 37 if x > 50000000 else 25 if x > 20000000 else 15 if x > 10000000 else 10 if x > 5000000 else 0
    return Fraction(min(r, 25) if regime == "new" else r, 100)


def tax_reference(gross: Fraction, regime: str = "new", age: str = "below-60", salaried: bool = True, resident: bool = True,
                  deductions: Fraction = Fraction(0)) -> Fraction:
    table = NEW if regime == "new" else OLD[age]
    std = min(gross, Fraction(75000 if regime == "new" else 50000)) if salaried else Fraction(0)
    taxable = max(Fraction(0), gross - std - deductions)
    whole = taxable.numerator // taxable.denominator
    x = Fraction((whole // 10 + (1 if whole % 10 >= 5 else 0)) * 10)  # s.288A
    t = slab(x, table)
    if resident:
        if regime == "new":
            t = Fraction(0) if x <= 1200000 else min(t, x - 1200000)
        elif x <= 500000:
            t = max(Fraction(0), t - 12500)
    rate = sur_rate(x, regime)
    total = t * (1 + rate)
    if rate:
        threshold = max(th for th in (5000000, 10000000, 20000000, 50000000) if x > th)
        cap = slab(Fraction(threshold), table) * (1 + sur_rate(Fraction(threshold), regime)) + (x - threshold)
        total = min(total, cap)
    return total * Fraction(104, 100)
