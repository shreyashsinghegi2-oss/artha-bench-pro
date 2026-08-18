# Contributing to ArthaBench Pro

Thank you for your interest in ArthaBench Pro.

ArthaBench Pro is an educational and research-focused financial AI project. Contributions are welcome when they improve correctness, reliability, accessibility, testing, documentation, or user experience.

## Before You Start

For substantial changes, open an issue first and describe:

- the problem you want to solve;
- the proposed approach;
- any new provider, dependency, or API involved;
- how the change affects financial correctness, safety, or data reliability.

## Development Setup

```bash
npm install
npm run dev
```

Create a local `.env` from `.env.example`. Never commit API keys or other secrets.

## Validation

Before proposing a change, run:

```bash
npm run lint
npm test
npm run build
```

Changes that affect deterministic financial calculations should include or update tests wherever practical.

## Pull Request Guidelines

Keep pull requests focused and explain:

1. What changed.
2. Why it changed.
3. How it was tested.
4. Any impact on providers, data freshness, calculations, AI behavior, or user-facing reliability signals.

Screenshots are encouraged for meaningful interface changes.

## Financial Reliability Principles

Contributions should preserve these project principles:

- Never present demo or fallback data as live market data.
- Keep provider secrets server-side.
- Do not let LLM output silently override deterministic financial calculations.
- Make uncertainty, provider failure, or stale data visible when it materially affects the result.
- Avoid language that presents the project as certified personalized financial advice.

## Code Style

- Prefer clear TypeScript types and small, focused modules.
- Validate external/provider data at application boundaries.
- Keep provider-specific logic isolated from UI components where practical.
- Add comments for financial rules or non-obvious reliability logic, not for self-explanatory code.

## Security Issues

Please do not open a public issue for suspected credential exposure or security vulnerabilities. Follow the process in `SECURITY.md`.
