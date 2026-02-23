---
title: Templates & Action Runs API
sidebar_position: 3
---

# Templates & Action Runs API

This section covers **templates** (run a template, get run status, list runs, cancel) and **actions** (trigger an action run, get run status, logs, list runs, cancel). All endpoints require authentication and the appropriate permission.

Base paths: `/api/v1/templates`, `/api/v1/actions`.

---

## Templates

### List templates

**GET** `/api/v1/templates`

Returns all registered templates (id, name, version, title, description, tags, parameters).

#### Auth

`template:read`

#### Response

**200 OK**

```json
{
  "data": {
    "templates": [
      {
        "id": "uuid",
        "name": "create-repo",
        "version": "1.0.0",
        "title": "Create Repository",
        "description": "Creates a new repo in the SCM",
        "tags": ["scm"],
        "parameters": [
          { "id": "repoName", "title": "Repo name", "type": "string", "required": true }
        ]
      }
    ]
  }
}
```

#### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/templates"
```

---

### Get template by ID

**GET** `/api/v1/templates/:id`

Returns a single template including full schema (steps, outputs).

#### Auth

`template:read`

#### Path parameters

| Name | Type   | Description |
|------|--------|-------------|
| `id` | string | Template UUID |

#### Response

**200 OK**

```json
{
  "data": {
    "id": "uuid",
    "name": "create-repo",
    "version": "1.0.0",
    "title": "Create Repository",
    "description": "...",
    "tags": [],
    "parameters": [],
    "steps": [ ... ],
    "outputs": { ... }
  }
}
```

#### Errors

| Status | Condition |
|--------|-----------|
| 404 | Template not found |

#### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/templates/550e8400-e29b-41d4-a716-446655440000"
```

---

### Run template

**POST** `/api/v1/templates/run`

Starts a template run. Returns immediately with a run ID; poll the run status endpoint for completion.

#### Auth

`template:run`

#### Request body

| Field        | Type   | Required | Description |
|--------------|--------|----------|-------------|
| `templateId`| string (UUID) | yes | Template ID |
| `inputs`    | object | no       | Key-value inputs for template parameters (default `{}`) |

#### Response

**202 Accepted**

```json
{
  "data": { "runId": "uuid", "status": "running" }
}
```

#### Errors

| Status | Condition |
|--------|-----------|
| 400 | Validation failed (invalid body) |
| 429 | Rate limit: max 5 template runs per minute per user |

#### Example

```bash
curl -s -b cookies.txt -X POST "https://forgeportal.example.com/api/v1/templates/run" \
  -H "Content-Type: application/json" \
  -d '{ "templateId": "550e8400-e29b-41d4-a716-446655440000", "inputs": { "repoName": "my-repo" } }'
```

---

### Get template run status

**GET** `/api/v1/templates/runs/:runId`

Returns the status of a template run, including steps (action runs) and resolved outputs.

#### Auth

`template:read`

#### Path parameters

| Name   | Type   | Description |
|--------|--------|-------------|
| `runId`| string | Template run UUID |

#### Response

**200 OK**

```json
{
  "data": {
    "runId": "uuid",
    "templateId": "uuid",
    "requestedBy": "user@example.com",
    "status": "success",
    "currentStep": "step-2",
    "steps": [
      {
        "stepId": "step-1",
        "actionId": "action-uuid",
        "status": "success",
        "outputs": {},
        "startedAt": "2025-01-15T10:00:00.000Z",
        "finishedAt": "2025-01-15T10:00:01.000Z"
      }
    ],
    "outputs": { "repoUrl": "https://github.com/org/repo" },
    "createdAt": "2025-01-15T10:00:00.000Z",
    "finishedAt": "2025-01-15T10:00:05.000Z"
  }
}
```

`status`: `running`, `success`, `failed`, `canceled`.

#### Errors

| Status | Condition |
|--------|-----------|
| 404 | Template run not found |

#### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/templates/runs/550e8400-e29b-41d4-a716-446655440000"
```

---

### List template runs

**GET** `/api/v1/templates/runs`

Returns a paginated list of template runs with optional status filter.

#### Auth

`template:read`

#### Query parameters

| Parameter | Type   | Default | Description |
|-----------|--------|---------|-------------|
| `status` | string | —       | Filter: `running`, `success`, `failed`, `canceled` |
| `limit`  | number | 20      | Page size (1–200) |
| `offset` | number | 0       | Pagination offset |

#### Response

**200 OK**

```json
{
  "data": {
    "runs": [ { "id": "uuid", "template_id": "uuid", "status": "success", ... } ],
    "total": 42
  }
}
```

#### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/templates/runs?status=running&limit=10"
```

---

### Cancel template run

**POST** `/api/v1/templates/runs/:runId/cancel`

Cancels a running template run (queued action runs are marked canceled).

#### Auth

`template:run`

#### Path parameters

| Name   | Type   | Description |
|--------|--------|-------------|
| `runId`| string | Template run UUID |

#### Response

**200 OK**

```json
{
  "data": { "runId": "uuid", "status": "canceled" }
}
```

#### Errors

| Status | Condition |
|--------|-----------|
| 404 | Template run not found |
| 409 | Run not in `running` state |

#### Example

```bash
curl -s -b cookies.txt -X POST "https://forgeportal.example.com/api/v1/templates/runs/550e8400-e29b-41d4-a716-446655440000/cancel"
```

---

## Actions

### Run action

**POST** `/api/v1/actions/:actionId/run`

Enqueues an action run. Returns immediately with a run ID.

#### Auth

`action:run`

#### Path parameters

| Name      | Type   | Description |
|-----------|--------|-------------|
| `actionId`| string | Action UUID |

#### Request body

| Field           | Type   | Required | Description |
|-----------------|--------|----------|-------------|
| `input`        | object | no       | Action input (default `{}`) |
| `entityId`     | string (UUID) | no | Optional entity context |
| `idempotencyKey` | string | no     | Optional key for idempotent run (max 255 chars) |

If `idempotencyKey` is sent and a run with that key already exists, the API returns **200** with the existing run (no new run created).

#### Response

**202 Accepted**

```json
{
  "data": { "runId": "uuid", "status": "queued" }
}
```

**200 OK** (idempotent replay)

```json
{
  "data": { "runId": "uuid", "cached": true, "status": "success", "output": { ... } }
}
```

#### Errors

| Status | Condition |
|--------|-----------|
| 400 | Validation failed |
| 404 | Action not found |
| 429 | Rate limit: max 10 action runs per minute per user |

#### Example

```bash
curl -s -b cookies.txt -X POST "https://forgeportal.example.com/api/v1/actions/550e8400-e29b-41d4-a716-446655440000/run" \
  -H "Content-Type: application/json" \
  -d '{ "input": { "branch": "main" }, "entityId": "entity-uuid" }'
```

---

### Get action run status

**GET** `/api/v1/actions/runs/:runId`

Returns run details: status, input, output, links, timestamps.

#### Auth

`action:read`

#### Path parameters

| Name   | Type   | Description |
|--------|--------|-------------|
| `runId`| string | Action run UUID |

#### Response

**200 OK**

```json
{
  "data": {
    "runId": "uuid",
    "actionId": "uuid",
    "entityId": "uuid",
    "requestedBy": "user@example.com",
    "status": "success",
    "input": {},
    "output": {},
    "links": [],
    "retryCount": 0,
    "maxRetries": 3,
    "startedAt": "2025-01-15T10:00:00.000Z",
    "finishedAt": "2025-01-15T10:00:01.000Z",
    "createdAt": "2025-01-15T10:00:00.000Z"
  }
}
```

#### Errors

| Status | Condition |
|--------|-----------|
| 404 | Run not found |

#### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/actions/runs/550e8400-e29b-41d4-a716-446655440000"
```

---

### Get action run logs

**GET** `/api/v1/actions/runs/:runId/logs`

Returns log entries for an action run.

#### Auth

`action:read`

#### Path parameters

| Name   | Type   | Description |
|--------|--------|-------------|
| `runId`| string | Action run UUID |

#### Response

**200 OK**

```json
{
  "data": {
    "logs": [
      { "id": "uuid", "run_id": "uuid", "level": "info", "message": "...", "created_at": "..." }
    ]
  }
}
```

#### Errors

| Status | Condition |
|--------|-----------|
| 404 | Run not found |

#### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/actions/runs/550e8400-e29b-41d4-a716-446655440000/logs"
```

---

### List action runs

**GET** `/api/v1/actions/runs`

Returns action runs, optionally filtered by entity or user. Query params: `entityId`, `requestedBy`, `limit` (default 20, max 100). If none of `entityId`/`requestedBy` is set, returns runs for the current user.

#### Auth

`action:read`

#### Response

**200 OK**

```json
{
  "data": { "runs": [ ... ], "total": 10 }
}
```

#### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/actions/runs?entityId=entity-uuid&limit=20"
```

---

### Cancel action run

**POST** `/api/v1/actions/runs/:runId/cancel`

Cancels a queued or running action run.

#### Auth

`action:run`

#### Path parameters

| Name   | Type   | Description |
|--------|--------|-------------|
| `runId`| string | Action run UUID |

#### Response

**200 OK**

```json
{
  "data": { "runId": "uuid", "status": "canceled" }
}
```

#### Errors

| Status | Condition |
|--------|-----------|
| 404 | Run not found |
| 409 | Run not in a cancelable state |

#### Example

```bash
curl -s -b cookies.txt -X POST "https://forgeportal.example.com/api/v1/actions/runs/550e8400-e29b-41d4-a716-446655440000/cancel"
```
