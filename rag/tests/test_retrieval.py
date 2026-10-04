import numpy as np
import pytest

from rag.bm25 import BM25, tokenize
from rag.retriever import HybridRetriever, LexicalReranker, rrf_fuse
from rag.store import InMemoryStore, StoredChunk


def test_bm25_prefers_documents_with_rare_query_terms():
    bm = BM25(["repo rate unchanged by RBI", "mutual fund expense ratio", "rate of interest on savings"])
    scores = dict(bm.scores("repo rate"))
    assert scores[0] > scores[2] > scores[1] == 0


def test_tokenize_drops_stopwords_and_lowercases():
    assert tokenize("The Repo Rate of the RBI") == ["repo", "rate", "rbi"]


def test_rrf_matches_formula():
    fused = rrf_fuse([["a", "b", "c"], ["b", "a"]], k=60)
    assert fused["a"] == pytest.approx(1 / 61 + 1 / 62)
    assert fused["b"] == pytest.approx(1 / 62 + 1 / 61)
    assert fused["c"] == pytest.approx(1 / 63)


def test_rrf_rewards_agreement_between_retrievers():
    fused = rrf_fuse([["x", "both"], ["y", "both"]], k=60)
    assert fused["both"] > fused["x"] and fused["both"] > fused["y"]


class FakeEmbedder:
    """Mock embeddings: fixed vectors per keyword, so vector ranking is fully controlled by the test."""
    dim = 3
    table = {"alpha": [1, 0, 0], "beta": [0, 1, 0], "gamma": [0, 0, 1]}

    def _v(self, text):
        for k, v in self.table.items():
            if k in text:
                return np.array(v, dtype=np.float32)
        return np.array([0.1, 0.1, 0.1], dtype=np.float32)

    def embed_documents(self, texts):
        return np.stack([self._v(t) for t in texts])

    def embed_query(self, text):
        return self._v(text)


def make_store():
    store = InMemoryStore()
    chunks = [("c1", "alpha document about tax rebate"), ("c2", "beta document about repo rate"), ("c3", "gamma document about expense ratio")]
    for cid, text in chunks:
        store.chunks.append(StoredChunk(cid, "d", text, None, {"authority": "SEBI" if cid == "c3" else "RBI"}))
        store.vectors.append(FakeEmbedder()._v(text))
    return store


def test_vector_search_top_k_with_mock_embeddings():
    hits = make_store().vector_search(np.array([0, 1, 0], dtype=np.float32), k=2)
    assert [c.id for c, _ in hits][0] == "c2" and len(hits) == 2


def test_hybrid_retrieval_returns_top_k_with_citations_in_order():
    r = HybridRetriever(make_store(), FakeEmbedder(), LexicalReranker(), candidates=20)
    results = r.retrieve("beta repo rate", top_k=2)
    assert [x.chunk.id for x in results][0] == "c2"
    assert [x.citation for x in results] == [1, 2]
    assert results[0].vector_rank == 1 and results[0].keyword_rank == 1


def test_filters_restrict_by_authority():
    r = HybridRetriever(make_store(), FakeEmbedder())
    results = r.retrieve("document", top_k=5, filters={"authority": "SEBI"})
    assert [x.chunk.id for x in results] == ["c3"]


def test_empty_query_and_empty_store_return_nothing():
    r = HybridRetriever(make_store(), FakeEmbedder())
    assert r.retrieve("   ") == []
    assert HybridRetriever(InMemoryStore(), FakeEmbedder()).retrieve("anything") == []


def test_keyword_only_match_is_still_found_via_fusion():
    # Query vector points at "gamma", but the words match c1 only: fusion must still surface c1.
    r = HybridRetriever(make_store(), FakeEmbedder())
    ids = [x.chunk.id for x in r.retrieve("gamma tax rebate", top_k=3)]
    assert "c1" in ids and "c3" in ids


def test_real_corpus_answers_each_authority(corpus, embedder):
    r = HybridRetriever(corpus, embedder)
    assert r.retrieve("rebate section 87A new regime", top_k=1)[0].chunk.metadata["authority"] == "CBDT"
    assert r.retrieve("total expense ratio direct plan", top_k=1)[0].chunk.metadata["authority"] == "SEBI"
    assert r.retrieve("UPI PIN receive money", top_k=1)[0].chunk.metadata["authority"] == "RBI"
