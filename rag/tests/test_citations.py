from rag.retriever import HybridRetriever, build_context, extract_citations


def top(corpus, embedder, q="rebate 87A new regime"):
    return HybridRetriever(corpus, embedder).retrieve(q, top_k=3)


def test_context_numbers_passages_and_names_sources(corpus, embedder):
    results = top(corpus, embedder)
    ctx = build_context(results)
    assert ctx.startswith("OFFICIAL DOCUMENTS")
    for r in results:
        assert f"[{r.citation}]" in ctx
    assert "CBDT" in ctx


def test_empty_results_give_empty_context():
    assert build_context([]) == ""


def test_extract_valid_invalid_and_grouped_citations(corpus, embedder):
    results = top(corpus, embedder)
    out = extract_citations("Rebate is Rs 60,000 [1]. See also [1, 2] and [9].", results)
    assert [c["citation"] for c in out["cited"]] == [1, 2]
    assert out["invalid"] == [9]
    assert out["uncited_answer"] is False
    assert out["cited"][0]["authority"] == "CBDT"


def test_answer_without_citations_is_flagged(corpus, embedder):
    out = extract_citations("No sources here.", top(corpus, embedder))
    assert out["cited"] == [] and out["uncited_answer"] is True


def test_long_chunks_are_truncated_in_context(corpus, embedder):
    results = top(corpus, embedder)
    results[0].chunk.text = "x" * 5000
    assert "x" * 1800 + " …" in build_context(results)
