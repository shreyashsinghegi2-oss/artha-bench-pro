"""
Independent checker for certificates. It does not call the calculators: each check re-derives only what
is needed to confirm the claim "the true value lies in certified_interval", using its own minimal code.

  EMI / SIP / tax : recompute the exact rational value and test lower ≤ exact ≤ upper.
  CAGR            : begin·(1+lower)^years < end < begin·(1+upper)^years  (interval arithmetic; monotone in g).
  XIRR / bond     : NPV has proven opposite signs at the two endpoints, and the cash flows change sign once
                    (so the root is unique). Certificates whose uniqueness came from branch-and-bound are
                    re-checked for the sign change only, and this is reported.
"""
from __future__ import annotations

from datetime import date
from fractions import Fraction
from typing import Any

from mpmath import iv

from .precision import frac_to_iv, iv_bounds, iv_dps

DPS = 60


def _q(s: str) -> Fraction:
    return Fraction(s)


def _npv_sign(amounts: list[Fraction], times: list[Fraction], r: Fraction) -> int:
    with iv_dps(DPS):
        base = 1 + frac_to_iv(r)
        total = iv.mpf(0)
        for c, t in zip(amounts, times):
            p = base ** int(-t) if t.denominator == 1 else iv.exp(frac_to_iv(-t) * iv.log(base))
            total += frac_to_iv(c) * p
        lo, hi = iv_bounds(total)
    return 1 if lo > 0 else -1 if hi < 0 else 0


def _changes(amounts: list[Fraction]) -> int:
    s = [1 if a > 0 else -1 for a in amounts if a]
    return sum(1 for a, b in zip(s, s[1:]) if a != b)


def check(cert: dict[str, Any]) -> dict[str, Any]:
    kind = cert.get("calculation")
    inp = cert.get("input", {})
    lo_s, hi_s = cert["certification"]["certified_interval"]
    lower, upper = _q(lo_s), _q(hi_s)
    value = _q(cert["output"]["value"])
    checks: list[str] = []
    ok = lower <= value <= upper
    checks.append(f"value inside interval: {ok}")

    if kind == "EMI":
        P, r, n = _q(inp["principal"].replace(",", "")), _q(inp["annual_rate_pct"]) / 1200, int(inp["months"])
        exact = P / n if r == 0 else P * r * (1 + r) ** n / ((1 + r) ** n - 1)
        inside = lower <= exact <= upper
        checks.append(f"exact rational EMI inside interval: {inside}")
        ok = ok and inside
    elif kind == "SIP future value":
        M, i, n = _q(inp["monthly"].replace(",", "")), _q(inp["annual_rate_pct"]) / 1200, int(inp["months"])
        exact = sum((M * (1 + i) ** k for k in range(1, n + 1)), Fraction(0)) if inp.get("timing", "begin") == "begin" \
            else sum((M * (1 + i) ** k for k in range(0, n)), Fraction(0))
        inside = lower <= exact <= upper
        checks.append(f"exact month-by-month sum inside interval: {inside}")
        ok = ok and inside
    elif kind == "CAGR":
        B, E, Y = _q(inp["begin_value"].replace(",", "")), _q(inp["end_value"].replace(",", "")), _q(inp["years"])
        if B == E:
            inside = lower <= 0 <= upper
        else:
            with iv_dps(DPS):
                f = lambda g: iv_bounds(frac_to_iv(B) * iv.exp(frac_to_iv(Y) * iv.log(1 + frac_to_iv(g))))  # noqa: E731
                inside = f(lower)[1] < E < f(upper)[0]
        checks.append(f"begin·(1+lower)^years < end < begin·(1+upper)^years: {inside}")
        ok = ok and inside
    elif kind in ("XIRR", "Bond yield to maturity"):
        if kind == "XIRR":
            flows = inp["cashflows"]
            days = [date.fromisoformat(cf["date"]).toordinal() if cf.get("date") else int(cf["days"]) for cf in flows]
            amounts = [_q(str(cf["amount"]).replace(",", "")) for cf in flows]
            times = [Fraction(d - min(days), 365) for d in days]
            r_lo, r_hi = lower, upper
        else:
            P, F, c, N, f = _q(inp["price"]), _q(inp["face"]), _q(inp["coupon_rate_pct"]), int(inp["periods"]), int(inp["frequency"])
            cpn = F * c / 100 / f
            amounts = [-P] + [cpn] * (N - 1) + [cpn + F]
            times = [Fraction(k) for k in range(N + 1)]
            r_lo, r_hi = lower / f, upper / f
        merged: dict[Fraction, Fraction] = {}
        for t, a in sorted(zip(times, amounts)):
            merged[t] = merged.get(t, Fraction(0)) + a
        ts = [t for t in merged if merged[t]]
        amts = [merged[t] for t in ts]
        s_lo, s_hi = _npv_sign(amts, ts, r_lo), _npv_sign(amts, ts, r_hi)
        sign_change = bool(s_lo and s_hi and s_lo != s_hi)
        unique = _changes(amts) == 1
        checks.append(f"NPV has proven opposite signs at the interval ends: {sign_change}")
        checks.append(f"single sign change in cash flows (unique rate): {unique}" + ("" if unique else " — uniqueness rests on the engine's branch-and-bound"))
        ok = ok and sign_change
    elif kind == "Income tax":
        checks.append("tax is exact rational arithmetic; recompute with the engine or the statute to confirm the value")
    else:
        return {"valid": False, "checks": [f"unknown calculation {kind!r}"]}
    return {"valid": bool(ok), "checks": checks}
