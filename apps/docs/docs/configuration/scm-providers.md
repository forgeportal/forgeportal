---
title: SCM Providers
sidebar_position: 3
---

# SCM Providers

ForgePortal integrates with **GitHub** and **GitLab** for repository discovery, file access, and webhooks. You can use one or both. Config lives under `scm` in [forgeportal.yaml](/docs/configuration/forgeportal-yaml#scm); secrets should be set via [environment variables](/docs/configuration/env-vars).

---

## GitHub

Two authentication modes are supported: **Personal Access Token (PAT)** or **GitHub App**. App is preferred for production (per-repo permissions, rate limits, webhooks).

### Option A: Personal Access Token (PAT)

1. **GitHub** → Settings → Developer settings → Personal access tokens → Generate new token (classic).
2. Scopes: at least **repo** (full control of private repos). For org repos, ensure the token has access to the organization.
3. Set the token in config **without** putting it in YAML:

```bash
# .env — short form (preferred for Docker Compose)
SCM_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# or long form (always works, required in CI/CD without .env)
FORGEPORTAL_SCM__GITHUB__TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

Both aliases map to the same config path (`scm.github.token`).

| Alias | Config path |
|-------|-------------|
| `SCM_GITHUB_TOKEN` | `scm.github.token` |
| `FORGEPORTAL_SCM__GITHUB__TOKEN` | `scm.github.token` |

**YAML (token from env):**

```yaml
scm:
  github: {}
  # token provided via SCM_GITHUB_TOKEN or FORGEPORTAL_SCM__GITHUB__TOKEN
```

> **Personal accounts and organisations:** You can configure `discovery.orgs`
> with either a GitHub **organisation** slug or a personal **username** — the
> scanner automatically uses the correct API endpoint (`/orgs/{org}` or
> `/users/{user}`). Similarly, the `create-repo` template action supports
> creating repositories in both organisations and personal accounts.

### Option B: GitHub App

1. **GitHub** → Organization or User → Developer settings → GitHub Apps → New GitHub App.
2. Set name, URL, webhook URL (see [Webhooks](#webhooks) below). Permissions:
   - **Repository permissions**: Contents (Read), Metadata (Read), Pull requests (Read/Write if you use PR actions).
   - **Subscribe to events**: e.g. Push, Pull request, Repository.
3. Create the App; note **App ID**. Generate a **Private key** and save the `.pem` file on the server.
4. **Install** the App on the org(s) or repos you use with ForgePortal.
5. Configure ForgePortal with App ID and path to the private key:

```yaml
scm:
  github:
    appId: "123456"
    privateKeyPath: /run/secrets/github-app-key.pem
    # webhookSecret: set via env or secret for signature verification
```

- **appId**: string (numeric ID of the App).
- **privateKeyPath**: path to the PEM file (readable by the process).
- Do **not** set `token` when using `appId` + `privateKeyPath`; the app uses installation tokens automatically.

---

## GitLab

GitLab uses a **personal or project access token** and an optional **base URL** for self-hosted instances.

### Setup

1. **GitLab** → User Settings → Access Tokens (or Project/Group → Settings → Access Tokens).
2. Create a token with scopes: **read_api**, **read_repository** (and **write_repository** if you need push/PR actions).
3. **Self-hosted**: use your instance URL as `baseUrl`. For GitLab.com leave `baseUrl` unset or set to `https://gitlab.com`.

**YAML:**

```yaml
scm:
  gitlab:
    # token: set via FORGEPORTAL_SCM__GITLAB__TOKEN
    baseUrl: https://gitlab.com
```

**With token via env:**  
`FORGEPORTAL_SCM__GITLAB__TOKEN=<token>`

**Self-hosted example:**

```yaml
scm:
  gitlab:
    baseUrl: https://gitlab.mycompany.com
    # token via env
```

---

## Webhooks

ForgePortal receives SCM events (push, PR, etc.) on a single endpoint and verifies signatures using a shared secret. You configure the webhook in the SCM (GitHub/GitLab) and the same secret in ForgePortal.

### Endpoint

| Method | URL |
|--------|-----|
| POST | `https://<forgeportal-host>/api/v1/webhooks/scm` |

Use **HTTPS** in production. For local dev you can use a tunnel (e.g. ngrok) and point the SCM webhook to it.

### Secret

Set the same value in:

1. **ForgePortal**  
   - GitHub: `scm.github.webhookSecret` (or `FORGEPORTAL_SCM__GITHUB__WEBHOOK_SECRET`).  
   - GitLab: `scm.gitlab.webhookSecret` (or `FORGEPORTAL_SCM__GITLAB__WEBHOOK_SECRET`).
2. **GitHub** (Settings → Webhooks → Add webhook → Secret).  
3. **GitLab** (Project/Group → Settings → Webhooks → Secret token).

Generate a random string (e.g. `openssl rand -hex 32`) and never commit it.

### GitHub: events to send

- **Push events** (required for catalog/discovery updates).
- **Pull request** (if you use PR-based flows).
- **Repository** (optional; creation/deletion).

In GitHub Webhook settings, choose “Let me select individual events” and enable at least **Push**.

### GitLab: trigger

- **Push events**
- **Merge request events** (if you use MR-based flows)

Enable the needed checkboxes in the GitLab webhook form.

### Behavior

- ForgePortal validates the payload using the provider’s signature (e.g. GitHub `X-Hub-Signature-256`, GitLab `X-Gitlab-Token` or signature header, depending on implementation).
- Invalid or missing secret → 401/403.
- Valid events are processed for catalog updates and any registered actions.

---


## Environment variable overrides

Every SCM secret can (and should) be passed as an environment variable instead of writing it in `forgeportal.yaml`. The pattern is `FORGEPORTAL_<SECTION>__<KEY>` (double underscore for nesting).

| What to set | YAML key | Environment variable |
|-------------|----------|----------------------|
| GitHub PAT | `scm.github.token` | `FORGEPORTAL_SCM__GITHUB__TOKEN` |
| GitHub App ID | `scm.github.appId` | `FORGEPORTAL_SCM__GITHUB__APPID` |
| GitHub App private key path | `scm.github.privateKeyPath` | `FORGEPORTAL_SCM__GITHUB__PRIVATEKEYPATH` |
| GitHub webhook secret | `scm.github.webhookSecret` | `FORGEPORTAL_SCM__GITHUB__WEBHOOK_SECRET` |
| GitLab token | `scm.gitlab.token` | `FORGEPORTAL_SCM__GITLAB__TOKEN` |
| GitLab base URL | `scm.gitlab.baseUrl` | `FORGEPORTAL_SCM__GITLAB__BASEURL` |
| GitLab webhook secret | `scm.gitlab.webhookSecret` | `FORGEPORTAL_SCM__GITLAB__WEBHOOK_SECRET` |

**Docker Compose** -- add to your `.env` file:

```bash
FORGEPORTAL_SCM__GITHUB__TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
# FORGEPORTAL_SCM__GITHUB__WEBHOOK_SECRET=my-webhook-secret
```

**Kubernetes / Helm** -- reference a secret in the pod environment:

```yaml
env:
  - name: FORGEPORTAL_SCM__GITHUB__TOKEN
    valueFrom:
      secretKeyRef:
        name: forgeportal-scm-secrets
        key: github-token
```

---

## Summary

| Provider | Auth mode | YAML keys | Env override |
|----------|-----------|-----------|--------------|
| GitHub | PAT | `scm.github.token` | `FORGEPORTAL_SCM__GITHUB__TOKEN` |
| GitHub | App | `scm.github.appId`, `scm.github.privateKeyPath` | -- (file path) |
| GitHub | Webhook | `scm.github.webhookSecret` | `FORGEPORTAL_SCM__GITHUB__WEBHOOK_SECRET` |
| GitLab | Token | `scm.gitlab.token` | `FORGEPORTAL_SCM__GITLAB__TOKEN` |
| GitLab | Base URL | `scm.gitlab.baseUrl` | `FORGEPORTAL_SCM__GITLAB__BASEURL` |
| GitLab | Webhook | `scm.gitlab.webhookSecret` | `FORGEPORTAL_SCM__GITLAB__WEBHOOK_SECRET` |

For all config keys and types, see [forgeportal.yaml -- scm](/docs/configuration/forgeportal-yaml#scm). For all environment variable names, see [Environment Variables](/docs/configuration/env-vars).
