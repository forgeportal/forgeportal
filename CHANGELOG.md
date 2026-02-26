# Changelog

All notable changes to ForgePortal are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

---

## [v1.0.0] - 2026-02-28

First stable release of ForgePortal — an open-source Internal Developer Portal (IDP) built on Fastify, React, PostgreSQL, and TypeScript.

### Added

**Software Catalog**
- Entity discovery from GitHub and GitLab via webhook ingestion and periodic scanning
- Full-text search across entities and documentation pages (PostgreSQL FTS with GIN indexes)
- Filtering by kind, lifecycle, owner, and tags with pagination
- Entity annotations (JSONB) for plugin configuration
- Entity description display in catalog list, detail header, and overview tab
- Annotations panel in entity overview with plugin badge recognition

**Scaffolding Engine**
- Handlebars template engine with parameter forms and dry-run preview
- Action runner with PostgreSQL `SKIP LOCKED` job queue for reliable execution
- Built-in actions: `scm.createRepo`, `scm.createPR`, `catalog.register`, `http.request`, `fs.write`
- Audit log for all action runs

**Scorecards**
- Rule engine with Gold / Silver / Bronze / None levels
- Automated evaluation worker with configurable schedules
- Fix actions that open pull requests to remediate scorecard failures
- Scorecard dashboard with level breakdown per entity

**Plugin System**
- Plugin SDK (`@forgeportal/plugin-sdk`) with TypeScript types for UI tabs, cards, backend routes, and action providers
- Plugin CLI (`@forgeportal/cli`) with `create-forge-plugin` scaffolding and `forge sync` dependency management
- Dynamic plugin loading at API startup from `forgeportal.yaml`
- Plugin enable/disable via Admin UI with real-time reflection (no restart required)
- Admin panel for plugin management, integrations, permissions, and audit logs

**First-Party Plugins**
- `@forgeportal/plugin-kubernetes` — live Deployments, Pods, Services, Ingresses + pod log streaming + restart/scale actions
- `@forgeportal/plugin-argocd` — sync status, health, history + `argocd.syncApp@v1` and `argocd.rollbackApp@v1` template actions
- `@forgeportal/plugin-github-insights` — PRs, commits, contributors, GitHub Actions workflow runs (with in-memory TTL cache)
- `@forgeportal/plugin-grafana` — UI-only Grafana dashboard embed with time range controls and variable injection

**Authentication & RBAC**
- OIDC authentication (Keycloak, Auth0, Okta, GitHub OAuth, etc.)
- RBAC roles: `platform-admin`, `template-admin`, `viewer`
- Dev bypass login (`FORGEPORTAL_DEV_BYPASS_LOGIN=true`) for local development

**Observability**
- Prometheus metrics endpoint (`/metrics`) with HTTP request duration, action queue depth, scorecard evaluation time
- Structured JSON logging (Fastify / pino) with request IDs
- k6 load test baseline script

**Infrastructure**
- Helm chart for Kubernetes deployment with `values.yaml` reference
- Docker Compose stack for local development and production
- Docusaurus documentation site with Getting Started, Configuration Reference, Plugin Developer Guide, Deployment Guide, and Scorecard/Template authoring guides
- GitHub Actions CI/CD pipeline: lint, build, test, Docker image push to GHCR, npm publish to registry
- CodeQL security scanning and Dependabot dependency updates
- `CODEOWNERS` file for review assignment

**Developer Experience**
- Home dashboard at `/` with stats, recent activity, and quick action cards
- Global search in navbar with `Cmd+K` / `Ctrl+K` shortcut and keyboard navigation
- Setup checklist banner for first-time configuration

### Technical Stack

| Layer | Technology |
|-------|-----------|
| API | Fastify 5, Node.js 22, TypeScript |
| Worker | Node.js 22, TypeScript |
| UI | React 19, Vite 6, Tailwind CSS 4, TanStack Query 5 |
| Database | PostgreSQL 16 with FTS, GIN indexes, `pg_trgm` |
| Monorepo | pnpm workspaces + Turborepo |
| Docs | Docusaurus 3 |
| Containers | Docker, Docker Compose, Helm |

---

[Unreleased]: https://github.com/forgeportal/forgeportal/compare/v1.0.0...HEAD
[v1.0.0]: https://github.com/forgeportal/forgeportal/releases/tag/v1.0.0
