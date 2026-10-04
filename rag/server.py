"""
HTTP sidecar (stdlib only):  python -m rag.server  [--port 8765]

  GET  /health                         -> {ok, chunks, embedder, reranker}
  POST /query   {query, top_k?, authority?}          -> {results: [...], context}
  POST /ingest  {text | pdf_base64, source, metadata?} -> {document_id, chunks, skipped}   (needs RAG_ADMIN_TOKEN)
  POST /cite    {answer, results}                    -> {cited, invalid, uncited_answer}

Environment: RAG_EMBEDDER, RAG_RERANKER, DATABASE_URL, RAG_STORE_PATH, RAG_ADMIN_TOKEN, RAG_PORT.
"""
from __future__ import annotations

import argparse
import base64
import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .embedder import get_embedder
from .indexer import AUTHORITIES, ingest_pdf, ingest_text
from .retriever import HybridRetriever, Result, build_context, extract_citations, get_reranker
from .store import StoredChunk, get_store

MAX_BODY = 25 * 1024 * 1024


class App:
    def __init__(self, store=None, embedder=None, reranker=None, admin_token: str | None = None):
        self.store = store if store is not None else get_store()
        self.embedder = embedder or get_embedder()
        self.reranker = reranker or get_reranker(os.environ.get("RAG_RERANKER"))
        self.retriever = HybridRetriever(self.store, self.embedder, self.reranker)
        self.admin_token = admin_token if admin_token is not None else os.environ.get("RAG_ADMIN_TOKEN", "")

    def health(self):
        return 200, {"ok": True, "chunks": self.store.count(), "embedder": type(self.embedder).__name__, "reranker": type(self.reranker).__name__}

    def query(self, body: dict):
        q = str(body.get("query", "")).strip()[:1000]
        if not q:
            return 400, {"error": "query is required"}
        top_k = max(1, min(int(body.get("top_k", 5)), 10))
        authority = body.get("authority")
        if authority and authority not in AUTHORITIES:
            return 400, {"error": f"authority must be one of {', '.join(AUTHORITIES)}"}
        results = self.retriever.retrieve(q, top_k=top_k, filters={"authority": authority} if authority else None)
        return 200, {"results": [r.to_dict() for r in results], "context": build_context(results)}

    def ingest(self, body: dict, auth_header: str):
        if not self.admin_token or not hmac.compare_digest(auth_header, f"Bearer {self.admin_token}"):
            return 401, {"error": "unauthorised"}
        source = str(body.get("source") or "upload")[:200]
        meta = body.get("metadata") or {}
        if body.get("pdf_base64"):
            res = ingest_pdf(base64.b64decode(body["pdf_base64"]), self.store, self.embedder, source, meta)
        elif body.get("text"):
            res = ingest_text(str(body["text"]), source, self.store, self.embedder, meta)
        else:
            return 400, {"error": "text or pdf_base64 is required"}
        return 200, res.__dict__

    def cite(self, body: dict):
        results = []
        for r in body.get("results") or []:
            chunk = StoredChunk(str(r.get("id")), "", str(r.get("text", "")), r.get("section"), {k: r.get(k) for k in ("source", "title", "authority", "date", "url")})
            results.append(Result(chunk, float(r.get("score", 0)), citation=int(r.get("citation", 0))))
        return 200, extract_citations(str(body.get("answer", "")), results)


def make_handler(app: App):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, status: int, payload: dict):
            data = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, fmt, *args):  # keep request bodies (user questions) out of logs
            pass

        def do_GET(self):
            if self.path == "/health":
                return self._send(*app.health())
            self._send(404, {"error": "not found"})

        def do_POST(self):
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                return self._send(413, {"error": "body too large"})
            try:
                body = json.loads(self.rfile.read(length) or b"{}")
            except json.JSONDecodeError:
                return self._send(400, {"error": "invalid JSON"})
            try:
                if self.path == "/query":
                    return self._send(*app.query(body))
                if self.path == "/ingest":
                    return self._send(*app.ingest(body, self.headers.get("Authorization", "")))
                if self.path == "/cite":
                    return self._send(*app.cite(body))
            except ValueError as exc:
                return self._send(400, {"error": str(exc)})
            except Exception:
                return self._send(500, {"error": "internal error"})
            self._send(404, {"error": "not found"})

    return Handler


def serve(port: int = 8765, app: App | None = None) -> ThreadingHTTPServer:
    httpd = ThreadingHTTPServer(("0.0.0.0", port), make_handler(app or App()))
    return httpd


if __name__ == "__main__":  # pragma: no cover
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("RAG_PORT", "8765")))
    args = parser.parse_args()
    httpd = serve(args.port)
    print(f"[rag] sidecar listening on :{args.port}")
    httpd.serve_forever()
