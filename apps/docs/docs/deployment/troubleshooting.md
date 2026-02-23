---
title: Troubleshooting
sidebar_position: 4
---

# Troubleshooting

Common issues, causes, and fixes. Format: **Symptom** → **Cause** → **Solution**.

---

## 1. Database connection refused

**Symptom:** API or worker fails to start with "connection refused" or "ECONNREFUSED" to the DB host.

**Cause:** PostgreSQL is not reachable (wrong host/port, firewall, or DB not started).

**Solution:** Check `DB_HOST`, `DB_PORT`; ensure Postgres is running and listening; open firewall/security group for the app; for Docker/Kubernetes, use the service name (e.g. `postgres`) and correct port (usually 5432).

---

## 2. OIDC redirect URI mismatch

**Symptom:** After login, IdP shows "Redirect URI mismatch" or "Invalid redirect_uri".

**Cause:** The redirect URI registered in the IdP does not match what ForgePortal sends (scheme, host, or path).

**Solution:** In the IdP client config, set the exact redirect URI: `https://<your-forgeportal-host>/api/v1/auth/callback`. Ensure no trailing slash mismatch and that the app uses HTTPS in production (or the correct base URL). If behind a proxy, ensure `X-Forwarded-Proto` and `X-Forwarded-Host` are set so the app builds the correct callback URL.

---

## 3. Webhook signature invalid (401)

**Symptom:** GitHub or GitLab webhook delivery fails with 401 "Invalid webhook signature".

**Cause:** The secret in ForgePortal does not match the one configured in the SCM, or the raw body is altered (e.g. re-parsed) before verification.

**Solution:** Use the same secret in both places: `scm.github.webhookSecret` (or `FORGEPORTAL_SCM__GITHUB__WEBHOOK_SECRET`) and GitHub Webhook secret; for GitLab, `scm.gitlab.webhookSecret` and the GitLab webhook token. Ensure the server receives the raw body for signature verification (no middleware that parses and re-serializes JSON before the webhook handler).

---

## 4. Scanner finds no repositories

**Symptom:** Discovery/catalog scan runs but no repos or entities appear.

**Cause:** SCM not configured (no token or GitHub App), wrong org/group name, or discovery `orgs` not set in config.

**Solution:** Configure `scm.github` or `scm.gitlab` (token or App + private key). In `discovery.orgs`, add entries with the correct `provider` and `org` (or group). Ensure the token or App has access to those orgs/repos. Check logs for "No SCM providers configured" or permission errors.

---

## 5. Action run stuck in "queued"

**Symptom:** An action run stays in `queued` and never starts.

**Cause:** Worker not running, worker cannot reach DB or API, or job queue table not being processed.

**Solution:** Ensure the worker process is running (Docker/Kubernetes: worker deployment/pod is up). Check worker logs for DB connection or job dequeue errors. Verify the same DB and config (e.g. same `DB_*` and queue tables) are used by API and worker.

---

## 6. Entity not appearing after push

**Symptom:** Push to a repo that should be in the catalog, but the entity does not show up or is not updated.

**Cause:** Webhook not configured for the repo/org, webhook URL or secret wrong, or discovery not set to use that org; or entity.yaml path/format issue.

**Solution:** Configure the SCM webhook to point to `https://<host>/api/v1/webhooks/scm` with the correct secret. Ensure discovery includes the org. Check that the repo has the expected entity file (e.g. `entity.yaml`) and that webhook deliveries succeed (no 401/500). Check API/catalog logs for ingest errors.

---

## 7. Search returns no results

**Symptom:** GET `/api/v1/search?q=...` returns empty `data` or no hits.

**Cause:** FTS index not built (docs or entities not indexed), or query/scope mismatch.

**Solution:** Ensure docs indexing has run and that entities exist. Check that `scope` is correct (`all`, `entities`, or `docs`). Verify search index tables are populated. If you changed DB or index logic, re-run indexing if applicable.

---

## 8. Plugin not loading

**Symptom:** A plugin does not appear in the list or is disabled and cannot be enabled.

**Cause:** Package not in `pluginPackages.packages`, plugin manifest invalid, crash on load, or override in DB (`plugin_overrides`) disabling it.

**Solution:** Add the package to `pluginPackages.packages` in config. Check that the package has a valid `forgeportal-plugin.json` and that the server can require it. Check API logs for plugin load errors. If using overrides, ensure the plugin is not disabled in the DB or remove the override and restart.

---

## 9. CSP blocking resources

**Symptom:** UI or scripts fail with Content-Security-Policy violations in the browser console.

**Cause:** The API (or reverse proxy) sends a CSP header that forbids the origin, inline script, or style used by the UI or a third-party asset.

**Solution:** Relax or adjust CSP in config: `server.securityHeaders.csp` in [forgeportal.yaml](/docs/configuration/forgeportal-yaml). Add the UI origin, `'self'`, or specific script/style sources as needed. Test in browser dev tools to see which directive blocks the resource.

---

## 10. Rate limit 429 (Too Many Requests)

**Symptom:** Clients receive 429 with "Rate limit exceeded" or "Search rate limit exceeded".

**Cause:** Built-in limits (e.g. 60/min for search, 100/min for webhooks, 10/min for action runs per user) are exceeded.

**Solution:** Respect the `Retry-After` header and back off. For search, reduce request frequency or cache results. For webhooks, ensure the SCM is not sending duplicate events excessively. For action/template runs, limit concurrent runs per user or increase the limit in code if you must (not recommended without review).

---

## 11. Migrations or seed failures on startup

**Symptom:** API or worker exits on startup with migration or seed SQL errors.

**Cause:** Migration files missing, wrong `MIGRATIONS_DIR`, or seed file path wrong; or DB user has no permission to run DDL; or schema already changed manually.

**Solution:** Set `MIGRATIONS_DIR` and `SEED_FILE` to the correct paths (or leave defaults). Ensure the DB user can create tables and run migrations. If the DB was modified manually, align migrations or run them manually. Disable seed in prod if not needed: `RUN_SEED=false`.

---

## 12. Session lost after restart or 401 on API calls

**Symptom:** After server restart or after some time, users are logged out or API returns 401.

**Cause:** Session secret changed (invalidates all sessions), or session store is in-memory and lost on restart; or cookie not sent (domain/path/SameSite).

**Solution:** Keep `SESSION_SECRET` stable across restarts. If using in-memory sessions, expect logout on restart unless you switch to a persistent store. Ensure cookie domain and path match the app; use `SameSite=Lax` or `Strict` and HTTPS so cookies are sent.

---

Quick reference: **DB** (1, 11), **OIDC** (2, 12), **Webhooks** (3, 6), **Discovery/Scanner** (4), **Workers** (5), **Search** (7), **Plugins** (8), **Security** (9), **Rate limits** (10).
