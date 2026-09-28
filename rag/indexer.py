"""
Document ingestion: PDF/text extraction, metadata detection, chunking, embedding and storage.

Metadata per chunk: {source, title, section, date, authority, doc_type, url}. Authority and date are
detected from the text and file name; pass them explicitly when known (explicit values always win).
"""
from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from .embedder import Chunk, Embedder, chunk_text, embed_chunks

AUTHORITIES = ("SEBI", "RBI", "CBDT", "AMFI", "NSE", "BSE", "OTHER")

_AUTHORITY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("SEBI", re.compile(r"\bSEBI\b|Securities and Exchange Board of India", re.I)),
    ("RBI", re.compile(r"\bRBI\b|Reserve Bank of India", re.I)),
    ("CBDT", re.compile(r"\bCBDT\b|Central Board of Direct Taxes|Income[- ]tax Department|Income[- ]tax Act", re.I)),
    ("AMFI", re.compile(r"\bAMFI\b|fact ?sheet|expense ratio|\bNAV\b|\bAUM\b", re.I)),
    ("NSE", re.compile(r"\bNSE\b|National Stock Exchange", re.I)),
    ("BSE", re.compile(r"\bBSE\b|Bombay Stock Exchange", re.I)),
]
_DOC_TYPES = [
    ("circular", re.compile(r"\bcircular\b", re.I)),
    ("notification", re.compile(r"\bnotification\b", re.I)),
    ("master_direction", re.compile(r"\bmaster direction\b", re.I)),
    ("regulation", re.compile(r"\bregulations?\b", re.I)),
    ("factsheet", re.compile(r"fact ?sheet", re.I)),
    ("listing_agreement", re.compile(r"listing (?:agreement|obligations)", re.I)),
    ("guideline", re.compile(r"\bguidelines?\b", re.I)),
]
_MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
_DATE_PATTERNS = [
    re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?[ -]([A-Za-z]{3,9})[ ,-]+(\d{4})\b"),  # 12 March 2026
    re.compile(r"\b([A-Za-z]{3,9}) (\d{1,2}),? (\d{4})\b"),  # March 12, 2026
    re.compile(r"\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b"),  # 12.03.2026 (Indian day-first)
    re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"),  # 2026-03-12
]


def _safe_date(y: int, m: int, d: int) -> str | None:
    try:
        return date(y, m, d).isoformat()
    except ValueError:
        return None


def detect_date(text: str) -> str | None:
    """First plausible document date in the text, as ISO yyyy-mm-dd."""
    head = text[:4000]
    for i, pat in enumerate(_DATE_PATTERNS):
        for m in pat.finditer(head):
            g = m.groups()
            if i == 0:
                mon = _MONTHS.get(g[1][:3].lower())
                iso = _safe_date(int(g[2]), mon, int(g[0])) if mon else None
            elif i == 1:
                mon = _MONTHS.get(g[0][:3].lower())
                iso = _safe_date(int(g[2]), mon, int(g[1])) if mon else None
            elif i == 2:
                iso = _safe_date(int(g[2]), int(g[1]), int(g[0]))
            else:
                iso = _safe_date(int(g[0]), int(g[1]), int(g[2]))
            if iso and "1990-01-01" <= iso <= "2100-12-31":
                return iso
    return None


def detect_authority(text: str, source: str = "") -> str:
    """The issuing authority, judged by where its name first appears (title and first page carry most weight)."""
    haystack = f"{source}\n{text[:6000]}"
    best: tuple[int, str] | None = None
    for name, pat in _AUTHORITY_PATTERNS:
        m = pat.search(haystack)
        if m and (best is None or m.start() < best[0]):
            best = (m.start(), name)
    return best[1] if best else "OTHER"


def detect_doc_type(text: str) -> str:
    head = text[:3000]
    for name, pat in _DOC_TYPES:
        if pat.search(head):
            return name
    return "document"


def detect_title(text: str) -> str:
    for line in text.splitlines():
        line = line.strip()
        if 8 <= len(line) <= 200 and re.search(r"[A-Za-z]{3}", line):
            return line
    return "Untitled document"


def clean_text(text: str) -> str:
    text = text.replace("­", "")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # re-join words hyphenated across lines
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pdf_text(data: bytes | str | Path) -> str:
    """Text of every page of a PDF (bytes or path). Scanned PDFs without a text layer return ''."""
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data) if isinstance(data, bytes) else str(data))
    pages = [(page.extract_text() or "") for page in reader.pages]
    return clean_text("\n\n".join(pages))


@dataclass
class IngestResult:
    document_id: str
    title: str
    authority: str
    date: str | None
    chunks: int
    skipped: bool = False


def build_metadata(text: str, source: str, overrides: dict | None = None) -> dict:
    meta = {
        "source": source,
        "title": detect_title(text),
        "authority": detect_authority(text, source),
        "date": detect_date(text),
        "doc_type": detect_doc_type(text),
    }
    for key, value in (overrides or {}).items():
        if value not in (None, ""):
            meta[key] = value
    if meta["authority"] not in AUTHORITIES:
        meta["authority"] = "OTHER"
    return meta


def ingest_text(text: str, source: str, store, embedder: Embedder, metadata: dict | None = None,
                chunk_tokens: int = 512, overlap_tokens: int = 64) -> IngestResult:
    """Chunk, embed and store one document. Re-ingesting identical text is a no-op (content hash)."""
    text = clean_text(text)
    meta = build_metadata(text, source, metadata)
    doc_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    if store.has_document(doc_hash):
        return IngestResult(doc_hash[:16], meta["title"], meta["authority"], meta["date"], 0, skipped=True)
    chunks: list[Chunk] = chunk_text(text, meta, chunk_tokens, overlap_tokens)
    for c in chunks:
        c.metadata["section"] = c.section
    store.add_document(doc_hash, meta, embed_chunks(chunks, embedder))
    return IngestResult(doc_hash[:16], meta["title"], meta["authority"], meta["date"], len(chunks))


def ingest_pdf(data: bytes | str | Path, store, embedder: Embedder, source: str | None = None, metadata: dict | None = None) -> IngestResult:
    src = source or (Path(data).name if not isinstance(data, bytes) else "upload.pdf")
    text = extract_pdf_text(data)
    if not text:
        raise ValueError(f"No text layer found in {src}; run OCR first.")
    return ingest_text(text, src, store, embedder, metadata)


def ingest_directory(folder: str | Path, store, embedder: Embedder, metadata: dict | None = None) -> list[IngestResult]:
    """Ingest every .pdf and .txt file in a folder (non-recursive)."""
    results = []
    for path in sorted(Path(folder).iterdir()):
        if path.suffix.lower() == ".pdf":
            results.append(ingest_pdf(path, store, embedder, path.name, metadata))
        elif path.suffix.lower() in (".txt", ".md"):
            results.append(ingest_text(path.read_text(encoding="utf-8"), path.name, store, embedder, metadata))
    return results


if __name__ == "__main__":  # pragma: no cover
    # python -m rag.indexer ./docs/official --authority SEBI
    import argparse

    from .embedder import get_embedder
    from .store import get_store

    parser = argparse.ArgumentParser(description="Ingest PDFs/text files into the RAG store.")
    parser.add_argument("folder")
    parser.add_argument("--authority", choices=AUTHORITIES)
    parser.add_argument("--url")
    args = parser.parse_args()
    store, embedder = get_store(), get_embedder()
    for r in ingest_directory(args.folder, store, embedder, {"authority": args.authority, "url": args.url}):
        print(f"{'skip' if r.skipped else 'ok  '} {r.authority:5} {r.date or '----------'} {r.chunks:4} chunks  {r.title[:70]}")
