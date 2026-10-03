"""
CAGR, XIRR and bond yield to maturity. These are irrational in general, so the engine proves an
enclosure [lower, upper] that must contain the true value and reports its midpoint.

CAGR = (end / begin)^(1 / years) − 1.
  Proof: g ↦ begin · (1 + g)^years is strictly increasing for years > 0, so if interval arithmetic shows
  begin·(1+lower)^years < end < begin·(1+upper)^years, the true CAGR lies in (lower, upper).
XIRR: annual rate r with Σ amount_k · (1 + r)^(−days_k / 365) = 0 (Excel XIRR convention, actual/365).
Bond YTM: per-period rate r with −price + Σ coupon · (1+r)^(−k) + face · (1+r)^(−N) = 0; yield = r × frequency.
  Both proofs are in core/roots.py (proven sign change + uniqueness).
"""
from __future__ import annotations

from datetime import date
from fractions import Fraction

from mpmath import iv, mp

from ..core import certificate
from ..core.precision import (
    INTERVAL_DPS,
    InputError,
    VerificationError,
    display_pct,
    frac_to_iv,
    frac_to_mpf,
    iv_bounds,
    iv_dps,
    mpf_to_frac,
    parse_decimal,
    round_sig,
)
from ..core.roots import certify_root


def _positive(value: object, name: str) -> Fraction:
    q = parse_decimal(value, name)
    if q <= 0:
        raise InputError(f"{name} must be greater than 0")
    return q


def _power_iv(q: Fraction, years: Fraction):
    """Interval enclosure of q^years for a rational q > 0."""
    base = frac_to_iv(q)
    if years.denominator == 1:
        return base ** int(years)
    return iv.exp(frac_to_iv(years) * iv.log(base))


def _prove_growth_bracket(B: Fraction, E: Fraction, Y: Fraction, q_mid: Fraction) -> tuple[Fraction, Fraction]:
    """
    Proven bracket [qL, qH] for the growth factor q = (E/B)^(1/Y): interval arithmetic shows
    B·qL^Y < E < B·qH^Y, and q ↦ B·q^Y is strictly increasing for q > 0, so the true q lies in (qL, qH).
    Working on q (not g = q − 1) avoids cancellation when q is tiny (near-total loss).
    δ is relative to the smaller of q and |q − 1|, so both q and the CAGR g keep a small relative bound.
    """
    scale = min(q_mid, abs(q_mid - 1))
    for k in range(29, 11, -1):
        delta = scale / 10**k
        qL, qH = q_mid - delta, q_mid + delta
        with iv_dps(INTERVAL_DPS):
            at_lo = iv_bounds(frac_to_iv(B) * _power_iv(qL, Y))
            at_hi = iv_bounds(frac_to_iv(B) * _power_iv(qH, Y))
        if at_lo[1] < E < at_hi[0]:
            return qL, qH
    raise VerificationError("CAGR enclosure could not be proven by monotonicity")


def cagr(begin_value: object, end_value: object, years: object) -> dict:
    B, E, Y = _positive(begin_value, "begin_value"), _positive(end_value, "end_value"), _positive(years, "years")
    if Y > 1000:
        raise InputError("years must be at most 1000")
    ratio = E / B
    inputs = {"begin_value": str(begin_value), "end_value": str(end_value), "years": str(years)}

    if ratio == 1:
        return certificate.build("CAGR", inputs, Fraction(0), Fraction(0), Fraction(0), "0.0000%",
                                 methods=[("exact (end equals begin)", Fraction(0))], method_3="exact", extra_output={"percentage": "0"})

    with iv_dps(INTERVAL_DPS):
        q_lo, q_hi = iv_bounds(iv.exp(iv.log(frac_to_iv(ratio)) / frac_to_iv(Y)))  # growth factor, always > 0

    with mp.workdps(30):
        primary = frac_to_mpf(ratio) ** (1 / frac_to_mpf(Y)) - 1

    with mp.workdps(60):
        # Independent route: an exact rational power of the ratio, then an integer root (Newton inside mpmath.root),
        # instead of exp/log. Used when the years denominator is small enough for the power to stay manageable.
        if Y.denominator <= 1000 and Y.numerator <= 10**6:
            cross = mp.root(frac_to_mpf(ratio ** Y.denominator), Y.numerator) - 1
            cross_name = f"rational power + integer root ({Y.numerator}th root) @ 60 digits"
        else:
            cross = mp.exp(mp.log(frac_to_mpf(ratio)) / frac_to_mpf(Y)) - 1
            cross_name = "exp/log @ 60 digits"
        reconstruction = abs((1 + primary) ** frac_to_mpf(Y) * frac_to_mpf(B) - frac_to_mpf(E)) / frac_to_mpf(E)

    q_mid = (q_lo + q_hi) / 2
    qL, qH = _prove_growth_bracket(B, E, Y, q_mid)
    lower, upper = qL - 1, qH - 1  # exact rational shift: the CAGR interval inherits the proof
    value = round_sig(q_mid - 1, 30)
    if not lower <= value <= upper:  # e.g. g within 1e-30 of -100%: 30 digits cannot separate it from -1
        value = q_mid - 1

    return certificate.build(
        "CAGR", inputs, value, lower, upper, display_pct(value),
        methods=[("power formula @ 30 digits", primary), (cross_name, cross)],
        method_3="interval arithmetic @ 50 digits on the growth factor; enclosure proven by monotonicity of begin·(1+g)^years",
        extra_output={"percentage": certificate.sig_str(value * 100), "reconstruction_relative_error": mp.nstr(reconstruction, 3)},
    )


def _day_number(item: dict, index: int) -> int:
    if "date" in item and item["date"] is not None:
        try:
            return date.fromisoformat(str(item["date"])).toordinal()
        except ValueError as exc:
            raise InputError(f"cashflows[{index}].date must be YYYY-MM-DD") from exc
    days = item.get("days")
    if isinstance(days, bool) or not isinstance(days, int) or days < 0:
        raise InputError(f"cashflows[{index}] needs a date (YYYY-MM-DD) or a whole number of days >= 0")
    return days


def xirr(cashflows: list[dict]) -> dict:
    if not isinstance(cashflows, list) or not 2 <= len(cashflows) <= 1000:
        raise InputError("cashflows must be a list of 2 to 1000 items")
    days = [_day_number(cf, i) for i, cf in enumerate(cashflows)]
    amounts = [parse_decimal(cf.get("amount"), f"cashflows[{i}].amount") for i, cf in enumerate(cashflows)]
    d0 = min(days)
    times = [Fraction(d - d0, 365) for d in days]
    cert = certify_root(amounts, times)

    return certificate.build(
        "XIRR",
        {"cashflows": [{k: (str(v) if k == "amount" else v) for k, v in cf.items()} for cf in cashflows]},
        cert.value, cert.lower, cert.upper, display_pct(cert.value),
        methods=[("safeguarded Newton @ 30 digits", cert.newton), ("bisection @ 40 digits", cert.bisection)],
        method_3=f"interval arithmetic @ 50 digits: proven sign change across the interval; uniqueness by {cert.uniqueness}",
        extra_output={"percentage": certificate.sig_str(cert.value * 100) if cert.value else "0"},
        convergence={"iterations": cert.newton_iterations, "residual": mp.nstr(cert.residual, 3), "sign_changes": cert.sign_changes},
        notes=["Day count: actual/365 from the earliest cash flow (the Excel XIRR convention).",
               "The rate is an annual effective rate. Near 0% the relative error is not meaningful; use the absolute bound."],
    )


def bond_ytm(price: object, coupon_rate_pct: object, periods: object, frequency: object = 2, face: object = "100") -> dict:
    P, F = _positive(price, "price"), _positive(face, "face")
    c = parse_decimal(coupon_rate_pct, "coupon_rate_pct")
    if not 0 <= c <= 100:
        raise InputError("coupon_rate_pct must be between 0 and 100")
    if isinstance(frequency, bool) or frequency not in (1, 2, 4, 12):
        raise InputError("frequency must be 1, 2, 4 or 12 coupons a year")
    if isinstance(periods, bool) or not isinstance(periods, int) or not 1 <= periods <= 1200:
        raise InputError("periods must be a whole number of coupon periods between 1 and 1200")

    coupon = F * c / 100 / frequency
    amounts = [-P] + [coupon] * (periods - 1) + [coupon + F]
    times = [Fraction(k) for k in range(periods + 1)]
    cert = certify_root(amounts, times)
    f = frequency
    value, lower, upper = cert.value * f, cert.lower * f, cert.upper * f
    # Effective annual yield: (1 + r)^f − 1 is increasing in r, and f is an integer, so its bounds are exact rationals.
    eff_lo, eff_hi = (1 + cert.lower) ** f - 1, (1 + cert.upper) ** f - 1

    return certificate.build(
        "Bond yield to maturity",
        {"price": str(price), "coupon_rate_pct": str(coupon_rate_pct), "periods": periods, "frequency": f, "face": str(face)},
        value, lower, upper, display_pct(value),
        # Scale exactly: mpf * int would round to mpmath's default 15 digits outside a workdps block.
        methods=[("safeguarded Newton @ 30 digits", mpf_to_frac(cert.newton) * f), ("bisection @ 40 digits", mpf_to_frac(cert.bisection) * f)],
        method_3=f"interval arithmetic @ 50 digits: proven sign change; uniqueness by {cert.uniqueness}",
        extra_output={
            "percentage": certificate.sig_str(value * 100),
            "effective_annual_interval": [certificate.sig_str(round_sig(eff_lo, 30, "down")), certificate.sig_str(round_sig(eff_hi, 30, "up"))],
        },
        convergence={"iterations": cert.newton_iterations, "residual": mp.nstr(cert.residual, 3), "sign_changes": cert.sign_changes},
        notes=["Priced on a coupon date (no accrued interest); yield is nominal annual = per-period rate × frequency (bond-equivalent)."],
    )
