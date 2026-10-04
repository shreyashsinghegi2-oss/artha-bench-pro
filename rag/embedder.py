"""
Chunking and embedding.

Chunks are built on token boundaries (512 tokens, 64-token overlap by default) and always cut from the
original text, so a chunk is an exact substring of its document and can be quoted as a citation.

Tokens are counted with a regex tokenizer (words, numbers and single punctuation marks) by default, or with
`tiktoken` (cl100k_base) when RAG_TOKENIZER=tiktoken and it is installed. The regex count is close to, but not exactly, a model's
BPE count; the 512 budget leaves headroom for that.

Embedders:
  - HashingEmbedder: deterministic, dependency-free (feature hashing of unigrams and bigrams). Used in
    tests and as a fallback so the pipeline never hard-fails.
  - SentenceTransformerEmbedder: nomic-embed-text v1.5 (768 dims, default) or BGE via sentence-transformers.
"""
from __future__ import annotations

import hashlib
import math
import os
import re
from dataclasses import dataclass, field
from typing import Iterable, Protocol, Sequence

import numpy as np

DEFAULT_CHUNK_TOKENS = 512
DEFAULT_OVERLAP_TOKENS = 64
EMBEDDING_DIM = 768  # must match the vector(768) column in the Supabase migration

_TOKEN_RE = re.compile(r"\w+|[^\w\s]", re.UNICODE)
_HEADING_RE = re.compile(
    r"^\s*(?:(?:chapter|part|section|schedule|annexure|regulation|clause|rule)\s+[\w.()-]+.*"
    r"|\d{1,2}(?:\.\d{1,2}){0,3}\.?\s+[A-Z][^\n]{2,80}"
    r"|[A-Z][A-Z0-9 ,&()/-]{4,80})\s*$",
    re.IGNORECASE | re.MULTILINE,
)


@dataclass
class Chunk:
    text: str
    index: int
    start_char: int
    end_char: int
    token_count: int
    section: str | None = None
    metadata: dict = field(default_factory=dict)

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.text.encode("utf-8")).hexdigest()


def token_spans(text: str) -> list[tuple[int, int]]:
    """Character spans of tokens: the regex tokenizer, or tiktoken when RAG_TOKENIZER=tiktoken and it is installed."""
    if os.environ.get("RAG_TOKENIZER") != "tiktoken":
        return [m.span() for m in _TOKEN_RE.finditer(text)]
    try:  # pragma: no cover - exercised only when tiktoken is installed
        import tiktoken  # type: ignore

        enc = tiktoken.get_encoding("cl100k_base")
        spans, pos = [], 0
        for tok in enc.encode(text):
            piece = enc.decode([tok])
            start = text.find(piece, pos) if piece else pos
            if start < 0:
                start = pos
            end = start + len(piece)
            spans.append((start, end))
            pos = end
        return spans
    except Exception:
        return [m.span() for m in _TOKEN_RE.finditer(text)]


def count_tokens(text: str) -> int:
    return len(token_spans(text))


def find_sections(text: str) -> list[tuple[int, str]]:
    """(char offset, heading) for lines that look like headings, in order."""
    out = []
    for m in _HEADING_RE.finditer(text):
        heading = m.group(0).strip()
        if 3 <= len(heading) <= 90 and not heading.endswith((",", ";")):
            out.append((m.start(), heading))
    return out


def chunk_text(
    text: str,
    metadata: dict | None = None,
    chunk_tokens: int = DEFAULT_CHUNK_TOKENS,
    overlap_tokens: int = DEFAULT_OVERLAP_TOKENS,
) -> list[Chunk]:
    """Split text into overlapping token windows. Each chunk records its section heading and metadata."""
    if chunk_tokens <= 0:
        raise ValueError("chunk_tokens must be positive")
    if overlap_tokens < 0 or overlap_tokens >= chunk_tokens:
        raise ValueError("overlap_tokens must be >= 0 and smaller than chunk_tokens")
    if not text or not text.strip():
        return []

    spans = token_spans(text)
    if not spans:
        return []
    sections = find_sections(text)
    step = chunk_tokens - overlap_tokens
    chunks: list[Chunk] = []
    start_tok = 0
    while start_tok < len(spans):
        end_tok = min(start_tok + chunk_tokens, len(spans))
        start_char, end_char = spans[start_tok][0], spans[end_tok - 1][1]
        section = None
        for offset, heading in sections:
            if offset <= start_char:
                section = heading
            else:
                break
        chunks.append(
            Chunk(
                text=text[start_char:end_char],
                index=len(chunks),
                start_char=start_char,
                end_char=end_char,
                token_count=end_tok - start_tok,
                section=section,
                metadata=dict(metadata or {}),
            )
        )
        if end_tok == len(spans):
            break
        start_tok += step
    return chunks


class Embedder(Protocol):
    dim: int

    def embed_documents(self, texts: Sequence[str]) -> np.ndarray: ...

    def embed_query(self, text: str) -> np.ndarray: ...


def _normalise(mat: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return mat / norms


class HashingEmbedder:
    """Feature-hashed unigrams + bigrams, L2-normalised. Deterministic across runs and machines."""

    def __init__(self, dim: int = EMBEDDING_DIM):
        self.dim = dim

    def _vec(self, text: str) -> np.ndarray:
        v = np.zeros(self.dim, dtype=np.float32)
        words = [w.lower() for w in re.findall(r"\w+", text, re.UNICODE)]
        feats = words + [f"{a}_{b}" for a, b in zip(words, words[1:])]
        for f in feats:
            h = int.from_bytes(hashlib.blake2b(f.encode("utf-8"), digest_size=8).digest(), "little")
            v[h % self.dim] += 1.0 if (h >> 63) & 1 == 0 else -1.0
        return v

    def embed_documents(self, texts: Sequence[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)
        return _normalise(np.stack([self._vec(t) for t in texts]))

    def embed_query(self, text: str) -> np.ndarray:
        return self.embed_documents([text])[0]


class SentenceTransformerEmbedder:  # pragma: no cover - needs model weights
    """nomic-embed-text v1.5 (default) or BGE through sentence-transformers, with the prefixes each model expects."""

    PREFIXES = {
        "nomic": ("search_document: ", "search_query: "),
        "bge": ("", "Represent this sentence for searching relevant passages: "),
    }

    def __init__(self, model_name: str = "nomic-ai/nomic-embed-text-v1.5", batch_size: int = 32):
        from sentence_transformers import SentenceTransformer  # type: ignore

        self.model = SentenceTransformer(model_name, trust_remote_code=True)
        self.dim = int(self.model.get_sentence_embedding_dimension())
        family = "nomic" if "nomic" in model_name else "bge" if "bge" in model_name else ""
        self.doc_prefix, self.query_prefix = self.PREFIXES.get(family, ("", ""))
        self.batch_size = batch_size
        if self.dim != EMBEDDING_DIM:
            raise ValueError(
                f"{model_name} produces {self.dim}-dim vectors but the pgvector column is vector({EMBEDDING_DIM}); "
                "use a 768-dim model (nomic-embed-text, bge-base) or migrate the column."
            )

    def embed_documents(self, texts: Sequence[str]) -> np.ndarray:
        vecs = self.model.encode([self.doc_prefix + t for t in texts], batch_size=self.batch_size, normalize_embeddings=True)
        return np.asarray(vecs, dtype=np.float32)

    def embed_query(self, text: str) -> np.ndarray:
        return np.asarray(self.model.encode([self.query_prefix + text], normalize_embeddings=True)[0], dtype=np.float32)


def get_embedder(name: str | None = None) -> Embedder:
    """RAG_EMBEDDER = hashing | nomic | bge-base | <any sentence-transformers id>. Falls back to hashing."""
    name = (name or os.environ.get("RAG_EMBEDDER") or "hashing").strip()
    if name == "hashing":
        return HashingEmbedder()
    model = {"nomic": "nomic-ai/nomic-embed-text-v1.5", "bge-base": "BAAI/bge-base-en-v1.5"}.get(name, name)
    try:  # pragma: no cover
        return SentenceTransformerEmbedder(model)
    except Exception as exc:  # pragma: no cover
        print(f"[rag] embedder {model!r} unavailable ({exc}); using hashing embedder")
        return HashingEmbedder()


def embed_chunks(chunks: Iterable[Chunk], embedder: Embedder, batch_size: int = 64) -> list[tuple[Chunk, np.ndarray]]:
    items = list(chunks)
    out: list[tuple[Chunk, np.ndarray]] = []
    for i in range(0, len(items), batch_size):
        batch = items[i : i + batch_size]
        vecs = embedder.embed_documents([(c.section + "\n" if c.section else "") + c.text for c in batch])
        out.extend(zip(batch, vecs))
    return out


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = float(np.linalg.norm(a)), float(np.linalg.norm(b))
    if na == 0 or nb == 0 or math.isnan(na) or math.isnan(nb):
        return 0.0
    return float(np.dot(a, b) / (na * nb))
