---
title: Scorecards API
sidebar_position: 4
---

# Scorecards API

The Scorecards API lets you list scorecards, get the latest evaluation per entity, trigger evaluation, run fixes for failing rules, and fetch dashboard aggregates. All endpoints require authentication; some require `scorecard:evaluate` or `action:run`.

Base path: `/api/v1/scorecards`.

---

## Dashboard

**GET** `/api/v1/scorecards/dashboard`

Returns aggregated scorecard stats: level distribution, worst-performing entities, and per-scorecard breakdown. **Must be registered before** any `:entityId` route so that `"dashboard"` is not interpreted as an entity ID.

### Auth

Authenticated user (no specific permission).

### Response

**200 OK**

```json
{
  "data": {
    "totals": { "Gold": 5, "Silver": 10, "Bronze": 3, "none": 2, "total": 20 },
    "worst": [
      {
        "entityId": "uuid",
        "entityName": "my-service",
        "entityKind": "service",
        "level": "Bronze"
      }
    ],
    "byScorecardName": [
      {
        "scorecardName": "Security",
        "appliesToKind": "service",
        "levelBreakdown": { "Gold": 2, "Silver": 4, "Bronze": 1, "none": 1 }
      }
    ]
  }
}
```

### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/scorecards/dashboard"
```

---

## List scorecards

**GET** `/api/v1/scorecards`

Returns all **enabled** scorecards, optionally filtered by entity kind.

### Auth

Authenticated user.

### Query parameters

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `kind`   | string | Filter by entity kind (e.g. `service`) |

### Response

**200 OK**

```json
{
  "data": {
    "scorecards": [
      {
        "id": "uuid",
        "name": "Security",
        "version": "1.0.0",
        "appliesToKind": "service",
        "levels": ["Gold", "Silver", "Bronze"],
        "rules": [
          { "id": "rule-1", "title": "Has README", "level": "Silver", "type": "file-exists" }
        ],
        "createdAt": "2025-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/scorecards?kind=service"
```

---

## Get latest evaluations for entity

**GET** `/api/v1/scorecards/:entityId/latest`

Returns the latest evaluation **per scorecard** for the given entity. Scorecards that apply to the entity but have not been evaluated yet appear with `status: "pending"` and `level: null`.

### Auth

Authenticated user.

### Path parameters

| Name      | Type   | Description |
|-----------|--------|-------------|
| `entityId`| string | Entity UUID |

### Response

**200 OK**

```json
{
  "data": {
    "entityId": "uuid",
    "evaluations": [
      {
        "scorecardId": "uuid",
        "scorecardName": "Security",
        "version": "1.0.0",
        "status": "success",
        "level": "Silver",
        "evaluatedAt": "2025-01-15T10:00:00.000Z",
        "cacheTtlSeconds": 3600,
        "rules": [
          {
            "ruleId": "rule-1",
            "ruleTitle": "Has README",
            "level": "Silver",
            "pass": true,
            "details": {},
            "error": null,
            "fixAction": null
          },
          {
            "ruleId": "rule-2",
            "ruleTitle": "Has LICENSE",
            "level": "Gold",
            "pass": false,
            "details": {},
            "error": null,
            "fixAction": { "scorecardId": "uuid", "ruleId": "rule-2", "templateId": "uuid", "inputs": {} }
          }
        ]
      }
    ]
  }
}
```

### Status values

- `"pending"` — scorecard applies to the entity but has not been evaluated yet. `level` and `evaluatedAt` are `null`.
- `"success"` — all applicable rules were evaluated; level calculated.
- `"partial"` — some rules returned `null` (SCM not configured for this entity); level calculated from non-null rules only.
- `"failed"` — evaluation threw an unexpected error.

### `rules[].pass` values

- `true` — rule passed.
- `false` — rule failed.
- `null` — rule was **not evaluated** (e.g. the entity has no SCM URL, or no SCM provider is configured for the entity's SCM host). Treated as neutral — does not count as a pass or a fail.

`fixAction` is only present for failing rules when a fix is available.

:::tip Rules that require SCM
Rules of type `scm.file.exists` and `scm.anyOf` check the entity's repository directly. If no SCM provider is configured for the entity's host, these rules return `pass: null` (not evaluated) rather than `false`. The entity will show `status: "partial"` and a note indicating which rules were skipped.
:::

### Errors

| Status | Condition |
|--------|-----------|
| 404 | Entity not found |

### Example

```bash
curl -s -b cookies.txt "https://forgeportal.example.com/api/v1/scorecards/550e8400-e29b-41d4-a716-446655440000/latest"
```

---

## Evaluate entity

**POST** `/api/v1/scorecards/:entityId/evaluate`

Manually triggers scorecard evaluation for the entity. Enqueues one `scorecard-eval` job per applicable (enabled) scorecard. Returns immediately with job counts.

### Auth

`scorecard:evaluate` (e.g. platform-admin, template-admin).

### Path parameters

| Name      | Type   | Description |
|-----------|--------|-------------|
| `entityId`| string | Entity UUID |

### Request body

| Field  | Type    | Default | Description |
|--------|---------|---------|-------------|
| `force`| boolean | true    | If true, re-evaluate even when cache is valid |

### Response

**202 Accepted**

```json
{
  "data": {
    "jobsEnqueued": 2,
    "scorecards": [
      { "scorecardId": "uuid", "name": "Security", "jobId": "job-uuid" }
    ]
  }
}
```

If no scorecards apply to the entity's kind, `jobsEnqueued` is 0 and `scorecards` is `[]`.

### Errors

| Status | Condition |
|--------|-----------|
| 404 | Entity not found |

### Example

```bash
curl -s -b cookies.txt -X POST "https://forgeportal.example.com/api/v1/scorecards/550e8400-e29b-41d4-a716-446655440000/evaluate" \
  -H "Content-Type: application/json" \
  -d '{ "force": true }'
```

---

## Fix failing rule

**POST** `/api/v1/scorecards/:entityId/fix`

Starts an automated fix for a failing scorecard rule (e.g. creates a file and opens a PR via the forge-fix-file template). Requires the rule to be failing and the scorecard to define a fix action.

### Auth

`action:run` (e.g. developer or above).

### Path parameters

| Name      | Type   | Description |
|-----------|--------|-------------|
| `entityId`| string | Entity UUID |

### Request body

| Field        | Type   | Required | Description |
|--------------|--------|----------|-------------|
| `scorecardId`| string | yes      | Scorecard UUID |
| `ruleId`     | string | yes      | Rule ID within the scorecard |

### Response

**202 Accepted**

```json
{
  "data": {
    "templateRunId": "uuid",
    "statusUrl": "/api/v1/templates/runs/uuid",
    "branch": "fix/scorecard-rule-rule-1",
    "prTitle": "Fix: Security - Has LICENSE"
  }
}
```

### Errors

| Status | Condition |
|--------|-----------|
| 404 | Entity, scorecard, or rule not found |
| 422 | Rule already passing (no fix needed), or no fix action available for this rule |

### Example

```bash
curl -s -b cookies.txt -X POST "https://forgeportal.example.com/api/v1/scorecards/550e8400-e29b-41d4-a716-446655440000/fix" \
  -H "Content-Type: application/json" \
  -d '{ "scorecardId": "sc-uuid", "ruleId": "rule-2" }'
```
