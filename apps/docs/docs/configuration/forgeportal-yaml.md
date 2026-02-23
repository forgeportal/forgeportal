---
title: forgeportal.yaml Reference
sidebar_position: 1
---

# forgeportal.yaml Reference

ForgePortal is configured via a single **YAML file** (`forgeportal.yaml` at the project root) validated by Zod. Every value can be overridden by [environment variables](/docs/configuration/env-vars). This page documents each top-level section and its fields (type, default, description).

## Overview

The file has **11 top-level sections**: `db`, `server`, `auth`, `scm`, `discovery`, `migrations`, `docs`, `plugins`, `pluginPackages`, `scorecards`, `encryptionKey`. Omitted sections use schema defaults. Secrets (passwords, client secrets, tokens) should be set via env vars, not committed in the file.

---

## `db`

Database connection for PostgreSQL.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `host` | string | `localhost` | Database host. |
| `port` | number | `5432` | Database port. |
| `database` | string | `forgeportal` | Database name. |
| `user` | string | `forge` | Database user. |
| `password` | string | `forge_local_dev` | Database password. Set via `DB_PASSWORD` in production. |
| `maxPoolSize` | number | `20` | Maximum connections in the pool. |

**Example:**

```yaml
db:
  host: postgres
  port: 5432
  database: forgeportal
  user: forge
  # password: set via DB_PASSWORD
  maxPoolSize: 20
```

---

## `server`

API server and logging.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | `4000` | Listen port. |
| `host` | string | `0.0.0.0` | Bind address. |
| `logLevel` | string | `info` | One of: `debug`, `info`, `warn`, `error`. |
| `securityHeaders` | object | — | Optional. `csp`: string for Content-Security-Policy (empty string to disable). |

**Example:**

```yaml
server:
  port: 4000
  host: 0.0.0.0
  logLevel: info
  # securityHeaders:
  #   csp: "default-src 'self'; ..."
```

---

## `auth`

Authentication (OIDC) and session.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sessionSecret` | string | `change-me-forgeportal-session-secret` | Min 16 chars. Used to encrypt session; set via `SESSION_SECRET` in production. |
| `oidc` | object | `{}` | OIDC provider settings. See [OIDC Setup](/docs/configuration/oidc-setup). |
| `oidc.issuer` | string (URL) | — | Discovery URL of the IdP. If empty, dev-mode bypass (no login). |
| `oidc.clientId` | string | — | OAuth2 client ID. |
| `oidc.clientSecret` | string | — | **Never put in file.** Set via `OIDC_CLIENT_SECRET`. |
| `oidc.redirectUri` | string (URL) | — | Override redirect URI (default: `http(s)://host:port/api/v1/auth/callback`). |
| `oidc.scopes` | string | `openid email profile` | Space-separated scopes. Add `groups` for Keycloak/Okta. |
| `oidc.groupsClaim` | string | — | JWT claim for groups/roles. Auto-detected if unset (e.g. `groups`, `roles`, `realm_access.roles`). |
| `roleMapping` | object | — | Map ForgePortal role → list of IDP group/role names. Keys: `platform-admin`, `template-admin`, `team-admin`, `developer`, `viewer`. |

**Example:**

```yaml
auth:
  sessionSecret: change-me-in-production
  oidc:
    issuer: https://keycloak.example.com/realms/forgeportal
    clientId: forgeportal
    # clientSecret: env OIDC_CLIENT_SECRET
    scopes: openid email profile groups
    groupsClaim: groups
  roleMapping:
    platform-admin: ["forge-admins", "SRE"]
    developer: ["engineers"]
```

---

## `scm`

SCM providers (GitHub, GitLab). Used for discovery, webhooks, and actions. See [SCM Providers](/docs/configuration/scm-providers).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `github.token` | string | — | GitHub PAT. Prefer env. |
| `github.appId` | string | — | GitHub App ID (when using App auth). |
| `github.privateKeyPath` | string | — | Path to App private key file. |
| `github.webhookSecret` | string | — | Webhook secret for signature verification. |
| `gitlab.token` | string | — | GitLab personal or project token. |
| `gitlab.baseUrl` | string (URL) | `https://gitlab.com` | GitLab API base (use for self-hosted). |
| `gitlab.webhookSecret` | string | — | Webhook secret. |

**Example:**

```yaml
scm:
  github:
    # token: set via env
    # appId: ...
    # privateKeyPath: ...
    # webhookSecret: ...
  gitlab:
    # token: set via env
    baseUrl: https://gitlab.com
```

---

## `discovery`

Catalog discovery (repo scan).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `entityFilePath` | string | `entity.yaml` | File name (or path) to look for in each repo. |
| `intervalMinutes` | number | `0` | Scheduled scan interval in minutes. `0` = disabled (manual only). |
| `orgs` | array | `[]` | List of `{ provider: github \| gitlab, org: string, topic?: string }`. |

**Example:**

```yaml
discovery:
  entityFilePath: entity.yaml
  intervalMinutes: 60
  orgs:
    - provider: github
      org: my-org
    - provider: gitlab
      org: my-group
```

---

## `migrations`

Database migrations and seed.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `dir` | string | `tools/migration` | Directory containing SQL migrations. |
| `runSeed` | boolean | `false` | Whether to run the seed file after migrations. |
| `seedFile` | string | `tools/seed/seed_v1.sql` | Path to seed SQL. |

---

## `docs`

Documentation indexing.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxIndexFileSizeBytes` | number | `5242880` (5 MB) | Max size in bytes for a single file to be indexed; larger files are skipped. |

---

## `pluginPackages`

List of npm packages to load as plugins at startup.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `packages` | string[] | `[]` | Package names (e.g. `@myorg/forge-plugin-pagerduty`). Each must have a valid `forgeportal-plugin.json`. |

**Example:**

```yaml
pluginPackages:
  packages:
    - "@myorg/forge-plugin-pagerduty"
```

---

## `plugins`

Per-plugin configuration (enabled flag and non-secret config). Keys are **plugin IDs** (derived from package name, e.g. `pagerduty`, `slack-notify`).

| Field (per plugin) | Type | Default | Description |
|--------------------|------|---------|-------------|
| `enabled` | boolean | `true` | Whether the plugin is active. Can be overridden in DB (`plugin_overrides`). |
| `config` | object | `{}` | Non-secret config key-value. **Secrets** must be set via env: `FORGEPORTAL_PLUGIN_<ID>_<KEY>` (e.g. `FORGEPORTAL_PLUGIN_PAGERDUTY_APITOKEN`). |

**Example:**

```yaml
plugins:
  pagerduty:
    enabled: true
    config:
      apiEndpoint: "https://api.pagerduty.com"
      # apiToken: set via FORGEPORTAL_PLUGIN_PAGERDUTY_APITOKEN
  slack-notify:
    enabled: false
    config:
      defaultChannel: "#alerts"
```

---

## `scorecards`

Scorecard evaluation schedule.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `evalIntervalHours` | number | `24` | Interval in hours between bulk scorecard evaluations. Set to `0` to disable. |

---

## `encryptionKey`

Key used for encrypting sensitive data (e.g. stored secrets). Min 16 characters. **Never commit a production value**; set via `ENCRYPTION_KEY`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| (root) `encryptionKey` | string | `local-dev-key-change-in-prod-32chars!` | Encryption key for AES-256-GCM (e.g. admin-stored SCM secrets). |

---

## Full example (annotated)

```yaml
# Database — override with DB_* env vars
db:
  host: localhost
  port: 5432
  database: forgeportal
  user: forge
  # password: DB_PASSWORD

# API
server:
  port: 4000
  host: 0.0.0.0
  logLevel: info

# Auth — set OIDC_* and SESSION_SECRET in production
auth:
  sessionSecret: change-me
  oidc: {}
  # roleMapping: { "platform-admin": ["admins"], "developer": ["devs"] }

# SCM — set tokens via env or FORGEPORTAL_SCM__GITHUB__TOKEN
scm:
  github: {}
  gitlab: { baseUrl: https://gitlab.com }

# Discovery
discovery:
  entityFilePath: entity.yaml
  intervalMinutes: 0
  orgs: []

# Migrations
migrations:
  dir: tools/migration
  runSeed: false
  seedFile: tools/seed/seed_v1.sql

# Docs indexing
docs:
  maxIndexFileSizeBytes: 5242880

# Plugins
pluginPackages:
  packages: []
plugins: {}

# Scorecards
scorecards:
  evalIntervalHours: 24

# Encryption — set ENCRYPTION_KEY in production
encryptionKey: local-dev-key-change-in-prod-32chars!
```

For environment variable overrides, see [Environment Variables](/docs/configuration/env-vars).
