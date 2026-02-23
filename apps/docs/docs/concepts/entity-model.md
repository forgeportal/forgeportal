---
title: Entity Model
sidebar_position: 2
---

# Entity Model

Entities are the core records in the ForgePortal catalog. Each entity is described by an **`entity.yaml`** file in a Git repository and is identified by **kind**, **namespace**, and **name**. This page documents the full specification, relations, sources, and lifecycle.

## How it works

1. **Source** — An `entity.yaml` file (or another path set by `discovery.entityFilePath`) lives in a repo. It is discovered by a **repo scan** (worker) or by a **webhook** (push to that file).
2. **Validation** — The content is parsed as YAML and validated against the entity schema (`apiVersion`, `kind`, `metadata`, `spec`). Invalid files are skipped or logged; valid ones are **upserted** (create or update by kind + namespace + name).
3. **Storage** — The API/worker writes into `entities` (and updates `entity_sources` for the repo URL and path). Search uses a **search_tsv** (tsvector) column for full-text search.
4. **Relations** — Relations like `dependsOn`, `providesApi`, `consumesApi` are stored; the exact relation types supported are defined in the catalog (e.g. `dependsOn`, `ownedBy`, `partOf`, `providesApi`, `consumesApi`).

:::tip Key concepts
- **Identity**: `kind` + `namespace` + `name` (unique).
- **Source of truth**: Git repo; `entity_sources` table links entity ↔ provider + repo_url + path.
- **Lifecycle**: Optional `spec.lifecycle` — `experimental` \| `production` \| `deprecated`.
:::

## Full `entity.yaml` specification

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiVersion` | `forgeportal/v1` | Yes | Literal; identifies the schema. |
| `kind` | string | Yes | One of: `service`, `library`, `website`, `api`, `component`, `resource`, `system`, `domain`, `group`, `user`, `template`. |
| `metadata.name` | string | Yes | Short name (1–255 chars). Must be unique within the namespace. |
| `metadata.namespace` | string | No | Defaults to `default`. |
| `metadata.description` | string | No | Free-text description. |
| `metadata.tags` | string[] | No | Default `[]`. Used for filtering and display. |
| `metadata.links` | array | No | Each item: `{ title: string, url: string }` (url must be valid). Default `[]`. |
| `spec.owner` | string | No | Owner reference (e.g. team or user id). |
| `spec.lifecycle` | string | No | One of: `experimental`, `production`, `deprecated`. |
| `spec.dependsOn` | string[] | No | List of entity refs or identifiers. Default `[]`. |
| `spec.providesApi` | string[] | No | e.g. API URLs or identifiers. Default `[]`. |
| `spec.consumesApi` | string[] | No | Default `[]`. |

The catalog stores additional **SCM-derived** data (e.g. repo URL, default branch) in the entity row; that is filled during ingestion, not from the YAML.

### Example

```yaml
apiVersion: forgeportal/v1
kind: service
metadata:
  name: orders-api
  namespace: default
  description: Orders and payments API
  tags:
    - java
    - spring-boot
  links:
    - title: Repo
      url: https://github.com/my-org/orders-api
spec:
  owner: team-commerce
  lifecycle: production
  dependsOn:
    - component:auth-service
  providesApi:
    - https://api.example.com/orders
```

## Relations

The system supports **relation types** such as:

- **dependsOn** — This entity depends on another (e.g. service depends on a component).
- **ownedBy** — Ownership (e.g. owned by a team or user).
- **partOf** — This entity is part of a parent (e.g. component part of a system).
- **providesApi** / **consumesApi** — API provision or consumption.

Relations can be expressed in `spec` (e.g. `spec.dependsOn`) and are normalized into the **entity_relations** table (from_entity_id, type, to_entity_id) according to catalog logic.

## Entity sources

The **entity_sources** table records **where** each entity was discovered:

- `entity_id` — References `entities.id`.
- `provider` — SCM provider name (e.g. `github`, `gitlab`).
- `repo_url` — Full repo URL.
- `path` — Path to the entity file (e.g. `entity.yaml`).
- `last_seen_at` — Last time this source was seen during scan or webhook.

One entity can have multiple sources in theory (e.g. same logical entity in two repos); in practice, one source per entity is typical. Sources are updated on every successful ingestion for that repo/path.

## Lifecycle

**Lifecycle** is an optional hint for governance and UI:

| Value | Meaning |
|-------|--------|
| `experimental` | Early or unstable; not production-ready. |
| `production` | In production use. |
| `deprecated` | Scheduled for removal or replacement. |

If omitted, the field is null. Scorecards and dashboards can use lifecycle for filtering or reporting.
