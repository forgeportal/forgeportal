---
title: Search API
sidebar_position: 5
---

# Search API

The Search API provides **unified full-text search** over catalog entities and indexed documentation. Results are merged and sorted by score. Rate limit: 60 requests per minute per user (or IP if unauthenticated).

Base path: `/api/v1/search`.

---

## Search

**GET** `/api/v1/search`

Searches across entities and/or docs depending on `scope`. Response includes `data` (items with type, id, title, excerpt, url, score, meta), `pagination`, `query`, and `scope`.

### Auth

`entity:read`

### Query parameters

| Parameter | Type   | Default | Description |
|-----------|--------|---------|-------------|
| `q`      | string | —       | **Required.** Search query (1–200 chars). |
| `scope`  | string | `all`   | One of: `all`, `entities`, `docs`. `entities` = catalog only; `docs` = indexed docs only; `all` = both. |
| `offset` | number | 0       | Pagination offset. |
| `limit`  | number | 20      | Page size (1–50). |

### Response

**200 OK**

```json
{
  "data": [
    {
      "type": "entity",
      "id": "entity-uuid",
      "title": "my-service",
      "excerpt": "Backend service for ...",
      "url": "/catalog/entity/entity-uuid",
      "score": 0.95,
      "meta": {
        "kind": "service",
        "namespace": "default",
        "name": "my-service",
        "owner_ref": "github.com/my-org",
        "lifecycle": "production"
      }
    },
    {
      "type": "doc",
      "id": "doc-uuid",
      "title": "README.md",
      "excerpt": "...",
      "url": "/catalog/entity/entity-uuid/docs/README.md",
      "score": 0.8,
      "meta": {
        "entity_id": "entity-uuid",
        "path": "README.md"
      }
    }
  ],
  "pagination": { "offset": 0, "limit": 20, "total": 2 },
  "query": "service",
  "scope": "all"
}
```

Response includes a **Cache-Control** header (e.g. `private, max-age=10`).

### Errors

| Status | Condition |
|--------|-----------|
| 400 | Missing or invalid `q` (empty or too long), or invalid `scope` |
| 401 | Not authenticated |
| 403 | Missing `entity:read` |
| 429 | Rate limit exceeded (60 req/min). Response includes `Retry-After` header. |

### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/search?q=api&scope=entities&limit=10&offset=0"
```

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/search?q=readme&scope=docs"
```
