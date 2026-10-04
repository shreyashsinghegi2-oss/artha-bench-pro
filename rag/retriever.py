"""
Hybrid retrieval: vector search + keyword search, fused with Reciprocal Rank Fusion (RRF), then re-ranked.

  candidates = RRF(vector top-20, keyword top-20)      score(d) = sum 1 / (k + rank_i(d)),  k = 60
  reranked   = cross-encoder(ms-marco-MiniLM) over the top-20 candidates -> top-5
  context    = numbered passages [1]..[5] with source lines, for the LLM prompt

The cross-encoder is used when sentence-transformers is installed; otherwise a lexical re-ranker
(query-term coverage + BM25 weight + RRF prior) keeps the pipeline working offline.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .bm25 import tokenize
from .embedder import Embedder
from .store import StoredChunk

RRF_K = 60


@dataclass
class Result:
    chunk: StoredChunk
    score: float
    vector_rank: int | None = None
    keyword_rank: int | None = None
    rrf: float = 0.0
    citation: int = 0

    def to_dict(self) -> dict:
        m = self.chunk.metadata
        return {
            "citation": self.citation,
            "id": self.chunk.id,
            "text": self.chunk.text,
            "section": self.chunk.section,
            "score": round(self.score, 6),
            "rrf": round(self.rrf, 6),
            "vector_rank": self.vector_rank,
            "keyword_rank": self.keyword_rank,
            "source": m.get("source"),
            "title": m.get("title"),
            "authority": m.get("authority"),
            "date": m.get("date"),
            "url": m.get("url"),
        }


def rrf_fuse(rankings: list[list[str]], k: int = RRF_K) -> dict[str, float]:
    """Reciprocal Rank Fusion over several ranked id lists (rank 1 = best)."""
    fused: dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            fused[doc_id] = fused.get(doc_id, 0.0) + 1.0 / (k + rank)
    return fused


class LexicalReranker:
    """Offline fallback: share of query terms present, plus a small prior from the fused rank."""

    def score(self, query: str, results: list[Result]) -> list[float]:
        terms = set(tokenize(query))
        out = []
        for r in results:
            words = set(tokenize((r.chunk.section or "") + " " + r.chunk.text))
            coverage = len(terms & words) / len(terms) if terms else 0.0
            phrase = 0.25 if query.lower().strip() and query.lower().strip() in r.chunk.text.lower() else 0.0
            out.append(coverage + phrase + r.rrf * 10)
        return out


class CrossEncoderReranker:  # pragma: no cover - needs model weights
    def __init__(self, model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        from sentence_transformers import CrossEncoder  # type: ignore

        self.model = CrossEncoder(model)

    def score(self, query: str, results: list[Result]) -> list[float]:
        return [float(s) for s in self.model.predict([(query, r.chunk.text) for r in results])]


def get_reranker(name: str | None = None):
    if name in (None, "", "lexical"):
        return LexicalReranker()
    try:  # pragma: no cover
        return CrossEncoderReranker(name if name != "cross-encoder" else "cross-encoder/ms-marco-MiniLM-L-6-v2")
    except Exception as exc:  # pragma: no cover
        print(f"[rag] reranker {name!r} unavailable ({exc}); using lexical reranker")
        return LexicalReranker()


@dataclass
class HybridRetriever:
    store: object
    embedder: Embedder
    reranker: object = field(default_factory=LexicalReranker)
    candidates: int = 20
    rrf_k: int = RRF_K

    def retrieve(self, query: str, top_k: int = 5, filters: dict | None = None) -> list[Result]:
        query = (query or "").strip()
        if not query:
            return []
        vec_hits = self.store.vector_search(self.embedder.embed_query(query), self.candidates, filters)
        kw_hits = self.store.keyword_search(query, self.candidates, filters)
        by_id: dict[str, Result] = {}
        for rank, (chunk, _score) in enumerate(vec_hits, start=1):
            by_id.setdefault(chunk.id, Result(chunk, 0.0)).vector_rank = rank
        for rank, (chunk, _score) in enumerate(kw_hits, start=1):
            by_id.setdefault(chunk.id, Result(chunk, 0.0)).keyword_rank = rank
        fused = rrf_fuse([[c.id for c, _ in vec_hits], [c.id for c, _ in kw_hits]], self.rrf_k)
        pool = sorted(by_id.values(), key=lambda r: -fused.get(r.chunk.id, 0.0))[: self.candidates]
        for r in pool:
            r.rrf = fused.get(r.chunk.id, 0.0)
        if not pool:
            return []
        for r, s in zip(pool, self.reranker.score(query, pool)):
            r.score = s
        ranked = sorted(pool, key=lambda r: (-r.score, -r.rrf, r.chunk.id))[:top_k]
        for i, r in enumerate(ranked, start=1):
            r.citation = i
        return ranked


def build_context(results: list[Result], max_chars_per_chunk: int = 1800) -> str:
    """Numbered passages for the LLM prompt. The model must cite them as [1], [2], ..."""
    if not results:
        return ""
    lines = ["OFFICIAL DOCUMENTS (retrieved). Cite each fact you use as [n]; if these passages do not answer the question, say so."]
    for r in results:
        m = r.chunk.metadata
        where = " · ".join(x for x in [m.get("authority"), m.get("title"), r.chunk.section, m.get("date")] if x)
        text = r.chunk.text if len(r.chunk.text) <= max_chars_per_chunk else r.chunk.text[:max_chars_per_chunk] + " …"
        lines.append(f"[{r.citation}] {where}\n{text}")
    return "\n\n".join(lines)


_CITE_RE = re.compile(r"\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]")


def extract_citations(answer: str, results: list[Result]) -> dict:
    """Which retrieved passages an answer cites, and any citation numbers that point nowhere."""
    by_num = {r.citation: r for r in results}
    used: list[int] = []
    invalid: list[int] = []
    for m in _CITE_RE.finditer(answer or ""):
        for part in m.group(1).split(","):
            n = int(part.strip())
            target = used if n in by_num else invalid
            if n not in target:
                target.append(n)
    return {
        "cited": [by_num[n].to_dict() for n in used],
        "invalid": invalid,
        "uncited_answer": not used,
    }
