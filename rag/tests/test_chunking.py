import pytest

from rag.embedder import DEFAULT_CHUNK_TOKENS, DEFAULT_OVERLAP_TOKENS, HashingEmbedder, chunk_text, count_tokens, embed_chunks, find_sections


def words(n: int) -> str:
    return " ".join(f"w{i}" for i in range(n))


def test_defaults_are_512_and_64():
    assert (DEFAULT_CHUNK_TOKENS, DEFAULT_OVERLAP_TOKENS) == (512, 64)


@pytest.mark.parametrize("text", ["", "   ", "\n\n\t"])
def test_empty_documents_give_no_chunks(text):
    assert chunk_text(text) == []


def test_short_document_is_one_chunk_equal_to_the_text():
    chunks = chunk_text("RBI keeps the repo rate unchanged.")
    assert len(chunks) == 1
    assert chunks[0].text == "RBI keeps the repo rate unchanged."
    assert chunks[0].token_count == count_tokens(chunks[0].text)


def test_exactly_one_window_has_no_second_chunk():
    chunks = chunk_text(words(512))
    assert len(chunks) == 1 and chunks[0].token_count == 512


def test_one_token_over_the_window_starts_a_second_overlapping_chunk():
    chunks = chunk_text(words(513))
    assert [c.token_count for c in chunks] == [512, 65]
    assert chunks[1].text.split()[0] == "w448"  # 512 - 64


def test_overlap_is_exactly_64_tokens_between_neighbours():
    chunks = chunk_text(words(2000))
    for a, b in zip(chunks, chunks[1:]):
        assert a.text.split()[-64:] == b.text.split()[:64]


def test_very_long_document_chunk_count_and_full_coverage():
    n = 50_000
    chunks = chunk_text(words(n))
    step = 512 - 64
    assert len(chunks) == 1 + -(-(n - 512) // step)
    assert chunks[0].start_char == 0 and chunks[-1].text.split()[-1] == f"w{n - 1}"
    assert all(c.token_count <= 512 for c in chunks)
    assert [c.index for c in chunks] == list(range(len(chunks)))


def test_chunks_are_exact_substrings_of_the_source():
    text = "Section 80C.\nDeduction up to Rs 1,50,000 — for PPF, ELSS & EPF.\n" * 200
    for c in chunk_text(text, chunk_tokens=50, overlap_tokens=10):
        assert text[c.start_char:c.end_char] == c.text


def test_metadata_is_copied_not_shared():
    meta = {"authority": "SEBI"}
    chunks = chunk_text(words(1200), meta)
    chunks[0].metadata["authority"] = "changed"
    assert chunks[1].metadata["authority"] == "SEBI" and meta["authority"] == "SEBI"


def test_section_heading_is_attached_to_following_chunks():
    text = "1. Introduction\n" + words(100) + "\n2. Disclosure Norms\n" + words(100)
    chunks = chunk_text(text, chunk_tokens=40, overlap_tokens=5)
    assert chunks[0].section == "1. Introduction"
    assert chunks[-1].section == "2. Disclosure Norms"


def test_find_sections_detects_common_heading_styles():
    text = "CHAPTER II\nbody\nSection 87A rebate\nbody\n3.1 Eligibility Criteria\nbody"
    assert [h for _, h in find_sections(text)] == ["CHAPTER II", "Section 87A rebate", "3.1 Eligibility Criteria"]


def test_non_ascii_hindi_text_is_chunked():
    text = "भारतीय रिज़र्व बैंक ने रेपो दर में कोई बदलाव नहीं किया। " * 100
    chunks = chunk_text(text, chunk_tokens=64, overlap_tokens=8)
    assert len(chunks) > 1 and all(c.text.strip() for c in chunks)


@pytest.mark.parametrize("size,overlap", [(0, 0), (-5, 0), (10, 10), (10, 11), (10, -1)])
def test_invalid_parameters_raise(size, overlap):
    with pytest.raises(ValueError):
        chunk_text("text", chunk_tokens=size, overlap_tokens=overlap)


def test_content_hash_is_stable():
    a, b = chunk_text("same text"), chunk_text("same text")
    assert a[0].content_hash == b[0].content_hash


def test_hashing_embedder_is_normalised_and_deterministic():
    e = HashingEmbedder()
    v1, v2 = e.embed_query("repo rate"), HashingEmbedder().embed_query("repo rate")
    assert v1.shape == (768,)
    assert abs(float((v1 ** 2).sum()) - 1.0) < 1e-5
    assert (v1 == v2).all()


def test_embed_chunks_batches_preserve_order():
    chunks = chunk_text(words(3000), chunk_tokens=100, overlap_tokens=10)
    out = embed_chunks(chunks, HashingEmbedder(), batch_size=7)
    assert [c.index for c, _ in out] == [c.index for c in chunks]
    assert HashingEmbedder().embed_documents([]).shape == (0, 768)
