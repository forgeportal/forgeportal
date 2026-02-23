# security-considerations.md — Threat Model & Mitigations (ForgePortal V1)

This document defines **security threats** and **required mitigations** for ForgePortal V1.
It complements `provider-token-strategy.md` and is aligned with best practices around token handling and least-privilege access for GitHub/GitLab integrations. GitHub explicitly warns that classic PATs are “like passwords” and should be protected/limited; prefer more secure alternatives when possible. ([docs.github.com](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token?utm_source=chatgpt.com))

---

## 1) Security Objectives (V1)

1) **Protect SCM credentials and prevent unauthorized repository modifications**
2) **Ensure actions are permissioned, auditable, and non-repudiable**
3) **Prevent data leakage through logs, UI, APIs, and webhooks**
4) **Provide safe-by-default deployment configurations for docker-compose and Kubernetes**
5) **Minimize blast radius (least privilege, scoped integrations, controlled actions)**

---

## 2) Trust Boundaries

### 2.1 External systems
- GitHub / GitLab APIs (SCM)
- OIDC Identity Provider (e.g., Keycloak)
- (Optional) CI systems, Kubernetes clusters (V2)

### 2.2 Internal boundaries
- Browser (untrusted) ↔ UI
- UI ↔ API (trusted only with auth)
- API ↔ Worker (trusted but authenticated/authorized)
- API/Worker ↔ Postgres (trusted network only)

### 2.3 Secret boundary
- Secrets must never cross to:
  - client/browser
  - logs
  - templates/action outputs
- Secrets should exist only in:
  - server runtime memory
  - secret store (K8s Secret / Docker secret)
  - encrypted-at-rest storage if used (avoid storing raw tokens in DB in V1)

---

## 3) Threat Model (Top risks)

### T1 — Token leakage (SCM credentials)
**Attack**: tokens exposed via logs, error payloads, UI, DB dumps, misconfigured secrets.  
**Impact**: attacker modifies repos, injects CI, exfiltrates code.

**Mitigations (required)**
- Never store raw tokens in DB; store only `secret_ref` and keep secret in K8s Secret / Docker secret.
- Redact secrets from logs (request logs + action logs + uncaught exception / error dumps).
- Disable “echo inputs” for action steps that may include secrets.
- Apply least privilege and prefer GitHub App/fine-grained tokens where possible (GitHub recommends considering more secure methods than classic PATs). ([docs.github.com](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token?utm_source=chatgpt.com))
- Token scopes:
  - GitHub: do not grant `workflow` unless you must write `.github/workflows/*`. ([docs.github.com](https://docs.github.com/fr/rest/repos/contents?utm_source=chatgpt.com))
  - GitLab: avoid broad `api` scope unless required by the implementation path. ([docs.gitlab.com](https://docs.gitlab.com/user/profile/personal_access_tokens/?utm_source=chatgpt.com))

---

### T2 — Unauthorized action execution (“Fix” buttons used maliciously)
**Attack**: low-privilege user triggers actions that create repos, open PRs, change CI, etc.  
**Impact**: supply-chain risk, repo pollution, privilege escalation.

**Mitigations (required)**
- Enforce **server-side authorization** for every action run (never trust UI).
- Permissions model:
  - action-level permission (`action:run`) + scope checks (repo/org/team/entity).
- Require approval gate for high-risk actions (optional V1 setting):
  - `scm.createRepo`
  - writing `.github/workflows/*`
  - webhook creation
- All actions must write immutable audit log with actor + repo + PR/MR link.

Backstage’s approach of authorizing scaffolder templates provides a validated model for step authorization. ([backstage.io](https://backstage.io/docs/next/features/software-templates/authorizing-scaffolder-template-details?utm_source=chatgpt.com))

---

### T3 — SSRF via integrations (webhooks, docs fetch, remote URLs)
**Attack**: attacker makes ForgePortal fetch internal URLs (metadata, docs, webhooks).  
**Impact**: internal network scanning, data exfiltration.

**Mitigations (required)**
- Strict allowlist for outbound HTTP destinations:
  - GitHub/GitLab base URLs only (configurable allowlist).
- Deny private ranges by default (RFC1918 + metadata IPs) unless explicitly allowed.
- When rendering docs, do not fetch remote resources server-side.

---

### T4 — Webhook spoofing / replay
**Attack**: attacker sends forged webhook events to trigger ingestion/actions.  
**Impact**: catalog poisoning, false updates, potential chained actions.

**Mitigations (required)**
- Verify webhook signatures:
  - GitHub supports webhook signature verification (HMAC secret per webhook).
  - GitLab supports webhook secret tokens for verification.
- Reject events missing valid signature.
- Use replay protection (timestamp window + event-id dedupe).
- Webhook endpoint must be rate-limited.

---

### T5 — Supply-chain injection (templates / skeleton content)
**Attack**: malicious template adds backdoors, insecure CI steps, secret exfiltration.  
**Impact**: compromised downstream services.

**Mitigations (required)**
- Template editing restricted to `template-admin`.
- Store templates in a controlled repo and require code review.
- Provide signed template bundles (V2), but in V1:
  - at least restrict template write permissions + audit all changes.
- CI bootstrap must be minimal and not include curl-from-internet or secret printing.

Backstage templates validate that templates can write files and publish repos; this is why governance must exist. ([backstage.io](https://backstage.io/docs/features/software-templates/?utm_source=chatgpt.com))

---

### T6 — XSS / content injection via Markdown docs
**Attack**: attacker commits Markdown containing script injection.  
**Impact**: session theft, actions triggered via CSRF-like flows.

**Mitigations (required)**
- Sanitize Markdown output:
  - Disallow raw HTML or sanitize to safe subset.
- Set strict Content Security Policy (CSP):
  - no `unsafe-inline` scripts if possible
- Render external links safely (rel=noopener).

Backstage TechDocs architecture emphasizes security by serving static docs and stripping active content where appropriate; treat docs as untrusted. ([backstage.io](https://backstage.io/docs/next/features/techdocs/architecture/?utm_source=chatgpt.com))

---

### T7 — CSRF / session hijacking
**Attack**: malicious site triggers authenticated actions via user’s session.  
**Impact**: unintended PRs, webhook changes, repo writes.

**Mitigations (required)**
- Use httpOnly secure cookies for sessions + CSRF tokens (if cookie-based auth).
- SameSite=strict or lax (prefer strict if feasible).
- For state-changing endpoints, require:
  - CSRF token
  - and/or double-submit cookie
  - and/or custom header `X-ForgePortal-Action: ...`

---

### T8 — Sensitive data exposure (PII, internal URLs, repo metadata)
**Attack**: entity pages leak internal links, on-call numbers, etc.  
**Impact**: privacy / security incident.

**Mitigations (required)**
- Classify fields:
  - public vs internal
- Apply RBAC by entity/team and optionally field-level redaction for certain links.
- Avoid exposing integration configs and tokens in UI responses.

---

### T9 — DoS via scanning / indexing / action queue
**Attack**: heavy repo scanning or repeated action runs overload services.  
**Impact**: platform unavailable.

**Mitigations (required)**
- Rate limit:
  - webhook endpoint
  - action runs per user per minute
- Queue with concurrency controls for worker:
  - max active runs
  - per-repo lock to reduce conflicts
- Caching for scorecards and repo file existence checks (TTL).

---

## 4) Required Security Controls (V1 checklist)

### 4.1 AuthN/AuthZ
- OIDC login (server-side verification)
- Roles: platform-admin, template-admin, team-admin, developer, viewer
- Policy checks server-side for:
  - reading entities
  - editing entities
  - running actions
  - managing templates/integrations

### 4.2 Logging & Auditing
- Log redaction mandatory:
  - tokens, secrets, Authorization header, webhook secret
- Audit log for:
  - every action run request + result
  - every integration change
  - every template change

### 4.3 Secrets management
- docker-compose: docker secrets preferred; `.env` allowed only for local dev
- Kubernetes: Secrets mounted; never hardcoded
- Rotation policy: enforce expiration for PATs where used; GitHub encourages expirations and warns PATs are sensitive like passwords. ([docs.github.com](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token?utm_source=chatgpt.com))

### 4.4 Webhook security
- Signature verification (reject invalid)
- Dedupe by event id
- Rate limit

### 4.5 Docs rendering security
- Markdown sanitization
- CSP headers
- No server-side fetching of remote resources

### 4.6 Dependency and container security
- Pin dependencies and enable SCA scanning in CI (V2)
- Minimal container images, non-root user
- Network policies in K8s (V2)

---

## 5) “High-risk actions” policy (recommended defaults)

Mark these actions as “high-risk” and require elevated role or approval:
- `scm.createRepo@v1`
- `scm.ensureWebhook@v1`
- `ci.bootstrap@v1` when it writes `.github/workflows/*` (needs extra permission). ([docs.github.com](https://docs.github.com/fr/rest/repos/contents?utm_source=chatgpt.com))

---

## 6) Secure-by-default implementation notes (for the agent)

### 6.1 HTTP hardening
- Set security headers:
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `X-Frame-Options: DENY` (or CSP frame-ancestors)

### 6.2 Input validation
- Validate repo owner/name against safe regex
- Reject paths with `..` or absolute path in file actions
- Max file size limits for docs/indexing

### 6.3 SCM write safety
- Prefer PR/MR-based changes (reviewable)
- Avoid direct writes to main branch except in “Create new service” flows (configurable)

### 6.4 Least privilege reminder
- GitHub workflow writes require extra “workflow” permission for classic tokens or Workflows write for App/fine-grained tokens. ([docs.github.com](https://docs.github.com/fr/rest/repos/contents?utm_source=chatgpt.com))
- GitLab PAT scopes are powerful; ensure expiration and minimal necessary scopes. ([docs.gitlab.com](https://docs.gitlab.com/user/profile/personal_access_tokens/?utm_source=chatgpt.com))

---

## 7) Security acceptance criteria (V1)

1) No token appears in:
   - API logs
   - action logs
   - UI responses
2) Webhooks rejected if signature invalid
3) Unauthorized users cannot execute any action
4) Docs renderer blocks scripts / unsafe HTML
5) Every action run produces an audit entry with PR/MR URL or commit SHA