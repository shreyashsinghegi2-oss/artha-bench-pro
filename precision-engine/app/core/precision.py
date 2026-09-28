"""
Exact input handling and decimal output for the precision engine.

Rules enforced here:
- Inputs are decimal strings (or ints). A Python float is rejected, because by the time a value is a
  float it has already been rounded to binary and the original decimal is lost.
- Every input becomes an exact rational (fractions.Fraction). Arithmetic that can be done exactly
  (EMI, SIP, tax) is done exactly; everything else is bounded with outward-rounded interval arithmetic.
- Outputs are decimal strings produced by directed rounding of exact rationals, so the printed
  interval endpoints still enclose the true value.
"""
from __future__ import annotations

import re
from contextlib import contextmanager
from fractions import Fraction

from mpmath import iv, mp, mpf

WORKING_DPS = 30  # primary computations
INTERVAL_DPS = 50  # enclosures; wider than the output so the bound is not limited by printing
OUTPUT_SIG = 30  # significant digits in "value"
TARGET_RELATIVE_ERROR = Fraction(1, 10**8)  # 0.000001 %

_DECIMAL = re.compile(r"^[+-]?(\d{1,18})(\.\d{1,18})?$")


@contextmanager
def iv_dps(dps: int):
    """mpmath's interval context has no workdps(); set and restore its precision explicitly."""
    saved = iv.dps
    iv.dps = dps
    try:
        yield
    finally:
        iv.dps = saved


class PrecisionError(Exception):
    """Base class: the engine refuses to return a number it cannot certify."""


class InputError(PrecisionError):
    pass


class VerificationError(PrecisionError):
    pass


class AccuracyError(PrecisionError):
    pass


def parse_decimal(value: object, name: str = "value") -> Fraction:
    """Exact rational from a decimal string or int. Floats are refused."""
    if isinstance(value, bool) or isinstance(value, float):
        raise InputError(f"{name} must be a decimal string, not a {type(value).__name__}")
    if isinstance(value, int):
        return Fraction(value)
    if not isinstance(value, str):
        raise InputError(f"{name} must be a decimal string")
    text = value.strip().replace(",", "").replace("_", "")
    if not _DECIMAL.match(text):
        raise InputError(f"{name} must look like 12345.67 (up to 18 digits either side of the point)")
    return Fraction(text)


def to_prec(value: object, dps: int = WORKING_DPS) -> mpf:
    """mpf at the given working precision, built from the exact rational (never via float)."""
    q = parse_decimal(value)
    with mp.workdps(dps):
        return mpf(q.numerator) / q.denominator


def frac_to_mpf(q: Fraction) -> mpf:
    return mpf(q.numerator) / q.denominator


def frac_to_iv(q: Fraction):
    """Outward-rounded interval containing q exactly."""
    return iv.mpf(q.numerator) / iv.mpf(q.denominator)


def raw_to_frac(raw: tuple) -> Fraction:
    """Exact value of mpmath's raw binary float (sign, mantissa, exponent, bitcount)."""
    sign, man, exp, _bc = raw
    if man == 0:
        if exp == 0:
            return Fraction(0)
        raise VerificationError("non-finite value in an interval bound")  # inf / nan are encoded with man == 0
    value = Fraction(int(man)) * (Fraction(2) ** int(exp))
    return -value if sign else value


def mpf_to_frac(x: mpf) -> Fraction:
    """Exact value of an mpf as a rational (no rounding)."""
    return raw_to_frac(x._mpf_)


def iv_bounds(x) -> tuple[Fraction, Fraction]:
    """
    Exact rational endpoints of an mpmath interval, read from the raw endpoint tuples.
    (x.a is itself an interval, and mpf(x.a) would re-round it at mp.dps, which is only 15 digits by default.)
    """
    a_raw, b_raw = x._mpi_
    return raw_to_frac(a_raw), raw_to_frac(b_raw)


def _pow10(k: int) -> Fraction:
    return Fraction(10) ** k


def round_sig(q: Fraction, sig: int = OUTPUT_SIG, mode: str = "nearest") -> Fraction:
    """Round q to `sig` significant decimal digits: 'nearest' (half away from zero), 'down' (toward -inf) or 'up'."""
    if q == 0:
        return Fraction(0)
    a = abs(q)
    e = len(str(a.numerator // a.denominator)) - 1 if a >= 1 else -_leading_zeros(a) - 1
    scale = _pow10(sig - 1 - e)
    scaled = q * scale
    if mode == "down":
        n = scaled.numerator // scaled.denominator
    elif mode == "up":
        n = -((-scaled.numerator) // scaled.denominator)
    else:
        n = int((abs(scaled) + Fraction(1, 2)).__floor__()) * (1 if scaled >= 0 else -1)
    return Fraction(n) / scale


def _leading_zeros(a: Fraction) -> int:
    k = 0
    while a * _pow10(k + 1) < 1:
        k += 1
    return k


def dec_str(q: Fraction, max_places: int = 400) -> str:
    """Exact decimal string of a rational with a terminating expansion; otherwise the first max_places digits."""
    sign = "-" if q < 0 else ""
    a = abs(q)
    whole, rem = divmod(a.numerator, a.denominator)
    if rem == 0:
        return f"{sign}{whole}"
    digits = []
    for _ in range(max_places):
        rem *= 10
        d, rem = divmod(rem, a.denominator)
        digits.append(str(d))
        if rem == 0:
            break
    frac = "".join(digits).rstrip("0")
    return f"{sign}{whole}.{frac}" if frac else f"{sign}{whole}"


def sig_str(q: Fraction, sig: int = OUTPUT_SIG) -> str:
    return dec_str(round_sig(q, sig))


def bound_str(q: Fraction) -> str:
    """Upper bound on a non-negative error, printed with 3 significant digits and rounded UP."""
    if q == 0:
        return "0"
    r = round_sig(q, 3, "up")
    exp10 = 0
    a = r
    while a >= 10:
        a /= 10
        exp10 += 1
    while a < 1:
        a *= 10
        exp10 -= 1
    mant = dec_str(a)
    return f"{mant}e{exp10}" if exp10 else mant


def display_inr(q: Fraction) -> str:
    """₹ with Indian digit grouping, rounded half away from zero to paise (display only; not certified)."""
    paise = int((abs(q) * 100 + Fraction(1, 2)).__floor__())
    rupees, p = divmod(paise, 100)
    s = str(rupees)
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        s = ",".join(groups) + "," + tail
    return f"{'-' if q < 0 and paise else ''}₹{s}.{p:02d}"


def display_pct(q: Fraction, places: int = 4) -> str:
    scale = _pow10(places)
    v = q * 100 * scale
    n = int((abs(v) + Fraction(1, 2)).__floor__()) * (1 if v >= 0 else -1)
    whole = Fraction(n) / scale
    s = dec_str(whole)
    if "." not in s:
        s += "."
    s += "0" * (places - len(s.split(".")[1]))
    return f"{s}%"
