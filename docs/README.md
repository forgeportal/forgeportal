# ForgePortal — Internal Design Specs

This folder contains the **V1 design specifications** for ForgePortal: product requirements, architecture decisions, security threat model, SCM action contracts, and provider capability mapping.

These documents are the source of truth used during V1 development. They are kept for reference but should not be confused with the end-user documentation site (`apps/docs/`).

---

## Spec Index

| Document | Purpose |
|----------|---------|
| [`prd.md`](prd.md) | Product Requirements Document — goals, non-functional requirements, milestones, key differentiators vs Backstage |
| [`architecture.md`](architecture.md) | Full architecture specification — components, modules, data model, plugin system, repo layout, DX flows |
| [`security-considerations.md`](security-considerations.md) | Threat model (T1–T9), mitigations, RBAC, secret handling, webhook verification |
| [`actions_v1.md`](actions_v1.md) | Action contracts — every built-in action: inputs, outputs, idempotency keys, error codes |
| [`provider_capability_matrix.md`](provider_capability_matrix.md) | GitHub vs GitLab capability mapping for each action |
| [`provider-token-strategy.md`](provider-token-strategy.md) | SCM authentication strategy — GitHub PAT, GitHub App, GitLab token, permission scopes |

---

## Key Decisions (from architecture.md)

| Topic | Decision |
|-------|----------|
| Backend framework | **Fastify** — lightweight, plugin model, fast |
| Monorepo tooling | **pnpm + Turborepo** |
| Template engine | **Handlebars** — logic-less, secure |
| Job queue | **PostgreSQL SKIP LOCKED** — no extra broker |
| Plugin manifest | **`forgeportal-plugin.json`** with semver engineVersion |
| Config format | **`forgeportal.yaml`** validated by Zod, env-var overrides |
| API versioning | **/api/v1/** prefix |
| Docs XSS protection | **rehype-sanitize** (GitHub schema) |
| Logging | **pino** with secret redaction |
| Entity search | **PostgreSQL FTS** (tsvector on entities + docs) |
| Webhook strategy | **Webhook-first** ingestion; polling as fallback |

---

## Relationship to User Documentation

The end-user documentation site lives in [`apps/docs/`](../apps/docs/) (Docusaurus 3) and is deployed to `docs.forgeportal.dev`. The files in this `docs/` folder are internal engineering references, not published.
