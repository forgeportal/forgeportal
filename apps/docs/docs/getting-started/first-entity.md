---
title: Your First Entity
sidebar_position: 4
---

# Your First Entity

Get a **software entity** into the ForgePortal catalog by adding an `entity.yaml` file to a Git repository. The platform discovers it via a **repo scan** (scheduled or manual) or via **webhooks** when you push.

## The `entity.yaml` format

ForgePortal expects a single file per repo (or per path), by default named **`entity.yaml`** at the repo root. It must be valid YAML and match this structure (from the catalog schema):

- **`apiVersion`** — Must be `forgeportal/v1`.
- **`kind`** — One of: `service`, `library`, `website`, `api`, `component`, `resource`, `system`, `domain`, `group`, `user`, `template`.
- **`metadata`** — Name, namespace, optional description, tags, links.
- **`spec`** — Optional owner, lifecycle, relations (e.g. dependsOn, providesApi, consumesApi).

### Example: a backend service

```yaml
apiVersion: forgeportal/v1
kind: service
metadata:
  name: my-backend
  namespace: default
  description: Order and payment backend API
  tags:
    - java
    - spring-boot
  links:
    - title: Repo
      url: https://github.com/my-org/my-backend
    - title: Runbook
      url: https://wiki.my-org.com/runbooks/my-backend
spec:
  owner: team-platform
  lifecycle: production
  dependsOn:
    - component:auth-service
  providesApi:
    - https://api.my-org.com/orders
```

- **`metadata.name`** — Short name (1–255 chars); must be unique within the namespace.
- **`metadata.namespace`** — Defaults to `default` if omitted.
- **`metadata.tags`** / **`metadata.links`** — Optional; used for filtering and display.
- **`spec.lifecycle`** — One of `experimental`, `production`, `deprecated`.
- **`spec.dependsOn`** / **`spec.providesApi`** / **`spec.consumesApi`** — Arrays of strings for relationships (exact format can depend on your conventions).

### Minimal valid file

```yaml
apiVersion: forgeportal/v1
kind: component
metadata:
  name: my-app
spec: {}
```

This is enough for the catalog to ingest the entity; other fields are optional.

## Add the file to your repo

1. Create `entity.yaml` in the **root** of your repository (or the path you configured in `discovery.entityFilePath` in `forgeportal.yaml`).
2. Commit and push to the default branch (e.g. `main`):

   ```bash
   git add entity.yaml
   git commit -m "Add ForgePortal entity"
   git push origin main
   ```

## How the entity gets into the catalog

ForgePortal discovers entities in two ways:

1. **Repo scan** — The worker (or a cron) runs a **repo-scan** job. It uses the SCM provider (GitHub/GitLab) and the configured **discovery orgs** in `forgeportal.yaml` to list repos and look for `entity.yaml`. When found, it reads the file and upserts the entity into the catalog.
2. **Webhooks** — If you configured SCM webhooks (e.g. push events), the API receives the event and can trigger ingestion for the changed repo/path.

So either:

- **Configure discovery** in `forgeportal.yaml` (and ensure SCM credentials are set), then run a manual scan from the Admin → Scan page or wait for the scheduled scan, or  
- **Configure webhooks** for your repo so pushes trigger ingestion.

Until discovery orgs and/or webhooks are set up, the platform won’t see new repos automatically; use **Admin → Scan** to trigger a manual repo scan if your setup supports it.

## See the entity in the catalog

1. **Trigger discovery** — Run a manual repo scan (Admin → Scan) or wait for the next scheduled scan / webhook.
2. **Open the catalog** — In the UI, go to **Catalog** (or the main catalog view).
3. **Filter or search** — Find your entity by name, kind, or tags. Click it to see its detail page (metadata, spec, relations, docs if indexed).

You’ve just gone from **zero to a visible entity** in the catalog. Next you can add more entities, set up templates and scorecards, and plug in OIDC for production use.

## Reference: full metadata and spec

From the catalog schema:

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `apiVersion` | `forgeportal/v1` | Yes | Literal |
| `kind` | string | Yes | One of the 12 kinds listed above |
| `metadata.name` | string | Yes | 1–255 chars |
| `metadata.namespace` | string | No | Default `default` |
| `metadata.description` | string | No | Free text |
| `metadata.tags` | string[] | No | Default `[]` |
| `metadata.links` | array | No | `{ title, url }`; url must be valid URL |
| `spec.owner` | string | No | Owner ref (e.g. team name) |
| `spec.lifecycle` | string | No | `experimental` \| `production` \| `deprecated` |
| `spec.dependsOn` | string[] | No | Default `[]` |
| `spec.providesApi` | string[] | No | Default `[]` |
| `spec.consumesApi` | string[] | No | Default `[]` |

For more on the entity model and relations, see [Concepts — Entity model](/docs/concepts/entity-model).
