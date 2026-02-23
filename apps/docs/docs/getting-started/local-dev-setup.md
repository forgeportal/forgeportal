---
title: Local Dev Setup
sidebar_position: 3
---

# Local Dev Setup

Run ForgePortal from source with **pnpm** and a local **PostgreSQL** instance. Use this when you're developing the platform or contributing.

## Prerequisites

| Requirement | Version / notes |
|-------------|------------------|
| **Node.js** | 20+ (project uses `engines.node: ">=20.19.0"`) |
| **pnpm** | 10+ (monorepo uses pnpm workspaces; `packageManager: "pnpm@10.6.2"`) |
| **PostgreSQL** | 16 (e.g. `postgres:16-alpine` in Docker, or local 16) |
| **Git** | For cloning and entity discovery |

Check versions:

```bash
node --version   # v20.x or v22.x
pnpm --version   # 10.x
psql --version   # 16.x (if using local Postgres)
```

## Clone and install

```bash
git clone https://github.com/your-org/forgeportal.git
cd forgeportal
pnpm install
```

This installs dependencies for all workspace packages (core, catalog, api, ui, worker, docs, etc.).

## Database

You need a running PostgreSQL 16 with a database and user. Options:

1. **Use Docker Compose for Postgres only** — from repo root, run Postgres from the same Compose env:
   ```bash
   cd deployments/docker-compose
   docker compose up -d postgres
   ```
   Then point the app to `localhost` and the exposed port (e.g. `5433` if `DB_PORT_HOST=5433`).

2. **Local Postgres 16** — create a database and user:
   ```bash
   createdb forgeportal
   # Ensure user has access; set DB_HOST=localhost, DB_PORT=5432, DB_NAME=forgeportal, DB_USER=..., DB_PASSWORD=...
   ```

Set env vars (or a `.env` in the repo root if your tooling loads it):

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=forgeportal
export DB_USER=forge
export DB_PASSWORD=forge_local_dev
export ENCRYPTION_KEY=local-dev-key-change-in-prod-32chars!
```

Run migrations (from repo root, using the API or a migration script if you have one):

```bash
# If your project has a migrate script:
pnpm run migrate
# Or apply SQL manually from tools/migration/*.sql
```

## Run the stack in dev

From the **repo root**:

```bash
pnpm dev
```

This runs **Turborepo** in dev mode: it starts the API, Worker, and UI (and any other apps configured in `turbo.json`). Typical ports:

| Service | Port | URL |
|---------|------|-----|
| **UI** | 3000 | [http://localhost:3000](http://localhost:3000) |
| **API** | 4000 | [http://localhost:4000](http://localhost:4000) |

- **API health:** [http://localhost:4000/healthz](http://localhost:4000/healthz)
- **API metrics:** [http://localhost:4000/metrics](http://localhost:4000/metrics)

Without OIDC configured, the API runs in dev-mode; the UI may allow access without login (depending on your auth guard setup).

## Monorepo layout (short)

| Path | Role |
|------|------|
| `apps/api` | Fastify API server |
| `apps/ui` | React (Vite) frontend |
| `apps/worker` | Job runner + action runner |
| `apps/docs` | Docusaurus docs site |
| `packages/core` | Config, logger, shared utilities |
| `packages/catalog` | Entities, scan, webhooks |
| `packages/scaffolder` | Templates, actions, action runner |
| `packages/auth` | OIDC, RBAC, permissions |
| `tools/migration` | SQL migrations |
| `tools/seed` | Seed SQL |

## Useful commands

From **repo root**:

```bash
# Build all packages
pnpm build

# Run all tests
pnpm test

# Lint
pnpm lint

# Clean build artifacts
pnpm clean
```

Single package (examples):

```bash
# Run API tests only
pnpm --filter @forgeportal/api test

# Run UI dev (if not using turbo dev for everything)
pnpm --filter @forgeportal/ui dev

# Build docs site
pnpm --filter @forgeportal/docs-site build

# Serve docs site (Docusaurus)
pnpm --filter @forgeportal/docs-site dev
```

## Verification

1. Open [http://localhost:3000](http://localhost:3000) — UI loads.
2. Open [http://localhost:4000/healthz](http://localhost:4000/healthz) — returns `{"status":"ok","db":"connected"}` when DB is up.
3. (Optional) Create an entity and run a scan — see [Your first entity](/docs/getting-started/first-entity).

Next: [Your first entity](/docs/getting-started/first-entity) — add an `entity.yaml` to a repo and see it in the catalog.
