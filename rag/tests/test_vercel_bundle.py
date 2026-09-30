"""The bundled index (scripts/build_rag_bundle.py) and the Vercel function (api/rag_engine.py)."""
import importlib.util
import json
import threading
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


bundle_builder = _load("build_rag_bundle", ROOT / "scripts" / "build_rag_bundle.py")
rag_fn = _load("rag_engine_fn", ROOT / "api" / "rag_engine.py")

HTML = """<html><head><script>var x=1;</script></head><body><nav>Menu</nav>
<h1>Tax on long-term capital gains</h1><p>Long-term capital gains on listed equity shares exceeding
Rs. 1,25,000 are taxed at 12.5 per cent under section 112A of the Income-tax Act.</p>
<p>The holding period for listed equity shares is more than twelve months.</p>
<footer>Copyright</footer></body></html>"""

RSS = """<rss><channel>
<item><title>Monetary Policy Statement: repo rate kept at 5.50 per cent</title><link>https://www.rbi.org.in/x?prid=1</link>
<pubDate>Wed, 01 Oct 2026 10:00:00 +0530</pubDate><description>&lt;p&gt;The Monetary Policy Committee decided to keep the policy repo rate unchanged.&lt;/p&gt;</description></item>
</channel></rss>"""


def test_html_and_rss_parsing():
    text = bundle_builder.html_to_text(HTML.encode())
    assert "12.5 per cent" in text and "var x" not in text and "Menu" not in text
    items = bundle_builder.rss_items(RSS.encode())
    assert items[0]["title"].startswith("Monetary Policy") and "<p>" not in items[0]["text"]


def test_build_load_and_query(tmp_path):
    (tmp_path / "ltcg.html").write_text(HTML, encoding="utf-8")
    (tmp_path / "rbi.xml").write_text(RSS, encoding="utf-8")
    sources = {"sources": [
        {"url": (tmp_path / "ltcg.html").as_uri(), "kind": "html", "authority": "CBDT", "title": "LTCG"},
        {"url": (tmp_path / "rbi.xml").as_uri(), "kind": "rss", "authority": "RBI", "title": "RBI press releases"},
        {"url": (tmp_path / "missing.html").as_uri(), "kind": "html", "authority": "CBDT", "title": "missing"},
    ]}
    (tmp_path / "sources.json").write_text(json.dumps(sources), encoding="utf-8")
    out = tmp_path / "index.json"
    assert bundle_builder.build(tmp_path / "sources.json", out) == 0
    data = json.loads(out.read_text(encoding="utf-8"))
    assert "vectors" not in data and data["dim"] == 768 and len(data["chunks"]) >= 2
    assert [s["status"] for s in data["sources"]] == ["ok", "ok", "failed"]

    store, embedder = rag_fn.load_bundle(str(out))
    assert len(store.vectors) == len(store.chunks)
    app = rag_fn.App(store=store, embedder=embedder, admin_token="")
    status, body = app.query({"query": "tax rate on long term capital gains on shares"})
    assert status == 200 and "112A" in body["results"][0]["text"]
    status, body = app.query({"query": "repo rate decision", "authority": "RBI"})
    assert status == 200 and body["results"][0]["authority"] == "RBI"


def test_handler_routes(tmp_path, monkeypatch):
    monkeypatch.setattr(rag_fn, "_APP", None)
    monkeypatch.setattr(rag_fn, "_INDEX", str(tmp_path / "none.json"))
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), rag_fn.handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{httpd.server_address[1]}/api/rag_engine"
    try:
        health = json.loads(urllib.request.urlopen(f"{base}/health").read())
        assert health["ok"] is True and health["chunks"] == 0 and health["index"] == "bundled, read-only"

        def post(path, body):
            req = urllib.request.Request(f"{base}{path}", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
            try:
                return urllib.request.urlopen(req).status
            except urllib.error.HTTPError as e:
                return e.code

        assert post("/query", {"query": "anything"}) == 200
        assert post("/ingest", {"text": "x"}) == 405
        assert post("/nope", {}) == 404
    finally:
        httpd.shutdown()
