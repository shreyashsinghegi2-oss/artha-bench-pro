"""
Vercel Python function: the precision engine (precision-engine/app, FastAPI) served from this project.

Public base URL: https://<site>/api/precision_engine  (set PRECISION_ENGINE_URL to it). vercel.json rewrites
/api/precision_engine/* here; the prefix is stripped so the engine sees /health and /api/<calc> as usual.
"""
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_ROOT, "precision-engine"))

from app.main import app as _engine  # noqa: E402

_PREFIX = "/api/precision_engine"


async def app(scope, receive, send):
    if scope.get("type") in ("http", "websocket"):
        path = scope.get("path", "")
        if path == _PREFIX or path.startswith(_PREFIX + "/"):
            stripped = path[len(_PREFIX):] or "/"
            scope = dict(scope, path=stripped, raw_path=stripped.encode("utf-8"), root_path="")
    await _engine(scope, receive, send)
