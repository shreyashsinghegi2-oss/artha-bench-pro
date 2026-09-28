"""
Certificate assembly and the acceptance rules every result must pass before it is returned.

A result is returned only if:
  1. the certified enclosure [lower, upper] contains the reported value,
  2. every independent method agrees with the value to within AGREEMENT (1e-10, relative for |value| > 1),
  3. the certified error bound is at most 1e-8 relative to the value (0.000001 %); for a value of exactly
     zero the bound must be at most 1e-8 absolute, because relative error is undefined at zero.
Otherwise a VerificationError / AccuracyError is raised and the API answers 422 with no number.
"""
from __future__ import annotations

from datetime import datetime, timezone
from fractions import Fraction
from typing import Any

import mpmath
import sympy

from .precision import (
    INTERVAL_DPS,
    TARGET_RELATIVE_ERROR,
    WORKING_DPS,
    AccuracyError,
    VerificationError,
    bound_str,
    dec_str,
    round_sig,
    sig_str,
)

ENGINE_VERSION = "precision-engine-1.0.0"
AGREEMENT = Fraction(1, 10**10)
INTERVAL_SIG = 34  # digits printed for interval endpoints (rounded outward, so they still enclose)


def to_frac(x: Any) -> Fraction:
    if isinstance(x, Fraction):
        return x
    if isinstance(x, int):
        return Fraction(x)
    if isinstance(x, mpmath.mpf):
        from .precision import mpf_to_frac

        return mpf_to_frac(x)
    raise TypeError(f"cannot convert {type(x).__name__} exactly")


def build(
    calculation: str,
    inputs: dict[str, Any],
    value: Fraction,
    lower: Fraction,
    upper: Fraction,
    display: str,
    methods: list[tuple[str, Any]],
    method_3: str,
    extra_output: dict[str, Any] | None = None,
    convergence: dict[str, Any] | None = None,
    notes: list[str] | None = None,
) -> dict[str, Any]:
    if not (lower <= value <= upper):
        raise VerificationError(f"{calculation}: value lies outside its certified interval")

    disagreements = []
    scale = max(Fraction(1), abs(value))
    for name, candidate in methods:
        d = abs(to_frac(candidate) - value)
        disagreements.append(d)
        if d > AGREEMENT * scale:
            raise VerificationError(f"{calculation}: {name} disagrees with the certified value by {bound_str(d)}")

    # The bound must describe what the caller receives: the printed value and the printed (outward-rounded)
    # interval, not the internal exact ones.
    lo_print = round_sig(lower, INTERVAL_SIG, "down") if lower else Fraction(0)
    hi_print = round_sig(upper, INTERVAL_SIG, "up") if upper else Fraction(0)
    value_str = _printed_inside(value, lo_print, hi_print)
    shown = Fraction(value_str)
    abs_bound = max(shown - lo_print, hi_print - shown)
    if shown != 0:
        rel_bound = abs_bound / abs(shown)
        if rel_bound > TARGET_RELATIVE_ERROR:
            raise AccuracyError(f"{calculation}: certified relative error {bound_str(rel_bound)} exceeds 1e-8")
    else:
        rel_bound = None
        if abs_bound > TARGET_RELATIVE_ERROR:
            raise AccuracyError(f"{calculation}: value is 0 and the absolute bound {bound_str(abs_bound)} exceeds 1e-8")
    verification = {f"method_{i + 1}": name for i, (name, _) in enumerate(methods)}
    verification[f"method_{len(methods) + 1}"] = method_3
    verification["max_disagreement"] = bound_str(max(disagreements) if disagreements else Fraction(0))
    verification["all_agree"] = True

    return {
        "calculation": calculation,
        "input": inputs,
        "output": {"value": value_str, "display": display, **(extra_output or {})},
        "certification": {
            "guaranteed_relative_error": "≤ 0.000001%",
            "certified_relative_error": bound_str(rel_bound) if rel_bound is not None else None,
            "certified_absolute_error": bound_str(abs_bound),
            "certified_interval": [dec_str(lo_print), dec_str(hi_print)],
            "interval_width": bound_str(hi_print - lo_print),
            "verification": verification,
            "working_precision": f"{WORKING_DPS} decimal digits (enclosures at {INTERVAL_DPS})",
            "convergence": convergence or {"iterations": 0, "residual": "0"},
            "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "engine_version": ENGINE_VERSION,
            "mpmath_version": mpmath.__version__,
            "sympy_version": sympy.__version__,
            "scope": "The bound applies to output.value. output.display is rounded for reading and is not certified.",
            "notes": notes or [],
        },
    }


def _printed_inside(value: Fraction, lo: Fraction, hi: Fraction) -> str:
    """30 significant digits, or more if needed so the printed value still lies inside the printed interval."""
    if value == 0:
        return "0"
    for sig in range(30, 81, 5):
        s = sig_str(value, sig)
        if lo <= Fraction(s) <= hi:
            return s
    raise VerificationError("value cannot be printed inside its certified interval")


def exact_interval(exact: Fraction) -> tuple[Fraction, Fraction, Fraction]:
    """For an exactly known rational: the 30-digit value and a tight enclosure [down, up] of the exact value."""
    value = round_sig(exact, 30) if exact else Fraction(0)
    lower = min(value, round_sig(exact, INTERVAL_SIG + 6, "down") if exact else Fraction(0))
    upper = max(value, round_sig(exact, INTERVAL_SIG + 6, "up") if exact else Fraction(0))
    return value, lower, upper
