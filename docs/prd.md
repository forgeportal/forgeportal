# PRD — Backstage Competitor (Codename: “ForgePortal”)

> Goal: Build a Backstage-class Internal Developer Portal (IDP) **from scratch**, with a **simpler extension model**, **built-in scorecards + actions**, and **first-class support for GitHub + GitLab**.

## 1) Context & Problem

Organizations struggle with:
- Fragmented ownership metadata (who owns what, where is the runbook, what’s deployed where)
- Repetitive “golden path” work (creating a new service, CI, K8s manifests, docs, alerts)
- Lack of enforceable standards (security, production readiness, documentation quality)
- High cognitive load / steep learning curve in existing portals

Backstage provides a strong reference architecture: a core app wired with **frontend plugins**, **backend plugins/services/modules**, and core capabilities like **Software Catalog** and **Software Templates**. :contentReference[oaicite:0]{index=0}  
But it can feel heavy to operate/extend.

## 2) Vision

A developer portal that is:
- **Dev-friendly**: fast, opinionated defaults, minimal config, strong local DX
- **Actionable**: every insight has a “Fix” action
- **Standards-driven**: scorecards are first-class (not “optional add-on”)
- **Extensible without pain**: plugins are easy to build, version, and install
- **Provider-agnostic**: GitHub + GitLab parity for discovery and scaffolding

## 3) Goals / Non-goals

### Goals (V1)
1) **Catalog**: entity inventory + ownership + relationships + discovery from repos
2) **Scaffolder**: templates + actions that create and bootstrap components (repos, CI, K8s, docs)
3) **Docs**: docs-as-code rendering from repo (Markdown baseline)
4) **Scorecards**: standards engine similar to “rules + levels”
5) **Actions**: workflow execution + audit trail + policy checks
6) **SCM support**: GitHub and GitLab in first release

Backstage’s “Catalog + Templates” are core pillars we must match in capability. :contentReference[oaicite:1]{index=1}  
Scorecards concept and structure are validated by Port’s model (“rules”, “levels”, actionable insights). :contentReference[oaicite:2]{index=2}

### Non-goals (V1)
- Full marketplace with revenue sharing
- Multi-tenant SaaS (we’ll support self-host first)
- Deep native doc build pipeline (MkDocs-style build comes in V2)
- Full graph database (Postgres relations first)

## 4) Target Users & Personas

- **Developers**: create services, find ownership/runbooks, run self-service actions
- **Platform team**: define golden paths, maintain templates/actions, enforce standards
- **Engineering managers**: visibility on service health/maturity and initiatives

## 5) Key Differentiators (how we beat Backstage)

1) **Easier to understand and onboard** — Structured documentation, glossary, and clear doc map; conventions-first defaults and guided flows reduce cognitive load.
2) **Faster time to value** — "Fix" actions and default templates; one coherent spec pack (PRD, architecture, actions, security) keeps implementation aligned.
3) **Scorecards are built-in and central**
   - Standards engine ships in core, not optional plugin
   - Rule-based evaluation with levels (Bronze/Silver/Gold etc.) :contentReference[oaicite:3]{index=3}

4) **Actions as a product**
   - Every scorecard failure suggests “Fix with PR” actions
   - Audited and permissioned

5) **Simpler plugin model**
   - Single plugin type: UI extension + optional backend endpoints
   - Versioned contracts; guides for building front and backend plugins (no OCI required in V1). :contentReference[oaicite:4]{index=4}

6) **GitHub + GitLab parity**
   - Same features and UX regardless of provider, via SCM abstraction

## 6) Functional Requirements (V1)

### 6.1 Software Catalog
**Entities**
- Types: `service`, `library`, `website`, `job`, `infra`, `api`, `team`, `system`
- Core fields: `name`, `type`, `owner`, `lifecycle`, `repo`, `tags`, `links`
- Relationships: `dependsOn`, `ownedBy`, `partOf`, `providesApi`, `consumesApi`

**Capabilities**
- List, filter, search, and view entity pages
- Entity graph visualization (dependencies + ownership)
- Repo discovery:
  - Scan repos/orgs/groups
  - Detect entity metadata file (`entity.yaml` or `catalog-info.yaml` equivalent)
  - Auto-generate entity skeleton when missing (via action)

**Acceptance Criteria**
- A new repo discovered in GitHub/GitLab can become an entity in ≤ 2 minutes (scan interval dependent)
- Entity page shows owner, repo, docs link, scorecard status, actions

### 6.2 Docs (Docs-as-Code)
**V1 behavior**
- Render Markdown from repo default path (e.g., `/docs`, `/README.md`)
- Entity ↔ docs binding by convention
- Searchable docs content (via search index)

**Acceptance Criteria**
- Docs render in portal within 1 refresh after commit
- Broken links detection warning (basic)

### 6.3 Scaffolder (Templates)
**Template model**
- Template defines:
  - inputs (name, language, runtime, team, deployment target)
  - steps (actions)
  - outputs (repo URL, entity created)

Backstage’s “Software Templates” and scaffolding approach validate that templates + actions are core. :contentReference[oaicite:5]{index=5}

**Minimum built-in actions (V1)**
1) Create repository/project (GitHub/GitLab)
2) Push skeleton code
3) Create/update CI pipeline files
4) Create/update K8s manifest / Helm skeleton
5) Create docs skeleton (README + /docs)
6) Create entity metadata file
7) Open PR/MR for changes (when repo exists)
8) Create webhooks for sync

**SCM Implementation references**
- GitLab Projects API can create/manage projects (`POST /projects`). :contentReference[oaicite:6]{index=6}
- GitHub REST supports creating/updating file contents (base64 payload, `repo`/`workflow` scopes depending on path). :contentReference[oaicite:7]{index=7}

**Acceptance Criteria**
- “Create service” template produces:
  - repo created
  - initial commit pushed
  - CI file present
  - docs present
  - entity appears in catalog automatically
- End-to-end run visible in audit log

### 6.4 Scorecards (Standards Engine)
Scorecards evaluate entities against standards using **rules** and **levels**. :contentReference[oaicite:8]{index=8}

**V1 capabilities**
- Define scorecards per entity type
- Rules based on:
  - entity properties
  - repo checks (file exists, branch protections present, CI present)
  - integrations present (e.g., “has on-call link” as property)
- Output:
  - overall level (e.g., Bronze/Silver/Gold)
  - per-rule pass/fail
  - suggested actions to fix failed rules

**Example rules**
- README exists
- Runbook exists
- Owner assigned
- CI workflow exists
- Security file exists (`SECURITY.md`)
- K8s deployment manifest exists

**Acceptance Criteria**
- Scorecard evaluation completes < 5 seconds for an entity with cached SCM checks
- UI shows rule results and “Fix” actions

### 6.5 Actions & Workflows
**V1 capabilities**
- Action definitions:
  - inputs
  - permissions
  - execution steps (can call SCM provider + internal services)
- Execution engine:
  - queued runs
  - live logs
  - final status + outputs
- Audit trail:
  - who ran
  - what changed (links to PR/MR)

**Acceptance Criteria**
- Every action run is immutable and auditable
- Failures show actionable error + retry option

### 6.6 Search
**V1**
- Postgres full-text search across:
  - entity fields
  - docs content (indexed)
- Filters: type, owner, tags, lifecycle

**V2**
- Pluggable search backend (OpenSearch/Meilisearch)

### 6.7 Authentication & Authorization
**Auth**
- OIDC (Keycloak, GitHub, GitLab, etc.)
**Permissions**
- Role-based:
  - platform-admin
  - template-admin
  - team-admin
  - developer
  - viewer
- Scoped permissions:
  - entity-level view/edit
  - action-level execute
  - template-level manage

**Acceptance Criteria**
- A user cannot run an action without permission
- Audit log includes user identity

### 6.8 Integrations (V1)
**SCM**
- GitHub
- GitLab

**Optional (V1 if time)**
- Webhook receiver for repo change events (speed up sync)

## 7) Non-Functional Requirements

### Tech stack (V1)
- **Backend and worker**: TypeScript (Node) — Fastify or NestJS; same codebase, separate process/deployment for worker.
- **Frontend**: React + TypeScript.
- **Data**: PostgreSQL; search via Postgres FTS.
- **Deploy**: docker-compose and Helm.

### Performance
- P95 entity page load < 1s (cached)
- Search results < 500ms for 50k entities (target with indexing)

### Reliability
- Action runner can resume after restart
- Idempotent steps where possible

### Security
- Tokens stored encrypted (KMS optional in V2)
- Least-privilege token scopes (GitHub `repo` and possibly `workflow` for `.github/workflows`). :contentReference[oaicite:9]{index=9}
- Strict audit logging for actions that modify repos

### Deployability (multi-choice)
- Docker Compose distribution for PoC / small teams
- Helm chart for Kubernetes
- Single-binary option for backend services (where applicable)

### Extensibility
- Plugin SDK for:
  - UI cards, routes, entity page sections
  - backend endpoints + action providers
- Versioned contracts (semver), compatibility checks at install

## 8) UX / IA (V1)

### Core navigation
- Home (quick actions + initiatives)
- Catalog
- Docs
- Templates
- Scorecards
- Actions (runs)
- Admin (integrations, permissions, plugins)

### Entity page layout
- Header: name, owner, lifecycle, repo links
- Tabs:
  - Overview (links, metadata)
  - Docs
  - Scorecards
  - Dependencies
  - Actions
  - Activity (audit + recent changes)

## 9) Data Model (V1 conceptual)

- `entities`
- `entity_relations`
- `entity_versions` (optional for history)
- `docs_index` (rendered content pointer + search index)
- `scorecards`
- `scorecard_rules`
- `scorecard_evaluations`
- `actions`
- `action_runs`
- `audit_logs`
- `integrations` (SCM credentials/config)

(Full ERD + schema goes into ARCHITECTURE.md.)

## 10) API Surface (V1 high level)

- `GET /api/catalog/entities`
- `GET /api/catalog/entities/{id}`
- `POST /api/catalog/ingest/scan`
- `GET /api/docs/{entityId}`
- `POST /api/templates/run`
- `GET /api/scorecards/{entityId}`
- `POST /api/actions/{actionId}/run`
- `GET /api/actions/runs/{runId}`

## 11) Milestones & Delivery Plan

### Milestone 0 — Foundations (Week 1–2)
- Repo + CI
- OIDC login
- Catalog CRUD + basic UI
- GitHub/GitLab integration skeleton

### Milestone 1 — Catalog + Discovery (Week 3–4)
- Repo discovery scan (both providers)
- Entity pages + relations
- Basic search (Postgres FTS)

### Milestone 2 — Docs + Templates (Week 5–7)
- Markdown docs render
- Template engine + 5 core actions
- Audit trail

### Milestone 3 — Scorecards + Fix Actions (Week 8–10)
- Scorecards engine + UI
- “Fix via PR/MR” actions (entity metadata, docs, CI)

### Milestone 4 — Hardening + Packaging (Week 11–12)
- Helm + docker-compose
- RBAC policies
- Load test + security review

## 12) Risks & Mitigations

1) **SCM parity complexity (GitHub vs GitLab)**
   - Mitigation: SCM abstraction layer + provider capability matrix
   - Reference official APIs for create project and content updates. :contentReference[oaicite:10]{index=10}

2) **Workflow runner reliability**
   - Mitigation: persistent run state, retry policies, idempotent steps

3) **Plugin ecosystem fragmentation**
   - Mitigation: strict plugin contracts + versioning + verification at install

4) **Adoption friction**
   - Mitigation: conventions-first defaults + “autofix” actions + guided onboarding

## 13) Success Metrics

- Time-to-first-service (template run to catalog visibility): **< 10 minutes**
- % entities with owner + docs + runbook: **> 80% in 60 days**
- # “Fix” actions executed per week (adoption indicator)
- Developer satisfaction (internal survey): target +30% vs baseline

## 14) Resolved / Open Questions

**Decided for V1 (see Architecture):**
- **Modular monolith**: one backend + one worker (both TypeScript), single deploy unit per process.
- **Plugin packaging**: npm (UI) + TS module at build (backend); OCI/sidecar optional in V2.
- **Action runner**: DB-backed queue or lightweight broker in V1; Temporal/other in V2 if needed.

**Open:**
- Entity metadata file name standard: `entity.yaml` vs `catalog-info.yaml`-compatible

---

## Appendix — Source Anchors

- Backstage architecture and building blocks (frontend plugins, backend plugins/services/modules, catalog, templates). :contentReference[oaicite:11]{index=11}  
- Port scorecards concept: rules, levels, standards evaluation, actionable insights. :contentReference[oaicite:12]{index=12}  
- GitLab Projects API (`POST /projects`) for project creation. :contentReference[oaicite:13]{index=13}  
- GitHub “Create or update file contents” endpoint + token scopes. :contentReference[oaicite:14]{index=14}