"""api/precision_engine.py serves the engine under /api/precision_engine (Vercel) by stripping the prefix."""
import importlib.util
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("precision_engine_fn", ROOT / "api" / "precision_engine.py")
fn = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fn)
client = TestClient(fn.app)


def test_health_and_emi_under_the_vercel_prefix():
    assert client.get("/api/precision_engine/health").status_code == 200
    r = client.post("/api/precision_engine/api/emi", json={"principal": "1000000", "annual_rate_pct": "8.5", "months": 240})
    assert r.status_code == 200
    body = r.json()
    assert body["output"]["display"] == "₹8,678.23"
    assert body["certification"]["verification"]["all_agree"] is True


def test_unprefixed_paths_still_work():
    assert client.get("/health").status_code == 200
