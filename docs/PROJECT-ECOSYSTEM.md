# Artha Project Ecosystem

This document explains how the three public financial-AI projects relate to each other without presenting them as the same product.

```mermaid
flowchart TB
    AB[Artha Bench\nResearch Reliability Benchmark]
    FTB[FinTrustBench\nTrustworthy Personal-Finance Benchmarking]
    PRO[ArthaBench Pro\nFinancial Intelligence Product]

    AB -->|Evaluation methodology\nfinancial math\nreliability concepts| PRO
    AB -->|Benchmarking principles| FTB
    FTB -->|Scenario comparison\nauthenticated benchmark workflows| PRO

    subgraph SHARED[Shared Engineering Themes]
      SAFE[Safety & Reliability]
      MATH[Deterministic Financial Logic]
      AI[LLM Integration]
      DATA[Financial Data]
      EVAL[Evaluation & Comparison]
    end

    AB --> SAFE & MATH & EVAL
    FTB --> SAFE & AI & EVAL
    PRO --> SAFE & MATH & AI & DATA & EVAL
```

## Project roles

| Project | Primary Role | Core Strength |
|---|---|---|
| **Artha Bench** | Research benchmark | Financial-AI reliability evaluation and deterministic math |
| **FinTrustBench** | Benchmarking platform | Personal-finance scenarios, comparison, auth and structured AI evaluation |
| **ArthaBench Pro** | Flagship product | Market/news/economic intelligence, learning, AI reasoning and reliability-aware UX |

## Evolution model

```mermaid
flowchart LR
    R[Research Question] --> B[Benchmark Method]
    B --> P[Prototype Workflow]
    P --> PROD[Product Feature]
    PROD --> M[Measurement / Evaluation]
    M --> R
```

The projects can therefore be understood as parts of one engineering/research loop:

1. **Artha Bench** explores how reliability can be measured.
2. **FinTrustBench** turns trustworthy-AI evaluation into richer user and comparison workflows.
3. **ArthaBench Pro** applies reliability-aware ideas inside a broader financial intelligence product.
4. Product observations can generate new benchmark questions and research directions.

## Architectural comparison

```mermaid
flowchart LR
    subgraph AB[Artha Bench]
      ABUI[Evaluation UI] --> ABM[Finance Math]
      ABUI --> ABE[AI Evaluation]
      ABM --> ABS[Scoring]
      ABE --> ABS
    end

    subgraph FTB[FinTrustBench]
      FUI[Benchmark UI] --> AUTH[Firebase Auth]
      FUI --> FAPI[Express API]
      FAPI --> MIS[Mistral]
      FAPI --> FH[History / Results]
    end

    subgraph PRO[ArthaBench Pro]
      PUI[Financial Intelligence UI] --> PAPI[API Layer]
      PAPI --> PFIN[Finance Engine]
      PAPI --> PG[Groq]
      PAPI --> PM[Market Providers]
      PAPI --> PN[News Provider]
      PFIN & PG & PM & PN --> PREL[Reliability Layer]
    end
```

## Long-term direction

The strongest long-term architecture is not to merge every repository into one monolith. Instead, each repo can preserve a clear identity while sharing tested concepts, schemas, evaluation methods, or packages when those abstractions become stable enough to extract.

Potential future shared packages:

- financial formulas / deterministic math
- reliability scoring schemas
- benchmark scenario format
- provider-status / freshness types
- citation/evidence contracts
- common evaluation metrics

## Planned knowledge layer

ArthaBench Pro's planned financial-document RAG can eventually create a new feedback path into the research projects:

```mermaid
flowchart LR
    DOCS[Financial Corpus] --> RAG[Artha RAG]
    RAG --> ANSWER[Grounded AI Answer]
    ANSWER --> BENCH[Artha Bench Evaluation]
    ANSWER --> TRUST[FinTrustBench Scenarios]
    BENCH & TRUST --> IMPROVE[Improve Product Reliability]
    IMPROVE --> RAG
```

This keeps the product, benchmark, and trust-testing layers connected while retaining clear responsibilities.
