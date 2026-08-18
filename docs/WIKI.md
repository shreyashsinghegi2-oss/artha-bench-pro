# ArthaBench Pro — Technical Wiki

> **Purpose:** A professional technical reference for the architecture, data flow, reliability model, security boundaries, modules, deployment, and roadmap of ArthaBench Pro.

## 1. System Overview

ArthaBench Pro is a financial AI reliability, learning, business-news, economic, and market-intelligence platform. Its architecture deliberately separates **live/provider data**, **deterministic financial logic**, **AI reasoning**, and **reliability controls** instead of allowing an LLM to become the source of truth for every operation.

### Architecture at a glance

```mermaid
flowchart TB
    U[User]

    subgraph FE[Frontend — React 19 + TypeScript + Vite]
      UI[ArthaBench Pro UI]
      DASH[Dashboard]
      MARKET[Market Workspace]
      ECON[Economy Workspace]
      NEWS[Business News]
      LEARN[Learning Workspace]
      AIVIEW[Ask Artha AI]
      EVAL[Evaluation / Reliability Views]
    end

    subgraph API[Server / API Layer — Node.js + Express]
      ROUTER[API Routes / Vercel Handler]
      STD[AI Response Standard]
      HEALTH[Health + Diagnostics]
    end

    subgraph CORE[Core Intelligence & Reliability]
      FIN[Deterministic Finance Engine]
      GROQ[Groq Service]
      CONS[Consensus Engine]
      EVID[Evidence Verifier]
      GT[Ground-Truth Evaluator]
      SAFE[Learning Safety]
      BATCH[Batch Benchmark]
    end

    subgraph DATA[Data Services]
      MKT[Market Data Service]
      INDIA[India Market Ticker Service]
      BNEWS[Business News Service]
    end

    subgraph EXT[External Providers]
      GP[Groq Models]
      YF[Yahoo Finance]
      TD[Twelve Data]
      ND[NewsData.io]
    end

    U --> UI
    UI --> DASH & MARKET & ECON & NEWS & LEARN & AIVIEW & EVAL
    DASH & MARKET & ECON & NEWS & LEARN & AIVIEW & EVAL --> ROUTER

    ROUTER --> FIN
    ROUTER --> GROQ
    ROUTER --> MKT
    ROUTER --> INDIA
    ROUTER --> BNEWS
    ROUTER --> HEALTH

    GROQ --> GP
    GROQ --> CONS
    CONS --> EVID
    FIN --> GT
    EVID --> STD
    GT --> STD
    SAFE --> STD
    BATCH --> GT

    MKT --> YF
    MKT --> TD
    INDIA --> YF
    BNEWS --> ND

    STD --> ROUTER
    ROUTER --> UI
```

---

## 2. Core Design Principle

ArthaBench Pro follows a **separation-of-trust** model:

```mermaid
flowchart LR
    A[External Data] --> B[Provider Adapters]
    B --> C[Validation / Freshness Checks]
    C --> D[Deterministic Logic]
    C --> E[AI Reasoning]
    D --> F[Reliability Layer]
    E --> F
    F --> G[Structured Response]
    G --> H[User Interface]
```

The LLM can explain, compare, or reason, but deterministic calculations and provider states remain independently observable.

---

## 3. Major Modules

### Frontend

| Module | Responsibility |
|---|---|
| `src/components/dashboard/` | Main financial intelligence dashboard |
| `src/components/market/` | Market data, charts, ticker and performance views |
| `src/components/economy/` | Macroeconomic and rate-comparison views |
| `src/components/news/` | Financial/business news surfaces |
| `src/components/learning/` | Structured finance-learning workspace |
| `src/components/ai/` | Ask Artha AI experience |
| `src/components/evaluation/` | Reliability/evaluation UI |
| `src/services/` | Client-side service access to the API |
| `src/schemas/` | Frontend validation contracts |

### Server / Intelligence

| File / Module | Responsibility |
|---|---|
| `server/groqService.ts` | Server-side Groq model integration |
| `server/consensusEngine.ts` | Multi-model/independent evaluation logic |
| `server/financeEngine.ts` | Deterministic financial calculations |
| `server/evidenceVerifier.ts` | Evidence-oriented verification |
| `server/groundTruthEvaluator.ts` | Ground-truth and evaluation logic |
| `server/aiResponseStandard.ts` | Standardized AI response structure |
| `server/learningService.ts` | Learning-oriented AI flows |
| `server/learningSafety.ts` | Educational safety controls |
| `server/batchBenchmark.ts` | Batch evaluation / benchmark execution |
| `server/marketDataService.ts` | Market provider abstraction |
| `server/indiaMarketTickerService.ts` | India-market ticker retrieval |
| `server/businessNewsService.ts` | Business-news provider integration |

---

## 4. Ask Artha AI — Request Lifecycle

```mermaid
sequenceDiagram
    actor User
    participant UI as React UI
    participant API as Express API
    participant Fin as Finance Engine
    participant AI as Groq Service
    participant Eval as Consensus / Evidence Layer
    participant Groq as Groq Provider

    User->>UI: Submit financial question
    UI->>API: Validated request
    API->>Fin: Run deterministic checks when applicable
    API->>AI: Request AI reasoning
    AI->>Groq: Server-side model request
    Groq-->>AI: Model response
    AI->>Eval: Independent evaluation / verification
    Fin-->>Eval: Deterministic results
    Eval-->>API: Reliability-aware structured output
    API-->>UI: Answer + status / evidence metadata
    UI-->>User: Render financial explanation
```

### Why this matters

A generated answer can be fluent and still be numerically wrong. By keeping deterministic computation separate from model reasoning, ArthaBench Pro can compare the two instead of trusting language generation blindly.

---

## 5. Market Data Architecture

```mermaid
flowchart LR
    UI[Market UI] --> API[Market API]
    API --> SVC[Market Data Service]
    SVC --> P1[Primary Provider]
    SVC --> P2[Fallback Provider]
    P1 --> Y[Yahoo Finance Adapter]
    P2 --> T[Twelve Data Adapter]
    Y --> N[Normalize Quote]
    T --> N
    N --> F[Freshness / Usability Check]
    F --> R[Provider-labelled Response]
    R --> UI
```

The repository includes provider documentation for Yahoo Finance and a sequential Yahoo → Twelve Data fallback configuration. The fallback path is intended to avoid unnecessary paid/free-tier provider requests when the primary quote is usable.

---

## 6. Business News Flow

```mermaid
flowchart LR
    U[Dashboard / News UI] --> API[Server API]
    API --> B[Business News Service]
    B --> N[NewsData.io]
    N --> B
    B --> V[Normalize + Validate]
    V --> U
```

Provider credentials remain server-side. If the configured provider is unavailable, the application is designed to avoid silently presenting fallback/demo content as verified live data.

---

## 7. Reliability Model

ArthaBench Pro treats reliability as a **system property**, not a single confidence number.

```mermaid
flowchart TB
    INPUT[Question / Market Request]
    INPUT --> SRC[Source / Provider Status]
    INPUT --> NUM[Deterministic Numerical Checks]
    INPUT --> AI[AI Reasoning]
    AI --> CONS[Independent / Consensus Review]
    SRC --> REL[Reliability Decision]
    NUM --> REL
    CONS --> REL
    REL --> OUT[Structured Output]
```

### Reliability signals can include

- Provider availability
- Data freshness / trading-session context
- Deterministic calculation agreement
- Model agreement or disagreement
- Evidence availability
- Safety rules
- Explicit demo/fallback status

---

## 8. Security Boundary

```mermaid
flowchart LR
    subgraph Browser[Browser — Untrusted Client]
      UI[React App]
    end

    subgraph Server[Trusted Server Boundary]
      API[Express / Vercel API]
      ENV[Environment Variables]
      LOGIC[Financial + AI Services]
    end

    subgraph Providers[External Providers]
      G[Groq]
      N[NewsData.io]
      M[Market Providers]
    end

    UI -->|No provider secrets| API
    ENV --> API
    API --> LOGIC
    LOGIC --> G & N & M
```

### Security rules

- Provider secrets are stored only in server-side environment variables.
- Secrets must never use a browser-exposed `VITE_` prefix.
- `.env` files must never be committed.
- Browser responses must never echo provider credentials.
- Provider diagnostics should expose status, not secrets.

---

## 9. Deployment Architecture

```mermaid
flowchart TB
    DEV[Developer]
    GH[GitHub — main branch]
    VC[Vercel]
    FE[Static Frontend]
    FN[Serverless / Node API]
    ENV[Vercel Environment Variables]
    EXT[External Providers]

    DEV --> GH
    GH --> VC
    VC --> FE
    VC --> FN
    ENV --> FN
    FN --> EXT
```

### Verification commands

```bash
npm install
npm run lint
npm test
npm run build
```

Production diagnostics:

```text
GET /api/health
GET /api/diagnostics
```

---

## 10. Repository Structure

```text
artha-bench-pro/
├── api/                     # Vercel/serverless API entry
├── docs/                    # Architecture and provider documentation
├── server/                  # Backend intelligence + provider services
│   ├── financeEngine.ts
│   ├── groqService.ts
│   ├── consensusEngine.ts
│   ├── evidenceVerifier.ts
│   ├── groundTruthEvaluator.ts
│   ├── marketDataService.ts
│   ├── indiaMarketTickerService.ts
│   └── businessNewsService.ts
├── src/
│   ├── components/
│   │   ├── ai/
│   │   ├── dashboard/
│   │   ├── economy/
│   │   ├── evaluation/
│   │   ├── learning/
│   │   ├── market/
│   │   └── news/
│   ├── data/
│   ├── schemas/
│   └── services/
├── tests/
├── server.ts
└── vercel.json
```

---

## 11. Planned Financial RAG Architecture

> This section is a **roadmap design**, not a claim that RAG is already deployed.

```mermaid
flowchart LR
    DOCS[Financial PDFs / Reports / Regulations] --> ING[Ingestion]
    ING --> CLEAN[Extraction + Cleaning]
    CLEAN --> CHUNK[Chunking + Metadata]
    CHUNK --> IDX[Hybrid Search / Vector Index]
    Q[User Question] --> RET[Retrieval]
    IDX --> RET
    RET --> RR[Reranker]
    RR --> LLM[Artha AI Reasoning]
    LLM --> EV[Evidence / Citation Layer]
    EV --> ANS[Grounded Answer]
```

Recommended metadata fields include company, ticker, document type, publication date, financial year, quarter, regulator, source, page number, and document ID.

---

## 12. Project Positioning

ArthaBench Pro is the **product-oriented flagship** in the Artha project family.

- **ArthaBench Pro:** financial intelligence + AI reliability + market/news/economic/learning product
- **Artha Bench:** research-oriented financial AI reliability benchmark
- **FinTrustBench:** trustworthy personal-finance AI benchmarking and comparison platform

See [`PROJECT-ECOSYSTEM.md`](PROJECT-ECOSYSTEM.md) for the cross-project architecture.

---

## 13. Roadmap

- Financial-document RAG with source/page citations
- Larger verified financial corpus
- Stronger provider reliability scoring
- Expanded Indian and U.S. economic datasets
- Richer company and portfolio analysis
- More automated tests and observability
- Reproducible benchmark/evaluation reports

---

## 14. Engineering Philosophy

> **Do not hide uncertainty behind a polished AI answer.**

ArthaBench Pro aims to expose the difference between a calculation, a provider observation, an AI inference, and a fallback state so users and evaluators can understand what the system actually knows.
