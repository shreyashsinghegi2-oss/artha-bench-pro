# Official documents for the search index

Some official sites (incometaxindia.gov.in) refuse downloads from servers, so the index workflow cannot fetch
them. Download them in your browser and commit them here with these exact names:

| File | Download from |
| --- | --- |
| `income-tax-act-2025.pdf` | https://www.incometaxindia.gov.in/documents/d/guest/income_tax_act_2025_as_amended_by_fa_act_2026-pdf |
| `finance-act-2026.pdf` | https://www.incometaxindia.gov.in/documents/d/guest/finance-act-2026-pdf-1 |

Pushing a file here re-runs the "RAG index" workflow, which rebuilds `rag/index/official-index.json`.
To add another document, put it here and add an entry with `"path"` to `rag/sources.json`.
