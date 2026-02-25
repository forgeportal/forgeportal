---
title: Kubernetes Plugin
sidebar_position: 1
---

# @forgeportal/plugin-kubernetes

The **Kubernetes plugin** is the first official fullstack plugin bundled with ForgePortal. It adds a **Kubernetes** tab to every entity that has the `forgeportal.dev/k8s-label-selector` annotation, giving your team live visibility into workloads (Deployments, Pods, Services, Ingresses) directly from the catalog.

## Features

| Feature | Description |
|---------|-------------|
| **Workloads view** | Lists Deployments, Pods, Services and Ingresses filtered by a label selector |
| **Pod logs** | Stream the last 100 lines of any pod container in a dark-themed drawer |
| **Restart deployment** | One-click rolling restart via `POST /api/v1/plugins/kubernetes/.../restart` |
| **Scale deployment** | Set replica count from the UI |
| **Multi-cluster** | Dropdown to switch between multiple configured clusters when 2+ are defined |
| **TLS skip** | Optional `skipTLSVerify` for local clusters (e.g. Docker Desktop) |

---

## Prerequisites

- ForgePortal **API** running with plugin support enabled.
- A Kubernetes cluster reachable from the API container (in-cluster or external).
- A **Kubernetes Service Account** with at least read access to Pods, Deployments, Services, and Ingresses.

---

## Installation

### Monorepo (workspace)

The plugin is already included in `packages/plugin-kubernetes`. Run `forge sync` to add it to `apps/api` and `apps/ui` automatically:

```bash
pnpm forge:sync
```

Then add the plugin to your `forgeportal.yaml` (see [Configuration](#configuration)).

### External package

```bash
# From your ForgePortal project root:
pnpm add @forgeportal/plugin-kubernetes --filter @forgeportal/api
pnpm add @forgeportal/plugin-kubernetes --filter @forgeportal/ui
```

Or add the package name to `pluginPackages.packages` in `forgeportal.yaml` and run `pnpm forge:sync`.

---

## Configuration

### 1. Register in `forgeportal.yaml`

```yaml
pluginPackages:
  packages:
    - "@forgeportal/plugin-kubernetes"

plugins:
  kubernetes:
    enabled: true
    config:
      # JSON array of cluster objects — set via env or inline (no tokens here!)
      clusters: '[{"name":"production","url":"https://k8s.example.com","skipTLSVerify":false}]'
      defaultNamespace: "default"
```

:::caution Tokens are secrets
Never put `token` values in `forgeportal.yaml`. Use environment variables instead (see below).
:::

### 2. Cluster configuration fields

Each cluster object in the `clusters` JSON array supports:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier (used in UI dropdown and annotations). |
| `url` | string | Yes | Kubernetes API server URL (e.g. `https://kubernetes.docker.internal:6443`). |
| `token` | string | No | Service account bearer token. Prefer env var (see below). |
| `skipTLSVerify` | boolean | No | Skip TLS verification. Useful for local clusters with self-signed certs. |

### 3. Inject tokens via environment variables

For each cluster, expose its token through the dedicated env var pattern:

```
FORGEPORTAL_PLUGIN_KUBERNETES_<CLUSTER_NAME_UPPERCASE>_TOKEN=<service-account-token>
```

**Example** — cluster named `local`:

```bash
# .env or docker-compose environment:
FORGEPORTAL_PLUGIN_KUBERNETES_LOCAL_TOKEN=eyJhbGciOiJSUzI1NiIs...
```

**Example** — cluster named `production`:

```bash
FORGEPORTAL_PLUGIN_KUBERNETES_PRODUCTION_TOKEN=eyJhbGciOiJSUzI1NiIs...
```

The plugin loader merges these tokens into the cluster config at startup.

### 4. Create a Service Account (Kubernetes side)

```yaml
# kubernetes/forgeportal-sa.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: forgeportal
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: forgeportal-readonly
rules:
  - apiGroups: ["", "apps", "networking.k8s.io"]
    resources: ["pods", "pods/log", "deployments", "services", "ingresses"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments/scale", "deployments"]
    verbs: ["patch", "update"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: forgeportal-readonly
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: forgeportal-readonly
subjects:
  - kind: ServiceAccount
    name: forgeportal
    namespace: default
```

```bash
kubectl apply -f kubernetes/forgeportal-sa.yaml

# Generate a long-lived token (Kubernetes 1.24+)
kubectl create token forgeportal --duration=8760h
```

---

## Annotating entities

To activate the Kubernetes tab for an entity, add the `forgeportal.dev/k8s-label-selector` annotation to its `entity.yaml`:

```yaml
apiVersion: forgeportal/v1
kind: service
metadata:
  name: frontend-app
  namespace: default
  annotations:
    # Required — label selector to find workloads in Kubernetes
    forgeportal.dev/k8s-label-selector: "app=frontend-app"
    # Optional — which cluster to use (defaults to first configured cluster)
    forgeportal.dev/k8s-cluster: "production"
    # Optional — override namespace (defaults to plugin defaultNamespace)
    forgeportal.dev/k8s-namespace: "apps"
spec:
  owner: team-platform
  lifecycle: production
```

### Supported annotations

| Annotation | Required | Description |
|-----------|----------|-------------|
| `forgeportal.dev/k8s-label-selector` | **Yes** | Kubernetes label selector (e.g. `app=myservice,env=prod`). |
| `forgeportal.dev/k8s-cluster` | No | Cluster name (must match a name in your `clusters` config). Defaults to first cluster. |
| `forgeportal.dev/k8s-namespace` | No | Kubernetes namespace. Defaults to `defaultNamespace` from plugin config. |

---

## Database migration

Before using the plugin, apply the entity annotations migration if you haven't already:

```bash
# From the API container or with psql access:
psql -U forge -d forgeportal -f tools/migration/012_entity_annotations.sql
```

This adds the `annotations JSONB` column to the `entities` table (Story 2-7).

---

## UI walkthrough

Once configured and an entity is annotated:

1. Navigate to the entity detail page in ForgePortal.
2. Click the **Kubernetes** tab.
3. The plugin fetches workloads filtered by your label selector.
4. Click **View Logs** on any Pod to open the log drawer (dark background, green text).
5. Click **Restart** on a Deployment to trigger a rolling restart.
6. Use the **replica ±** buttons to scale a Deployment up or down.
7. If multiple clusters are configured, a **cluster dropdown** appears at the top right of the tab.

---

## Multi-cluster setup

When 2 or more clusters are configured, the plugin shows a dropdown in the tab header so users can switch context without leaving the page.

```yaml
plugins:
  kubernetes:
    enabled: true
    config:
      clusters: |
        [
          {"name":"staging","url":"https://k8s-staging.example.com"},
          {"name":"production","url":"https://k8s-prod.example.com"}
        ]
```

```bash
# Set tokens for both:
FORGEPORTAL_PLUGIN_KUBERNETES_STAGING_TOKEN=eyJ...
FORGEPORTAL_PLUGIN_KUBERNETES_PRODUCTION_TOKEN=eyJ...
```

The entity annotation `forgeportal.dev/k8s-cluster` sets the **default** cluster for that entity; users can override it via the dropdown.

---

## API routes

The plugin registers routes under `/api/v1/plugins/kubernetes/`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/clusters` | Returns configured cluster names and URLs (no tokens). |
| `GET` | `/entities/:entityId/workloads` | Lists workloads filtered by annotation label selector. |
| `GET` | `/entities/:entityId/pods/:podName/logs` | Returns last N lines of pod logs as `{ data: { logs: string } }`. |
| `POST` | `/entities/:entityId/deployments/:deploymentName/restart` | Triggers a rolling restart. |
| `POST` | `/entities/:entityId/deployments/:deploymentName/scale` | Sets `spec.replicas`. Body: `{ replicas: number }`. |

---

## Troubleshooting

### "Kubernetes not configured for this entity"

The entity is missing the `forgeportal.dev/k8s-label-selector` annotation. Add it to `entity.yaml` and re-sync (push the file or trigger a manual discovery scan).

### 502 Bad Gateway / fetch failed

The API cannot reach the Kubernetes cluster. Common causes:
- Incorrect cluster URL in `clusters` config.
- `FORGEPORTAL_PLUGIN_KUBERNETES_<NAME>_TOKEN` env var not set or expired.
- TLS certificate issue — set `skipTLSVerify: true` for local clusters (e.g. Docker Desktop).
- Kubernetes API not reachable from the Docker network — use `https://kubernetes.docker.internal:6443` (Docker Desktop) or `https://host.docker.internal:6443` (alternative).

### Token expired

Service account tokens created with `kubectl create token` have a TTL. For production, create a **secret-based** long-lived token instead:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: forgeportal-token
  namespace: default
  annotations:
    kubernetes.io/service-account.name: forgeportal
type: kubernetes.io/service-account-token
```

### Logs appear black / invisible

Ensure your Tailwind CSS build scans the plugin source. In `apps/ui/src/index.css`, verify this line exists:

```css
@source "../../../packages/plugin-kubernetes/src/**/*.{ts,tsx}";
```

This was fixed in ForgePortal and is present in all recent versions.
