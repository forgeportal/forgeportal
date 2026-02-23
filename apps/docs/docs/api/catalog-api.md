---
title: Catalog API
sidebar_position: 2
---

# Catalog API

The Catalog API manages **entities** (services, libraries, components, etc.) and their **relations** and **sources**. All catalog endpoints require authentication and the `entity:read` permission (or `entity:create` / `entity:update` / `entity:delete` for mutations).

Base path: `/api/v1/catalog`.

---

## List entities

**GET** `/api/v1/catalog/entities`

Returns a paginated list of entities with optional filters.

### Auth

`entity:read`

### Query parameters

| Parameter  | Type   | Default | Description |
|------------|--------|---------|-------------|
| `kind`    | string | —       | Filter by entity kind (e.g. `service`, `library`, `component`) |
| `owner`   | string | —       | Filter by owner (e.g. `github.com/my-org`) |
| `tag`     | string | —       | Filter by tag |
| `lifecycle` | string | —     | Filter by lifecycle (`experimental`, `production`, `deprecated`) |
| `q`       | string | —       | Full-text search over entity metadata |
| `offset`  | number | 0       | Pagination offset |
| `limit`   | number | 20      | Page size (1–100) |

### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "uuid",
      "kind": "service",
      "namespace": "default",
      "name": "my-service",
      "owner_ref": "github.com/my-org",
      "lifecycle": "production",
      "tags": ["api", "backend"],
      "links": [{ "title": "Repo", "url": "https://github.com/my-org/my-service" }],
      "scm": {},
      "spec": {},
      "created_at": "2025-01-15T10:00:00.000Z",
      "updated_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "pagination": { "offset": 0, "limit": 20, "total": 1 }
}
```

### Errors

| Status | Condition |
|--------|-----------|
| 400 | Invalid query (e.g. invalid enum for `kind` or `lifecycle`) |
| 401 | Not authenticated |
| 403 | Missing `entity:read` |

### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/catalog/entities?kind=service&limit=10&offset=0"
```

---

## Get entity by ID

**GET** `/api/v1/catalog/entities/:id`

Returns a single entity with its **relations** and **sources**. Relations are included in the same response (no separate relations endpoint).

### Auth

`entity:read`

### Path parameters

| Name | Type   | Description |
|------|--------|-------------|
| `id` | string | Entity UUID |

### Response

**200 OK**

```json
{
  "data": {
    "entity": {
      "id": "uuid",
      "kind": "service",
      "namespace": "default",
      "name": "my-service",
      "owner_ref": "github.com/my-org",
      "lifecycle": "production",
      "tags": [],
      "links": [],
      "scm": {},
      "spec": {},
      "created_at": "2025-01-15T10:00:00.000Z",
      "updated_at": "2025-01-15T10:00:00.000Z"
    },
    "relations": [
      {
        "id": "rel-uuid",
        "from_entity_id": "uuid",
        "type": "dependsOn",
        "to_entity_id": "other-uuid",
        "created_at": "2025-01-15T10:00:00.000Z"
      }
    ],
    "sources": [
      {
        "id": "src-uuid",
        "entity_id": "uuid",
        "provider": "github",
        "owner": "my-org",
        "repo": "my-service",
        "created_at": "2025-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

Relation types: `dependsOn`, `ownedBy`, `partOf`, `providesApi`, `consumesApi`.

### Errors

| Status | Condition |
|--------|-----------|
| 404 | Entity not found |
| 401 | Not authenticated |
| 403 | Missing `entity:read` |

### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/catalog/entities/550e8400-e29b-41d4-a716-446655440000"
```

---

## Create entity

**POST** `/api/v1/catalog/entities`

Creates a new entity. Relations can be set at creation time.

### Auth

`entity:create`

### Request body

| Field           | Type   | Required | Description |
|-----------------|--------|----------|-------------|
| `kind`         | string | yes      | One of: `service`, `library`, `website`, `api`, `component`, `resource`, `system`, `domain`, `group`, `user`, `template` |
| `namespace`    | string | no       | Default `default` |
| `name`         | string | yes      | 1–255 chars |
| `owner_ref`    | string | no       | Owner reference (e.g. team or SCM org) |
| `lifecycle`    | string | no       | `experimental`, `production`, `deprecated` |
| `tags`         | string[] | no     | Array of tags |
| `links`        | array  | no       | `[{ "title": string, "url": string (URL) }]` |
| `scm`          | object | no       | `{ owner?, repo? }` for SCM identifiers |
| `spec`         | object | no       | Arbitrary spec key-value |
| `relations`    | array  | no       | `[{ "type": RelationType, "target_entity_id": "uuid" }]` |

### Response

**201 Created**

```json
{
  "data": {
    "entity": { ... },
    "relations": [ ... ],
    "sources": [ ... ]
  }
}
```

### Errors

| Status | Condition |
|--------|-----------|
| 400 | Validation failed (invalid kind, name, links, relations) |
| 401 | Not authenticated |
| 403 | Missing `entity:create` |

### Example

```bash
curl -s -b cookies.txt -X POST "https://forgeportal.example.com/api/v1/catalog/entities" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "service",
    "name": "my-api",
    "tags": ["rest"],
    "relations": [{ "type": "dependsOn", "target_entity_id": "550e8400-e29b-41d4-a716-446655440000" }]
  }'
```

---

## Update entity

**PUT** `/api/v1/catalog/entities/:id`

Updates an existing entity. Only provided fields are updated. `kind`, `namespace`, and `name` cannot be changed. Requires ownership for non–platform-admin users (when ownership is enforced).

### Auth

`entity:update` and (when applicable) ownership of the entity.

### Path parameters

| Name | Type   | Description |
|------|--------|-------------|
| `id` | string | Entity UUID |

### Request body

Same fields as create, all optional; `kind`, `namespace`, `name` are omitted. Partial updates supported.

### Response

**200 OK**

```json
{
  "data": {
    "entity": { ... },
    "relations": [ ... ],
    "sources": [ ... ]
  }
}
```

### Errors

| Status | Condition |
|--------|-----------|
| 400 | Validation failed |
| 404 | Entity not found |
| 409 | Conflict (e.g. duplicate) |
| 401 | Not authenticated |
| 403 | Missing `entity:update` or not owner |

### Example

```bash
curl -s -b cookies.txt -X PUT "https://forgeportal.example.com/api/v1/catalog/entities/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{ "lifecycle": "production", "tags": ["api", "v2"] }'
```

---

## Delete entity

**DELETE** `/api/v1/catalog/entities/:id`

Deletes an entity and its relations/sources.

### Auth

`entity:delete`

### Path parameters

| Name | Type   | Description |
|------|--------|-------------|
| `id` | string | Entity UUID |

### Response

**204 No Content** — no body.

### Errors

| Status | Condition |
|--------|-----------|
| 404 | Entity not found |
| 401 | Not authenticated |
| 403 | Missing `entity:delete` |

### Example

```bash
curl -s -b cookies.txt -X DELETE "https://forgeportal.example.com/api/v1/catalog/entities/550e8400-e29b-41d4-a716-446655440000"
```
