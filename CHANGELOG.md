# Changelog

All notable changes to ForgePortal are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

---

## [v1.3.0] - 2026-02-27

### Added

**Epic 13 — UI Theming & Branding**
- Portal white-labeling via `forgeportal.yaml` — rename the portal, replace the logo, change the brand color, set a custom favicon; all without code changes (Story 13-1)
- Custom navigation links (`ui.navLinks`) — pin up to 10 external links (runbooks, PagerDuty, Grafana, etc.) to the navbar and mobile drawer (Story 13-2)
- Dismissable announcement banner (`ui.announcement`) — show urgent notices above the navbar with three color variants: `info` (blue), `warning` (amber), `error` (red); dismissed per browser session via `sessionStorage` (Story 13-3)
- Dark mode toggle — sun/moon icon in the navbar; preference persisted in `localStorage`, defaults to OS `prefers-color-scheme`; anti-flash inline script in `index.html` prevents wrong-theme flash on load (Story 13-4)
- `GET /api/v1/config/branding` public endpoint — serves all branding config to the UI with no authentication required
- `useTheme` and `useBranding` React hooks for consuming theme and branding config

**Epic 12 — Golden Path Templates**
- `create-database` — provisions a PostgreSQL database on a target server via SSH, registers a `resource` entity and opens a GitHub PR (Story 12-1)
- `create-cache` — provisions a Redis cache instance, registers entity, opens PR (Story 12-2)
- `create-message-queue` — provisions a RabbitMQ queue, registers entity, opens PR (Story 12-3)
- `create-k8s-cluster` — generates a full Kubernetes cluster manifest bundle (Namespace, Deployment, Service, HPA, PodDisruptionBudget, NetworkPolicy, ServiceAccount) via `scm.pushSkeleton@v1` (Story 12-4)
- `create-monitoring-stack` — scaffolds a complete observability stack (Prometheus, Grafana, Alertmanager) with Kubernetes manifests (Story 12-5)
- `create-helm-chart` — generates a production-ready Helm chart with 11 skeleton files (Chart.yaml, values.yaml, deployment, service, ingress, HPA, ServiceAccount, ConfigMap, NOTES, helpers, tests) (Story 12-6)

### Fixed
- Action Runs table: corrected camelCase serialization and pagination (`pagination.total` vs `data.total`) for `GET /api/v1/action-runs`
- Catalog: added `development` and `staging` to `ENTITY_LIFECYCLES` enum
- Scaffolder: save entity annotations on `create-database` dogfood run; fix `updateStepOutput` type cast and scorecard `ON CONFLICT`
- Node.js service template: use `npm install` / `npm install --omit=dev` in CI and Dockerfile

### Documentation
- Added `ui-customization.md` — full reference for all branding and theming options (portal name, logo, favicon, primary color, nav links, announcement banner, dark mode)
- Updated `forgeportal-yaml.md` — `ui` section added as the 12th top-level key with field table, example, and link to UI Customization guide
- Updated `forgeportal.example.yaml` — `ui:` block with all options commented

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

[Unreleased]: https://github.com/forgeportal/forgeportal/compare/v1.3.0...HEAD
[v1.3.0]: https://github.com/forgeportal/forgeportal/compare/v1.2.0...v1.3.0
[v1.2.0]: https://github.com/forgeportal/forgeportal/compare/v1.1.0...v1.2.0
[v1.1.0]: https://github.com/forgeportal/forgeportal/compare/v1.0.0...v1.1.0
[v1.0.0]: https://github.com/forgeportal/forgeportal/releases/tag/v1.0.0
