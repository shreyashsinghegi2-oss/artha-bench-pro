"""HTTP routes. Each handler only validates the body and calls the calculator; all maths lives in app/calc."""
from __future__ import annotations

from fastapi import APIRouter

from ..calc import annuity, rates, tax
from ..core import checker
from ..schemas.requests import BondRequest, CagrRequest, EmiRequest, SipRequest, TaxRequest, VerifyRequest, XirrRequest

router = APIRouter(prefix="/api")


@router.post("/emi")
def emi(body: EmiRequest) -> dict:
    return annuity.emi(body.principal, body.annual_rate_pct, body.months)


@router.post("/sip")
def sip(body: SipRequest) -> dict:
    return annuity.sip(body.monthly, body.annual_rate_pct, body.months, body.timing)


@router.post("/cagr")
def cagr(body: CagrRequest) -> dict:
    return rates.cagr(body.begin_value, body.end_value, body.years)


@router.post("/xirr")
def xirr(body: XirrRequest) -> dict:
    return rates.xirr([cf.model_dump(exclude_none=True) for cf in body.cashflows])


@router.post("/bond")
def bond(body: BondRequest) -> dict:
    return rates.bond_ytm(body.price, body.coupon_rate_pct, body.periods, body.frequency, body.face)


@router.post("/tax")
def income_tax(body: TaxRequest) -> dict:
    return tax.income_tax(body.gross_income, body.regime, body.financial_year, body.age_category, body.salaried, body.resident, body.deductions)


@router.post("/verify")
def verify(body: VerifyRequest) -> dict:
    """Re-check a certificate independently of the calculator that produced it."""
    try:
        return checker.check(body.certificate)
    except (KeyError, ValueError, TypeError) as exc:
        return {"valid": False, "checks": [f"malformed certificate: {exc}"]}
