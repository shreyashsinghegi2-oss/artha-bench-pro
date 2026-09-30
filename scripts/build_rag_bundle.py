"""
Builds rag/index/official-index.json from rag/sources.json (run by .github/workflows/rag-index.yml).

  python scripts/build_rag_bundle.py [--sources rag/sources.json] [--out rag/index/official-index.json]

Each source is downloaded (PDF, HTML page or RSS feed), turned into text, chunked by rag.indexer and stored.
The bundle stores documents, chunk text and the hashing-embedder vectors as one base64 float16 matrix (small
and instant to load; the embedder is deterministic, so query vectors match). Sources that fail are reported and skipped; the script fails only if nothing was indexed.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import html
import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np  # noqa: E402

from rag.embedder import HashingEmbedder  # noqa: E402
from rag.indexer import ingest_pdf, ingest_text  # noqa: E402
from rag.store import InMemoryStore  # noqa: E402

UA = "Mozilla/5.0 (compatible; ArthaBench-RAG-Indexer/1.0; +https://artha-bench-pro.vercel.app)"
# Some government sites refuse unknown agents; a standard browser request is retried once for them.
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
}


def fetch(url: str, timeout: int = 90) -> bytes:
    last: Exception | None = None
    for headers in ({"User-Agent": UA, "Accept": "*/*"}, BROWSER_HEADERS):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as res:  # noqa: S310 - fixed official URLs from sources.json
                return res.read()
        except urllib.error.HTTPError as e:
            last = e
            if e.code not in (401, 403, 406, 429):
                raise
    raise last if last else RuntimeError("download failed")


class _Text(HTMLParser):
    SKIP = {"script", "style", "nav", "header", "footer", "noscript", "svg", "form"}
    BLOCK = {"p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "br", "section", "article", "table"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def html_to_text(raw: bytes) -> str:
    p = _Text()
    p.feed(raw.decode("utf-8", errors="replace"))
    text = "".join(p.parts)
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


def rss_items(raw: bytes) -> list[dict]:
    root = ET.fromstring(raw)
    items = []
    for item in root.iter("item"):
        get = lambda tag: (item.findtext(tag) or "").strip()  # noqa: E731
        desc = re.sub(r"<[^>]+>", " ", html.unescape(get("description")))
        items.append({"title": get("title"), "link": get("link"), "date": get("pubDate"), "text": re.sub(r"\s+", " ", desc).strip()})
    return items


def build(sources_path: Path, out_path: Path) -> int:
    sources = json.loads(sources_path.read_text(encoding="utf-8"))["sources"]
    store = InMemoryStore()
    embedder = HashingEmbedder()
    report = []
    for src in sources:
        url, kind, authority = src["url"], src["kind"], src["authority"]
        meta = {"authority": authority, "title": src.get("title"), "url": url}
        try:
            raw = fetch(url)
            if kind == "pdf":
                r = ingest_pdf(raw, store, embedder, url, meta)
                report.append({"url": url, "status": "ok", "chunks": r.chunks})
            elif kind == "html":
                text = html_to_text(raw)
                if len(text) < 200:
                    raise ValueError("page has too little text")
                r = ingest_text(text, url, store, embedder, meta)
                report.append({"url": url, "status": "ok", "chunks": r.chunks})
            elif kind == "rss":
                n = 0
                for it in rss_items(raw)[:60]:
                    body = f"{it['title']}\n\n{it['text']}".strip()
                    if len(body) < 40:
                        continue
                    r = ingest_text(body, it["link"] or url, store, embedder, {"authority": authority, "title": it["title"], "url": it["link"] or url, "date": it["date"] or None, "doc_type": "press release"})
                    n += r.chunks
                report.append({"url": url, "status": "ok", "chunks": n})
            else:
                raise ValueError(f"unknown kind {kind}")
        except Exception as e:  # noqa: BLE001 - report every source, never stop the whole build
            report.append({"url": url, "status": "failed", "error": str(e)[:200]})
    for line in report:
        print(json.dumps(line))
    if not store.chunks:
        print("Nothing was indexed.", file=sys.stderr)
        return 1
    out_path.parent.mkdir(parents=True, exist_ok=True)
    bundle = {
        "built_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "embedder": "HashingEmbedder",
        "sources": report,
        "documents": store.documents,
        "chunks": [c.__dict__ for c in store.chunks],
        "dim": int(store.vectors[0].shape[0]),
        "vectors_f16_b64": base64.b64encode(np.stack(store.vectors).astype(np.float16).tobytes()).decode("ascii"),
    }
    out_path.write_text(json.dumps(bundle, ensure_ascii=False), encoding="utf-8")
    print(f"Indexed {len(store.documents)} documents, {len(store.chunks)} chunks -> {out_path}")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", default="rag/sources.json")
    ap.add_argument("--out", default="rag/index/official-index.json")
    a = ap.parse_args()
    sys.exit(build(Path(a.sources), Path(a.out)))
