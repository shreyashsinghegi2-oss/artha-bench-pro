"""
ArthaBench precision engine: certified financial calculations over HTTP.

Run:  uvicorn app.main:app --port 8000        (from precision-engine/)
A calculation that cannot be certified returns HTTP 422 with {"verified": false, "error": ...} and no number.
"""
from __future__ import annotations

import os

import mpmath
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .core.certificate import ENGINE_VERSION
from .core.precision import AccuracyError, InputError, PrecisionError, VerificationError
from .routers.calculators import router

app = FastAPI(title="ArthaBench precision engine", version=ENGINE_VERSION.split("-")[-1])
origins = [o.strip() for o in os.environ.get("PRECISION_ALLOWED_ORIGINS", "").split(",") if o.strip()]
if origins:
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["POST", "GET"], allow_headers=["content-type"])
app.include_router(router)


@app.exception_handler(PrecisionError)
async def _refuse(_request: Request, exc: PrecisionError) -> JSONResponse:
    kind = "input" if isinstance(exc, InputError) else "verification" if isinstance(exc, VerificationError) else \
        "accuracy" if isinstance(exc, AccuracyError) else "precision"
    return JSONResponse(status_code=422, content={"verified": False, "error_type": kind, "error": str(exc)})


@app.get("/health")
def health() -> dict:
    return {"ok": True, "engine_version": ENGINE_VERSION, "mpmath_version": mpmath.__version__,
            "calculators": ["emi", "sip", "cagr", "xirr", "bond", "tax"]}
