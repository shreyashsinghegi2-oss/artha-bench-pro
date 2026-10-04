"""
CAGR (10,000 cases), XIRR (5,000) and bond yield (5,000) against oracles in Python's decimal module at
80 digits — a different arbitrary-precision library from the engine's mpmath.
"""
from datetime import date, timedelta
from decimal import Decimal
from fractions import Fraction

import pytest
from hypothesis import assume, given, settings
from hypothesis import strategies as st

from app.calc.rates import bond_ytm, cagr, xirr
from app.core.precision import VerificationError
from tests.conftest import examples
from tests.oracles import cagr_decimal, npv_decimal

TARGET = Fraction(1, 10**8)
money = st.decimals(min_value=Decimal("1"), max_value=Decimal("1000000000"), places=2, allow_nan=False, allow_infinity=False)


@given(B=money, E=money, Y=st.decimals(min_value=Decimal("0.1"), max_value=Decimal("60"), places=2))
@settings(max_examples=examples(10_000))
def test_cagr_against_decimal(B, E, Y):
    result = cagr(str(B), str(E), str(Y))
    cert = result["certification"]
    value = Fraction(result["output"]["value"])
    oracle = Fraction(cagr_decimal(Fraction(str(B)), Fraction(str(E)), Fraction(str(Y))))
    lo, hi = (Fraction(s) for s in cert["certified_interval"])
    slack = Fraction(1, 10**70)  # the 80-digit oracle's own rounding
    assert lo - slack <= oracle <= hi + slack
    err = abs(value - oracle)
    assert err <= Fraction(cert["certified_absolute_error"]) + slack
    if oracle:
        assert err / abs(oracle) <= TARGET


def _single_sign_change_flows(draw):
    n_out = draw(st.integers(1, 20))
    n_in = draw(st.integers(1, 30))
    start = date(2015, 1, 1)
    days = sorted(draw(st.lists(st.integers(0, 3650), min_size=n_out + n_in, max_size=n_out + n_in, unique=True)))
    outs = [-draw(money) for _ in range(n_out)]
    ins = [draw(money) for _ in range(n_in)]
    decimals = outs + ins  # outflows first, then inflows: exactly one sign change
    amounts = [Fraction(str(a)) for a in decimals]
    return [{"date": (start + timedelta(days=d)).isoformat(), "amount": str(a)} for d, a in zip(days, decimals)], days, amounts


@st.composite
def flows(draw):
    return _single_sign_change_flows(draw)


@given(data=flows())
@settings(max_examples=examples(5_000, 100))
def test_xirr_root_is_certified(data):
    cashflows, days, amounts = data
    try:
        result = xirr(cashflows)
    except VerificationError as exc:
        # Allowed only when the rate is outside the supported range; the engine must not return a number.
        assert "no rate" in str(exc)
        return
    cert = result["certification"]
    lo, hi = (Fraction(s) for s in cert["certified_interval"])
    times = [Fraction(d - days[0], 365) for d in days]
    if lo == hi == 0:  # exact 0 %: NPV at 0 is the plain sum of the cash flows
        assert sum(amounts) == 0
        return
    # Independent proof with the decimal oracle: NPV changes sign across the certified interval.
    a, b = npv_decimal(amounts, times, lo), npv_decimal(amounts, times, hi)
    assert (a > 0) != (b > 0), "decimal oracle does not see a sign change across the certified interval"
    value = Fraction(result["output"]["value"])
    width = hi - lo
    if value:
        assert (width / 2) / abs(value) <= TARGET


@given(
    price=st.decimals(min_value=Decimal("40"), max_value=Decimal("160"), places=2),
    coupon=st.decimals(min_value=Decimal("0"), max_value=Decimal("15"), places=2),
    periods=st.integers(1, 80),
    freq=st.sampled_from([1, 2, 4, 12]),
)
@settings(max_examples=examples(5_000, 100))
def test_bond_yield_against_decimal_bisection(price, coupon, periods, freq):
    result = bond_ytm(str(price), str(coupon), periods, freq)
    cert = result["certification"]
    lo, hi = (Fraction(s) / freq for s in cert["certified_interval"])
    P, c = Fraction(str(price)), Fraction(str(coupon))
    cp = 100 * c / 100 / freq
    amounts = [-P] + [cp] * (periods - 1) + [cp + 100]
    if lo == hi == 0:  # exact 0 % yield (e.g. a zero-coupon bond bought at face value)
        assert sum(amounts) == 0
        return
    times = [Fraction(k) for k in range(periods + 1)]
    a, b = npv_decimal(amounts, times, lo), npv_decimal(amounts, times, hi)
    assert (a > 0) != (b > 0)
    value = Fraction(result["output"]["value"])
    if value:
        assert abs(Fraction(cert["certified_absolute_error"])) / abs(value) <= TARGET


def test_xirr_known_values():
    assert Fraction(xirr([{"days": 0, "amount": "-1000"}, {"days": 365, "amount": "1100"}])["output"]["value"]) == Fraction(1, 10)
    r = xirr([{"days": 0, "amount": "-1000"}, {"days": 730, "amount": "1210"}])
    assert abs(Fraction(r["output"]["value"]) - Fraction(1, 10)) < Fraction(1, 10**28)


def test_xirr_refuses_ambiguous_cash_flows():
    with pytest.raises(VerificationError, match="2 valid rates"):
        xirr([{"days": 0, "amount": "-100"}, {"days": 365, "amount": "230"}, {"days": 730, "amount": "-132"}])


def test_xirr_multi_sign_change_with_unique_root_is_certified():
    r = xirr([{"days": 0, "amount": "-100"}, {"days": 365, "amount": "50"}, {"days": 730, "amount": "-10"}, {"days": 1095, "amount": "80"}])
    assert "branch-and-bound" in r["certification"]["verification"]["method_3"]


def test_cagr_known_values():
    assert Fraction(cagr("100", "200", "1")["output"]["value"]) == 1
    assert cagr("100", "100", "7")["output"]["value"] == "0"
    assume(True)
