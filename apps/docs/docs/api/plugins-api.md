---
title: Plugins API
sidebar_position: 7
---

# Plugins API

The Plugins API exposes the list of loaded plugins (admin only) and a status endpoint with enabled IDs and public (non-secret) config for all authenticated users. Admin can persist enable/disable overrides via PATCH.

Base path: `/api/v1/plugins` and `/api/v1/admin/plugins`.

---

## List plugins (admin)

**GET** `/api/v1/plugins`

Returns the **full list** of loaded plugins (metadata, status, config shape). Intended for platform administrators.

### Auth

`admin:plugins`

### Response

**200 OK**

The response body is the array of loaded plugins as returned by the plugin loader. Each item typically includes:

- `id`: Plugin ID (e.g. `pagerduty`, `slack-notify`)
- `status`: `enabled` | `disabled`
- `version`, `name`, and other manifest fields
- Config and metadata as defined by the loader (no secrets).

Exact shape is implementation-defined; the API returns the same structure as used internally (e.g. `LoadedPlugin[]`).

### Errors

| Status | Condition |
|--------|-----------|
| 401 | Not authenticated |
| 403 | Missing `admin:plugins` |

### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/plugins"
```

---

## Plugins status (all authenticated)

**GET** `/api/v1/plugins/status`

Returns **enabled plugin IDs** and their **public (non-secret) config** only. Safe for any authenticated user to see.

### Auth

Authenticated user (no specific permission).

### Response

**200 OK**

```json
{
  "enabledIds": ["pagerduty", "slack-notify"],
  "configs": {
    "pagerduty": {
      "apiEndpoint": "https://api.pagerduty.com"
    },
    "slack-notify": {
      "defaultChannel": "#alerts"
    }
  }
}
```

- `enabledIds`: Array of plugin IDs that are currently enabled.
- `configs`: Object keyed by plugin ID; values are the public config (secret keys stripped). Only enabled plugins with non-empty public config appear.

### Errors

| Status | Condition |
|--------|-----------|
| 401 | Not authenticated |

### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/plugins/status"
```

---

## Update plugin override (admin)

**PATCH** `/api/v1/admin/plugins/:id`

Persists an enable/disable override for a plugin. The change takes effect after the server is restarted.

### Auth

`admin:plugins`

### Path parameters

| Name | Type   | Description |
|------|--------|-------------|
| `id` | string | Plugin ID (e.g. `pagerduty`) |

### Request body

| Field     | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `enabled` | boolean | yes      | Whether the plugin should be enabled after restart. |

### Response

**200 OK**

```json
{
  "id": "pagerduty",
  "enabled": false,
  "message": "Override saved. Restart the server for the change to take effect."
}
```

### Errors

| Status | Condition |
|--------|-----------|
| 400 | Body missing or invalid (e.g. `enabled` not boolean) |
| 404 | Plugin ID not found in loaded plugins |
| 401 | Not authenticated |
| 403 | Missing `admin:plugins` |

### Example

```bash
curl -s -b cookies.txt -X PATCH "https://forgeportal.example.com/api/v1/admin/plugins/pagerduty" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false }'
```
