import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from rag.embedder import HashingEmbedder  # noqa: E402
from rag.indexer import ingest_text  # noqa: E402
from rag.store import InMemoryStore  # noqa: E402

SEBI_TEXT = """Securities and Exchange Board of India
CIRCULAR
SEBI/HO/IMD/2026/42 dated 12 March 2026
1. Total Expense Ratio of Mutual Fund Schemes
The total expense ratio (TER) charged to a direct plan shall be lower than the regular plan, because no distribution commission is paid in a direct plan.
2. Disclosure
Asset management companies shall disclose the TER of every scheme on their website daily."""

RBI_TEXT = """Reserve Bank of India
Master Direction on Digital Payment Security Controls, 2026-02-18
3. Authentication
Regulated entities shall use additional factor authentication for card-not-present transactions. A UPI PIN is only needed to send money, never to receive it."""

CBDT_TEXT = """Central Board of Direct Taxes, Income-tax Department
Notification No. 18/2026 dated 1 April 2026
Section 87A rebate
Under the new tax regime for tax year 2026-27, a resident individual with taxable income up to Rs 12,00,000 gets a rebate of up to Rs 60,000."""


@pytest.fixture
def embedder():
    return HashingEmbedder()


@pytest.fixture
def corpus(embedder):
    store = InMemoryStore()
    for text, src in [(SEBI_TEXT, "sebi_ter.pdf"), (RBI_TEXT, "rbi_payments.pdf"), (CBDT_TEXT, "cbdt_87a.pdf")]:
        ingest_text(text, src, store, embedder, chunk_tokens=40, overlap_tokens=8)
    return store
