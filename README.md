<div align="center">

# ⚡ ForgePortal

**The Internal Developer Portal that developers actually love.**

Open-source · Self-hosted · Ships in days, not months.

[![CI](https://github.com/forgeportal/forgeportal/actions/workflows/ci.yml/badge.svg)](https://github.com/forgeportal/forgeportal/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.19-brightgreen)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-10-orange)](pnpm-workspace.yaml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](tsconfig.base.json)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED)](deployments/docker-compose/docker-compose.yml)

</div>

---

## What is ForgePortal?

ForgePortal is an open-source Internal Developer Portal (IDP) built on **PostgreSQL, Fastify, React, and TypeScript**. It gives engineering organizations a single place to:

- **Discover** every service, library, API, and team in the catalog — auto-populated from GitHub and GitLab.
- **Scaffold** new services from golden-path templates that open PRs automatically.
- **Enforce quality standards** via Bronze/Silver/Gold scorecards with one-click fix actions.
- **Extend** the platform in minutes with a three-type plugin system and a CLI.

> ForgePortal draws inspiration from [Backstage](https://backstage.io) and deliberately simplifies everything that makes Backstage hard to operate.

| | ForgePortal | Backstage |
|---|---|---|
| Initial setup | < 5 min (`docker compose up`) | 2–4 hours |
| Plugin creation | < 2 min (`npx create-forge-plugin`) | 30–60 min |
| Dependencies | PostgreSQL + 2 services | Node, many plugins, Yarn |
| Scorecards + auto-fix PRs | Built-in | 3rd-party plugins |
| Config format | `forgeportal.yaml` (Zod-validated) | `app-config.yaml` |
| License | MIT | Apache 2.0 |

---

## Quick Start

```bash
git clone https://github.com/forgeportal/forgeportal
cd forgeportal
cp deployments/docker-compose/.env.example deployments/docker-compose/.env
cp forgeportal.example.yaml forgeportal.yaml   # configure discovery, plugins, scorecards
docker compose -f deployments/docker-compose/docker-compose.yml up
```

Open **http://localhost:3000** — your portal is live.

> By default the portal runs in **dev mode** (no login required — you are automatically logged in as admin). Add `OIDC_*` variables to enable SSO. See [OIDC Setup](apps/docs/docs/configuration/oidc-setup.md).

---

## Features

**Software Catalog**
Auto-discovers services from GitHub and GitLab via webhooks or scheduled scans. Every entity (`entity.yaml`) is versioned in your repo — ForgePortal just reads it.

**Templates & Scaffolding**
Golden-path templates with Handlebars interpolation that run multi-step actions: create repo, push skeleton, open PR, register entity, bootstrap CI. Every run is audited.

**Scorecards**
Bronze / Silver / Gold maturity levels for any service kind. Rules check README existence, CI config, docs, custom fields. Fix actions open PRs automatically — one click, not a ticket.

**Plugin System**
Three plugin types: UI (entity tab, card, or route), Backend (action handlers + Fastify routes), and Fullstack (both). One manifest file, one CLI command, no forking.

---

## Stack

| Layer | Technology |
|-------|-----------|
| API | [Fastify](https://fastify.dev) + TypeScript |
| Worker | Node.js process (PostgreSQL job queue) |
| UI | React 19 + Vite + TailwindCSS |
| Database | PostgreSQL 16 (FTS, SKIP LOCKED queue, advisory locks) |
| Auth | OIDC (Keycloak, Okta, Auth0, Azure AD, Cognito) |
| Monorepo | pnpm workspaces + Turborepo |
| Deployment | Docker Compose + Helm (Kubernetes) |

---

## Monorepo Structure

```
forgeportal/
├── apps/
│   ├── api/          # Fastify API server
│   ├── worker/       # Background job processor
│   ├── ui/           # React frontend
│   └── docs/         # Docusaurus documentation site
├── packages/
│   ├── core/         # Config, logger, errors, shared utilities
│   ├── auth/         # OIDC, session, RBAC, middleware
│   ├── catalog/      # Entity CRUD, scanner, webhooks, search
│   ├── scaffolder/   # Templates, action runner, audit log
│   ├── scorecards/   # Rule engine, evaluations, fix actions
│   ├── docs/         # Markdown renderer + FTS indexer
│   ├── scm/          # GitHub & GitLab provider adapters
│   ├── search/       # Unified search API
│   ├── db/           # PostgreSQL pool + job queue primitives
│   └── plugin-sdk/   # Plugin SDK types, hooks, PluginRegistry
├── tools/
│   ├── migration/    # SQL migration files
│   ├── seed/         # Development seed data
│   └── create-forge-plugin/  # Plugin scaffold CLI
├── deployments/
│   ├── docker-compose/       # Docker Compose stack
│   └── helm/                 # Helm chart for Kubernetes
└── docs/                     # Internal design specs (PRD, architecture)
```

---

## Local Development

**Prerequisites:** Node.js >= 20.19, pnpm 10, Docker (for PostgreSQL)

```bash
pnpm install
```

### Option A — Full Docker (zero setup)

```bash
docker compose -f deployments/docker-compose/docker-compose.yml up
```

All services run in containers — no local Node required.

### Option B — Native (faster, recommended for contributors)

```bash
# Starts Postgres in Docker, then all apps in TypeScript watch mode
pnpm dev:full
```

Hot-reload on every file save. Stop Postgres when done:

```bash
pnpm dev:stop
```

### Other useful commands

```bash
pnpm test    # run all tests
pnpm build   # build all packages
pnpm lint    # lint all packages
```

**Service ports:**

| Service | Port |
|---------|------|
| UI | 3000 |
| API | 4000 |
| PostgreSQL | 5433 (host) |
| Docs site (dev) | 3001 |

---

## Configuration

Copy the example config:
```bash
cp deployments/docker-compose/.env.example deployments/docker-compose/.env
```

Key variables:

| Variable | Description |
|----------|-------------|
| `OIDC_ISSUER` | OIDC provider discovery URL (leave empty for dev bypass) |
| `OIDC_CLIENT_ID` | OIDC client ID |
| `OIDC_CLIENT_SECRET` | OIDC client secret |
| `DB_PASSWORD` | PostgreSQL password |
| `ENCRYPTION_KEY` | 32-char key for encrypting stored secrets |
| `SCM_GITHUB_TOKEN` | GitHub personal access token |
| `SCM_GITLAB_TOKEN` | GitLab personal access token |

Full reference: [`forgeportal.yaml`](forgeportal.yaml) and the [Configuration docs](apps/docs/docs/configuration/forgeportal-yaml.md).

---

## Creating a Plugin

```bash
npx create-forge-plugin my-plugin --type ui
# → generates forge-plugin-my-plugin/ in the current directory
```

Then register it in `forgeportal.yaml`:
```yaml
pluginPackages:
  packages:
    - "@myorg/my-plugin"
```

Full guide: [Plugin Developer Guide](apps/docs/docs/plugin-development/overview.md).

---

## Deployment

**Docker Compose (production):**
See [Deployment Guide — Docker Compose](apps/docs/docs/deployment/docker-compose.md).

**Kubernetes with Helm:**
```bash
helm install forgeportal ./deployments/helm \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=forgeportal.example.com \
  --set externalDatabase.enabled=true \
  --set externalDatabase.host=my-db.example.com
```

See [Deployment Guide — Kubernetes/Helm](apps/docs/docs/deployment/kubernetes-helm.md).

---

## Documentation

The full documentation site lives at **`apps/docs/`** (Docusaurus 3) and is deployed to [docs.forgeportal.dev](https://docs.forgeportal.dev).

Run locally:
```bash
pnpm --filter @forgeportal/docs-site dev
# → http://localhost:3001
```

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md) before opening a PR.

For monorepo setup, scripts, migrations, and testing conventions, see [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md).

Internal design specs (PRD, architecture, threat model) are in [`docs/`](docs/).

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a full list of changes per release, or browse [GitHub Releases](https://github.com/forgeportal/forgeportal/releases).

## Security

Please report security issues privately — see [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
Built with TypeScript, PostgreSQL, and a lot of coffee.
</div>
