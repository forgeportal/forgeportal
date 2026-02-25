---
title: Action Runs API
sidebar_position: 7
---

# Action Runs API

Action runs are individual step executions created when a template is run or a scorecard fix is triggered. Use these endpoints to list runs, filter by status, and retrieve full run details.

Base path: `/api/v1/action-runs`.

---

## List action runs

**GET** `/api/v1/action-runs`

Returns a paginated list of action runs ordered by most recent first.

### Auth

`action:read` (all authenticated users in dev-bypass mode)

### Query parameters

| Parameter    | Type   | Default | Description |
|--------------|--------|---------|-------------|
| `status`     | string | —       | Filter by status: `queued`, `running`, `success`, `failed`, `canceled` |
| `entityId`   | uuid   | —       | Filter runs by the entity they were triggered for |
| `templateId` | uuid   | —       | Filter runs by the template that created them |
| `limit`      | number | `20`    | Max results (1–200) |
| `offset`     | number | `0`     | Pagination offset |

### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "bbbb0000-0000-0000-0000-000000000001",
      "action_id": "aaaa0000-0000-0000-0000-000000000001",
      "template_id": null,
      "entity_id": null,
      "requested_by": "alex@acmecorp.com",
      "status": "success",
      "input": {},
      "output": { "repoUrl": "https://github.com/acmecorp/my-service" },
      "retry_count": 0,
      "max_retries": 3,
      "started_at": "2026-02-25T14:00:00Z",
      "finished_at": "2026-02-25T14:01:30Z",
      "created_at": "2026-02-25T13:59:58Z"
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "total": 42 }
}
```

### Example

```bash
# List the 5 most recent failed runs
curl -s -b cookies.txt \
  "https://forgeportal.example.com/api/v1/action-runs?status=failed&limit=5"
```

---

## Get action run detail

**GET** `/api/v1/action-runs/:runId`

Returns the full detail of a single action run including all outputs.

### Auth

`action:read`

### Path parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `runId`   | uuid | The action run ID returned by `POST /api/v1/actions/:actionId/run` |

### Response

**200 OK** — same shape as a list item (see above), with full `output` and `error` fields.

**404 Not Found** — run does not exist.

### Example

```bash
curl -s -b cookies.txt \
  "https://forgeportal.example.com/api/v1/action-runs/bbbb0000-0000-0000-0000-000000000001"
```

---

## Related endpoints

- **Trigger a run:** `POST /api/v1/actions/:actionId/run` — see [Templates & Actions API](/docs/api/templates-api)
- **Cancel a run:** `POST /api/v1/actions/runs/:runId/cancel`
- **Run logs:** `GET /api/v1/actions/runs/:runId/logs`
