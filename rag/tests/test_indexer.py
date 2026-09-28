import io

import pytest

from rag.embedder import HashingEmbedder
from rag.indexer import build_metadata, clean_text, detect_authority, detect_date, detect_doc_type, ingest_pdf, ingest_text
from rag.store import InMemoryStore

from .conftest import CBDT_TEXT, RBI_TEXT, SEBI_TEXT


@pytest.mark.parametrize("text,expected", [
    ("dated 12 March 2026", "2026-03-12"),
    ("issued on March 12, 2026", "2026-03-12"),
    ("Date: 12.03.2026", "2026-03-12"),
    ("effective 2026-04-01", "2026-04-01"),
    ("1st April 2026", "2026-04-01"),
    ("no date here", None),
    ("31.02.2026 is invalid", None),
])
def test_detect_date(text, expected):
    assert detect_date(text) == expected


@pytest.mark.parametrize("text,expected", [(SEBI_TEXT, "SEBI"), (RBI_TEXT, "RBI"), (CBDT_TEXT, "CBDT"), ("Scheme factsheet: NAV and AUM", "AMFI"), ("National Stock Exchange listing", "NSE"), ("plain text", "OTHER")])
def test_detect_authority(text, expected):
    assert detect_authority(text) == expected


def test_detect_doc_type_and_explicit_overrides_win():
    assert detect_doc_type(SEBI_TEXT) == "circular"
    meta = build_metadata(SEBI_TEXT, "x.pdf", {"authority": "RBI", "url": "https://example.org", "date": None})
    assert meta["authority"] == "RBI" and meta["url"] == "https://example.org" and meta["date"] == "2026-03-12"


def test_clean_text_rejoins_hyphenation_and_collapses_space():
    assert clean_text("regu-\nlation   text\n\n\n\nnext") == "regulation text\n\nnext"


def test_reingesting_same_text_is_skipped():
    store, emb = InMemoryStore(), HashingEmbedder()
    first = ingest_text(SEBI_TEXT, "a.pdf", store, emb)
    second = ingest_text(SEBI_TEXT, "a.pdf", store, emb)
    assert first.chunks >= 1 and second.skipped and store.count() == first.chunks


def test_store_persists_to_disk(tmp_path):
    path = tmp_path / "store.json"
    store = InMemoryStore(str(path))
    ingest_text(RBI_TEXT, "rbi.pdf", store, HashingEmbedder())
    assert InMemoryStore(str(path)).count() == store.count()


def test_pdf_ingestion_extracts_text(tmp_path):
    canvas = pytest.importorskip("reportlab.pdfgen.canvas")
    try:
        import pypdf  # noqa: F401
    except BaseException:  # some system builds of cryptography panic on import
        pytest.skip("pypdf cannot be imported in this environment")
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(72, 750, "Reserve Bank of India circular dated 5 May 2026")
    c.drawString(72, 730, "A UPI PIN is never needed to receive money.")
    c.save()
    store = InMemoryStore()
    res = ingest_pdf(buf.getvalue(), store, HashingEmbedder(), source="rbi.pdf")
    assert res.authority == "RBI" and res.date == "2026-05-05" and res.chunks == 1
