"""
EMI and SIP future value. With a decimal rate and a whole number of months both are rational numbers,
so the engine knows the exact answer (fractions.Fraction) and the error bound is computed, not estimated.

EMI  = P · r · (1+r)^n / ((1+r)^n − 1),  r = annual % / 1200     (r = 0 → P / n)
SIP  = M · ((1+i)^n − 1) / i · (1+i)   for payments at the start of each month (the Indian convention),
       without the final (1+i) for payments at the end of each month.  i = annual % / 1200.

Methods:
  1. closed form at 30 digits (mpmath)
  2. independent algorithm at 60 digits: EMI → the amortisation schedule must close to ~0; SIP → month-by-month sum
  3. exact rational value, and an outward-rounded interval evaluation that must contain it
"""
from __future__ import annotations

from fractions import Fraction

from mpmath import iv, mp

from ..core import certificate
from ..core.precision import INTERVAL_DPS, iv_dps, InputError, VerificationError, display_inr, frac_to_iv, frac_to_mpf, iv_bounds, parse_decimal

MAX_MONTHS = 1200


def _months(n: object) -> int:
    if isinstance(n, bool) or not isinstance(n, int):
        raise InputError("months must be a whole number")
    if not 1 <= n <= MAX_MONTHS:
        raise InputError(f"months must be between 1 and {MAX_MONTHS}")
    return n


def _rate(rate: object) -> Fraction:
    q = parse_decimal(rate, "annual_rate_pct")
    if not 0 <= q <= 100:
        raise InputError("annual_rate_pct must be between 0 and 100")
    return q


def emi_exact(P: Fraction, rate_pct: Fraction, n: int) -> Fraction:
    r = rate_pct / 1200
    if r == 0:
        return P / n
    f = (1 + r) ** n
    return P * r * f / (f - 1)


def emi(principal: object, annual_rate_pct: object, months: object) -> dict:
    P = parse_decimal(principal, "principal")
    if P <= 0:
        raise InputError("principal must be greater than 0")
    rate_pct, n = _rate(annual_rate_pct), _months(months)
    exact = emi_exact(P, rate_pct, n)

    with mp.workdps(30):
        Pm, rm = frac_to_mpf(P), frac_to_mpf(rate_pct) / 1200
        if rm == 0:
            primary = Pm / n
        else:
            fac = (1 + rm) ** n
            primary = Pm * rm * fac / (fac - 1)

    with mp.workdps(60):
        bal, rr, pay = frac_to_mpf(P), frac_to_mpf(rate_pct) / 1200, +primary
        for _ in range(n):
            bal = bal * (1 + rr) - pay
        schedule_residual = abs(bal)
    # A 30-digit EMI leaves a closing balance of about n · 1e-30 · P; anything near a paisa means a wrong formula.
    if schedule_residual > frac_to_mpf(P) * mp.mpf("1e-20"):
        raise VerificationError("EMI amortisation schedule does not close")

    with iv_dps(INTERVAL_DPS):
        Pi, ri = frac_to_iv(P), frac_to_iv(rate_pct) / 1200
        if rate_pct == 0:
            enc = Pi / n
        else:
            fi = (1 + ri) ** n
            enc = Pi * ri * fi / (fi - 1)
        lo, hi = iv_bounds(enc)
    if not lo <= exact <= hi:
        raise VerificationError("EMI interval enclosure does not contain the exact value")

    value, lower, upper = certificate.exact_interval(exact)
    total = exact * n
    return certificate.build(
        "EMI",
        {"principal": str(principal), "annual_rate_pct": str(annual_rate_pct), "months": n},
        value, lower, upper, display_inr(exact),
        methods=[("closed_form @ 30 digits", primary), ("exact rational arithmetic", exact)],
        method_3="interval arithmetic @ 50 digits (outward rounding) contains the exact value; amortisation schedule closes",
        extra_output={
            "total_payment": certificate.sig_str(total),
            "total_interest": certificate.sig_str(total - P) if total != P else "0",
            "schedule_closing_balance": mp.nstr(schedule_residual, 3),
        },
        notes=[
            "Rate is nominal annual, compounded monthly (annual % / 12 per month).",
            "Lenders usually round the instalment to the rupee or paisa; the certified value is the unrounded formula result.",
        ],
    )


def sip_exact(M: Fraction, rate_pct: Fraction, n: int, timing: str) -> Fraction:
    i = rate_pct / 1200
    if i == 0:
        return M * n
    fv_end = M * ((1 + i) ** n - 1) / i
    return fv_end * (1 + i) if timing == "begin" else fv_end


def sip(monthly: object, annual_rate_pct: object, months: object, timing: str = "begin") -> dict:
    M = parse_decimal(monthly, "monthly")
    if M <= 0:
        raise InputError("monthly must be greater than 0")
    if timing not in ("begin", "end"):
        raise InputError("timing must be 'begin' or 'end'")
    rate_pct, n = _rate(annual_rate_pct), _months(months)
    exact = sip_exact(M, rate_pct, n, timing)

    with mp.workdps(30):
        Mm, im = frac_to_mpf(M), frac_to_mpf(rate_pct) / 1200
        if im == 0:
            primary = Mm * n
        else:
            primary = Mm * ((1 + im) ** n - 1) / im * ((1 + im) if timing == "begin" else 1)

    with mp.workdps(60):
        Mm, im = frac_to_mpf(M), frac_to_mpf(rate_pct) / 1200
        acc = mp.mpf(0)
        for _ in range(n):  # month by month: deposit, then grow (begin) or grow, then deposit (end)
            acc = (acc + Mm) * (1 + im) if timing == "begin" else acc * (1 + im) + Mm
        stepwise = acc

    with iv_dps(INTERVAL_DPS):
        Mi, ii = frac_to_iv(M), frac_to_iv(rate_pct) / 1200
        if rate_pct == 0:
            enc = Mi * n
        else:
            enc = Mi * ((1 + ii) ** n - 1) / ii * ((1 + ii) if timing == "begin" else 1)
        lo, hi = iv_bounds(enc)
    if not lo <= exact <= hi:
        raise VerificationError("SIP interval enclosure does not contain the exact value")

    value, lower, upper = certificate.exact_interval(exact)
    invested = M * n
    return certificate.build(
        "SIP future value",
        {"monthly": str(monthly), "annual_rate_pct": str(annual_rate_pct), "months": n, "timing": timing},
        value, lower, upper, display_inr(exact),
        methods=[("closed_form @ 30 digits", primary), ("month-by-month accumulation @ 60 digits", stepwise), ("exact rational arithmetic", exact)],
        method_3="interval arithmetic @ 50 digits (outward rounding) contains the exact value",
        extra_output={"invested": certificate.sig_str(invested), "gain": certificate.sig_str(exact - invested) if exact != invested else "0"},
        notes=[
            "Rate is nominal annual, compounded monthly. Mutual fund returns are not fixed; this is the arithmetic for an assumed constant rate.",
        ],
    )
