---
title: ArgoCD Plugin
sidebar_position: 2
---

# @forgeportal/plugin-argocd

The **ArgoCD plugin** is a fullstack plugin that adds an **ArgoCD** tab to entities in the catalog, giving your team live visibility into application sync status, health, revision history, and one-click sync/rollback actions — all without leaving ForgePortal.

## Features

| Feature | Description |
|---------|-------------|
| **Sync status** | Current sync state (Synced, OutOfSync, Unknown) with health indicator |
| **App health** | Kubernetes health rollup (Healthy, Degraded, Progressing, Missing) |
| **Current revision** | Git commit SHA and source repo/path |
| **Sync history** | Last 5 deploy events with timestamps and revision hashes |
| **Sync action** | One-click sync trigger via `argocd.syncApp@v1` template action |
| **Rollback action** | Roll back to a specific revision via `argocd.rollbackApp@v1` |

---

## Prerequisites

- ForgePortal API and Worker running
- ArgoCD instance reachable from the **API container** (not the browser)
- ArgoCD API token with `applications, get` and `applications, sync` permissions

---

## Installation

### 1. Add the plugin package

In `forgeportal.yaml`:

```yaml
pluginPackages:
  packages:
    - "@forgeportal/plugin-argocd"
```

### 2. Sync dependencies

```bash
pnpm forge:sync
# or: npx @forgeportal/cli sync
```

### 3. Configure the plugin

```yaml
plugins:
  argocd:
    enabled: true
    config:
      url: "https://argocd.example.com"
      tokenEnvVar: "FORGEPORTAL_PLUGIN_ARGOCD_TOKEN"   # default
      insecure: false   # set true if ArgoCD uses a self-signed certificate
```

### 4. Set the API token

```bash
# In your Docker Compose / Kubernetes environment
FORGEPORTAL_PLUGIN_ARGOCD_TOKEN=<argocd-api-token>
```

To generate an ArgoCD API token:

```bash
argocd account generate-token --account forgeportal
```

---

## Configuration reference

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `url` | `string` | — | **Required.** Base URL of your ArgoCD instance (e.g. `https://argocd.example.com`) |
| `tokenEnvVar` | `string` | `FORGEPORTAL_PLUGIN_ARGOCD_TOKEN` | Name of the env var holding the API token |
| `insecure` | `boolean` | `false` | Skip TLS certificate validation (useful for self-signed certs in dev) |

---

## Annotating entities

Add the following annotation to your `entity.yaml` or `catalog-info.yaml`:

```yaml
apiVersion: forgeportal.dev/v1alpha1
kind: Service
metadata:
  name: payments-api
  annotations:
    # Required — ArgoCD application name
    forgeportal.dev/argocd-app-name: "payments-api"

    # Optional — ArgoCD project (default: "default")
    forgeportal.dev/argocd-project: "production"
spec:
  owner: team:platform
  lifecycle: production
```

### Supported annotations

| Annotation | Required | Description |
|-----------|----------|-------------|
| `forgeportal.dev/argocd-app-name` | **Yes** | Name of the ArgoCD Application resource |
| `forgeportal.dev/argocd-project` | No | ArgoCD project name (default: `default`) |

---

## UI Walkthrough

When an entity has the `forgeportal.dev/argocd-app-name` annotation, an **ArgoCD** tab appears on the entity detail page.

The tab displays:

1. **Status bar** — Sync state badge (green `Synced`, yellow `OutOfSync`) + Health badge (green `Healthy`, red `Degraded`) + last reconciled timestamp
2. **Source** — Git repository URL + branch/path + current commit SHA
3. **Sync History** — Timeline of the last 5 syncs with revision SHA, timestamp, and status
4. **Actions** — "Sync Now" button (triggers `POST /api/v1/plugins/argocd/entities/:id/sync`)

If the annotation is missing, the tab shows a configuration guide instead of an error.

---

## Template Actions

The plugin registers two actions available in **Scaffolder templates**:

### `argocd.syncApp@v1`

Triggers an ArgoCD application sync.

```yaml
steps:
  - id: sync-app
    name: Sync ArgoCD Application
    action: argocd.syncApp@v1
    input:
      appName: "{{ parameters.appName }}"
      # Optional: prune: true
      # Optional: dryRun: true
```

**Input schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `appName` | `string` | Yes | ArgoCD application name |
| `prune` | `boolean` | No | Remove resources not in Git (default: `false`) |
| `dryRun` | `boolean` | No | Preview sync without applying (default: `false`) |

### `argocd.rollbackApp@v1`

Rolls an application back to a specific history revision.

```yaml
steps:
  - id: rollback
    name: Rollback ArgoCD Application
    action: argocd.rollbackApp@v1
    input:
      appName: "{{ parameters.appName }}"
      revision: "{{ parameters.targetRevision }}"
```

**Input schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `appName` | `string` | Yes | ArgoCD application name |
| `revision` | `string` | Yes | Git revision (commit SHA or tag) to roll back to |

---

## API Routes

The plugin registers the following backend routes under `/api/v1/plugins/argocd`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/entities/:entityId/app` | Sync status, health, current source, last reconciled |
| `GET` | `/entities/:entityId/history` | Last 5 sync history entries |
| `POST` | `/entities/:entityId/sync` | Trigger application sync |

All routes require a valid ForgePortal session (OIDC cookie or API key).

---

## Troubleshooting

### "Application not found" error

The `forgeportal.dev/argocd-app-name` annotation value does not match any ArgoCD Application in the configured project.

**Fix:** Check the application name in the ArgoCD UI and update the annotation.

### "401 Unauthorized" from ArgoCD API

The token is invalid, expired, or lacks permissions.

**Fix:**
1. Verify `FORGEPORTAL_PLUGIN_ARGOCD_TOKEN` is set in the API container
2. Regenerate the token: `argocd account generate-token --account forgeportal`
3. Ensure the account has `applications, get` and `applications, sync` RBAC policies

### `ARGOCD_TOKEN not set` in API logs

The environment variable is missing from the API container.

**Fix:** Add `FORGEPORTAL_PLUGIN_ARGOCD_TOKEN=<token>` to your `docker-compose.yaml` or Kubernetes Secret, then restart the API.

### TLS / self-signed certificate error

ArgoCD uses a self-signed certificate and the API container refuses the connection.

**Fix:** Set `insecure: true` in the plugin config (development only; not recommended for production):

```yaml
plugins:
  argocd:
    config:
      insecure: true
```
