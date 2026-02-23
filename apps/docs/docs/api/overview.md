---
title: API Overview
sidebar_position: 1
---

# API Overview

ForgePortal exposes a **REST API** under the `/api/v1` prefix. This page describes base URL, authentication, error format, pagination, and rate limits.

## Base URL

All endpoints are relative to the API server. Examples assume the server runs at `https://forgeportal.example.com`:

```text
https://forgeportal.example.com/api/v1/...
```

For local development (default port 4000):

```text
http://localhost:4000/api/v1/...
```

## Authentication

- **Session cookie**: After OIDC login, the server sets a signed session cookie (`forgeportal.sid`). Browser and API clients that send this cookie are treated as authenticated.
- **CSRF**: For mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`), the server expects a valid CSRF token when OIDC is enabled. Endpoints under `/api/v1/auth/callback` and `/api/v1/webhooks/` are exempt.
- **Dev mode**: If OIDC is not configured (`auth.oidc.issuer` empty), the server runs in dev mode and bypasses login; all users are treated as authenticated.

For non-browser clients (e.g. `curl` or scripts), use the same session cookie after logging in via the browser, or implement the OIDC flow and send the session cookie on subsequent requests.

## Error format

Errors return a JSON body with a consistent shape:

| Field     | Type   | Description |
|----------|--------|-------------|
| `error`  | string | Short code (e.g. `Bad Request`, `Not Found`, `Conflict`, `Unauthorized`, `Too Many Requests`) |
| `message`| string | Human-readable description |
| `details`| array  | Optional; present for validation errors (e.g. Zod issues) |

**Example (400 Validation):**

```json
{
  "error": "Bad Request",
  "message": "kind: Invalid enum value"
}
```

**Example (404):**

```json
{
  "error": "Not Found",
  "message": "Entity not found"
}
```

**Example (429):**

```json
{
  "error": "Too Many Requests",
  "message": "Search rate limit exceeded: 60 req/min"
}
```

HTTP status codes follow REST conventions: `200` OK, `201` Created, `202` Accepted, `204` No Content, `400` Bad Request, `401` Unauthorized, `403` Forbidden, `404` Not Found, `409` Conflict, `422` Unprocessable Entity, `429` Too Many Requests, `500` Internal Server Error.

## Pagination

Endpoints that return lists support **limit** and **offset** query parameters:

| Parameter | Type   | Default | Description |
|-----------|--------|---------|-------------|
| `limit`  | number | 20      | Max items per page (often capped at 50–100) |
| `offset` | number | 0       | Number of items to skip |

The response usually includes a **pagination** object:

```json
{
  "data": [ ... ],
  "pagination": {
    "offset": 0,
    "limit": 20,
    "total": 42
  }
}
```

Exact parameter names and caps are documented per endpoint (e.g. [Catalog](/docs/api/catalog-api), [Search](/docs/api/search-api)).

## Rate limits

- **Search**: 60 requests per minute per user/key (e.g. `email` or IP). Response `429` with `Retry-After` header when exceeded.
- **Webhooks** (`POST /api/v1/webhooks/scm`): 100 requests per minute per IP; `429` with `Retry-After` when exceeded.
- **Action runs**: 10 runs per minute per user.
- **Template runs**: 5 runs per minute per user.

Other endpoints may be rate-limited in the future; clients should respect `429` and `Retry-After`.

## Summary

| Topic        | Detail |
|-------------|--------|
| Base path   | `/api/v1` |
| Auth        | Session cookie + CSRF for mutations (when OIDC enabled) |
| Errors      | `{ error, message, details? }` |
| Pagination  | `limit` / `offset` + `pagination: { offset, limit, total }` in list responses |
| Rate limits | Search 60/min, webhooks 100/min, action/template runs per user |

See the following pages for per-endpoint details: [Catalog](/docs/api/catalog-api), [Templates & Actions](/docs/api/templates-api), [Scorecards](/docs/api/scorecards-api), [Search](/docs/api/search-api), [Webhooks](/docs/api/webhooks), [Plugins](/docs/api/plugins-api).
