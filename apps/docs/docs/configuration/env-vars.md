---
title: Environment Variables
sidebar_position: 4
---

# Environment Variables

ForgePortal reads configuration from [forgeportal.yaml](/docs/configuration/forgeportal-yaml) and **overrides** values with environment variables. Two mechanisms apply: **legacy** named variables and the **generic** `FORGEPORTAL_*` convention. Env overrides are applied after loading the YAML file, so they take precedence.

---

## Legacy variables (explicit mapping)

These names are explicitly mapped to config paths. Values are **coerced**: `"true"` / `"false"` → boolean; numeric strings → number; otherwise string.

| Variable | Config path | Type / Default |
|----------|-------------|----------------|
| `DB_HOST` | `db.host` | string (default: `localhost`) |
| `DB_PORT` | `db.port` | number (default: `5432`) |
| `DB_NAME` | `db.database` | string (default: `forgeportal`) |
| `DB_USER` | `db.user` | string (default: `forge`) |
| `DB_PASSWORD` | `db.password` | string (default: `forge_local_dev`) |
| `PORT` | `server.port` | number (default: `4000`) |
| `LOG_LEVEL` | `server.logLevel` | string (default: `info`) |
| `OIDC_ISSUER` | `auth.oidc.issuer` | string (URL) |
| `OIDC_CLIENT_ID` | `auth.oidc.clientId` | string |
| `OIDC_CLIENT_SECRET` | `auth.oidc.clientSecret` | string (secret) |
| `OIDC_REDIRECT_URI` | `auth.oidc.redirectUri` | string (URL) |
| `OIDC_SCOPES` | `auth.oidc.scopes` | string (default: `openid email profile`) |
| `OIDC_GROUPS_CLAIM` | `auth.oidc.groupsClaim` | string |
| `SESSION_SECRET` | `auth.sessionSecret` | string (min 16 chars) |
| `ENCRYPTION_KEY` | `encryptionKey` | string (min 16 chars) |
| `MIGRATIONS_DIR` | `migrations.dir` | string (default: `tools/migration`) |
| `RUN_SEED` | `migrations.runSeed` | boolean (default: `false`) |
| `SEED_FILE` | `migrations.seedFile` | string (default: `tools/seed/seed_v1.sql`) |
| `SCM_GITHUB_TOKEN` | `scm.github.token` | string (GitHub PAT) |
| `SCM_GITHUB_APP_ID` | `scm.github.appId` | string |
| `SCM_GITHUB_APP_PRIVATE_KEY_PATH` | `scm.github.privateKeyPath` | string (file path) |
| `SCM_GITHUB_WEBHOOK_SECRET` | `scm.github.webhookSecret` | string (secret) |
| `SCM_GITLAB_TOKEN` | `scm.gitlab.token` | string (GitLab PAT) |
| `SCM_GITLAB_BASE_URL` | `scm.gitlab.baseUrl` | string (URL, default: `https://gitlab.com`) |
| `SCM_GITLAB_WEBHOOK_SECRET` | `scm.gitlab.webhookSecret` | string (secret) |

**Example (production DB):**

```bash
DB_HOST=postgres.internal
DB_PORT=5432
DB_NAME=forgeportal
DB_USER=forge
DB_PASSWORD=secret
```

**Example (OIDC):**

```bash
OIDC_ISSUER=https://keycloak.example.com/realms/forgeportal
OIDC_CLIENT_ID=forgeportal
OIDC_CLIENT_SECRET=xxx
OIDC_SCOPES=openid email profile groups
SESSION_SECRET=at-least-16-chars-secret
```

---

## Generic override: `FORGEPORTAL_*`

Any nested config key can be overridden with an env var of the form:

```text
FORGEPORTAL_<Section>__<Key>__<SubKey>...
```

- **Prefix**: `FORGEPORTAL_`
- **Segments**: separated by **double underscore** `__`
- **Naming**: each segment is converted from **snake_case** to **camelCase** (e.g. `log_level` → `logLevel`), then used as the config key.

So you can set values that have no legacy name, such as SCM tokens, server host, or plugin-related keys.

### Examples

| Env variable | Config path | Description |
|--------------|-------------|-------------|
| `FORGEPORTAL_SERVER__HOST` | `server.host` | Bind address (e.g. `0.0.0.0`) |
| `FORGEPORTAL_SERVER__PORT` | `server.port` | Listen port (same as `PORT` legacy) |
| `FORGEPORTAL_SCM__GITHUB__TOKEN` | `scm.github.token` | GitHub PAT |
| `FORGEPORTAL_SCM__GITHUB__APP_ID` | `scm.github.appId` | GitHub App ID |
| `FORGEPORTAL_SCM__GITHUB__PRIVATE_KEY_PATH` | `scm.github.privateKeyPath` | Path to App private key |
| `FORGEPORTAL_SCM__GITHUB__WEBHOOK_SECRET` | `scm.github.webhookSecret` | Webhook secret for GitHub |
| `FORGEPORTAL_SCM__GITLAB__TOKEN` | `scm.gitlab.token` | GitLab token |
| `FORGEPORTAL_SCM__GITLAB__BASE_URL` | `scm.gitlab.baseUrl` | GitLab API base URL |
| `FORGEPORTAL_SCM__GITLAB__WEBHOOK_SECRET` | `scm.gitlab.webhookSecret` | Webhook secret for GitLab |
| `FORGEPORTAL_DISCOVERY__INTERVAL_MINUTES` | `discovery.intervalMinutes` | Scan interval (number) |
| `FORGEPORTAL_DOCS__MAX_INDEX_FILE_SIZE_BYTES` | `docs.maxIndexFileSizeBytes` | Max file size for indexing (number) |
| `FORGEPORTAL_SCORECARDS__EVAL_INTERVAL_HOURS` | `scorecards.evalIntervalHours` | Scorecard run interval (number) |

Coercion is the same: `"true"`/`"false"` → boolean, numeric string → number, else string.

> Values starting with `[` or `{` are parsed as JSON. This allows setting array
> or object config values from environment variables:
>
> ```bash
> FORGEPORTAL_DISCOVERY__ORGS='[{"provider":"github","org":"my-org"}]'
> ```
>
> This is the only way to set `discovery.orgs` (an array of objects) without
> mounting a `forgeportal.yaml` file.

---

## Plugin secrets: `FORGEPORTAL_PLUGIN_<ID>_<KEY>`

Plugins can read **secrets** from environment variables so they are never stored in YAML. The convention is:

```text
FORGEPORTAL_PLUGIN_<PLUGIN_ID>_<KEY>
```

- **PLUGIN_ID**: plugin identifier (e.g. `PAGERDUTY`, `SLACK_NOTIFY`), usually uppercase and derived from the package name.
- **KEY**: secret key name in uppercase (e.g. `APITOKEN`, `WEBHOOK_URL`).

These are typically injected into the plugin’s config at runtime (key normalized to camelCase). Non-secret config stays in [forgeportal.yaml under `plugins.<id>.config`](/docs/configuration/forgeportal-yaml#plugins).

**Examples:**

| Env variable | Typical use |
|--------------|-------------|
| `FORGEPORTAL_PLUGIN_PAGERDUTY_APITOKEN` | PagerDuty API token for plugin `pagerduty` |
| `FORGEPORTAL_PLUGIN_SLACK_NOTIFY_WEBHOOK_URL` | Slack webhook URL for plugin `slack-notify` |

---

## Precedence and summary

1. **Default** values from the schema (see [forgeportal.yaml](/docs/configuration/forgeportal-yaml)).
2. **forgeportal.yaml** (file config).
3. **Legacy** env vars (e.g. `DB_PASSWORD`, `OIDC_CLIENT_SECRET`).
4. **FORGEPORTAL_*** and **FORGEPORTAL_PLUGIN_*** env vars.

So: file first, then env overrides. Use legacy names where they exist; for everything else (SCM tokens, server host, plugins, discovery, docs, scorecards) use the `FORGEPORTAL_` or `FORGEPORTAL_PLUGIN_` convention. Never commit secrets in YAML—set them via the environment or a secrets manager that injects env vars.
