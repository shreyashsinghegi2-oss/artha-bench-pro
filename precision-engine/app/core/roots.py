"""
Certified root of a dated cash-flow equation  f(r) = Σ c_k (1 + r)^(-t_k) = 0,  r > -1.

Used by XIRR (t_k = days / 365) and bond yield (t_k = coupon periods).

What is proved, and how:
1. Existence in [lo, hi]: f is continuous on (-1, ∞). f(lo) and f(hi) are evaluated with outward-rounded
   interval arithmetic; if the two intervals lie strictly on opposite sides of 0, the intermediate value
   theorem puts a root in [lo, hi].
2. Uniqueness: with x = 1/(1+r) > 0, f is the generalised polynomial Σ c_k x^(t_k). By Descartes' rule of
   signs for real exponents (Laguerre), the number of positive roots is at most the number of sign changes
   of c_k ordered by t_k. One sign change means at most one root, so the root in [lo, hi] is THE rate.
   With more than one sign change, uniqueness inside the supported range is established by interval
   branch-and-bound (_isolate_roots); if more than one root exists the engine refuses to pick one.
Primary value: safeguarded Newton at 30 digits. Cross-check: plain bisection at 40 digits (a different
algorithm with guaranteed convergence). The error bound comes from the proven enclosure in (1).
"""
from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction

from mpmath import iv, mp, mpf

from .precision import INTERVAL_DPS, VerificationError, frac_to_iv, frac_to_mpf, iv_bounds, iv_dps

R_MIN = Fraction(-9999, 10000)  # -99.99 % per unit of time
MULTI_ROOT_MAX = Fraction(100)  # branch-and-bound range upper end: 10,000 %
_GRID = [Fraction(x) for x in ("-0.9999", "-0.999", "-0.99", "-0.95", "-0.9", "-0.75", "-0.5", "-0.25", "0", "0.05", "0.1",
                                "0.2", "0.35", "0.5", "0.75", "1", "1.5", "2", "3", "5", "10", "30", "100", "1000", "10000",
                                "100000", "1000000")]


@dataclass
class RootCertificate:
    value: Fraction  # midpoint of the proven enclosure
    lower: Fraction
    upper: Fraction
    newton: mpf
    newton_iterations: int
    bisection: mpf
    residual: mpf  # |f(newton)| at 30 digits
    sign_changes: int
    uniqueness: str


def sign_changes(amounts: list[Fraction]) -> int:
    signs = [1 if a > 0 else -1 for a in amounts if a != 0]
    return sum(1 for a, b in zip(signs, signs[1:]) if a != b)


def _ipow(base, exponent: Fraction):
    """base^exponent for a positive interval base. Integer exponents stay algebraic (tighter enclosures)."""
    if exponent.denominator == 1:
        return base ** int(exponent)
    return iv.exp(frac_to_iv(exponent) * iv.log(base))


def _hull(a: Fraction, b: Fraction):
    """Interval [a, b] with outward-rounded endpoints."""
    a_raw, b_raw = frac_to_iv(a)._mpi_[0], frac_to_iv(b)._mpi_[1]
    return iv.mpf([mp.make_mpf(a_raw), mp.make_mpf(b_raw)])


class CashflowEquation:
    def __init__(self, amounts: list[Fraction], times: list[Fraction]):
        if len(amounts) != len(times) or len(amounts) < 2:
            raise VerificationError("need at least two cash flows")
        merged: dict[Fraction, Fraction] = {}
        for i in sorted(range(len(times)), key=lambda k: times[k]):
            merged[times[i]] = merged.get(times[i], Fraction(0)) + amounts[i]
        self.times = [t for t in merged if merged[t] != 0]
        self.amounts = [merged[t] for t in self.times]
        if not any(a > 0 for a in self.amounts) or not any(a < 0 for a in self.amounts):
            raise VerificationError("cash flows need at least one inflow and one outflow")
        if self.times[-1] == self.times[0]:
            raise VerificationError("cash flows must span more than one date")
        self._cache: dict[int, tuple[list[mpf], list[mpf]]] = {}

    def _coeffs(self) -> tuple[list[mpf], list[mpf]]:
        """Amounts and times converted at the CURRENT working precision (converting once at 15 digits
        would make every method solve a slightly different equation)."""
        key = mp.prec
        if key not in self._cache:
            self._cache[key] = ([frac_to_mpf(c) for c in self.amounts], [frac_to_mpf(t) for t in self.times])
        return self._cache[key]

    def f(self, r: mpf) -> mpf:
        base = 1 + r
        cs, ts = self._coeffs()
        return mp.fsum(c * base ** (-t) for c, t in zip(cs, ts))

    def df(self, r: mpf) -> mpf:
        base = 1 + r
        cs, ts = self._coeffs()
        return mp.fsum(-c * t * base ** (-t - 1) for c, t in zip(cs, ts))

    def f_iv(self, r):
        base = 1 + r
        total = iv.mpf(0)
        for c, t in zip(self.amounts, self.times):
            total += frac_to_iv(c) * _ipow(base, -t)
        return total

    def df_iv(self, r):
        base = 1 + r
        total = iv.mpf(0)
        for c, t in zip(self.amounts, self.times):
            total += -frac_to_iv(c) * frac_to_iv(t) * _ipow(base, -t - 1)
        return total

    def sign_at(self, r: Fraction) -> int:
        """Proven sign of f(r): +1 or -1, or 0 when interval precision cannot decide."""
        with iv_dps(INTERVAL_DPS):
            lo, hi = iv_bounds(self.f_iv(frac_to_iv(r)))
        return 1 if lo > 0 else -1 if hi < 0 else 0


def _bracket(eq: CashflowEquation) -> tuple[Fraction, Fraction]:
    prev_r, prev_s = None, 0
    for r in _GRID:
        s = eq.sign_at(r)
        if s == 0:
            continue
        if prev_s and s != prev_s:
            return prev_r, r
        prev_r, prev_s = r, s
    raise VerificationError("no rate between -99.99% and 100,000,000% makes the NPV zero")


def _newton(eq: CashflowEquation, lo: Fraction, hi: Fraction) -> tuple[mpf, int]:
    """Newton at 30 digits; a step that leaves the current bracket is replaced by a bisection step."""
    with mp.workdps(30):
        a, b = frac_to_mpf(lo), frac_to_mpf(hi)
        fa = eq.f(a)
        r = (a + b) / 2
        tol = mpf("1e-28")
        for i in range(1, 400):
            fr = eq.f(r)
            if fr == 0:
                return r, i
            if (fr > 0) == (fa > 0):
                a, fa = r, fr
            else:
                b = r
            d = eq.df(r)
            nxt = r - fr / d if d != 0 else None
            if nxt is None or not (a < nxt < b):
                nxt = (a + b) / 2
            if abs(nxt - r) <= tol * max(1, abs(r)):
                return nxt, i
            r = nxt
    raise VerificationError("Newton iteration did not converge")


def _bisection(eq: CashflowEquation, lo: Fraction, hi: Fraction) -> mpf:
    with mp.workdps(40):
        a, b = frac_to_mpf(lo), frac_to_mpf(hi)
        fa = eq.f(a)
        while b - a > mpf("1e-24") * max(1, abs(a)):
            m = (a + b) / 2
            fm = eq.f(m)
            if fm == 0:
                return m
            if (fm > 0) == (fa > 0):
                a, fa = m, fm
            else:
                b = m
        return (a + b) / 2


def _enclose(eq: CashflowEquation, guess: mpf) -> tuple[Fraction, Fraction]:
    """Tightest proven bracket around the Newton result (opposite proven signs at both ends)."""
    g = Fraction(mp.nstr(guess, 40, strip_zeros=False, min_fixed=-mp.inf, max_fixed=mp.inf)) if guess != 0 else Fraction(0)
    scale = max(abs(g), Fraction(1, 10**30))  # relative to the rate itself, so small rates keep a small relative bound
    for k in range(29, 11, -1):
        delta = scale / 10**k
        lo, hi = max(g - delta, R_MIN), g + delta
        s_lo, s_hi = eq.sign_at(lo), eq.sign_at(hi)
        if s_lo and s_hi and s_lo != s_hi:
            return lo, hi
    raise VerificationError("could not prove a root near the computed rate")


def _isolate_roots(eq: CashflowEquation, lo: Fraction, hi: Fraction, max_boxes: int = 20000) -> list[tuple[Fraction, Fraction]]:
    """
    Rigorous root isolation on [lo, hi] by interval branch-and-bound:
      0 ∉ f(X)                          → no root in X
      0 ∉ f'(X), proven opposite signs  → exactly one root in X (strictly monotone + IVT)
      0 ∉ f'(X), proven same sign       → no root in X
      otherwise                         → split X.
    """
    stack = [(lo, hi)]
    found: list[tuple[Fraction, Fraction]] = []
    boxes = 0
    with iv_dps(INTERVAL_DPS):
        while stack:
            a, b = stack.pop()
            boxes += 1
            if boxes > max_boxes:
                raise VerificationError("could not resolve how many IRRs these cash flows have")
            X = _hull(a, b)
            fx_lo, fx_hi = iv_bounds(eq.f_iv(X))
            if fx_lo > 0 or fx_hi < 0:
                continue
            d_lo, d_hi = iv_bounds(eq.df_iv(X))
            if d_lo > 0 or d_hi < 0:
                sa, sb = eq.sign_at(a), eq.sign_at(b)
                if sa and sb:
                    if sa != sb:
                        found.append((a, b))
                    continue
            if b - a < Fraction(1, 10**12):
                raise VerificationError("could not resolve how many IRRs these cash flows have (roots too close together)")
            m = (a + b) / 2
            stack.extend([(m, b), (a, m)])
    return sorted(found)


def certify_root(amounts: list[Fraction], times: list[Fraction]) -> RootCertificate:
    eq = CashflowEquation(amounts, times)
    changes = sign_changes(eq.amounts)
    if changes == 1:
        lo, hi = _bracket(eq)
        uniqueness = "Descartes' rule of signs: the cash flows change sign once, so there is at most one rate"
    else:
        boxes = _isolate_roots(eq, R_MIN, MULTI_ROOT_MAX)
        if not boxes:
            raise VerificationError("no rate between -99.99% and 10,000% makes the NPV zero")
        if len(boxes) > 1:
            raise VerificationError(
                f"the cash flows change sign {changes} times and have {len(boxes)} valid rates between -99.99% and 10,000%; "
                "no single rate is correct"
            )
        lo, hi = boxes[0]
        uniqueness = f"interval branch-and-bound: exactly one rate in [-99.99%, 10,000%] ({changes} sign changes)"
    newton, iterations = _newton(eq, lo, hi)
    bisection = _bisection(eq, lo, hi)
    if sum(eq.amounts) == 0 and lo <= 0 <= hi:
        # f(0) = Σ c_k exactly, so a zero sum means the rate is exactly 0 % (proved in exact arithmetic;
        # a relative bound around 0 would be meaningless, and Newton only lands within ~1e-31 of it).
        enc_lo = enc_hi = Fraction(0)
    else:
        enc_lo, enc_hi = _enclose(eq, newton)
    with mp.workdps(30):
        residual = abs(eq.f(newton))
    return RootCertificate(
        value=(enc_lo + enc_hi) / 2, lower=enc_lo, upper=enc_hi, newton=newton, newton_iterations=iterations,
        bisection=bisection, residual=residual, sign_changes=changes, uniqueness=uniqueness,
    )
