"""The primitives the proofs rest on: exact conversion of interval endpoints, directed rounding, input rules."""
from fractions import Fraction

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from mpmath import iv, mp

from app.core.precision import InputError, frac_to_iv, iv_bounds, iv_dps, parse_decimal, round_sig


def test_interval_endpoints_are_exact_not_15_digit():
    # Regression: mpf(x.a) re-rounds at mp.dps (15), which once made enclosures unsound.
    with iv_dps(50):
        lo, hi = iv_bounds(frac_to_iv(Fraction(1, 3)))
    assert lo < Fraction(1, 3) < hi
    assert hi - lo < Fraction(1, 10**45)
    assert mp.dps == 15  # the helper must not leak precision changes


@given(st.fractions(min_value=-10**12, max_value=10**12, max_denominator=10**15))
@settings(max_examples=2000)
def test_frac_to_iv_encloses(q):
    with iv_dps(50):
        lo, hi = iv_bounds(frac_to_iv(q))
    assert lo <= q <= hi


@given(st.fractions(min_value=Fraction(1, 10**12), max_value=10**20, max_denominator=10**12), st.integers(1, 40))
@settings(max_examples=2000)
def test_directed_rounding(q, sig):
    down, up, near = round_sig(q, sig, "down"), round_sig(q, sig, "up"), round_sig(q, sig)
    assert down <= q <= up
    assert down <= near <= up


def test_iv_dps_restores_precision():
    before = iv.dps
    with iv_dps(80):
        assert iv.dps == 80
    assert iv.dps == before


@pytest.mark.parametrize("bad", [0.1, 1e5, True, None, "1e5", "abc", "1.2.3", "∞", "1" * 19])
def test_rejects_non_decimal_inputs(bad):
    with pytest.raises(InputError):
        parse_decimal(bad)


def test_accepts_indian_grouping_and_ints():
    assert parse_decimal("1,00,000.50") == Fraction(200001, 2)
    assert parse_decimal(12) == 12
