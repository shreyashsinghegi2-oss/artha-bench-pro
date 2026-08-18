# Security Policy

## Reporting a Vulnerability

Please avoid publishing suspected vulnerabilities, leaked credentials, authentication weaknesses, or provider-secret exposure in a public GitHub issue.

For a security report, contact the repository owner through the contact information associated with the GitHub profile and include:

- a clear description of the issue;
- the affected component or endpoint;
- reproduction steps where appropriate;
- the potential impact;
- any suggested mitigation.

Do not include real API keys, access tokens, passwords, or sensitive personal data in the report.

## Credential Handling

ArthaBench Pro is designed so private provider credentials remain server-side.

- Never commit `.env` files containing real secrets.
- Never expose secrets using `VITE_`-prefixed environment variables.
- Rotate any credential that has been pasted into public source code, logs, screenshots, chat messages, or issues.
- Use hosting-platform environment variables for production secrets.

## Financial Data & AI Safety

Security reports may also include issues that could cause the system to:

- falsely label demo data as live;
- expose protected provider responses or credentials;
- bypass authentication or authorization checks;
- silently substitute AI-generated numbers for deterministic calculations;
- disclose internal prompts or sensitive diagnostics;
- accept malicious input that materially changes financial reliability behavior.

## Scope

This is an educational and research project under active development. No bug-bounty or financial reward program is currently offered.
