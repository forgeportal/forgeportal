---
title: Architectural Decisions
sidebar_position: 2
---

# Architectural Decisions

This page documents the major architectural decisions in ForgePortal: what was chosen, why, and what trade-offs were accepted. It is intended to help contributors understand the design and inform future decisions.

---

## 1. Monorepo with pnpm workspaces

**Decision:** All packages live in a single monorepo managed by **pnpm workspaces**.

**Rationale:** ForgePortal has multiple closely coupled packages (core, catalog, auth, SCM, scaffolder, scorecards, search, plugin-sdk, UI, API, docs). A monorepo eliminates version drift between internal packages, simplifies cross-package refactors, and keeps CI straightforward.

**Trade-offs:** Larger clone size; build caches must cover many packages. We use `pnpm`'s efficient symlinking and workspace protocol (`workspace:*`) to minimize overhead.

---

## 2. PostgreSQL as the single data store

**Decision:** ForgePortal uses **PostgreSQL only** — for entities, sessions (via signed cookies), the action queue, audit logs, scorecards, docs index, and plugin overrides. No Redis, no dedicated message broker.

**Rationale:** Postgres is operationally well-understood, can handle the workloads expected of an internal developer portal (not millions of msg/sec), and reduces the deployment surface for teams running this in small or medium clusters. The job queue is implemented on a `action_runs` table with `FOR UPDATE SKIP LOCKED`.

**Trade-offs:** Not optimal for extremely high-throughput queues. If the queue depth becomes a bottleneck in the future, the queue implementation can be swapped behind a `@forgeportal/queue` interface without changing the rest of the system.

---

## 3. Fastify for the API server

**Decision:** The backend API uses **Fastify** (v5).

**Rationale:** Fastify has excellent TypeScript support, a well-defined plugin system (`register`), built-in JSON schema validation, and strong performance. Its lifecycle hooks (preHandler, onRequest, onClose) made it easy to layer auth, CSRF, and metrics without complex middleware chains.

**Trade-offs:** Slightly less mainstream than Express; contributors need to learn Fastify conventions. The ecosystem is mature enough for production use.

---

## 4. Zod for configuration validation

**Decision:** The config schema is defined and validated with **Zod** at startup (`packages/core/src/config.schema.ts`).

**Rationale:** Zod provides strong TypeScript types derived from the schema, clear error messages, and composable validation. The alternative (JSON Schema + ajv) is more verbose and produces less readable TS types. Zod errors can be formatted and printed at startup to guide operators.

**Trade-offs:** Zod adds a small runtime dependency. For a startup-time check this is negligible.

---

## 5. OIDC with signed session cookies (no JWT API)

**Decision:** Authentication uses **OpenID Connect** (discovery + code flow). Sessions are maintained via **signed, encrypted cookies** (`@fastify/secure-session`). There is no JWT bearer-token API.

**Rationale:** Browser-based portals are naturally session-oriented. Signed HttpOnly cookies with `SameSite=Strict` are more resistant to XSS token theft than `localStorage`-based JWTs. CSRF protection is layered on top (`@fastify/csrf-protection`) for mutation endpoints.

**Trade-offs:** External API clients (e.g. CI scripts) cannot authenticate without going through the OIDC flow. If a bearer-token API is needed in the future, a token exchange or API key mechanism can be added without changing the core session model.

---

## 6. Separate worker process

**Decision:** Background jobs (action runner, scorecard evaluation, doc indexing) run in a **separate worker process** (`apps/worker`), not in the API server.

**Rationale:** Decoupling the worker from the API allows independent scaling, prevents long-running jobs from blocking API request handling, and makes it easier to reason about failures (a crashing worker does not take down the API).

**Trade-offs:** Two processes to manage (deploy, monitor). In Docker Compose and the Helm chart this is two separate containers/deployments, which adds a small operational overhead.

---

## 7. Plugin system: SDK + manifest + loader

**Decision:** Plugins extend ForgePortal via a **typed SDK** (`@forgeportal/plugin-sdk`), a **JSON manifest** (`forgeportal-plugin.json`), and a **server-side loader**. UI plugins are wired into the UI app at build time; backend plugins are loaded at runtime from npm packages listed in `pluginPackages.packages`.

**Rationale:** A manifest-first approach lets the server know plugin capabilities and config schema without running plugin code. The typed SDK provides a stable, versioned contract. Keeping UI plugins wired at build time avoids complex client-side module loading.

**Trade-offs:** UI plugins require a rebuild of the UI app (not hot-pluggable). Backend plugins are hot-loaded but changes require a server restart. This is an acceptable trade-off for an internal portal used by platform teams.

---

## 8. FTS via PostgreSQL `tsvector`

**Decision:** Full-text search (entities and docs) is implemented with PostgreSQL **`tsvector` / `tsquery`**, not an external search engine (Elasticsearch, Typesense, etc.).

**Rationale:** Postgres FTS is sufficient for the expected scale of an internal developer portal (thousands, not millions, of entities and docs). Adding an external search engine would significantly increase deployment complexity and operational cost for teams with small/medium catalogs.

**Trade-offs:** Limited ranking models; no semantic search. If scale or relevance requirements grow, the `@forgeportal/search` service interface can be re-implemented against an external engine.

---

## 9. Helm chart with optional in-cluster Postgres

**Decision:** The Helm chart includes an **optional in-cluster Postgres** (`postgres.enabled: true` by default, off for production) and supports **external DB** via `externalDatabase`. The same chart serves dev (in-cluster) and production (external RDS/Cloud SQL) with different values files.

**Rationale:** This reduces the barrier for first-time deployments (no separate DB setup needed) while allowing production-grade configurations where teams use managed databases. A single chart avoids maintaining two separate charts.

**Trade-offs:** In-cluster Postgres is not suitable for production HA; teams must remember to set `postgres.enabled: false` and use `externalDatabase` in production (documented in the [Production Checklist](/docs/deployment/production-checklist)).

---

## 10. Security: defense in depth

**Decision:** Multiple security layers are applied by default: CSP headers, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSRF protection on mutations, HMAC signature verification on webhooks, rate limiting on search and webhooks, encrypted session cookies, AES-256-GCM encryption for sensitive stored data.

**Rationale:** An internal developer portal often has access to SCM tokens, infrastructure credentials, and org-wide data. Defense in depth ensures that a single misconfiguration or third-party vuln does not immediately compromise the system.

**Trade-offs:** CSP may need tuning for custom plugins that load external resources (configurable via `server.securityHeaders.csp`). CSRF requires clients to implement the CSRF token flow for mutations.
