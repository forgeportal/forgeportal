# Actions V1 — Contracts (ForgePortal)

> **Implementation (TypeScript):** Each action is implemented as an async handler with typed inputs and outputs. Use the error taxonomy for failures; never log secrets. See `packages/plugin-sdk-server` for action provider interfaces.

Actions are **the only way** templates and “Fix” buttons change the world (SCM writes, PR/MR, catalog updates).
All actions must:
- be permissioned
- be auditable
- be (as much as possible) idempotent
- never leak secrets in logs

GitHub file writes are based on the “Create or update file contents” endpoint (base64 content, commit message, SHA for updates). :contentReference[oaicite:5]{index=5}  
Backstage’s scaffolder model (built-in actions + SCM action modules) is the conceptual inspiration. :contentReference[oaicite:6]{index=6}

---

## Common Types

### RepoRef
```json
{
  "provider": "github|gitlab",
  "owner": "org-or-group",
  "repo": "repo-name",
  "defaultBranch": "main"
}
```

### Action Result Envelope

```json
{
  "status": "success|failed",
  "outputs": {},
  "links": [],
  "warnings": []
}
```

### Error taxonomy (mandatory)

* `VALIDATION_ERROR` (bad input)
* `AUTH_ERROR` (missing/invalid permissions)
* `NOT_FOUND` (repo/file/entity missing)
* `CONFLICT` (e.g., concurrent write, stale SHA)
* `RATE_LIMITED`
* `REMOTE_ERROR` (provider/API failure)
* `INTERNAL_ERROR`

---

## A01 — scm.createRepo

**ID**: `scm.createRepo@v1`
**Owner module**: `scm`
**Purpose**: Create GitHub repo or GitLab project.

### Inputs

```json
{
  "provider": "github|gitlab",
  "owner": "org-or-group",
  "repo": "repo-name",
  "visibility": "private|internal|public",
  "description": "string",
  "initWithReadme": false
}
```

### Outputs

```json
{
  "repoUrl": "https://...",
  "defaultBranch": "main"
}
```

### Permissions

* `scm:repo:create` scoped to `owner`

### Idempotency

* If repo already exists, return success with existing URL (unless name conflict with different namespace).

### Provider notes

* GitLab create project: `POST /projects`. ([GitLab Docs][1])
* GitHub uses repository creation endpoints; file creation can follow with contents API. ([GitHub Docs][2])

---

## A02 — scm.createOrUpdateFile

**ID**: `scm.createOrUpdateFile@v1`
**Owner module**: `scm`
**Purpose**: Write a single file to default branch or a working branch.

### Inputs

```json
{
  "repo": { "provider":"github|gitlab", "owner":"...", "repo":"...", "defaultBranch":"main" },
  "path": "README.md",
  "contentBase64": "bXkgZmlsZQ==",
  "message": "commit message",
  "branch": "main",
  "expectedSha": "optional-sha-for-update"
}
```

### Outputs

```json
{
  "commitSha": "string",
  "fileUrl": "https://..."
}
```

### Permissions

* `scm:contents:write` scoped to repo
* Extra GitHub nuance: modifying `.github/workflows/*` requires `workflow` scope (classic tokens) or “Workflows: write” for fine-grained/app tokens. ([GitHub Docs][2])

### Idempotency

* If existing content hash equals new content hash => no-op success.
* If update requested with stale `expectedSha` => `CONFLICT`.

---

## A03 — scm.pushSkeleton

**ID**: `scm.pushSkeleton@v1`
**Owner module**: `scm`
**Purpose**: Write multiple files (skeleton) as a sequence of file writes.

### Inputs

```json
{
  "repo": { "...": "..." },
  "branch": "main|feature/...",
  "message": "initial skeleton",
  "files": [
    { "path": "README.md", "contentBase64": "..." },
    { "path": "docs/index.md", "contentBase64": "..." }
  ]
}
```

### Outputs

```json
{
  "commitShas": ["..."],
  "changedFiles": ["README.md","docs/index.md"]
}
```

### Idempotency

* Treat each file step as in A02 (hash check).
* Ensure deterministic ordering to reduce conflicts.

---

## A04 — scm.openPrOrMr

**ID**: `scm.openPrOrMr@v1`
**Owner module**: `scm`
**Purpose**: Open PR (GitHub) or MR (GitLab) from working branch to base.

### Inputs

```json
{
  "repo": { "...": "..." },
  "baseBranch": "main",
  "headBranch": "feature/forgeportal-fix",
  "title": "string",
  "body": "string"
}
```

### Outputs

```json
{
  "url": "https://...",
  "number": 123
}
```

### Idempotency

* If a PR/MR already exists for same head→base => return it.

---

## A05 — scm.ensureWebhook

**ID**: `scm.ensureWebhook@v1`
**Owner module**: `scm`
**Purpose**: Ensure webhook exists for push/merge events.

### Inputs

```json
{
  "repo": { "...": "..." },
  "callbackUrl": "https://forgeportal/api/webhooks/scm",
  "events": ["push","merge_request|pull_request"]
}
```

### Outputs

```json
{
  "webhookId": "string",
  "webhookUrl": "https://..."
}
```

### Idempotency

* Search existing hook by callback URL; update if needed.

---

## A06 — catalog.registerEntity

**ID**: `catalog.registerEntity@v1`
**Owner module**: `catalog`
**Purpose**: Upsert entity + bind to SCM source.

### Inputs

```json
{
  "entity": {
    "kind": "service",
    "namespace": "default",
    "name": "orders",
    "ownerRef": "team:payments",
    "lifecycle": "production",
    "tags": ["java","payments"],
    "links": [{"title":"Runbook","url":"..."}],
    "scm": {"provider":"github","owner":"org","repo":"orders","defaultBranch":"main"},
    "spec": {}
  },
  "source": { "provider":"github|gitlab", "repoUrl":"https://...", "path":"/" }
}
```

### Outputs

```json
{ "entityId": "uuid" }
```

### Idempotency

* Unique key: `(kind, namespace, name)`.

---

## A07 — docs.bootstrap

**ID**: `docs.bootstrap@v1`
**Owner module**: `docs`
**Purpose**: Add docs skeleton (`/docs`) and bind docs path.

### Inputs

```json
{
  "repo": { "...": "..." },
  "docsPath": "docs",
  "format": "markdown"
}
```

### Outputs

```json
{ "docsHome": "docs/index.md" }
```

---

## A08 — ci.bootstrap

**ID**: `ci.bootstrap@v1`
**Owner module**: `ci`
**Purpose**: Add CI pipeline config depending on provider.

### Inputs

```json
{
  "repo": { "...": "..." },
  "type": "github-actions|gitlab-ci",
  "language": "go|java|node",
  "buildCommand": "string",
  "testCommand": "string"
}
```

### Outputs

```json
{ "ciFile": ".github/workflows/ci.yml | .gitlab-ci.yml" }
```

### Provider note

* Writing `.github/workflows/*` triggers GitHub “workflow” permission requirements. ([GitHub Docs][2])

---

## A09 — k8s.bootstrap

**ID**: `k8s.bootstrap@v1`
**Owner module**: `k8s`
**Purpose**: Add K8s manifest skeleton or Helm chart skeleton.

### Inputs

```json
{
  "repo": { "...": "..." },
  "mode": "manifests|helm",
  "servicePort": 8080
}
```

### Outputs

```json
{ "path": "k8s/ | charts/<name>/" }
```

---

## A10 — scorecards.evaluate

**ID**: `scorecards.evaluate@v1`
**Owner module**: `scorecards`
**Purpose**: Evaluate a scorecard on an entity and store result.

Scorecards are rulesets with levels; this model is validated in Port documentation (rules + levels + standards). ([docs.port.io][3])

### Inputs

```json
{
  "entityId": "uuid",
  "scorecardId": "uuid",
  "force": false
}
```

### Outputs

```json
{
  "status": "success|failed|partial",
  "level": "Bronze|Silver|Gold",
  "results": [
    { "ruleId":"readme", "pass":true, "level":"Bronze", "details":{} }
  ]
}
```

### Idempotency

* Cache by `(entityId, scorecardId)` with TTL; if not `force`, reuse cached evaluation.
