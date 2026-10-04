<div align="center">

# ArthaBench Pro

### Financial AI Reliability, Learning & Market Intelligence Platform

**AI-assisted financial reasoning • deterministic calculations • market intelligence • learning workflows • reliability-focused design**

![React](https://img.shields.io/badge/React-19-20232A?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployment-Vercel-000000?logo=vercel)
![Status](https://img.shields.io/badge/Status-Active_Development-orange)

</div>

---

## Overview

**ArthaBench Pro** is an educational and research-focused financial intelligence platform designed to make AI-assisted financial analysis more transparent, structured, and reliability-aware.

The platform combines:

- **AI-assisted financial reasoning** with dual Groq-based evaluation workflows
- **Deterministic financial calculations** for numerical consistency
- **Indian and global market intelligence** through server-side provider adapters
- **Business and financial news** through NewsData.io
- **Learning and evaluation workspaces** for finance-focused exploration
- **Supabase-backed private finance accounts** with immediate email/password signup and user-scoped records
- **Safety and reliability controls** that distinguish live, delayed, unavailable, and demo data
- **Server-side secret handling** so provider credentials are not exposed to the browser

> ArthaBench Pro is an educational and research system. It does **not** provide personalized investment, tax, legal, or accounting advice.

---

## Research

Technical reports on the methods behind the platform ([index](docs/research/README.md)):

| Report | Topic |
|---|---|
| [TR-01 · Certified Financial Arithmetic](docs/research/TR-01-certified-financial-arithmetic.md) | Calculations that return a proven error bound, or no number at all |
| [TR-02 · AI Explains, It Never Calculates](docs/research/TR-02-grounded-financial-advisor.md) | An A–H pipeline where every number is traced and checked |
| [TR-03 · Reproducible Monte Carlo](docs/research/TR-03-reproducible-monte-carlo.md) | Seeded, multi-asset goal-probability simulation |

Cite this work with [`CITATION.cff`](CITATION.cff).

---

## Why ArthaBench Pro?

Financial AI systems can produce fluent answers even when underlying data is stale, incomplete, or inconsistent. ArthaBench Pro is being built around a different principle:

> **Financial intelligence should be explainable, traceable, and explicit about data quality.**

Instead of relying only on an LLM, the platform separates financial calculations, provider data, AI reasoning, and reliability signals into distinct layers.

---

## Core Capabilities

### Market Intelligence
- India-focused market views
- U.S. and global market context
- Market-performance visualizations
- Provider freshness and fallback handling
- Server-side Yahoo Finance / Twelve Data adapters

### Ask Artha AI
- Finance-focused AI interaction
- Structured reasoning workflows
- Dual-model evaluation patterns using Groq
- Reliability-aware responses and educational safety controls

### Financial Learning
- Guided finance-learning workspace
- Concepts, comparisons, and structured exploration
- Educational framing rather than personalized financial advice

### Economic Intelligence
- Economic-rate and macroeconomic comparisons
- Market/economy context modules
- Data-driven visual analysis

### Business News
- NewsData.io-powered financial and business headlines
- Server-side API-key protection
- Explicit fallback behavior when live providers are unavailable

### Reliability & Evaluation
- Separation of deterministic calculations from AI explanations
- Provider diagnostics and health endpoints