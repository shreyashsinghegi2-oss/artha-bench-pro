"""HTTP API, certificate format, and the independent checker (including tampered certificates)."""
import copy
from fractions import Fraction

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

REQUESTS = {
    "emi": {"principal": "5000000", "annual_rate_pct": "8.25", "months": 120},
    "sip": {"monthly": "10000", "annual_rate_pct": "12", "months": 240},
    "cagr": {"begin_value": "100000", "end_value": "250000", "years": "5.5"},
    "xirr": {"cashflows": [{"date": "2024-01-01", "amount": "-100000"}, {"date": "2024-07-01", "amount": "-50000"},
                           {"date": "2026-09-28", "amount": "190000"}]},
    "bond": {"price": "98.50", "coupon_rate_pct": "7.18", "periods": 20},
    "tax": {"gross_income": "1850000"},
}


@pytest.mark.parametrize("kind", list(REQUESTS))
def test_certificate_shape_and_independent_check(kind):
    res = client.post(f"/api/{kind}", json=REQUESTS[kind])
    assert res.status_code == 200, res.text
    cert = res.json()
    c = cert["certification"]
    assert c["verification"]["all_agree"] is True
    assert c["guaranteed_relative_error"] == "≤ 0.000001%"
    lo, hi = (Fraction(s) for s in c["certified_interval"])
    assert lo <= Fraction(cert["output"]["value"]) <= hi
    assert client.post("/api/verify", json={"certificate": cert}).json()["valid"] is True


@pytest.mark.parametrize("kind", ["emi", "sip", "cagr", "xirr", "bond"])
def test_checker_rejects_a_shifted_interval(kind):
    cert = client.post(f"/api/{kind}", json=REQUESTS[kind]).json()
    bad = copy.deepcopy(cert)
    lo, hi = (Fraction(s) for s in cert["certification"]["certified_interval"])
    shift = max(abs(hi), Fraction(1)) / 10**6
    bad["certification"]["certified_interval"] = [str(float(lo + shift)), str(float(hi + shift))]
    bad["output"]["value"] = str(float(lo + shift))
    assert client.post("/api/verify", json={"certificate": bad}).json()["valid"] is False


def test_json_numbers_are_refused():
    res = client.post("/api/emi", json={"principal": 100000.5, "annual_rate_pct": "8", "months": 12})
    assert res.status_code == 422


def test_uncertifiable_request_returns_no_number():
    res = client.post("/api/xirr", json={"cashflows": [{"days": 0, "amount": "-100"}, {"days": 365, "amount": "230"}, {"days": 730, "amount": "-132"}]})
    assert res.status_code == 422
    body = res.json()
    assert body["verified"] is False and "value" not in body


def test_health():
    assert client.get("/health").json()["ok"] is True
