---
title: Local Dev Setup
sidebar_position: 3
---

# Local Dev Setup

Three options depending on your setup. **Option A is recommended for first-time contributors** — zero install required.

---

## Option A — GitHub Codespaces (zero install, recommended)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/forgeportal/forgeportal)

**Requirements:** a GitHub account. That's it.

1. Click the badge above (or go to the repo → green **Code** button → **Codespaces** tab → **Create codespace on master**).
2. Wait ~2 minutes for the container to build and PostgreSQL to start.
3. The setup script runs automatically: migrations + demo data.
4. In the terminal, run:

```bash
pnpm dev
```

5. VS Code opens port forwarding automatically. Click **Open in Browser** for port `3000`.

:::tip Free tier
GitHub Codespaces is free for individuals up to 60 hours/month on a 2-core machine. That's plenty for contributing.
:::

---

## Option B — VS Code Dev Container (local, no Docker knowledge needed)

**Requirements:** VS Code + [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) + Docker Desktop.

1. Clone the repo and open it in VS Code.
2. VS Code shows a notification: **"Reopen in Container"** → click it.
3. Wait for the container to build (~2min first time, cached after).
4. The setup script runs automatically: PostgreSQL starts, migrations run, demo data loaded.
5. Run `pnpm dev` in the integrated terminal.

---

## Option C — Manual (Node.js + local PostgreSQL)

Use this if you prefer full control over your environment.

### Prerequisites

| Requirement | Version / notes |
|-------------|------------------|
| **Node.js** | 20+ (`engines.node: ">=20.19.0"`) |
| **pnpm** | 10+ (`packageManager: "pnpm@10.6.2"`) |
| **PostgreSQL** | 16 |
| **Git** | For cloning and entity discovery |

```bash
node --version   # v20.x or v22.x
pnpm --version   # 10.x
psql --version   # 16.x
```

### Clone and install

```bash
git clone https://github.com/forgeportal/forgeportal.git
cd forgeportal
pnpm install
cp .env.example .env   # then edit .env
```

### Database

**Option 1 — Docker for PostgreSQL only:**

```bash
cd deployments/docker-compose
docker compose up -d postgres
```

**Option 2 — Local PostgreSQL:**

```bash
createdb forgeportal_dev
```

Set DB env vars in `.env`:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=forgeportal_dev
DB_USER=postgres
DB_PASSWORD=postgres
ENCRYPTION_KEY=local-dev-key-change-in-prod-32chars!
```

### Run migrations

```bash
for f in tools/migration/*.sql; do
  psql -h localhost -U postgres -d forgeportal_dev -f "$f"
done
```

Seed demo data (optional):

```bash
psql -h localhost -U postgres -d forgeportal_dev -f tools/seed/seed_v1.sql
```

---

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
