"""
Request bodies. Monetary amounts and rates are strict strings: a JSON number would be parsed into a
binary float before it reached the engine, which is exactly the rounding the engine exists to avoid.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, StrictStr


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EmiRequest(Strict):
    principal: StrictStr = Field(examples=["5000000"])
    annual_rate_pct: StrictStr = Field(examples=["8.25"])
    months: StrictInt = Field(examples=[120])


class SipRequest(Strict):
    monthly: StrictStr = Field(examples=["10000"])
    annual_rate_pct: StrictStr = Field(examples=["12"])
    months: StrictInt = Field(examples=[240])
    timing: Literal["begin", "end"] = "begin"


class CagrRequest(Strict):
    begin_value: StrictStr = Field(examples=["100000"])
    end_value: StrictStr = Field(examples=["250000"])
    years: StrictStr = Field(examples=["5"])


class Cashflow(Strict):
    amount: StrictStr
    date: Optional[StrictStr] = None
    days: Optional[StrictInt] = None


class XirrRequest(Strict):
    cashflows: list[Cashflow] = Field(min_length=2, max_length=1000)


class BondRequest(Strict):
    price: StrictStr = Field(examples=["98.50"])
    coupon_rate_pct: StrictStr = Field(examples=["7.18"])
    periods: StrictInt = Field(examples=[20])
    frequency: Literal[1, 2, 4, 12] = 2
    face: StrictStr = "100"


class TaxRequest(Strict):
    gross_income: StrictStr = Field(examples=["1850000"])
    regime: Literal["new", "old"] = "new"
    financial_year: Literal["FY2025-26", "FY2026-27"] = "FY2026-27"
    age_category: Literal["below-60", "60-79", "80-plus"] = "below-60"
    salaried: StrictBool = True
    resident: StrictBool = True
    deductions: dict[str, StrictStr] = Field(default_factory=dict)


class VerifyRequest(Strict):
    certificate: dict
