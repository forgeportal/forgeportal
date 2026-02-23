# Security Policy

## Supported Versions

We actively maintain security fixes for the following releases:

| Version | Supported |
|---------|-----------|
| `main` (latest) | Yes |
| Older releases | No |

ForgePortal is currently in active V1 development. Once versioned releases are published, this table will be updated accordingly.

---

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Disclosing a vulnerability publicly before a fix is available puts all ForgePortal deployments at risk.

### How to Report

Send a detailed report by email to:

**ahmed.b.daamer@gmail.com**

Include the following in your report:

1. **Description** — what the vulnerability is and which component is affected.
2. **Impact** — who is affected and what an attacker could achieve.
3. **Reproduction steps** — a minimal, step-by-step scenario to trigger the issue.
4. **Environment** — ForgePortal version or commit SHA, OS, Node.js version, Docker version.
5. **Suggested fix** — optional but appreciated if you have one.
6. **Your contact details** — so we can follow up and credit you.

You may encrypt your report using PGP if you prefer. Contact us first to exchange keys.

---

## Response Timeline

| Stage | Target time |
|-------|-------------|
| Acknowledgement | Within 48 hours |
| Initial triage & severity assessment | Within 5 business days |
| Fix or workaround delivered | Within 30 days for critical/high severity |
| Public disclosure | After a fix is released, coordinated with the reporter |

---

## Scope

The following are **in scope** for security reports:

- **API server** (`apps/api`) — authentication bypass, privilege escalation, injection, SSRF, CSRF, secret leakage.
- **Worker** (`apps/worker`) — arbitrary code execution via action runner, path traversal in scaffolder.
- **UI** (`apps/ui`) — XSS, CSRF, clickjacking, insecure data exposure.
- **SCM providers** (`packages/catalog`) — webhook spoofing, token leakage, SSRF via user-supplied URLs.
- **Plugin system** — sandbox escape, privilege escalation via malicious plugin manifests.
- **Helm chart / Docker images** — insecure defaults, secrets in environment variables.

The following are **out of scope**:

- Vulnerabilities in third-party dependencies that are already publicly known (open a regular issue to track upgrades).
- Theoretical attacks with no demonstrated impact.
- Findings from automated scanners without manual verification.
- Denial of service attacks requiring significant resources beyond normal traffic patterns.

---

## Threat Model

ForgePortal's V1 threat model (T1–T9) is documented internally in the project's security specification. Key mitigations include:

- OIDC authentication with secure sessions (`@fastify/secure-session`)
- CSRF protection (`@fastify/csrf-protection`)
- Role-Based Access Control (RBAC) with `platform-admin`, `org-admin`, and `developer` roles
- Webhook HMAC signature verification
- Sanitised Markdown rendering (`rehype-sanitize`, GitHub schema)
- Path traversal guards on all file-serving endpoints
- Rate limiting on webhooks, action runs, and search
- HTTP security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Secret redaction in structured logs (pino)

---

## Disclosure Policy

We follow a **coordinated disclosure** model:

1. Reporter submits the vulnerability privately.
2. We acknowledge, triage, and develop a fix.
3. We release the fix and notify the reporter.
4. We publish a security advisory (GitHub Security Advisories) with credit to the reporter if they wish.
5. We request a minimum 90-day embargo from the initial report date for critical issues.

We will not take legal action against good-faith security researchers who follow this policy.

---

## Credits

We publicly credit researchers who responsibly disclose vulnerabilities once a fix has been released. Thank you for helping keep ForgePortal secure.
