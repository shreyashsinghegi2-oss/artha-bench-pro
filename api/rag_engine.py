"""
Vercel Python function: document search (rag/) over a read-only index bundled with the deployment.

Public base URL: https://<site>/api/rag_engine  (set RAG_SIDECAR_URL to it).
  GET  /health   POST /query   POST /cite      (POST /ingest is disabled here: the index is built by the
                                                "RAG index" GitHub workflow and shipped with the deployment)

The bundle (rag/index/official-index.json) stores documents, chunk text and float16 vectors from the
deterministic hashing embedder, so a cold start only decodes one matrix (no model download, no re-embedding).
"""
import base64
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _ROOT)

import numpy as np  # noqa: E402

from rag.embedder import HashingEmbedder  # noqa: E402
from rag.server import App  # noqa: E402
from rag.store import InMemoryStore, StoredChunk  # noqa: E402

_PREFIX = "/api/rag_engine"
_INDEX = os.path.join(_ROOT, "rag", "index", "official-index.json")
_MAX_BODY = 256 * 1024
_APP = None


def load_bundle(path: str | None = None):
    """In-memory store rebuilt from a bundle {documents, chunks}; vectors re-embedded deterministically."""
    path = path or _INDEX
    store = InMemoryStore()
    embedder = HashingEmbedder()
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        store.documents = data.get("documents", {})
        store.chunks = [StoredChunk(**c) for c in data.get("chunks", [])]
        if store.chunks and data.get("vectors_f16_b64"):
            mat = np.frombuffer(base64.b64decode(data["vectors_f16_b64"]), dtype=np.float16).astype(np.float32)
            store.vectors = list(mat.reshape(len(store.chunks), int(data["dim"])))
        elif store.chunks:
            store.vectors = list(embedder.embed_documents([c.text for c in store.chunks]))
    return store, embedder


def get_app():
    global _APP
    if _APP is None:
        store, embedder = load_bundle()
        _APP = App(store=store, embedder=embedder, admin_token="")
    return _APP


class handler(BaseHTTPRequestHandler):
    def _route(self) -> str:
        path = self.path.split("?", 1)[0]
        if path.startswith(_PREFIX):
            path = path[len(_PREFIX):] or "/"
        return path

    def _send(self, status: int, body: dict) -> None:
        raw = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self._route() == "/health":
            status, body = get_app().health()
            body["index"] = "bundled, read-only"
            return self._send(status, body)
        return self._send(404, {"error": "not found"})

    def do_POST(self):
        route = self._route()
        length = int(self.headers.get("Content-Length") or 0)
        if length > _MAX_BODY:
            return self._send(413, {"error": "request too large"})
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(body, dict):
                raise ValueError
        except ValueError:
            return self._send(400, {"error": "invalid JSON"})
        app = get_app()
        if route == "/query":
            return self._send(*app.query(body))
        if route == "/cite":
            return self._send(*app.cite(body))
        if route == "/ingest":
            return self._send(405, {"error": "this deployment serves a read-only bundled index; run the RAG index workflow to add documents"})
        return self._send(404, {"error": "not found"})

    def log_message(self, format, *args):  # noqa: A002 - keep function logs quiet
        return
