"""
Vector + keyword stores.

InMemoryStore: numpy cosine search + in-process BM25 (tests, local dev, small corpora). Optional JSON
persistence via RAG_STORE_PATH.

PgVectorStore: Supabase Postgres with pgvector (HNSW, cosine) for vector search and Postgres full-text
search (ts_rank_cd over a generated tsvector) for keyword search. Note: Postgres ranking is not true BM25;
the fusion step (RRF) only uses ranks, so this difference matters little in practice.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .embedder import Chunk
from .bm25 import BM25


@dataclass
class StoredChunk:
    id: str
    document_id: str
    text: str
    section: str | None
    metadata: dict


class InMemoryStore:
    def __init__(self, path: str | None = None):
        self.path = Path(path) if path else None
        self.chunks: list[StoredChunk] = []
        self.vectors: list[np.ndarray] = []
        self.documents: dict[str, dict] = {}
        self._bm25: BM25 | None = None
        if self.path and self.path.exists():
            self._load()

    # -- writes --
    def has_document(self, doc_hash: str) -> bool:
        return doc_hash in self.documents

    def add_document(self, doc_hash: str, meta: dict, embedded: list[tuple[Chunk, np.ndarray]]) -> None:
        self.documents[doc_hash] = meta
        for chunk, vec in embedded:
            self.chunks.append(StoredChunk(f"{doc_hash[:16]}:{chunk.index}", doc_hash[:16], chunk.text, chunk.section, dict(chunk.metadata)))
            self.vectors.append(np.asarray(vec, dtype=np.float32))
        self._bm25 = None
        if self.path:
            self._save()

    # -- reads --
    def _filtered(self, filters: dict | None) -> list[int]:
        idx = range(len(self.chunks))
        if not filters:
            return list(idx)
        return [i for i in idx if all(self.chunks[i].metadata.get(k) == v for k, v in filters.items() if v)]

    def vector_search(self, query_vec: np.ndarray, k: int, filters: dict | None = None) -> list[tuple[StoredChunk, float]]:
        ids = self._filtered(filters)
        if not ids:
            return []
        mat = np.stack([self.vectors[i] for i in ids])
        q = np.asarray(query_vec, dtype=np.float32)
        qn = float(np.linalg.norm(q)) or 1.0
        norms = np.linalg.norm(mat, axis=1)
        norms[norms == 0] = 1.0
        sims = (mat @ q) / (norms * qn)
        order = np.argsort(-sims, kind="stable")[:k]
        return [(self.chunks[ids[j]], float(sims[j])) for j in order]

    def keyword_search(self, query: str, k: int, filters: dict | None = None) -> list[tuple[StoredChunk, float]]:
        if self._bm25 is None:
            self._bm25 = BM25([(c.section or "") + " " + c.text for c in self.chunks])
        allowed = set(self._filtered(filters))
        scored = [(i, s) for i, s in self._bm25.scores(query) if i in allowed and s > 0]
        scored.sort(key=lambda x: (-x[1], x[0]))
        return [(self.chunks[i], s) for i, s in scored[:k]]

    def count(self) -> int:
        return len(self.chunks)

    # -- persistence --
    def _save(self) -> None:
        data = {
            "documents": self.documents,
            "chunks": [c.__dict__ for c in self.chunks],
            "vectors": [v.tolist() for v in self.vectors],
        }
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data), encoding="utf-8")
        tmp.replace(self.path)

    def _load(self) -> None:
        data = json.loads(self.path.read_text(encoding="utf-8"))
        self.documents = data["documents"]
        self.chunks = [StoredChunk(**c) for c in data["chunks"]]
        self.vectors = [np.asarray(v, dtype=np.float32) for v in data["vectors"]]


class PgVectorStore:  # pragma: no cover - needs a live Postgres; covered by the gated integration test
    """Supabase Postgres store. Uses the service-role connection string (DATABASE_URL); never expose it to clients."""

    def __init__(self, dsn: str):
        import psycopg  # type: ignore

        self.conn = psycopg.connect(dsn, autocommit=True)

    @staticmethod
    def _vec(v: np.ndarray) -> str:
        return "[" + ",".join(f"{x:.6f}" for x in np.asarray(v, dtype=np.float32)) + "]"

    def has_document(self, doc_hash: str) -> bool:
        with self.conn.cursor() as cur:
            cur.execute("select 1 from public.rag_documents where content_hash = %s", (doc_hash,))
            return cur.fetchone() is not None

    def add_document(self, doc_hash: str, meta: dict, embedded: list[tuple[Chunk, np.ndarray]]) -> None:
        with self.conn.transaction(), self.conn.cursor() as cur:
            cur.execute(
                """insert into public.rag_documents (content_hash, source, title, authority, doc_type, doc_date, url)
                   values (%s, %s, %s, %s, %s, %s, %s) returning id""",
                (doc_hash, meta.get("source"), meta.get("title"), meta.get("authority"), meta.get("doc_type"), meta.get("date"), meta.get("url")),
            )
            doc_id = cur.fetchone()[0]
            for chunk, vec in embedded:
                cur.execute(
                    """insert into public.rag_chunks (document_id, chunk_index, content, section, token_count, metadata, embedding)
                       values (%s, %s, %s, %s, %s, %s, %s::extensions.vector)""",
                    (doc_id, chunk.index, chunk.text, chunk.section, chunk.token_count, json.dumps(chunk.metadata), self._vec(vec)),
                )

    def _rows(self, sql: str, args: tuple) -> list[tuple[StoredChunk, float]]:
        with self.conn.cursor() as cur:
            cur.execute(sql, args)
            return [
                (StoredChunk(str(r[0]), str(r[1]), r[2], r[3], r[4] or {}), float(r[5]))
                for r in cur.fetchall()
            ]

    def vector_search(self, query_vec: np.ndarray, k: int, filters: dict | None = None):
        authority = (filters or {}).get("authority")
        return self._rows(
            """select c.id, c.document_id, c.content, c.section, c.metadata, 1 - (c.embedding <=> %s::extensions.vector) as score
               from public.rag_chunks c join public.rag_documents d on d.id = c.document_id
               where (%s::text is null or d.authority = %s)
               order by c.embedding <=> %s::extensions.vector limit %s""",
            (self._vec(query_vec), authority, authority, self._vec(query_vec), k),
        )

    def keyword_search(self, query: str, k: int, filters: dict | None = None):
        authority = (filters or {}).get("authority")
        return self._rows(
            """select c.id, c.document_id, c.content, c.section, c.metadata,
                      ts_rank_cd(c.fts, websearch_to_tsquery('english', %s)) as score
               from public.rag_chunks c join public.rag_documents d on d.id = c.document_id
               where c.fts @@ websearch_to_tsquery('english', %s) and (%s::text is null or d.authority = %s)
               order by score desc limit %s""",
            (query, query, authority, authority, k),
        )

    def count(self) -> int:
        with self.conn.cursor() as cur:
            cur.execute("select count(*) from public.rag_chunks")
            return int(cur.fetchone()[0])


def get_store():
    dsn = os.environ.get("DATABASE_URL")
    if dsn:  # pragma: no cover
        return PgVectorStore(dsn)
    return InMemoryStore(os.environ.get("RAG_STORE_PATH"))
