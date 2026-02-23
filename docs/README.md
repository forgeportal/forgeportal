# ForgePortal — Internal Docs

This folder contains the **developer guide** and references to the V1 design specifications for ForgePortal.

---

## Developer Guide

**→ [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)**

Covers monorepo setup, Turborepo scripts, running services locally, environment variables, code conventions, database migrations, and testing.

---

## Key Architecture Decisions

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

The end-user documentation site lives in [`apps/docs/`](../apps/docs/) (Docusaurus 3) and is deployed to [docs.forgeportal.dev](https://docs.forgeportal.dev). The files in this `docs/` folder are internal engineering references — they are not published.

> **Note:** The original V1 design specs (PRD, architecture, threat model, action contracts) were produced during the planning phase and are not tracked in git.
