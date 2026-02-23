---
title: Templates & Actions
sidebar_position: 4
---

# Templates & Actions

**Templates** are multi-step workflows (e.g. "create repo → add files → open PR") that users start from the UI. Each step runs an **action** (e.g. `scm.createRepo@v1`, `ci.bootstrap@v1`). Steps are executed by the **action runner** in the worker, using a **PostgreSQL-backed queue** and **Handlebars** for rendering step inputs. This page covers the template format, execution flow, retry policy, and audit logging.

## How it works

1. **User** starts a template run from the UI (POST template run with user inputs).
2. **API** validates inputs against the template's parameter schema, creates a **template_run** and the first **action_run**, then returns.
3. **Worker** (action runner) polls **action_runs**, **claims** a run (lock by worker id), executes the action handler (SCM or platform), then marks the run **success** or **failed/retry**.
4. **Template orchestrator** (called by the runner) on success: saves step outputs, queues the **next** step's action_run (with Handlebars-rendered input). On final failure (after retries): marks template run failed; on terminal success: marks template run success.
5. **Audit log** is written for each terminal action run (success or final failure).

:::tip Key concepts
- **Template** = YAML with `metadata` + `spec.parameters` + `spec.steps` + optional `spec.outputs` and `spec.skeletonFiles`. Steps reference actions by id (e.g. `scm.createRepo@v1`).
- **Action run** = one execution of one action; stored in `action_runs` with status (queued → running → success/failed/canceled). **Retry**: default `max_retries` (e.g. 3); failed runs can be retried until max.
- **Handlebars** = step `input` and optional `if` are rendered with user inputs + previous step outputs (e.g. `{{name}}`, `{{steps.step-1.outputs.repoUrl}}`).
:::

## Template YAML format

| Field | Description |
|-------|-------------|
| `apiVersion` | `forgeportal/v1` |
| `kind` | `Template` |
| `metadata.name` | Unique template id. |
| `metadata.title` | Human-readable title. |
| `metadata.description` | Description. |
| `metadata.owner` / `metadata.tags` | Optional. |
| `spec.parameters` | Array of `{ id, title, type, required?, default?, enum?, pattern?, ... }`. Types: `string`, `boolean`, `number`, `array`. |
| `spec.steps` | Non-empty array of `{ id, action, input, if? }`. `action` = action id (e.g. `scm.createRepo@v1`). `input` = key-value map (values can be Handlebars). `if` = optional Handlebars condition to skip step. |
| `spec.outputs` | Optional map of output names to Handlebars expressions (e.g. `repoUrl: '{{steps.step-1.outputs.repoUrl}}'`). |
| `spec.skeletonFiles` | Optional map: path → Handlebars template string for file content. |

### Example

```yaml
apiVersion: forgeportal/v1
kind: Template
metadata:
  name: create-service-repo
  title: Create a new service repo
  description: Creates a repo, adds README, and opens a PR.
spec:
  parameters:
    - id: name
      title: Repo name
      type: string
      required: true
    - id: provider
      title: SCM
      type: string
      enum: [github, gitlab]
  steps:
    - id: step-1
      action: scm.createRepo@v1
      input:
        repo: "{{name}}"
    - id: step-2
      action: scm.createOrUpdateFile@v1
      if: "{{eq provider 'github'}}"
      input:
        repoUrl: "{{steps.step-1.outputs.repoUrl}}"
        path: README.md
        content: "# {{name}}\n"
  outputs:
    repoUrl: "{{steps.step-1.outputs.repoUrl}}"
```

## Step execution and Handlebars

- **Context** for rendering: user inputs + previous step outputs (e.g. `steps.step-1.outputs`). Skeleton files are rendered with the same context.
- **Conditional step**: if `if` is present, it is evaluated as a Handlebars expression; if falsy, the step is skipped (or not queued).
- **Action lookup**: step `action` (e.g. `scm.createRepo@v1`) is resolved to an `action_id` in the DB; the runner invokes the registered handler for that action.

## Action runner and queue

- **Table**: `action_runs` — columns include status (`queued` \| `running` \| `success` \| `failed` \| `canceled`), `retry_count`, `max_retries` (default 3), `locked_by`, `locked_at`, `input`, `output`.
- **Claim**: Worker calls `claimNext(workerId)` to lock and dequeue one run. Only **queued** runs with `retry_count <= max_retries` (and optional `next_attempt_at`) are eligible.
- **Concurrency**: Configurable (e.g. 5); the runner keeps that many runs in flight.
- **Completion**: On success, runner marks run success, writes output, then notifies the template orchestrator. On failure, runner calls `markFailedOrRetry` — either schedules a retry (`next_attempt_at`, increment `retry_count`) or marks final failure.

## Retry policy

- **max_retries** (e.g. 3) is set when the run is created. Transient failures can retry up to that count; after that, the run is marked **failed** and the template run (if any) is marked failed.
- **Audit log** is written only on **terminal** states (success or final failure), not on each retry.

## Audit logging

For each action run that reaches a terminal state, the runner appends an **audit log** entry: actor, action name, target_type `action_run`, target_id, and metadata (run_id, entity_id, status, outputs, links, error if failed). This supports compliance and debugging.
