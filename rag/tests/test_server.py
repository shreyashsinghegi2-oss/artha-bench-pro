import json
import threading
import urllib.error
import urllib.request

import pytest

from rag.embedder import HashingEmbedder
from rag.server import App, serve
from rag.store import InMemoryStore

from .conftest import CBDT_TEXT


@pytest.fixture
def base_url():
    app = App(store=InMemoryStore(), embedder=HashingEmbedder(), admin_token="secret")
    httpd = serve(0, app)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


def call(url, body=None, token=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def test_ingest_requires_token_then_query_cites(base_url):
    assert call(f"{base_url}/ingest", {"text": CBDT_TEXT, "source": "cbdt.pdf"})[0] == 401
    status, res = call(f"{base_url}/ingest", {"text": CBDT_TEXT, "source": "cbdt.pdf"}, token="secret")
    assert status == 200 and res["chunks"] >= 1
    status, out = call(f"{base_url}/query", {"query": "87A rebate new regime", "top_k": 3})
    assert status == 200 and out["results"][0]["authority"] == "CBDT" and "[1]" in out["context"]
    status, cites = call(f"{base_url}/cite", {"answer": "Up to Rs 60,000 [1].", "results": out["results"]})
    assert status == 200 and cites["cited"][0]["citation"] == 1


def test_validation_errors(base_url):
    assert call(f"{base_url}/query", {"query": ""})[0] == 400
    assert call(f"{base_url}/query", {"query": "x", "authority": "FBI"})[0] == 400
    assert call(f"{base_url}/health")[1]["ok"] is True
    assert call(f"{base_url}/nope", {})[0] == 404
