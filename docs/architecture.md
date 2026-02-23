# ARCHITECTURE — ForgePortal v1.1

> **Scope:** Concrete architecture for V1 (self-hosted), supporting **GitHub + GitLab**, **Kubernetes + docker-compose**, with the **simplest plugin model in the IDP space** while matching Backstage core primitives (catalog, templates, docs, search, scorecards). Ship in 8-12 weeks.

---

# PART A — Architecture Review (issues in previous v1.0 design)

## Issue Table

| # | Area | Issue | Proposed Fix | Tradeoff |
|---|------|-------|-------------|----------|
| 1 | **Framework** | "Fastify or NestJS" left undecided — slows milestone 0 and forces a revisit | Lock **Fastify** (lighter, faster startup, less magic). NestJS adds DI/decorator overhead that does not pay off at our scale in V1. | Loses NestJS ecosystem (guards, interceptors); acceptable because our modules are small. |
| 2 | **Plugin model** | "One plugin type" is described but no manifest format, no local-dev story, no versioning rules | Define `forgeportal-plugin.json` manifest with semver `engineVersion` field, capability enum, and entry points. Ship `create-forge-plugin` CLI scaffolder. | Adds ~2 days of SDK work in M0. |
| 3 | **Action runner** | No queue model, no concurrency controls, no lock strategy, no retry policy described | Use Postgres-backed job queue (`action_runs` table with `SELECT ... FOR UPDATE SKIP LOCKED`). Max 5 concurrent runs per worker. Exponential backoff retries (3 max). Per-repo advisory lock via `pg_advisory_xact_lock`. | Postgres-as-queue has throughput ceiling (~500 jobs/s); acceptable for V1. |
| 4 | **Caching** | No caching strategy for SCM API calls or scorecard results | Add in-process LRU cache (TTL 60s) for SCM file-existence checks and repo metadata. Scorecard evaluations already cache via `cache_ttl_seconds`; add HTTP `Cache-Control` on entity pages. | In-process cache is per-instance; no cross-instance invalidation in V1. |
| 5 | **Webhook vs poll** | Webhook is "recommended" but not the primary path; poll-first means delayed ingestion | Make **webhook the primary ingestion path** (setup via `scm.ensureWebhook` action). Polling becomes fallback for repos where webhook setup fails. | Requires public callback URL (not always available in dev); mitigated by also supporting polling. |
| 6 | **Search** | Postgres FTS applied only to `docs_pages`; entity fields not indexed for FTS | Add `search_tsv tsvector` column to `entities` table, maintained via trigger on `(name, kind, tags, owner_ref, spec)`. Unified search endpoint queries both. | Extra trigger + index; negligible cost. |
| 7 | **DB schema drift** | `architecture.md` says `definition_jsonb` but actual SQL has `definition`. `schema_jsonb` vs `schema`. | Align doc to match SQL reality: columns are `definition` and `schema`. Remove `_jsonb` suffix from doc. | None. |
| 8 | **Worker coupling** | Worker is "same codebase, separate process" but no clear job dispatch protocol | Expose explicit job types enum (`repo-scan`, `scorecard-eval`, `docs-index`, `action-run`). Worker polls `action_runs` for action jobs and reads a `jobs` table (new) for background tasks. | New `jobs` table; simple schema. |
| 9 | **Plugin security** | Plugins can register backend routes but no sandboxing or permission scoping described | Each plugin declares required permissions in its manifest. Backend validates plugin routes through middleware that checks `plugin.permissions` against user roles. Plugins cannot access raw DB; they use SDK services. | Cannot prevent all misbehavior in compile-time plugins; acceptable for V1 trusted-plugin model. |
| 10 | **Monorepo tooling** | No package manager or build tool specified for the monorepo | Use **pnpm workspaces** + **Turborepo** for build orchestration. Single `Dockerfile` with multi-stage build (builder + runner). | pnpm is mandatory; contributors must install it. |
| 11 | **Template format** | Template variables use `${var}` string interpolation but no expression engine specified | Use **Handlebars** (`{{var}}`) for template interpolation in skeleton files and YAML step inputs. Handlebars is logic-less, auditable, no code execution risk. | No conditional logic in templates (by design for security). |
| 12 | **API versioning** | No versioning on REST API | Prefix all routes with `/api/v1/`. Version bump only on breaking changes. | Migration burden on version bump; acceptable. |
| 13 | **Config management** | No config file format or env-var strategy documented | Single `forgeportal.yaml` config file (validated by Zod schema at startup). Env vars override any config key via `FORGEPORTAL_` prefix. Docker Compose ships with `.env.example`. | Must maintain Zod schema; trivial. |
| 14 | **Docs rendering XSS** | Markdown sanitization mentioned but no library choice | Use **rehype-sanitize** with GitHub schema (allowlists safe HTML). Combine with strict `Content-Security-Policy: default-src 'self'`. | Cannot render custom HTML embeds; acceptable. |

---

# PART B — Target Architecture v1.1

## 1) System Overview

```
                         +-------------------+
                         |    Web Browser     |
                         +--------+----------+
                                  |
                         HTTPS (TLS)
                                  |
                    +-------------v--------------+
                    |        forgeportal-ui       |
                    |   React + TS (Vite build)   |
                    |   Plugin UI runtime         |
                    +-------------+--------------+
                                  | /api/v1/*
                    +-------------v--------------+
                    |       forgeportal-api       |
                    |   Fastify + TypeScript      |
                    |   ┌──────────────────────┐  |
                    |   │ catalog  │ scaffolder │  |
                    |   │ docs     │ scorecards │  |
                    |   │ search   │ auth       │  |
                    |   │ integrations │ plugins│  |
                    |   └──────────────────────┘  |
                    +-----+--+------+---+---------+
                          |  |      |   |
          +---------+  +--v--v--+ +-v---v---------+
          |  GitHub  |  |Postgres| | forgeportal-  |
          |  GitLab  |  |  (DB)  | |    worker     |
          | (SCM API)|  +--------+ | (jobs, scans, |
          +----------+             |  scorecards,  |
                                   |  action runs) |
                                   +---------------+
```

### 1.1 Components

- **Web UI (React + TypeScript, Vite)**
  - Portal shell: navigation, auth, global search
  - Entity pages: overview, docs, scorecards, actions, dependencies, activity
  - Plugin UI runtime: loads plugin-provided React components (routes, entity tabs, cards)

- **API Server (Fastify + TypeScript)**
  - Single HTTP process in V1 (modular monolith)
  - Modules: catalog, docs, scaffolder, scorecards, search, auth, integrations, plugins
  - REST API under `/api/v1/`
  - Webhook receiver: `/api/v1/webhooks/scm`
  - Plugin backend routes: `/api/v1/plugins/{pluginId}/*`

- **Worker (TypeScript, same codebase)**
  - Separate process; shares packages with API
  - Pulls jobs from Postgres (`SELECT ... FOR UPDATE SKIP LOCKED`)
  - Job types: `action-run`, `repo-scan`, `scorecard-eval`, `docs-index`
  - Concurrency: max 5 parallel runs, per-repo advisory lock

- **PostgreSQL**
  - Single DB; all state lives here in V1
  - FTS via tsvector on `docs_pages` and `entities`
  - Job queue via `action_runs` + new `jobs` table
  - V2: optional OpenSearch, Redis cache, external queue

### 1.2 Architectural Principles

1. **Convention over configuration** — sensible defaults everywhere; zero config to start.
2. **One language, one repo** — TypeScript from frontend to backend. pnpm monorepo.
3. **Postgres does everything in V1** — DB, queue, FTS, locks. No Redis, no Kafka. Add them only when measured need arises.
4. **Plugins are npm packages** — no OCI images, no sidecars, no Docker-in-Docker. `npm install` and restart.
5. **Security by default** — secrets never in DB, OIDC enforced, CSRF/CSP/sanitization enabled out of the box.

---

## 2) Deployment Architecture

### 2.1 Docker Compose (local / small teams)

```yaml
services:
  ui:
    image: forgeportal/ui:v1
    ports: ["3000:3000"]
  api:
    image: forgeportal/api:v1
    ports: ["4000:4000"]
    env_file: .env
    depends_on: [postgres]
  worker:
    image: forgeportal/api:v1
    command: ["node", "dist/worker.js"]
    env_file: .env
    depends_on: [postgres]
  postgres:
    image: postgres:16-alpine
    volumes: ["pgdata:/var/lib/postgresql/data"]
    environment:
      POSTGRES_DB: forgeportal
      POSTGRES_USER: forge
      POSTGRES_PASSWORD: ${DB_PASSWORD}
volumes:
  pgdata:
```

- `api` and `worker` share the same image (different entrypoint).
- `.env.example` ships with safe defaults for local development.
- No nginx required (Fastify serves static UI assets in dev mode).

### 2.2 Kubernetes (production)

| Resource | Notes |
|----------|-------|
| `Deployment: ui` | Static assets, served by lightweight Node server. Ingress path `/`. |
| `Deployment: api` | Fastify process. Ingress path `/api/`. HPA on CPU. |
| `Deployment: worker` | Same image, `command: worker.js`. HPA on queue depth. |
| `StatefulSet/External: postgres` | Prefer managed (RDS/CloudSQL). Chart supports `externalDatabase` config. |
| `CronJob: repo-scan` | Hourly. Calls `POST /api/v1/admin/scan`. |

Secrets (Kubernetes Secrets or external secret manager):
- `OIDC_CLIENT_SECRET`
- `SCM_GITHUB_APP_PRIVATE_KEY` / `SCM_GITLAB_TOKEN`
- `DB_PASSWORD`
- `ENCRYPTION_KEY` (for any at-rest encryption)

---

## 3) Module Boundaries

```
packages/
  @forgeportal/core        # shared types, config schema (Zod), logger, errors
  @forgeportal/db          # Postgres client (pg), migrations, query helpers
  @forgeportal/auth        # OIDC, session, RBAC middleware, CSRF
  @forgeportal/catalog     # entity CRUD, relations, ingestion, FTS
  @forgeportal/scm         # SCMProvider interface + GitHub/GitLab implementations
  @forgeportal/scaffolder  # template engine (Handlebars), action runner, job queue
  @forgeportal/docs        # markdown fetch, render (rehype), index
  @forgeportal/scorecards  # rule engine, evaluator, caching
  @forgeportal/search      # unified FTS across entities + docs
  @forgeportal/plugin-sdk  # plugin manifest types, UI hooks, backend registration
apps/
  api/                     # Fastify app wiring, route registration, plugin loader
  worker/                  # job loop, cron handlers
  ui/                      # React app (Vite), portal shell, plugin UI loader
deployments/
  docker-compose/
  helm/
tools/
  migration/
  seed/
  create-forge-plugin/     # CLI scaffolder for new plugins
```

Each package has its own `package.json`, exports a typed public API, and is independently testable.

---

## 4) Plugin System

### 4.1 Plugin Types

| Type | What it provides | Loaded by |
|------|-----------------|-----------|
| **UI plugin** | React components: entity tabs, entity cards, top-level routes | `apps/ui` at build time |
| **Backend plugin** | Fastify routes, action providers, catalog providers | `apps/api` at build time |
| **Fullstack plugin** | Both of the above in a single npm package | Both apps |

### 4.2 Plugin Manifest (`forgeportal-plugin.json`)

```json
{
  "name": "@myorg/forge-plugin-pagerduty",
  "version": "1.0.0",
  "forgeportal": {
    "engineVersion": "^1.0.0",
    "type": "fullstack",
    "capabilities": {
      "ui": {
        "entityTabs": ["PagerDutyTab"],
        "entityCards": ["PagerDutyCard"],
        "routes": []
      },
      "backend": {
        "routes": ["/pagerduty"],
        "actionProviders": ["pagerduty.createIncident"],
        "catalogProviders": []
      }
    },
    "permissions": ["entity:read", "integration:pagerduty:read"],
    "config": {
      "type": "object",
      "properties": {
        "apiKey": { "type": "string", "secret": true }
      },
      "required": ["apiKey"]
    }
  }
}
```

### 4.3 Capability Contracts

| Capability | Interface (from `@forgeportal/plugin-sdk`) | Registration |
|------------|-------------------------------------------|-------------|
| `entityTab` | `{ id, title, component: React.ComponentType<{ entity }> }` | `registerEntityTab(tab)` |
| `entityCard` | `{ id, title, component: React.ComponentType<{ entity }> }` | `registerEntityCard(card)` |
| `route` | `{ path, component, navLabel?, icon? }` | `registerRoute(route)` |
| `actionProvider` | `{ id, version, schema, handler: (ctx, input) => Promise<ActionResult> }` | `registerActionProvider(action)` |
| `catalogProvider` | `{ id, ingest: (ctx) => AsyncIterable<EntityDraft> }` | `registerCatalogProvider(provider)` |

### 4.4 Versioning and Compatibility

- Plugins declare `engineVersion: "^1.0.0"` (semver range).
- At startup, API and UI verify each plugin's `engineVersion` against `@forgeportal/plugin-sdk` version.
- Incompatible plugins are disabled with a warning log, not a crash.
- Plugin SDK follows semver: patch = bugfix, minor = new capability (backward-compatible), major = breaking contract change.

### 4.5 Local Dev Workflow

```bash
# Create a new plugin
npx create-forge-plugin my-plugin --type fullstack

# Structure created:
my-plugin/
  forgeportal-plugin.json
  src/
    ui/
      MyEntityTab.tsx
      index.ts          # exports registerPlugin(sdk)
    backend/
      routes.ts         # exports registerPlugin(sdk)
      actions.ts
  package.json

# Link into monorepo for hot reload
cd forgeportal/
pnpm add @myorg/forge-plugin-my-plugin --workspace
# or symlink for external dev:
pnpm link ../my-plugin

# Start dev with hot reload
pnpm dev  # starts api (nodemon) + ui (vite) + worker
```

UI plugins get Vite HMR. Backend plugins get nodemon restart.

### 4.6 Packaging and Distribution

- **V1**: Plugins are npm packages installed into the monorepo at build time. `pnpm add @scope/forge-plugin-X` + rebuild Docker image.
- **V2**: Runtime plugin loading from a registry (OCI or npm) without rebuild.

---

## 5) Action Runner Design

### 5.1 Queue Model

```
action_runs table:
  status: queued → running → success | failed | canceled
  locked_by: worker instance ID (nullable)
  locked_at: timestamp
  retry_count: int (default 0)
  max_retries: int (default 3)
  idempotency_key: text (unique, nullable)
```

Worker loop (each worker instance):

```
LOOP every 1s:
  BEGIN TRANSACTION
    SELECT * FROM action_runs
    WHERE status = 'queued'
      AND (locked_by IS NULL OR locked_at < now() - interval '5 minutes')
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED

    UPDATE ... SET status='running', locked_by=WORKER_ID, locked_at=now()
  COMMIT

  EXECUTE action handler
    ON SUCCESS: UPDATE status='success', output=...
    ON FAILURE:
      IF retry_count < max_retries:
        UPDATE status='queued', retry_count=retry_count+1, locked_by=NULL
        (exponential backoff via next_attempt_at)
      ELSE:
        UPDATE status='failed', output=error
```

### 5.2 Concurrency Controls

- Max 5 concurrent action runs per worker instance (configurable).
- Per-repo advisory lock: `SELECT pg_advisory_xact_lock(hashtext(repo_url))` before any SCM write. Prevents conflicting commits to the same repo.
- Per-user rate limit: max 10 action runs per minute (enforced at API level before queueing).

### 5.3 Idempotency

- Optional `idempotency_key` on `action_runs`. If provided and a run with same key exists with status `success`, return cached result.
- Each action contract specifies its own idempotency logic (see `actions_v1.md`): e.g., `scm.createRepo` returns existing repo if name matches.

### 5.4 Audit Logging

Every action run produces an audit entry:

```json
{
  "actor": "user:ahmed@example.com",
  "action": "scm.createRepo@v1",
  "target_type": "repo",
  "target_id": "github:myorg/new-service",
  "metadata": {
    "run_id": "uuid",
    "status": "success",
    "outputs": { "repoUrl": "...", "prUrl": "..." }
  },
  "ts": "2026-02-20T12:00:00Z"
}
```

Secrets are **never** included in `metadata.inputs` (input is stored in `action_runs.input` with redaction applied before persistence).

---

## 6) Data Architecture

### 6.1 Schema Additions (v1.1 delta)

**New columns on `action_runs`:**
```sql
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS locked_by TEXT;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 3;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS ux_runs_idempotency ON action_runs(idempotency_key) WHERE idempotency_key IS NOT NULL;
```

**Entity FTS:**
```sql
ALTER TABLE entities ADD COLUMN IF NOT EXISTS search_tsv tsvector;
CREATE INDEX IF NOT EXISTS ix_entities_tsv ON entities USING GIN(search_tsv);

CREATE OR REPLACE FUNCTION entities_update_tsv() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_tsv = to_tsvector('english',
    coalesce(NEW.name,'') || ' ' || coalesce(NEW.kind,'') || ' '
    || coalesce(NEW.owner_ref,'') || ' ' || coalesce(NEW.tags::text,''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_entities_tsv
  BEFORE INSERT OR UPDATE OF name, kind, owner_ref, tags ON entities
  FOR EACH ROW EXECUTE FUNCTION entities_update_tsv();
```

**Background jobs table:**
```sql
CREATE TABLE IF NOT EXISTS jobs (
  id            UUID PRIMARY KEY,
  type          TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'queued',
  locked_by     TEXT,
  locked_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_jobs_status ON jobs(status, created_at);
```

### 6.2 Search Strategy

| Content | Index | Query |
|---------|-------|-------|
| Entities | `entities.search_tsv` | `to_tsquery('english', ...)` |
| Docs | `docs_pages.content_tsv` | `to_tsquery('english', ...)` |

Unified search endpoint: `GET /api/v1/search?q=...&scope=all|entities|docs`

V2: plug in OpenSearch/Meilisearch behind the same endpoint (strategy pattern).

---

## 7) Performance Plan

### 7.1 Caching Strategy

| What | Where | TTL | Invalidation |
|------|-------|-----|-------------|
| SCM file existence checks | In-process LRU (per API/worker instance) | 60s | Webhook push event on repo |
| SCM repo metadata | In-process LRU | 120s | Webhook |
| Scorecard evaluations | DB `cache_ttl_seconds` | 3600s (1h) | Force re-eval or webhook trigger |
| Entity page API responses | HTTP `Cache-Control: private, max-age=30` | 30s | Client-side |
| Entity list (catalog browse) | HTTP `Cache-Control: private, max-age=10` | 10s | Client-side |

V2: add Redis for shared cross-instance cache.

### 7.2 Webhook vs Polling Strategy

| Method | When | Frequency |
|--------|------|-----------|
| **Webhook (primary)** | `scm.ensureWebhook` action installs hook on repo registration. Events: push, PR/MR merge. | Real-time |
| **Polling (fallback)** | Repos where webhook setup failed, or initial bulk discovery. | CronJob every 1h |

Webhook processing:
1. Verify signature (HMAC for GitHub, secret token for GitLab).
2. Dedupe by event ID (idempotent processing; store last N event IDs in-memory).
3. Enqueue `docs-index` or `entity-refresh` job.

---

## 8) Security Plan

### 8.1 Permission Model

```
Roles:
  platform-admin    → full access
  template-admin    → manage templates + actions + scorecards
  team-admin        → manage entities owned by their team
  developer         → run actions, view catalog, view docs
  viewer            → read-only

Permission checks:
  /api/v1/actions/:id/run → requires role >= developer + action.permissions match
  /api/v1/templates       → requires role >= template-admin for write
  /api/v1/admin/*         → requires role = platform-admin
  Plugin routes           → intersect user roles with plugin.permissions from manifest
```

### 8.2 Webhook Verification

- GitHub: validate `X-Hub-Signature-256` header against stored webhook secret (HMAC-SHA256).
- GitLab: validate `X-Gitlab-Token` header against stored secret token.
- Reject any request missing or failing verification.
- Rate limit webhook endpoint: 100 req/min per source IP.

### 8.3 Docs Rendering XSS Protection

- Server-side Markdown rendering via `unified` + `remark-parse` + `remark-rehype` + `rehype-sanitize` (GitHub schema).
- Strip all `<script>`, `<iframe>`, `<object>`, `<embed>`, event handlers.
- HTTP headers: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`.
- All external links get `rel="noopener noreferrer" target="_blank"`.

### 8.4 Secret Handling

- Tokens stored **only** as `secret_ref` in `integrations` table — actual secret lives in K8s Secret or Docker secret.
- At runtime, secrets loaded into memory from env vars / mounted files. Never written to DB.
- Redaction middleware: any log entry or API response is scanned for patterns matching known secret prefixes (`ghp_`, `glpat-`, `ghs_`) and replaced with `[REDACTED]`.
- Action run inputs are redacted before persistence: fields marked `secret: true` in action schema are replaced with `"***"`.

---

## 9) SCM Integration Architecture

### 9.1 SCMProvider Interface (TypeScript)

```typescript
interface SCMProvider {
  listRepos(scope: OrgScope): AsyncIterable<RepoSummary>;
  getRepo(ref: RepoRef): Promise<RepoDetail>;
  getFile(ref: RepoRef, path: string, gitRef?: string): Promise<FileContent | null>;
  createRepo(input: CreateRepoInput): Promise<RepoDetail>;
  createOrUpdateFile(ref: RepoRef, path: string, content: Buffer, message: string, branch: string, sha?: string): Promise<CommitResult>;
  createPullRequest(ref: RepoRef, input: PRInput): Promise<PRResult>;
  ensureWebhook(ref: RepoRef, callbackUrl: string, events: string[]): Promise<WebhookResult>;
  verifyWebhookSignature(payload: Buffer, signature: string, secret: string): boolean;
}
```

Implementations: `GitHubProvider`, `GitLabProvider` in `@forgeportal/scm`.

### 9.2 Token Strategy

See `provider-token-strategy.md` (unchanged). Summary:
- GitHub: prefer GitHub App installation tokens. Fallback: fine-grained PAT.
- GitLab: prefer project access tokens. Fallback: bot user PAT with minimal scopes.
- Workflows write permission: opt-in only when `ci.bootstrap` targets `.github/workflows/*`.

---

## 10) Docs Architecture

### V1 (Markdown render)
- Fetch Markdown from repo via SCM provider (`getFile`).
- Render server-side with `unified` pipeline (remark + rehype + sanitize).
- Store rendered text in `docs_pages` for FTS.
- Serve via `/api/v1/docs/{entityId}/page?path=...`.
- No static site build; no MkDocs.

### V2 (TechDocs-like)
- Separate `docs-builder` job builds MkDocs sites.
- Artifacts stored in S3-compatible storage.
- UI fetches static HTML via docs backend.

---

## 11) Scaffolder / Templates Architecture

### Template Format (YAML)

```yaml
apiVersion: forgeportal/v1
kind: Template
metadata:
  name: node-service
  title: Node.js Service
  description: Bootstrap a Node.js microservice with CI, docs, and K8s manifests.
spec:
  owner: team:platform
  parameters:
    - id: name
      title: Service Name
      type: string
      pattern: "^[a-z][a-z0-9-]{2,30}$"
    - id: owner
      title: Owning Team
      type: string
      ui: team-picker
    - id: provider
      title: SCM Provider
      type: string
      enum: [github, gitlab]
    - id: ownerGroup
      title: Org/Group
      type: string
  steps:
    - id: create-repo
      action: scm.createRepo@v1
      input:
        provider: "{{provider}}"
        owner: "{{ownerGroup}}"
        repo: "{{name}}"
        visibility: private
    - id: push-skeleton
      action: scm.pushSkeleton@v1
      input:
        repo: "{{steps.create-repo.outputs.repoRef}}"
        branch: main
        message: "feat: bootstrap {{name}}"
        files:
          - path: README.md
            templatePath: skeleton/README.md.hbs
          - path: entity.yaml
            templatePath: skeleton/entity.yaml.hbs
          - path: docs/index.md
            templatePath: skeleton/docs-index.md.hbs
    - id: bootstrap-ci
      action: ci.bootstrap@v1
      input:
        repo: "{{steps.create-repo.outputs.repoRef}}"
        type: "{{#if (eq provider 'github')}}github-actions{{else}}gitlab-ci{{/if}}"
        language: node
    - id: register
      action: catalog.registerEntity@v1
      input:
        entity:
          kind: service
          name: "{{name}}"
          ownerRef: "{{owner}}"
          scm: "{{steps.create-repo.outputs.repoRef}}"
  outputs:
    repoUrl: "{{steps.create-repo.outputs.repoUrl}}"
    entityId: "{{steps.register.outputs.entityId}}"
```

Template variable interpolation: **Handlebars** (`{{var}}`). Step outputs available as `{{steps.<stepId>.outputs.<key>}}`.

### Built-in Actions (V1)

`scm.createRepo@v1`, `scm.createOrUpdateFile@v1`, `scm.pushSkeleton@v1`, `scm.openPrOrMr@v1`, `scm.ensureWebhook@v1`, `catalog.registerEntity@v1`, `docs.bootstrap@v1`, `ci.bootstrap@v1`, `k8s.bootstrap@v1`, `scorecards.evaluate@v1`

See `actions_v1.md` for full contracts.

---

## 12) Scorecards Architecture

### Rule Engine

Rule types (V1):
- `entity.field.exists` — check if an entity field is non-empty
- `entity.link.exists` — check if entity has a link with matching title
- `scm.file.exists` — check if a file exists in the repo (cached)
- `scm.anyOf` — check if any of a set of file paths exist

Execution:
- Triggered by: webhook (repo push), cron (nightly), manual (`POST .../evaluate`).
- Worker evaluates rules, writes `scorecard_evaluations`.
- Results cached by `cache_ttl_seconds` (default 3600).

Outputs per entity:
- `level`: highest level where all rules pass (Bronze < Silver < Gold).
- Per-rule: `pass/fail` + `fixAction` (optional reference to an action that can fix it).

---

## 13) Observability

| Signal | Implementation | Notes |
|--------|---------------|-------|
| Metrics | `prom-client` (Prometheus) | API latency, error rate, queue depth, scan duration, action run success rate |
| Logs | `pino` (structured JSON) | Correlation ID per request/run. Redaction middleware for secrets. |
| Health | `GET /healthz` (readiness), `GET /livez` (liveness) | K8s probe compatible |
| Tracing (V2) | OpenTelemetry | Per action step span |

---

## 14) Repository Layout (Monorepo)

```
forgeportal/
  pnpm-workspace.yaml
  turbo.json
  package.json
  apps/
    ui/                      # React + Vite
      src/
        shell/               # layout, nav, auth context
        pages/               # catalog, docs, templates, scorecards, actions, admin
        plugins/             # plugin UI loader
      vite.config.ts
    api/                     # Fastify
      src/
        server.ts            # app setup, route registration
        plugins/             # plugin backend loader
        modules/             # catalog, docs, scaffolder, scorecards, search, auth, integrations
    worker/                  # job loop
      src/
        worker.ts            # entry point
        handlers/            # per-job-type handlers
  packages/
    @forgeportal/core/
    @forgeportal/db/
    @forgeportal/auth/
    @forgeportal/catalog/
    @forgeportal/scm/
    @forgeportal/scaffolder/
    @forgeportal/docs/
    @forgeportal/scorecards/
    @forgeportal/search/
    @forgeportal/plugin-sdk/
  tools/
    migration/
    seed/
    create-forge-plugin/     # CLI: npx create-forge-plugin
  deployments/
    docker-compose/
      docker-compose.yml
      .env.example
    helm/
      Chart.yaml
      values.yaml
      templates/
  Dockerfile                 # multi-stage: build all packages, then slim runner
```

---

## 15) Evolution Plan

### V1 (ship in 8-12 weeks)
- Single Fastify API + Worker (TypeScript)
- Postgres for DB, queue, FTS
- Markdown docs (server-rendered, sanitized)
- Compile-time plugin set (npm packages)
- GitHub + GitLab via SCMProvider
- Webhook-first ingestion + polling fallback
- Handlebars template interpolation
- OIDC auth + RBAC (5 roles)
- `create-forge-plugin` CLI

### V2 (scale + ecosystem)
- Split services: catalog, scaffolder, docs, search
- Redis for shared cache; NATS/Kafka for events
- Static docs build (TechDocs-like)
- Runtime plugin install (marketplace)
- Advanced scorecards (CI, SLO, security scanner integrations)
- OTEL tracing
- Multi-tenant SaaS mode

---

# PART C — Golden Path DX

## C1) Create a New Service (end-to-end)

```bash
# 1. Open ForgePortal UI → Templates → "Node.js Service"
# 2. Fill form: name=orders, owner=team:payments, provider=github, group=myorg
# 3. Click "Create"

# Behind the scenes (5 action steps):
#   scm.createRepo      → github:myorg/orders created
#   scm.pushSkeleton    → README.md, entity.yaml, docs/index.md pushed
#   ci.bootstrap         → .github/workflows/ci.yml created
#   catalog.registerEntity → entity "service:default/orders" registered
#   scm.ensureWebhook   → push webhook installed

# 4. Entity appears in Catalog within seconds
# 5. Scorecard evaluation runs automatically (Bronze: owner + readme)
# 6. Audit log: "user:ahmed created service orders via template node-service"
```

Time from click to catalog visibility: **< 60 seconds**.

## C2) Create a UI Plugin (Entity Tab)

```bash
npx create-forge-plugin forge-plugin-pagerduty --type ui
```

Generated structure:

```
forge-plugin-pagerduty/
  forgeportal-plugin.json     # manifest (see 4.2 above)
  package.json
  src/
    index.ts                  # plugin entry
    PagerDutyTab.tsx          # entity tab component
  tsconfig.json
```

`src/index.ts`:
```typescript
import { ForgePluginSDK } from '@forgeportal/plugin-sdk';
import { PagerDutyTab } from './PagerDutyTab';

export function registerPlugin(sdk: ForgePluginSDK) {
  sdk.registerEntityTab({
    id: 'pagerduty-oncall',
    title: 'On-Call',
    component: PagerDutyTab,
    appliesTo: { kinds: ['service'] },
  });
}
```

`src/PagerDutyTab.tsx`:
```tsx
import { useEntity } from '@forgeportal/plugin-sdk/react';

export function PagerDutyTab() {
  const { entity } = useEntity();
  const pdLink = entity.links?.find(l => l.title === 'PagerDuty');
  if (!pdLink) return <p>No PagerDuty link configured.</p>;
  return <iframe src={pdLink.url} style={{ width: '100%', height: 600, border: 'none' }} />;
}
```

Install: `pnpm add @myorg/forge-plugin-pagerduty` in the monorepo, rebuild, deploy.

## C3) Create a Backend Plugin (Action Provider)

```bash
npx create-forge-plugin forge-plugin-slack-notify --type backend
```

Generated structure:

```
forge-plugin-slack-notify/
  forgeportal-plugin.json
  package.json
  src/
    index.ts
    actions/
      sendSlackMessage.ts
  tsconfig.json
```

`src/actions/sendSlackMessage.ts`:
```typescript
import { ActionProvider, ActionContext, ActionResult } from '@forgeportal/plugin-sdk';

export const sendSlackMessage: ActionProvider = {
  id: 'slack.sendMessage',
  version: 'v1',
  schema: {
    input: {
      type: 'object',
      required: ['channel', 'text'],
      properties: {
        channel: { type: 'string' },
        text: { type: 'string' },
      },
    },
  },
  async handler(ctx: ActionContext, input: { channel: string; text: string }): Promise<ActionResult> {
    const token = ctx.config.get('slackBotToken');
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: input.channel, text: input.text }),
    });
    const data = await res.json();
    if (!data.ok) return { status: 'failed', outputs: {}, links: [], warnings: [data.error] };
    return { status: 'success', outputs: { ts: data.ts }, links: [], warnings: [] };
  },
};
```

`src/index.ts`:
```typescript
import { ForgePluginSDK } from '@forgeportal/plugin-sdk';
import { sendSlackMessage } from './actions/sendSlackMessage';

export function registerPlugin(sdk: ForgePluginSDK) {
  sdk.registerActionProvider(sendSlackMessage);
}
```

## C4) Create a Fullstack Plugin

```bash
npx create-forge-plugin forge-plugin-costview --type fullstack
```

Generated structure:

```
forge-plugin-costview/
  forgeportal-plugin.json
  package.json
  src/
    ui/
      CostCard.tsx
      index.ts              # sdk.registerEntityCard(CostCard)
    backend/
      routes.ts             # GET /cost/:entityId
      index.ts              # sdk.registerRoute(...)
  tsconfig.json
```

The backend exposes a Fastify route scoped under `/api/v1/plugins/costview/cost/:entityId`. The UI card fetches data from that route. Plugin config in `forgeportal.yaml`:

```yaml
plugins:
  costview:
    enabled: true
    config:
      cloudProvider: aws
      apiEndpoint: https://cost-api.internal
```

---

# PART D — Decision Log

| # | Decision | Alternatives Considered | Recommendation | Rationale |
|---|----------|------------------------|----------------|-----------|
| D1 | **Backend: TypeScript (Fastify)** | Go + Fiber, Rust + Axum, NestJS | **TypeScript + Fastify** | One language with frontend (fastest delivery). Fastify is 2x faster than Express, lighter than NestJS. Backstage itself is Node/TS. Go would add context-switch and hiring friction. |
| D2 | **Monorepo with pnpm + Turborepo** | npm workspaces, Nx, yarn, polyrepo | **pnpm + Turborepo** | pnpm is fastest, strictest on hoisting. Turbo gives incremental builds and caching. Nx is heavier than needed. |
| D3 | **Postgres as queue (V1)** | BullMQ + Redis, RabbitMQ, pg-boss | **Raw Postgres SKIP LOCKED** | Zero extra infra. pg-boss adds another abstraction; we want full control for idempotency and advisory locks. Redis queue in V2 if throughput demands it. |
| D4 | **Fastify over NestJS** | NestJS, Koa, Hono | **Fastify** | NestJS decorators/DI add learning curve and startup overhead. Fastify's plugin system (encapsulation, hooks) maps naturally to our modular backend. Hono lacks ecosystem maturity. |
| D5 | **Handlebars for template interpolation** | Nunjucks, Liquid, EJS, raw `${var}` | **Handlebars** | Logic-less (no arbitrary code execution — security win). Widely known. `{{steps.x.outputs.y}}` is intuitive. Nunjucks/EJS allow arbitrary JS which is a supply-chain risk. |
| D6 | **Plugin = npm package at build time (V1)** | OCI sidecar, remote gRPC plugin, runtime dynamic import | **npm at build time** | Simplest model: `pnpm add`, rebuild, redeploy. No runtime code loading risk. V2 can add dynamic loading when trust model is mature. |
| D7 | **Webhook-first ingestion** | Polling-first, hybrid equal | **Webhook primary, poll fallback** | Near real-time updates, fewer API calls (rate limit friendly). Polling is fallback for environments without public callback. |
| D8 | **rehype-sanitize for Markdown** | DOMPurify, sanitize-html, custom | **rehype-sanitize (GitHub schema)** | Integrated into our unified/remark pipeline. GitHub schema is battle-tested. DOMPurify requires a DOM (jsdom overhead). |
| D9 | **Zod for config validation** | Joi, Yup, AJV | **Zod** | First-class TypeScript types (infers config type from schema). Same lib for action input validation. |
| D10 | **pino for logging** | Winston, Bunyan, console | **pino** | Fastest Node logger (low overhead). Structured JSON by default. Fastify native integration. |
| D11 | **Entity FTS via Postgres tsvector** | Meilisearch, OpenSearch, Typesense | **Postgres tsvector (V1)** | Zero extra infra. Handles 50k entities easily. Pluggable search backend in V2. |
| D12 | **forgeportal.yaml + env overrides** | .env only, JSON config, TOML | **YAML + env override** | YAML is human-friendly for complex config (plugins, integrations). Env vars override any key for 12-factor compliance. |

---

## 16) Implementation Decisions Locked for V1

1. Backend language: **TypeScript (Fastify)**
2. Package manager + build: **pnpm + Turborepo**
3. DB: **PostgreSQL** (queue, FTS, state — all in one)
4. Deploy: **docker-compose + Helm**
5. SCM: **GitHub + GitLab via SCMProvider abstraction**
6. Templates: YAML with **Handlebars** interpolation
7. Permissions: RBAC (5 roles), enforced per action step and plugin route
8. Plugins: **npm packages at build time**, manifest-driven, versioned
9. Config: **forgeportal.yaml** validated by Zod, env-var overrides
10. Markdown: **unified + rehype-sanitize** (GitHub schema)
11. Logging: **pino** (structured JSON, secret redaction)
12. Webhook: primary ingestion path; polling as fallback
