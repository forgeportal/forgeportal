---
title: Production Checklist
sidebar_position: 3
---

# Production Checklist

Before going live, ensure the following. Each item includes **what** to do, **why** it matters, and **how** to verify.

---

## 1. OIDC configured (no dev bypass)

**What:** Configure a real IdP (Keycloak, Okta, Auth0, Azure AD, Cognito). Set `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` (via env), and optionally `OIDC_SCOPES`, `OIDC_GROUPS_CLAIM`, `roleMapping` in [forgeportal.yaml](/docs/configuration/forgeportal-yaml).

**Why:** Without OIDC, the server runs in dev mode and allows unauthenticated access.

**Verify:** Ensure `auth.oidc.issuer` is non-empty in config. Open the app in a private window; you should be redirected to the IdP login, not given immediate access.

---

## 2. Encryption key changed

**What:** Set `ENCRYPTION_KEY` to a strong random value (min 16 characters). Never use the default `local-dev-key-change-in-prod-32chars!`.

**Why:** The encryption key protects sensitive data (e.g. stored SCM secrets). A default or weak key compromises all such data.

**Verify:** Check that the env var (or secret) is set and different from the default. Do not log the value.

---

## 3. Session secret changed

**What:** Set `SESSION_SECRET` to a random string (min 16 characters). Never use the default.

**Why:** The session secret signs/encrypts session cookies. A weak or default secret allows session forgery.

**Verify:** Ensure the env var is set and not the default. After changing it, all existing sessions are invalidated.

---

## 4. Database backups scheduled

**What:** Schedule regular backups of the PostgreSQL database (pg_dump or managed backup). Store backups off-host and test restore.

**Why:** Restoring from backup is the primary way to recover from data loss or corruption.

**Verify:** Confirm backup job/cron exists, runs successfully, and a restore has been tested in a non-production environment.

---

## 5. Security headers enabled

**What:** Ensure the API runs with security headers (CSP, X-Content-Type-Options, Referrer-Policy, X-Frame-Options). These are enabled by default when [security hardening](/docs/configuration/forgeportal-yaml#server) is in use; adjust CSP if needed for your UI.

**Why:** Headers reduce risk of XSS, clickjacking, and MIME sniffing.

**Verify:** `curl -I https://your-api/api/v1/...` and check for `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`.

---

## 6. Rate limiting enabled

**What:** Rate limiting is built in for search (60/min), webhooks (100/min), and action/template runs per user. Ensure the app is not behind a proxy that strips client IP (or configure a trusted `X-Forwarded-For` / `X-Real-IP`) so limits apply per client.

**Why:** Prevents abuse and protects backend and DB from overload.

**Verify:** Trigger repeated search or webhook requests; after the limit, responses should be 429 with `Retry-After`.

---

## 7. Monitoring and metrics

**What:** Expose Prometheus metrics (when implemented) and collect them. Optionally add health checks (e.g. `/livez`, `/healthz`) to your orchestrator or load balancer. Set up alerts on errors, latency, and queue depth.

**Why:** Enables detection of failures and performance issues before users are impacted.

**Verify:** Confirm metrics endpoint is scraped (or health checks hit) and that at least one critical alert (e.g. API down, high error rate) is configured.

---

## 8. Log level set to info (or warn)

**What:** Set `LOG_LEVEL` to `info` or `warn` in production. Avoid `debug` unless troubleshooting.

**Why:** Reduces log volume and avoids logging sensitive or high-cardinality data in production.

**Verify:** Check env or config: `server.logLevel` or `LOG_LEVEL` is not `debug` in prod.

---

## 9. Secrets not in config files

**What:** Do not put passwords, client secrets, or tokens in `forgeportal.yaml` or in repo. Use environment variables, Docker/Kubernetes secrets, or a vault.

**Why:** Config files are often committed or copied; secrets in them leak easily.

**Verify:** Grep config and repo for placeholder secrets (e.g. `change-me`, `local-dev`); ensure production secrets are only in env or secret stores.

---

## 10. TLS for all production traffic

**What:** Serve the API and UI over HTTPS only. Terminate TLS at a reverse proxy (Nginx, Ingress) or at the app. Redirect HTTP to HTTPS.

**Why:** Protects credentials and session cookies in transit.

**Verify:** Open the app and API over HTTPS; ensure HTTP redirects to HTTPS and that mixed content does not occur.

---

## Quick reference

| # | Item | Verify |
|---|------|--------|
| 1 | OIDC configured | Login redirects to IdP |
| 2 | Encryption key changed | ENCRYPTION_KEY set, not default |
| 3 | Session secret changed | SESSION_SECRET set, not default |
| 4 | DB backups scheduled | Backup job + test restore |
| 5 | Security headers | CSP, X-Content-Type-Options, etc. in response |
| 6 | Rate limiting | 429 after limit exceeded |
| 7 | Monitoring / metrics | Scraping or health checks + alerts |
| 8 | Log level | info or warn in prod |
| 9 | No secrets in files | Secrets only in env/vault |
| 10 | TLS everywhere | HTTPS only, HTTP redirect |
