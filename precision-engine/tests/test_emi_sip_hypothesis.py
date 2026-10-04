"""
EMI and SIP: 10,000 random cases each in CI. For every case:
  1. the certificate is truthful: |value − exact| ≤ certified_absolute_error, and exact ∈ certified_interval;
  2. the relative error against the exact rational answer is ≤ 1e-8 (the guarantee) — in practice ~1e-30;
  3. the exact answer comes from the definition (balance reaches zero / month-by-month growth), not the closed form.
"""
from decimal import Decimal
from fractions import Fraction

from hypothesis import given, settings
from hypothesis import strategies as st

from app.calc.annuity import emi, sip
from tests.conftest import examples
from tests.oracles import emi_by_definition, sip_by_definition

amounts = st.decimals(min_value=Decimal("0.01"), max_value=Decimal("10000000000"), places=2, allow_nan=False, allow_infinity=False)
rates = st.decimals(min_value=Decimal("0"), max_value=Decimal("36"), places=4, allow_nan=False, allow_infinity=False)
months = st.integers(min_value=1, max_value=600)
TARGET = Fraction(1, 10**8)


def _truthful(result: dict, exact: Fraction) -> Fraction:
    cert = result["certification"]
    value = Fraction(result["output"]["value"])
    lo, hi = (Fraction(s) for s in cert["certified_interval"])
    assert lo <= exact <= hi, "true value outside the certified interval"
    err = abs(value - exact)
    assert err <= Fraction(cert["certified_absolute_error"]), "error larger than the certified bound"
    rel = err / abs(exact)
    assert rel <= TARGET, f"relative error {float(rel)} exceeds 1e-8"
    assert cert["verification"]["all_agree"] is True
    return rel


@given(P=amounts, rate=rates, n=months)
@settings(max_examples=examples(10_000))
def test_emi_matches_definition(P, rate, n):
    result = emi(str(P), str(rate), n)
    exact = emi_by_definition(Fraction(str(P)), Fraction(str(rate)), n)
    assert _truthful(result, exact) < Fraction(1, 10**25)


@given(M=amounts, rate=rates, n=months, timing=st.sampled_from(["begin", "end"]))
@settings(max_examples=examples(10_000))
def test_sip_matches_definition(M, rate, n, timing):
    result = sip(str(M), str(rate), n, timing)
    exact = sip_by_definition(Fraction(str(M)), Fraction(str(rate)), n, timing)
    assert _truthful(result, exact) < Fraction(1, 10**25)


def test_known_emi_values():
    # ₹10,00,000 at 8.5% for 20 years: widely published ₹8,678.23
    assert emi("1000000", "8.5", 240)["output"]["display"] == "₹8,678.23"
    # zero rate: exact division
    assert Fraction(emi("120000", "0", 12)["output"]["value"]) == 10000
