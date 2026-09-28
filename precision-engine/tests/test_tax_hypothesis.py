"""Income tax: 10,000 random cases per regime in CI against a separately written statute table; exact equality."""
from decimal import Decimal
from fractions import Fraction

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.calc.tax import income_tax
from app.core.precision import InputError
from tests.conftest import examples
from tests.oracles import tax_reference

incomes = st.one_of(
    st.decimals(min_value=Decimal("0"), max_value=Decimal("3000000"), places=2),  # where slabs and rebate bite
    st.decimals(min_value=Decimal("0"), max_value=Decimal("700000000"), places=2),  # through every surcharge band
    st.sampled_from([Decimal(v) for v in ("475000", "475004", "475005", "1275000", "1275001", "1275009", "1345000",
                                           "5075000", "5075010", "5140000", "10075000", "20075000", "50075000", "50100000")]),
)


@given(gross=incomes, salaried=st.booleans(), resident=st.booleans())
@settings(max_examples=examples(10_000))
def test_new_regime_exact(gross, salaried, resident):
    r = income_tax(str(gross), "new", salaried=salaried, resident=resident)
    assert Fraction(r["output"]["value"]) == tax_reference(Fraction(str(gross)), "new", salaried=salaried, resident=resident)
    assert r["certification"]["certified_absolute_error"] == "0"


@given(gross=incomes, age=st.sampled_from(["below-60", "60-79", "80-plus"]), c80=st.integers(0, 300000), resident=st.booleans())
@settings(max_examples=examples(10_000))
def test_old_regime_exact(gross, age, c80, resident):
    r = income_tax(str(gross), "old", age_category=age, resident=resident, deductions={"80C": str(c80)})
    expected = tax_reference(Fraction(str(gross)), "old", age=age, resident=resident, deductions=Fraction(min(c80, 150000)))
    assert Fraction(r["output"]["value"]) == expected


@given(a=st.integers(0, 600_000_000), b=st.integers(0, 600_000_000))
@settings(max_examples=examples(2_000))
def test_liability_never_decreases_with_income(a, b):
    lo, hi = sorted((a, b))
    assert Fraction(income_tax(str(lo))["output"]["value"]) <= Fraction(income_tax(str(hi))["output"]["value"])


@pytest.mark.parametrize("gross,expected", [
    ("1275000", "0"),  # ₹12,00,000 taxable: full 87A rebate
    ("1850000", "161200"),  # slabs 5/10/15/20% + 4% cess
    ("475000", "0"),
])
def test_anchor_values(gross, expected):
    assert income_tax(gross)["output"]["value"] == expected


def test_new_regime_ignores_old_regime_deductions_with_a_warning():
    r = income_tax("1500000", "new", deductions={"80C": "150000"})
    assert any("80C" in w for w in r["output"]["warnings"])
    assert r["output"]["value"] == income_tax("1500000", "new")["output"]["value"]


def test_unknown_section_is_refused():
    with pytest.raises(InputError):
        income_tax("1000000", deductions={"80Z": "1"})
